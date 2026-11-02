"""Country adapters must fail closed until wage and regulatory review completes."""
import uuid
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.errors import ApiError
from app.models import Job, Location
from app.schemas import JobIn, LocationIn
from app.services.jobs import apply_job_input
from app.services.jurisdictions import (
    MARKET_RULES,
    assert_job_market_ready,
    assess_nz_pay,
    market_for_country,
)


def test_unknown_nz_and_currency_mismatch_fail_closed():
    assert market_for_country(None) is None
    assert market_for_country("ZZ") is None
    assert MARKET_RULES["NZ"].publish_enabled is False
    assert MARKET_RULES["NZ"].currency == "NZD"
    for country, currency in [("NZ", "NZD"), (None, "AUD"), ("AU", "NZD")]:
        with pytest.raises(ApiError):
            assert_job_market_ready(country, currency)
    with pytest.raises(ApiError):
        assess_nz_pay(hourly_rate_minor=2400)
    assert assert_job_market_ready("AU", "AUD").code == "AU"


def test_explicit_au_venue_without_nz_onboarding():
    data = dict(name="Test Cafe", suburb="Fitzroy", state="VIC", postcode="3065")
    assert LocationIn(**data).country == "AU"
    with pytest.raises(ValidationError):
        LocationIn(**data, country="NZ")
    with pytest.raises(ValidationError):
        LocationIn(**data, country="ZZ")


def test_job_country_only_from_employer_owned_location():
    body = JobIn(title="Barista", description="Serve coffee", employment_type="casual")
    job = Job(employer_id=uuid.uuid4(), origin="direct", status="draft")
    apply_job_input(job, body, None)
    assert job.country_code is None
    venue = Location(
        id=uuid.uuid4(),
        employer_id=job.employer_id,
        name="Test Cafe",
        suburb="Fitzroy",
        state="VIC",
        postcode="3065",
        country="AU",
    )
    apply_job_input(job, body, venue)
    assert job.country_code == "AU"
    assert job.pay_currency == "AUD"


def test_pay_disclosure_requires_period():
    with pytest.raises(ValidationError):
        JobIn(
            title="Kitchen hand",
            description="Kitchen shift",
            employment_type="casual",
            pay_min=Decimal("23.00"),
            pay_period=None,
        )
