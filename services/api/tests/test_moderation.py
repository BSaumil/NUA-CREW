import uuid

from sqlalchemy import select

from app.models import AuditEvent, MessageReport
from tests.conftest import admin_headers, db_as, register_candidate, register_employer
from tests.test_invitations import accept, body, send, setup_pair


async def report_row(conversation_id=None):
    async with db_as("system") as session:
        report = MessageReport(
            conversation_id=conversation_id,
            reporter_role="candidate",
            reason="Unwanted messages",
            excerpt="Private reported words",
        )
        session.add(report)
        await session.flush()
        result = str(report.id)
        await session.commit()
        return result


async def test_only_admin_can_view_or_review_reports(client):
    rid = await report_row()
    candidate = await register_candidate(client, "moderation-candidate@nua-crew.example.com")
    employer, _ = await register_employer(client, "moderation-employer@nua-crew.example.com")
    for headers, status in [({}, 401), (candidate, 403), (employer, 403)]:
        assert (
            await client.get("/v1/admin/message-reports", headers=headers)
        ).status_code == status
        r = await client.post(
            f"/v1/admin/message-reports/{rid}/review",
            headers=headers,
            json={"outcome": "resolved", "reason_code": "spam"},
        )
        assert r.status_code == status


async def test_review_is_terminal_and_audited_without_copying_excerpt(client):
    rid = await report_row()
    headers = await admin_headers(client)
    rows = (await client.get("/v1/admin/message-reports", headers=headers)).json()
    assert len(rows) == 1 and rows[0]["id"] == rid
    assert rows[0]["excerpt"] == "Private reported words"
    url = f"/v1/admin/message-reports/{rid}/review"
    payload = {"outcome": "dismissed", "reason_code": "no_violation"}
    r = await client.post(url, headers=headers, json=payload)
    assert r.status_code == 200 and r.json()["status"] == "closed"
    assert (await client.post(url, headers=headers, json=payload)).status_code == 409
    assert (await client.get("/v1/admin/message-reports", headers=headers)).json() == []
    async with db_as("system") as session:
        events = list(
            await session.scalars(
                select(AuditEvent).where(AuditEvent.action == "moderation.report_reviewed")
            )
        )
        assert len(events) == 1 and events[0].meta["outcome"] == "dismissed"
        assert "Private reported words" not in str(events[0].meta)


async def test_admin_closure_stops_future_messages(client):
    eh, eid, job, ch, ref = await setup_pair(client, "support")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    conv = (await accept(client, ch, inv["id"])).json()["conversation_id"]
    rid = await report_row(uuid.UUID(conv))
    admin = await admin_headers(client)
    r = await client.post(
        f"/v1/admin/message-reports/{rid}/review",
        headers=admin,
        json={"outcome": "close_conversation", "reason_code": "harassment"},
    )
    assert r.status_code == 200
    r = await client.post(
        f"/v1/candidate/conversations/{conv}/messages",
        headers=ch,
        json={"body": "should not send", "client_key": "after-review"},
    )
    assert r.status_code == 409


async def test_removed_conversation_can_still_be_reviewed_without_broad_access(client):
    rid = await report_row()
    admin = await admin_headers(client)
    url = f"/v1/admin/message-reports/{rid}/review"
    assert (
        await client.post(
            url, headers=admin, json={"outcome": "close_conversation", "reason_code": "other"}
        )
    ).status_code == 409
    assert (
        await client.post(url, headers=admin, json={"outcome": "resolved", "reason_code": "other"})
    ).status_code == 200
