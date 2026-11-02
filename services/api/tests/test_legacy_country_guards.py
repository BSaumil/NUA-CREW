"""Old AU-only routes must reject explicit NZ data, not silently ignore it."""

from copy import deepcopy

import pytest
from pydantic import ValidationError

from app.schemas import CandidateRegister, EmployerRegister, JobIn, LocationIn, ProfileIn


@pytest.mark.parametrize("country_key", ["country", "country_code", "workplace_country_code"])
def test_legacy_location_rejects_explicit_nz_country(country_key: str) -> None:
    body = {"name": "Test Venue", "suburb": "Fitzroy", "state": "VIC", "postcode": "3065"}
    body[country_key] = "NZ"
    with pytest.raises(ValidationError, match="Australia only"):
        LocationIn.model_validate(body)


def test_legacy_location_accepts_existing_au_request() -> None:
    result = LocationIn(name="Test Venue", suburb="Fitzroy", state="VIC", postcode="3065")
    assert result.country == "AU"
    assert result.model_dump()["country"] == "AU"


def test_employer_registration_does_not_create_au_account_for_nz() -> None:
    body = {
        "email": "owner@example.com",
        "password": "correct-horse-battery",
        "full_name": "Owner",
        "organisation_name": "Test Venue",
        "accept_terms": True,
    }
    assert EmployerRegister.model_validate(body).country_code == "AU"

    for key in ("country_code", "legal_entity_country_code"):
        altered = {**body, key: "NZ"}
        with pytest.raises(ValidationError, match="Australia only"):
            EmployerRegister.model_validate(altered)

    with pytest.raises(ValidationError, match="Australia only"):
        EmployerRegister.model_validate(
            {
                **body,
                "location": {
                    "name": "Test Venue",
                    "suburb": "Auckland",
                    "state": "VIC",
                    "postcode": "1010",
                    "country": "NZ",
                },
            }
        )


@pytest.mark.parametrize(
    "field,value",
    [
        ("country", "NZ"),
        ("country_code", "NZ"),
        ("workplace_country_code", "NZ"),
        ("pay_currency", "NZD"),
    ],
)
def test_job_input_rejects_nz_on_au_route(field: str, value: str) -> None:
    body = {
        "title": "Barista",
        "description": "Serve customers and make coffee.",
        "employment_type": "casual",
    }
    assert JobIn.model_validate(body).workplace_country_code is None
    altered = deepcopy(body)
    altered[field] = value
    with pytest.raises(ValidationError, match="only"):
        JobIn.model_validate(altered)


@pytest.mark.parametrize(
    "schema,data",
    [
        (
            CandidateRegister,
            {
                "email": "applicant@example.com",
                "password": "correct-horse-battery",
                "full_name": "Candidate",
                "accept_terms": True,
            },
        ),
        (ProfileIn, {"full_name": "Candidate"}),
    ],
)
def test_nz_profile_hints_are_not_silently_ignored(schema: type, data: dict) -> None:
    with pytest.raises(ValidationError, match="Australia only"):
        schema.model_validate({**data, "country_code": "NZ"})
