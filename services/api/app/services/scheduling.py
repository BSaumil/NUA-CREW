"""Explicit scheduling instants and timesheet arithmetic; no payroll or award inference."""

from datetime import UTC, date, datetime, time, timedelta

from app.services.availability import zone


def resolve_instant(d: date, t: time, time_zone: str) -> datetime:
    tz = zone(time_zone)
    if t.tzinfo:
        raise ValueError("Use a local time without an offset")
    wall = datetime.combine(d, t)
    options = set()
    for fold in (0, 1):
        value = wall.replace(tzinfo=tz, fold=fold).astimezone(UTC)
        if value.astimezone(tz).replace(tzinfo=None) == wall:
            options.add(value)
    if len(options) != 1:
        raise ValueError("That time is skipped or repeated by daylight saving; choose another time")
    return options.pop()


def resolve_window(day: date, start: time, end: time, time_zone: str) -> tuple[datetime, datetime]:
    if start.tzinfo or end.tzinfo or start == end:
        raise ValueError("Use distinct local start and end times without offsets")

    a = resolve_instant(day, start, time_zone)
    b = resolve_instant(day + timedelta(days=int(end < start)), end, time_zone)
    if not timedelta(0) < b - a <= timedelta(hours=24):
        raise ValueError("A shift must last between zero and 24 elapsed hours")
    return a, b


def worked_minutes(start: datetime, end: datetime, break_minutes: int) -> int:
    if start.utcoffset() is None or end.utcoffset() is None:
        raise ValueError("Times must include a UTC offset")
    elapsed = (end.astimezone(UTC) - start.astimezone(UTC)).total_seconds()
    if elapsed <= 0 or elapsed > 24 * 3600 or elapsed % 60:
        raise ValueError("Use whole-minute times lasting up to 24 hours")
    if not 0 <= break_minutes < elapsed // 60:
        raise ValueError("Breaks must be shorter than the worked interval")
    return int(elapsed // 60) - break_minutes
