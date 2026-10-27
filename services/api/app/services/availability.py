"""Availability evaluation. Pure functions: no database, no clock.

Model
- Recurring rules are wall-clock windows in the worker's IANA time zone ("Tuesday 17:00-23:00").
  end <= start means the window runs overnight into the next day. A weekday may have many windows
  (a split shift or a break is simply a gap between two windows).
- Exceptions are dated overrides in the same local time (all day or a time window). An
  `unavailable` exception always wins over anything that would make the worker available.
- Commitments are UTC instants (held or confirmed). Applications never create one.
- A question is always an absolute UTC interval [start, end).

Answers (see AVAILABILITY_STATES):
- confirmed / held: overlaps a commitment of that status (confirmed wins).
- unavailable: overlaps an unavailable exception, or the worker has declared availability and this
  interval is not covered by it.
- available: wholly covered by recurring windows and/or available exceptions.
- unknown: the worker has declared no availability at all (and nothing blocks the interval).
  Missing data is never read as availability.
`offered` is reserved for a future messaging/offer flow and is never produced here.

DST: local wall-clock times are converted with zoneinfo (fold=0). A time that does not exist
(spring forward) moves to the first valid instant after the gap; a repeated hour (fall back)
resolves to its first occurrence. A 22:00-06:00 window on a changeover night therefore lasts 9 or
7 real hours, which matches what the clock on the wall says.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

Interval = tuple[datetime, datetime]


@dataclass(frozen=True)
class Rule:
    weekday: int  # Monday = 0
    start: time
    end: time


@dataclass(frozen=True)
class DayException:
    state: str  # "available" | "unavailable"
    start_date: date
    end_date: date
    start: time | None = None  # None = all day
    end: time | None = None


@dataclass(frozen=True)
class Busy:
    starts_at: datetime
    ends_at: datetime
    status: str  # "held" | "confirmed"


@dataclass(frozen=True)
class Result:
    state: str
    reason: str


def zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError) as e:
        raise ValueError(f"Unknown time zone: {name}") from e


def _at(tz: ZoneInfo, d: date, t: time) -> datetime:
    return datetime.combine(d, t, tzinfo=tz).astimezone(UTC)


def _window(tz: ZoneInfo, d: date, start: time, end: time) -> Interval:
    end_day = d + timedelta(days=1) if end <= start else d
    return _at(tz, d, start), _at(tz, end_day, end)


def _days(lo: datetime, hi: datetime, tz: ZoneInfo) -> Iterable[date]:
    d = lo.astimezone(tz).date() - timedelta(days=1)  # an overnight window may start yesterday
    last = hi.astimezone(tz).date()
    while d <= last:
        yield d
        d += timedelta(days=1)


def rule_windows(tz: ZoneInfo, rules: Sequence[Rule], lo: datetime, hi: datetime) -> list[Interval]:
    return [
        _window(tz, d, r.start, r.end)
        for d in _days(lo, hi, tz)
        for r in rules
        if r.weekday == d.weekday()
    ]


def exception_windows(
    tz: ZoneInfo, exceptions: Sequence[DayException], lo: datetime, hi: datetime
) -> list[tuple[str, Interval]]:
    out: list[tuple[str, Interval]] = []
    for d in _days(lo, hi, tz):
        for x in exceptions:
            if not (x.start_date <= d <= x.end_date):
                continue
            if x.start is None or x.end is None:
                out.append(
                    (x.state, (_at(tz, d, time(0)), _at(tz, d + timedelta(days=1), time(0))))
                )
            else:
                out.append((x.state, _window(tz, d, x.start, x.end)))
    return out


def merge(intervals: Iterable[Interval]) -> list[Interval]:
    out: list[Interval] = []
    for s, e in sorted(i for i in intervals if i[0] < i[1]):
        if out and s <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], e))
        else:
            out.append((s, e))
    return out


def _overlaps(a: Interval, b: Interval) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def evaluate(
    *,
    time_zone: str,
    rules: Sequence[Rule],
    exceptions: Sequence[DayException],
    busy: Sequence[Busy],
    start: datetime,
    end: datetime,
    buffer: timedelta = timedelta(0),
) -> Result:
    if start.tzinfo is None or end.tzinfo is None:
        raise ValueError("start and end must be timezone-aware")
    if end <= start:
        raise ValueError("end must be after start")
    start, end = start.astimezone(UTC), end.astimezone(UTC)
    tz = zone(time_zone)
    ask = (start, end)
    near = (start - buffer, end + buffer)  # travel/turnaround buffer applies to commitments only

    clash = [b for b in busy if _overlaps(near, (b.starts_at, b.ends_at))]
    if any(b.status == "confirmed" for b in clash):
        return Result("confirmed", "Already committed to confirmed work in this time")
    if clash:
        return Result("held", "Time is being held for another booking")

    # Look a day either side so overnight windows and local-midnight boundaries are complete.
    lo, hi = start - timedelta(days=1), end + timedelta(days=1)
    day_x = exception_windows(tz, exceptions, lo, hi)
    if any(s == "unavailable" and _overlaps(ask, w) for s, w in day_x):
        return Result("unavailable", "Marked unavailable for part or all of this time")

    available = merge(
        [*rule_windows(tz, rules, lo, hi), *(w for s, w in day_x if s == "available")]
    )
    if any(w[0] <= start and end <= w[1] for w in available):
        return Result("available", "Within declared availability")
    declared = bool(rules) or any(x.state == "available" for x in exceptions)
    if not declared:
        return Result("unknown", "No availability has been shared")
    return Result("unavailable", "Outside declared availability")


def weekly_hours(rules: Sequence[Rule]) -> float:
    """Nominal hours in a normal week by the wall clock (DST changeovers ignored)."""
    total = 0.0
    for r in rules:
        s = r.start.hour * 60 + r.start.minute
        e = r.end.hour * 60 + r.end.minute
        total += ((e - s) % 1440 or 1440) / 60
    return total


def overlapping_rules(rules: Sequence[Rule]) -> bool:
    """True if any two weekly windows overlap, including overnight spill into the next day."""
    week = 7 * 1440
    spans: list[tuple[int, int]] = []
    for r in rules:
        s = r.weekday * 1440 + r.start.hour * 60 + r.start.minute
        length = ((r.end.hour * 60 + r.end.minute) - (r.start.hour * 60 + r.start.minute)) % 1440
        spans.append((s, s + (length or 1440)))
    for i, a in enumerate(spans):
        for b in spans[i + 1 :]:
            for shift in (0, week, -week):
                if a[0] < b[1] + shift and b[0] + shift < a[1]:
                    return True
    return False
