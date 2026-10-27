"""Pure availability logic, including Melbourne DST and overnight windows (no database needed)."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.services.availability import (
    Busy,
    DayException,
    Rule,
    evaluate,
    overlapping_rules,
    weekly_hours,
)

MEL = ZoneInfo("Australia/Melbourne")
MON, TUE, SAT, SUN = 0, 1, 5, 6


def local(y: int, m: int, d: int, hh: int, mm: int = 0) -> datetime:
    return datetime(y, m, d, hh, mm, tzinfo=MEL)


def ask(rules, start, end, exceptions=(), busy=(), buffer=timedelta(0)):
    return evaluate(
        time_zone="Australia/Melbourne",
        rules=rules,
        exceptions=exceptions,
        busy=busy,
        start=start,
        end=end,
        buffer=buffer,
    ).state


def test_multiple_windows_per_day_with_a_break():
    rules = [Rule(TUE, time(9), time(12)), Rule(TUE, time(14), time(18))]
    tue = (2026, 11, 3)  # a Tuesday
    assert ask(rules, local(*tue, 9), local(*tue, 12)) == "available"
    assert ask(rules, local(*tue, 14), local(*tue, 17)) == "available"
    assert ask(rules, local(*tue, 11), local(*tue, 15)) == "unavailable"  # spans the break
    assert ask(rules, local(*tue, 12), local(*tue, 14)) == "unavailable"


def test_overnight_window_covers_both_sides_of_midnight():
    rules = [Rule(SAT, time(22), time(6))]
    assert ask(rules, local(2026, 11, 7, 23), local(2026, 11, 8, 5)) == "available"  # Sat -> Sun
    assert ask(rules, local(2026, 11, 8, 1), local(2026, 11, 8, 3)) == "available"  # Sunday morning
    assert ask(rules, local(2026, 11, 8, 5), local(2026, 11, 8, 7)) == "unavailable"
    assert ask(rules, local(2026, 11, 7, 21), local(2026, 11, 7, 23)) == "unavailable"


def test_saturday_shift_ending_sunday_across_dst_start():
    # DST began Sunday 4 Oct 2026 at 02:00 (clocks to 03:00): this Sat 22:00 - Sun 06:00 is 7 real hours.
    rules = [Rule(SAT, time(22), time(6))]
    start = local(2026, 10, 3, 22)
    end = local(2026, 10, 4, 6)
    assert (end.astimezone(UTC) - start.astimezone(UTC)) == timedelta(hours=7)  # real elapsed
    assert ask(rules, start, end) == "available"
    assert ask(rules, start, end + timedelta(hours=1)) == "unavailable"


def test_saturday_shift_ending_sunday_across_dst_end():
    # DST ends Sunday 4 Apr 2027 at 03:00 (clocks back to 02:00): 9 real hours that night.
    rules = [Rule(SAT, time(22), time(6))]
    start = local(2027, 4, 3, 22)
    end = datetime(2027, 4, 3, 20, 0, tzinfo=UTC)  # 06:00 AEST = 20:00Z
    assert (end - start) == timedelta(hours=9)
    assert ask(rules, start, end) == "available"
    assert ask(rules, start, end + timedelta(minutes=1)) == "unavailable"


def test_wall_clock_time_that_does_not_exist_moves_forward():
    # 02:30 does not exist on 4 Oct 2026 in Melbourne; the window starts at the first valid instant.
    rules = [Rule(SUN, time(2, 30), time(4))]
    assert ask(rules, local(2026, 10, 4, 4) - timedelta(minutes=30), local(2026, 10, 4, 4)) == (
        "available"
    )
    assert ask(rules, local(2026, 10, 4, 4) - timedelta(minutes=60), local(2026, 10, 4, 4)) == (
        "unavailable"
    )


def test_repeated_hour_resolves_to_first_occurrence():
    # 02:30 happens twice on 4 Apr 2027; rule 02:30-03:30 starts at the first one.
    rules = [Rule(SUN, time(2, 30), time(3, 30))]
    first_230 = datetime(2027, 4, 3, 15, 30, tzinfo=UTC)  # 02:30 AEDT
    assert ask(rules, first_230, first_230 + timedelta(minutes=30)) == "available"


def test_explicit_unavailable_exception_overrides_recurring_availability():
    rules = [Rule(TUE, time(9), time(17))]
    tue = (2026, 11, 3)
    x = [DayException("unavailable", date(*tue), date(*tue))]
    assert ask(rules, local(*tue, 10), local(*tue, 12), exceptions=x) == "unavailable"
    nxt = (2026, 11, 10)
    assert ask(rules, local(*nxt, 10), local(*nxt, 12), exceptions=x) == "available"


def test_partial_day_unavailable_exception_only_blocks_its_window():
    rules = [Rule(TUE, time(9), time(17))]
    tue = (2026, 11, 3)
    x = [DayException("unavailable", date(*tue), date(*tue), time(12), time(13))]
    assert ask(rules, local(*tue, 9), local(*tue, 12), exceptions=x) == "available"
    assert ask(rules, local(*tue, 12), local(*tue, 14), exceptions=x) == "unavailable"


def test_temporary_available_exception_adds_a_window_without_recurring_rules():
    x = [DayException("available", date(2026, 11, 14), date(2026, 11, 15))]
    assert ask([], local(2026, 11, 14, 9), local(2026, 11, 14, 17), exceptions=x) == "available"
    # a different day: availability was shared, but not for this day
    assert ask([], local(2026, 11, 16, 9), local(2026, 11, 16, 17), exceptions=x) == "unavailable"


def test_no_availability_data_is_unknown_never_available():
    assert ask([], local(2026, 11, 3, 9), local(2026, 11, 3, 17)) == "unknown"
    only_blocks = [DayException("unavailable", date(2026, 12, 25), date(2026, 12, 26))]
    # a blocked Christmas tells us nothing about a normal Tuesday
    assert (
        ask([], local(2026, 11, 3, 9), local(2026, 11, 3, 17), exceptions=only_blocks) == "unknown"
    )
    assert ask([], local(2026, 12, 25, 9), local(2026, 12, 25, 17), exceptions=only_blocks) == (
        "unavailable"
    )


def test_confirmed_commitment_blocks_but_held_is_reported_distinctly():
    rules = [Rule(TUE, time(9), time(17))]
    tue = (2026, 11, 3)
    s, e = local(*tue, 10), local(*tue, 12)
    held = Busy(s, e, "held")
    confirmed = Busy(s, e, "confirmed")
    assert ask(rules, s, e, busy=[held]) == "held"
    assert ask(rules, s, e, busy=[confirmed]) == "confirmed"
    assert ask(rules, s, e, busy=[held, confirmed]) == "confirmed"
    # back-to-back is fine without a buffer, a clash with one
    nxt = (local(*tue, 12), local(*tue, 14))
    assert ask(rules, *nxt, busy=[confirmed]) == "available"
    assert ask(rules, *nxt, busy=[confirmed], buffer=timedelta(minutes=30)) == "confirmed"


def test_commitment_overrides_unknown():
    s, e = local(2026, 11, 3, 10), local(2026, 11, 3, 12)
    assert ask([], s, e, busy=[Busy(s, e, "confirmed")]) == "confirmed"


def test_naive_datetimes_and_inverted_ranges_are_rejected():
    with pytest.raises(ValueError):
        evaluate(
            time_zone="Australia/Melbourne",
            rules=[],
            exceptions=[],
            busy=[],
            start=datetime(2026, 1, 1, 9),
            end=datetime(2026, 1, 1, 10),
        )
    with pytest.raises(ValueError):
        ask([], local(2026, 1, 1, 10), local(2026, 1, 1, 9))
    with pytest.raises(ValueError):
        evaluate(
            time_zone="Mars/Olympus",
            rules=[],
            exceptions=[],
            busy=[],
            start=local(2026, 1, 1, 9),
            end=local(2026, 1, 1, 10),
        )


def test_weekly_hours_and_overlap_detection():
    rules = [Rule(TUE, time(9), time(12)), Rule(SAT, time(22), time(6))]
    assert weekly_hours(rules) == 3 + 8
    assert not overlapping_rules(rules)
    assert overlapping_rules([Rule(TUE, time(9), time(12)), Rule(TUE, time(11), time(13))])
    # Saturday overnight spills into Sunday morning
    assert overlapping_rules([Rule(SAT, time(22), time(6)), Rule(SUN, time(5), time(8))])
    # Sunday overnight wraps into Monday
    assert overlapping_rules([Rule(SUN, time(22), time(6)), Rule(MON_, time(5), time(8))])
    assert not overlapping_rules([Rule(TUE, time(9), time(12)), Rule(TUE, time(12), time(13))])


MON_ = 0
