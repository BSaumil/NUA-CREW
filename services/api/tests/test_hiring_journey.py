"""One persisted hiring journey, including negative business/worker boundaries."""

import asyncio

from tests.conftest import register_candidate, register_employer
from tests.test_invitations import accept, body, send, setup_pair


async def test_full_hiring_journey_and_business_boundaries(client):
    employer, eid, job, candidate, ref = await setup_pair(client, "complete-journey")
    outsider, _ = await register_employer(client, "outside-journey@nua-crew.example.com")
    other_worker = await register_candidate(client, "outside-worker@nua-crew.example.com")
    resume = await client.post(
        "/v1/candidate/resumes",
        json={"title": "Hospitality", "content_text": "Experienced coffee maker."},
        headers=candidate,
    )
    assert resume.status_code == 201, resume.text
    applied = await client.post(
        f"/v1/jobs/{job['id']}/applications",
        headers={**candidate, "Idempotency-Key": "journey-application"},
        json={"resume_id": resume.json()["id"], "cover_note": "Available for mornings."},
    )
    assert applied.status_code == 201, applied.text
    aid = applied.json()["id"]
    for headers in (outsider, other_worker):
        assert (
            await client.get(f"/v1/employers/{eid}/applications/{aid}", headers=headers)
        ).status_code == 404
    assert (
        await client.get(f"/v1/candidate/applications/{aid}", headers=other_worker)
    ).status_code == 404
    reviewed = await client.post(
        f"/v1/employers/{eid}/applications/{aid}/status",
        headers=employer,
        json={"to_status": "under_review"},
    )
    assert reviewed.status_code == 200, reviewed.text
    mine = await client.get(f"/v1/candidate/applications/{aid}", headers=candidate)
    assert mine.json()["status"] == "under_review"
    invite = await send(client, employer, eid, body(ref, job), key="journey-invite")
    assert invite.status_code == 201, invite.text
    accepted = await accept(client, candidate, invite.json()["id"])
    assert accepted.status_code == 200, accepted.text
    cid = accepted.json()["conversation_id"]
    for url, headers in (
        (f"/v1/employers/{eid}/conversations/{cid}/messages", outsider),
        (f"/v1/candidate/conversations/{cid}/messages", other_worker),
    ):
        assert (await client.get(url, headers=headers)).status_code == 404
    for url, headers, message in (
        (f"/v1/employers/{eid}/conversations/{cid}/messages", employer, "Can we meet?"),
        (f"/v1/candidate/conversations/{cid}/messages", candidate, "Yes, tomorrow."),
    ):
        sent = await client.post(
            url, headers=headers, json={"body": message, "client_key": message}
        )
        assert sent.status_code == 201, sent.text
        retried = await client.post(
            url, headers=headers, json={"body": message, "client_key": message}
        )
        assert retried.status_code == 200 and retried.json()["id"] == sent.json()["id"]
    messages = await client.get(f"/v1/candidate/conversations/{cid}/messages", headers=candidate)
    assert [m["body"] for m in messages.json()["items"]] == ["Can we meet?", "Yes, tomorrow."]
    # A conversation and application do not reserve work or create a shift booking.
    calendar = await client.get("/v1/candidate/availability", headers=candidate)
    assert calendar.json()["commitments"] == []


async def test_api_serialises_competing_confirmations_as_a_clear_conflict(client):
    candidate = await register_candidate(client, "booking-race@nua-crew.example.com")
    payload = {
        "starts_at": "2027-01-01T09:00:00Z",
        "ends_at": "2027-01-01T12:00:00Z",
        "status": "confirmed",
    }
    responses = await asyncio.gather(
        *(
            client.post("/v1/candidate/availability/commitments", headers=candidate, json=payload)
            for _ in range(2)
        )
    )
    assert sorted(r.status_code for r in responses) == [201, 409]
    rejected = next(r for r in responses if r.status_code == 409)
    assert rejected.json()["error"]["code"] == "commitment_conflict"
