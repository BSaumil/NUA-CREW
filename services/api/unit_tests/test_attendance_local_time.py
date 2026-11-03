from datetime import UTC, date, datetime, time

import pytest
from pydantic import ValidationError

from app.services.scheduling import resolve_instant
from app.shift_schemas import CorrectionIn


def test_venue_local_instant_is_independent_of_the_device_time_zone():
    assert resolve_instant(date(2026, 10, 30), time(12), "Australia/Melbourne") == datetime(
        2026, 10, 30, 1, tzinfo=UTC
    )


@pytest.mark.parametrize("day", [date(2026, 4, 5), date(2026, 10, 4)])
def test_repeated_and_skipped_dst_correction_times_are_refused(day):
    with pytest.raises(ValueError, match="skipped or repeated"):
        resolve_instant(day, time(2, 30), "Australia/Melbourne")


def test_correction_accepts_one_time_representation_only():
    local = {
        "claim_kind": "check_in",
        "local_date": "2026-10-30",
        "local_time": "12:00",
        "reason": "Arrived early",
    }
    assert CorrectionIn(**local).claimed_at is None
    for patch in (
        {"claimed_at": "2026-10-30T01:00:00Z"},
        {"local_date": None},
        {"local_time": None},
    ):
        with pytest.raises(ValidationError):
            CorrectionIn(**{**local, **patch})
