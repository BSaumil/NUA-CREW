"""The API refuses registration unless the owner has opened it, whatever the web UI says."""

import httpx
import pytest

from app.config import Settings, get_settings
from tests.conftest import PASSWORD, next_abn


def _set(monkeypatch: pytest.MonkeyPatch, **values: object) -> None:
    # Patch the cached settings object (as the other tests do) so other patches stay in place.
    for name, value in values.items():
        monkeypatch.setattr(get_settings(), name, value)


def _candidate(email: str) -> dict:
    return {"email": email, "password": PASSWORD, "full_name": "Gate Test", "accept_terms": True}


def _employer(email: str) -> dict:
    return {
        "abn": next_abn(),
        "email": email,
        "password": PASSWORD,
        "full_name": "Gate Owner",
        "organisation_name": "Gate Cafe",
        "location": {"name": "Main", "suburb": "Fitzroy", "state": "VIC", "postcode": "3065"},
        "accept_terms": True,
    }


def test_unset_means_closed_for_both_roles(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NUA_CANDIDATE_REGISTRATION", raising=False)
    monkeypatch.delenv("NUA_EMPLOYER_REGISTRATION", raising=False)
    s = Settings(_env_file=None)
    assert s.candidate_registration == "closed"
    assert s.employer_registration == "closed"
    assert s.registration_allowlist == []


async def test_closed_refuses_direct_requests(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _set(monkeypatch, candidate_registration="closed", employer_registration="closed")
    for path, body in (
        ("/v1/auth/register/candidate", _candidate("closed-c@nua-crew.example.com")),
        ("/v1/auth/register/employer", _employer("closed-e@nua-crew.example.com")),
    ):
        r = await client.post(path, json=body)
        assert r.status_code == 403, r.text
        assert r.json()["error"]["code"] == "registration_closed"
    # Nothing was created: the same address still cannot log in.
    login = await client.post(
        "/v1/auth/login", json={"email": "closed-c@nua-crew.example.com", "password": PASSWORD}
    )
    assert login.status_code == 401


async def test_roles_are_switched_separately(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _set(monkeypatch, candidate_registration="open", employer_registration="closed")
    ok = await client.post(
        "/v1/auth/register/candidate", json=_candidate("sep-c@nua-crew.example.com")
    )
    assert ok.status_code == 201, ok.text
    no = await client.post(
        "/v1/auth/register/employer", json=_employer("sep-e@nua-crew.example.com")
    )
    assert no.status_code == 403


async def test_allowlist_accepts_only_listed_addresses_and_domains(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _set(
        monkeypatch,
        candidate_registration="allowlist",
        employer_registration="allowlist",
        registration_allowlist=["Pilot.One@nua-crew.example.com", "@pilot.example.org"],
    )
    exact = await client.post(
        "/v1/auth/register/candidate", json=_candidate("pilot.one@NUA-CREW.example.com")
    )
    assert exact.status_code == 201, exact.text
    domain = await client.post(
        "/v1/auth/register/employer", json=_employer("boss@pilot.example.org")
    )
    assert domain.status_code == 201, domain.text
    for email in (
        "stranger@nua-crew.example.com",
        "x@evilpilot.example.org",
        "x@pilot.example.org.evil.com",
        "pilot.one@nua-crew.example.com.evil.com",
    ):
        r = await client.post("/v1/auth/register/candidate", json=_candidate(email))
        assert r.status_code == 403, email


async def test_allowlist_with_no_entries_admits_nobody(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _set(monkeypatch, candidate_registration="allowlist", registration_allowlist=[])
    r = await client.post(
        "/v1/auth/register/candidate", json=_candidate("any@nua-crew.example.com")
    )
    assert r.status_code == 403


async def test_closed_registration_does_not_block_login(
    client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    ok = await client.post(
        "/v1/auth/register/candidate", json=_candidate("existing@nua-crew.example.com")
    )
    assert ok.status_code == 201
    _set(monkeypatch, candidate_registration="closed")
    login = await client.post(
        "/v1/auth/login", json={"email": "existing@nua-crew.example.com", "password": PASSWORD}
    )
    assert login.status_code == 200
