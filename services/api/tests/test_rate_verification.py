import uuid

import pytest
from sqlalchemy import select, text

from app.models import AuditEvent, AwardRateVersion, PenaltyRuleVersion
from tests.conftest import admin_headers, db_as, register_employer

V = "/v1/admin/awards"
NOTE = "Checked against the official pay guide effective that day"


@pytest.fixture
async def admin(client):
    return await admin_headers(client)


@pytest.fixture(autouse=True)
async def restore_reference_data():
    """Reference tables are not truncated between tests: leave every row as the seed loaded it."""
    yield
    async with db_as() as s:
        await s.execute(
            text(
                "update award_rate_versions set data_status='supplied_unverified', "
                "verified_by=null, verified_at=null where data_status='verified'"
            )
        )
        await s.execute(
            text(
                "update penalty_rule_versions set data_status='supplied_unverified', "
                "verified_by=null, verified_at=null where data_status='verified'"
            )
        )
        await s.commit()


async def _rate(client, admin, **q):
    rows = (await client.get(f"{V}/rate-versions", headers=admin, params=q)).json()
    assert rows
    return rows[0]


async def _rule(client, admin, **q):
    rows = (await client.get(f"{V}/penalty-rules", headers=admin, params=q)).json()
    assert rows
    return rows[0]


async def test_listings_show_what_a_checker_needs_and_nothing_is_verified_by_default(client, admin):
    rates = (await client.get(f"{V}/rate-versions", headers=admin)).json()
    rules = (await client.get(f"{V}/penalty-rules", headers=admin)).json()
    assert len(rates) == 33 and rules
    for r in rates:
        assert r["source_url"].startswith("https://") and r["source_note"]
        assert r["weekly_minor"] > 0 and isinstance(r["hourly_minor"], int)
        assert r["data_status"] == "supplied_unverified" and r["verified_at"] is None
    for r in rules:
        assert isinstance(r["multiplier_bp"], int) and r["classification_codes"]
        assert r["data_status"] == "supplied_unverified" and r["verified_by"] is None
    only = (
        await client.get(f"{V}/rate-versions", headers=admin, params={"data_status": "verified"})
    ).json()
    assert only == []


async def test_verifying_binds_to_the_figure_that_was_checked(client, admin):
    rate = await _rate(client, admin)
    path = f"{V}/rate-versions/{rate['id']}"
    wrong = await client.post(
        f"{path}/verify",
        headers=admin,
        json={"source_note": NOTE, "confirm_hourly_minor": rate["hourly_minor"] + 1},
    )
    assert wrong.status_code == 409 and wrong.json()["error"]["code"] == "figures_changed"
    assert (await _rate(client, admin))["data_status"] == "supplied_unverified"

    ok = await client.post(
        f"{path}/verify",
        headers=admin,
        json={"source_note": NOTE, "confirm_hourly_minor": rate["hourly_minor"]},
    )
    assert ok.status_code == 200 and ok.json()["data_status"] == "verified"
    shown = (await client.get(f"{V}/rate-versions", headers=admin)).json()
    row = next(r for r in shown if r["id"] == rate["id"])
    assert row["data_status"] == "verified" and row["verified_at"] and row["verified_by"]
    assert row["source_note"] == NOTE
    # The confirmation is required: a bare note (the old shape) is refused.
    bare = await client.post(f"{path}/verify", headers=admin, json={"source_note": NOTE})
    assert bare.status_code == 422


async def test_a_verified_row_cannot_be_silently_reverified_and_can_be_revoked(client, admin):
    rate = await _rate(client, admin)
    path = f"{V}/rate-versions/{rate['id']}"
    body = {"source_note": NOTE, "confirm_hourly_minor": rate["hourly_minor"]}
    assert (await client.post(f"{path}/verify", headers=admin, json=body)).status_code == 200
    again = await client.post(f"{path}/verify", headers=admin, json=body)
    assert again.status_code == 409 and again.json()["error"]["code"] == "already_verified"

    short = await client.post(f"{path}/revoke", headers=admin, json={"reason": "no"})
    assert short.status_code == 422
    gone = await client.post(
        f"{path}/revoke", headers=admin, json={"reason": "The guide was reissued; re-checking"}
    )
    assert gone.status_code == 200 and gone.json()["data_status"] == "supplied_unverified"
    async with db_as() as s:
        rv = await s.get(AwardRateVersion, uuid.UUID(rate["id"]))
        assert rv.verified_by is None and rv.verified_at is None
        assert rv.hourly_minor == rate["hourly_minor"]  # figures are never touched
    twice = await client.post(f"{path}/revoke", headers=admin, json={"reason": "Already revoked"})
    assert twice.status_code == 409 and twice.json()["error"]["code"] == "not_verified"


