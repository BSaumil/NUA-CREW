from datetime import UTC, date, datetime, time, timedelta

import pytest

from app.services.scheduling import resolve_window, worked_minutes


def test_overnight_and_dst_elapsed_hours():
    start, end = resolve_window(date(2026, 10, 3), time(22), time(6), "Australia/Melbourne")
    assert end - start == timedelta(hours=7)  # clocks move forward overnight
    start, end = resolve_window(date(2027, 4, 3), time(22), time(6), "Australia/Melbourne")
    assert end - start == timedelta(hours=9)


@pytest.mark.parametrize("day", [date(2026, 10, 4), date(2027, 4, 4)])
def test_nonexistent_and_repeated_local_times_are_not_silently_guessed(day):
    with pytest.raises(ValueError, match="daylight saving"):
        resolve_window(day, time(2, 30), time(5), "Australia/Melbourne")


def test_timesheet_minutes_use_actual_instants_and_validate_breaks():
    start = datetime(2027, 1, 1, 9, tzinfo=UTC)
    assert worked_minutes(start, start + timedelta(hours=4), 30) == 210
    for end, pause in [
        (start, 0),
        (start + timedelta(hours=2), 120),
        (start + timedelta(seconds=61), 0),
    ]:
        with pytest.raises(ValueError):
            worked_minutes(start, end, pause)
