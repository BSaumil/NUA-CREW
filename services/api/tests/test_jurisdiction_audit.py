"""Country provenance is explicitly non-authoritative until manually reviewed."""

import pytest

from app.jurisdiction_audit import EvidenceState, review_legacy_job


@pytest.mark.parametrize(
    ("location", "currency", "expected_state", "proposed"),
    [
        (None, "AUD", EvidenceState.MISSING_WORKPLACE, None),
        ("", "AUD", EvidenceState.MISSING_WORKPLACE, None),
        ("GB", "GBP", EvidenceState.UNCONFIGURED_WORKPLACE, None),
        ("AU", None, EvidenceState.MISSING_CURRENCY, "AU"),
        ("AU", "NZD", EvidenceState.CURRENCY_CONFLICT, "AU"),
        ("NZ", "AUD", EvidenceState.CURRENCY_CONFLICT, "NZ"),
        ("AU", "AUD", EvidenceState.CONSISTENT_UNVERIFIED, "AU"),
        ("NZ", "NZD", EvidenceState.CONSISTENT_UNVERIFIED, "NZ"),
    ],
)
def test_legacy_jobs_never_auto_backfill(
    location: str | None,
    currency: str | None,
    expected_state: EvidenceState,
    proposed: str | None,
) -> None:
    evidence = review_legacy_job(location_country=location, pay_currency=currency)
    assert evidence.state == expected_state
    assert evidence.candidate_country == proposed
    assert evidence.eligible_for_automatic_backfill is False