async def test_penalty_rules_follow_the_same_rules(client, admin):
    rule = await _rule(client, admin)
    path = f"{V}/penalty-rules/{rule['id']}"
    wrong = await client.post(
        f"{path}/verify",
        headers=admin,
        json={"source_note": NOTE, "confirm_multiplier_bp": rule["multiplier_bp"] + 500},
    )
    assert wrong.status_code == 409 and wrong.json()["error"]["code"] == "figures_changed"
    ok = await client.post(
        f"{path}/verify",
        headers=admin,
        json={"source_note": NOTE, "confirm_multiplier_bp": rule["multiplier_bp"]},
    )
    assert ok.status_code == 200
    verified = (
        await client.get(f"{V}/penalty-rules", headers=admin, params={"data_status": "verified"})
    ).json()
    assert [r["id"] for r in verified] == [rule["id"]]
    again = await client.post(
        f"{path}/verify",
        headers=admin,
        json={"source_note": NOTE, "confirm_multiplier_bp": rule["multiplier_bp"]},
    )
    assert again.status_code == 409
    revoked = await client.post(
        f"{path}/revoke", headers=admin, json={"reason": "Rule wording was ambiguous"}
    )
    assert revoked.status_code == 200
    async with db_as() as s:
        row = await s.get(PenaltyRuleVersion, uuid.UUID(rule["id"]))
        assert row.data_status == "supplied_unverified" and row.verified_by is None


async def test_unknown_ids_404_and_non_admins_cannot_list_verify_or_revoke(client, admin):
    emp, _ = await register_employer(client, "rate-ver@nua-crew.example.com")
    rate = await _rate(client, admin)
    ghost = "00000000-0000-0000-0000-000000000000"
    for url, body in (
        (f"{V}/rate-versions/{ghost}/verify", {"source_note": NOTE, "confirm_hourly_minor": 1}),
        (f"{V}/rate-versions/{ghost}/revoke", {"reason": "Nothing to revoke here"}),
        (f"{V}/penalty-rules/{ghost}/verify", {"source_note": NOTE, "confirm_multiplier_bp": 5000}),
        (f"{V}/penalty-rules/{ghost}/revoke", {"reason": "Nothing to revoke here"}),
    ):
        assert (await client.post(url, headers=admin, json=body)).status_code == 404
    for headers in (emp, {}):
        assert (await client.get(f"{V}/penalty-rules", headers=headers)).status_code in (401, 403)
        for suffix, body in (
            ("verify", {"source_note": NOTE, "confirm_hourly_minor": rate["hourly_minor"]}),
            ("revoke", {"reason": "Trying to withdraw it"}),
        ):
            r = await client.post(
                f"{V}/rate-versions/{rate['id']}/{suffix}", headers=headers, json=body
            )
            assert r.status_code in (401, 403)
    assert (await _rate(client, admin))["data_status"] == "supplied_unverified"


async def test_verification_and_revocation_are_audited_with_the_figure_and_reason(client, admin):
    rate = await _rate(client, admin)
    path = f"{V}/rate-versions/{rate['id']}"
    await client.post(
        f"{path}/verify",
        headers=admin,
        json={"source_note": NOTE, "confirm_hourly_minor": rate["hourly_minor"]},
    )
    await client.post(f"{path}/revoke", headers=admin, json={"reason": "Found a typo in my check"})
    async with db_as() as s:
        events = {
            e.action: e.meta
            for e in await s.scalars(
                select(AuditEvent).where(
                    AuditEvent.entity_type == "rate_version", AuditEvent.entity_id == rate["id"]
                )
            )
        }
    assert events["award.rate_verified"]["hourly_minor"] == rate["hourly_minor"]
    assert events["award.rate_verification_revoked"]["reason"] == "Found a typo in my check"
