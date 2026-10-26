"""Database-level isolation: these queries have NO tenant filter on purpose.

They prove Postgres itself withholds other tenants' rows even if application code forgets a WHERE.
"""

import uuid

import pytest
from fastapi.routing import APIRoute
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.deps import admin_user, member_owner, member_recruiter, member_viewer
from app.routers import admin, applications, auth, candidate, employer, jobs_public, notifications
from tests.conftest import (
    JOB,
    db_as,
    published_job,
    register_candidate,
    verified_employer,
)

pytestmark = pytest.mark.asyncio


async def count(s, sql: str) -> int:
    return (await s.execute(text(f"select count(*) from {sql}"))).scalar_one()  # noqa: S608


@pytest.fixture
async def world(client):
    a, ea = await verified_employer(client, "owner@a.example.com", "A Cafe")
    b, eb = await verified_employer(client, "owner@b.example.com", "B Cafe")
    pub = await published_job(client, a, ea)
    locs = (await client.get(f"/v1/employers/{ea}/locations", headers=a)).json()
    draft = (
        await client.post(
            f"/v1/employers/{ea}/jobs",
            json={**JOB, "title": "Secret draft", "location_id": locs[0]["id"]},
            headers=a,
        )
    ).json()
    x = await register_candidate(client, "x@x.example.com", "Xavier Applicant")
    y = await register_candidate(client, "y@x.example.com", "Yara Bystander")
    for h in (x, y):
        await client.post(
            "/v1/candidate/resumes", json={"title": "R", "content_text": "private"}, headers=h
        )
    resumes = (await client.get("/v1/candidate/resumes", headers=x)).json()
    r = await client.post(
        f"/v1/jobs/{pub['id']}/applications", json={"resume_id": resumes[0]["id"]}, headers=x
    )
    assert r.status_code == 201
    async with db_as() as s:
        cx = (
            await s.execute(
                text("select id, user_id from candidate_profiles where full_name like 'Xavier%'")
            )
        ).one()
        cy = (
            await s.execute(
                text("select id, user_id from candidate_profiles where full_name like 'Yara%'")
            )
        ).one()
    return dict(ea=uuid.UUID(ea), eb=uuid.UUID(eb), pub=pub, draft=draft, cx=cx, cy=cy)


async def test_anonymous_sees_only_public_rows(world):
    async with db_as(role="") as s:
        assert await count(s, "jobs where status='published'") == 1
        assert await count(s, "jobs where status='draft'") == 0
        for table in (
            "applications", "application_events", "candidate_profiles", "candidate_skills", "resumes",
            "resume_versions", "notifications", "audit_events", "employer_memberships", "locations",
            "job_versions", "consents", "ingestion_sources", "source_permissions",
        ):  # fmt: skip
            assert await count(s, table) == 0, table
        assert await count(s, "employers") == 2  # name and ABN are public by design


async def test_other_employer_sees_nothing_of_a(world):
    w = world
    async with db_as(role="employer", employer_ids=[w["eb"]]) as s:
        assert await count(s, "applications") == 0
        assert await count(s, "application_events") == 0
        assert await count(s, "candidate_profiles") == 0
        assert await count(s, "resume_versions") == 0
        assert await count(s, "jobs where status='draft'") == 0
        assert await count(s, f"employer_memberships where employer_id='{w['ea']}'") == 0
        assert await count(s, f"locations where employer_id='{w['ea']}'") == 0
        r = await s.execute(text("update jobs set title='pwned'"))
        assert r.rowcount == 0
        r = await s.execute(text("update applications set status='rejected'"))
        assert r.rowcount == 0
        with pytest.raises(DBAPIError):  # cannot plant rows into A's tenant
            await s.execute(
                text(
                    "insert into jobs (employer_id, title, description, employment_type, status, "
                    "origin, pay_basis) values (:e, 't', 'd', 'casual', 'published', 'direct', "
                    "'not_disclosed')"
                ),
                {"e": w["ea"]},
            )


async def test_employer_sees_only_applicants_to_its_own_jobs(world):
    w = world
    async with db_as(role="employer", employer_ids=[w["ea"]]) as s:
        assert await count(s, "applications") == 1
        assert await count(s, "application_events") == 1
        assert await count(s, "jobs where status='draft'") == 1
        names = {r[0] for r in await s.execute(text("select full_name from candidate_profiles"))}
        assert names == {"Xavier Applicant"}  # the bystander is invisible
        assert await count(s, "resume_versions") == 1  # only the one attached to the application
        assert (
            await count(s, "resumes") == 0
        )  # candidates' resume library is never employer-visible
        assert await count(s, "notifications") == 0
        assert await count(s, "audit_events") == 0


async def test_candidates_are_isolated_from_each_other(world):
    w = world
    async with db_as(role="candidate", user_id=w["cy"][1], candidate_id=w["cy"][0]) as s:
        assert await count(s, "applications") == 0
        assert await count(s, "resumes") == 1  # their own
        assert await count(s, "resume_versions") == 1
        names = {r[0] for r in await s.execute(text("select full_name from candidate_profiles"))}
        assert names == {"Yara Bystander"}
        assert (
            await s.execute(
                text("update candidate_profiles set summary='x' where full_name like 'Xav%'")
            )
        ).rowcount == 0
    async with db_as(role="candidate", user_id=w["cx"][1], candidate_id=w["cx"][0]) as s:
        assert await count(s, "applications") == 1
        assert await count(s, "jobs where status='draft'") == 0


async def test_privileged_roles_see_everything(world):
    for role in ("system", "admin"):
        async with db_as(role=role) as s:
            assert await count(s, "applications") == 1
            assert await count(s, "candidate_profiles") == 2
            assert await count(s, "jobs") == 2
            assert await count(s, "audit_events") > 0


async def test_context_does_not_leak_between_requests(client, world):
    """Settings are transaction-local: a pooled connection must not remember the last caller."""
    async with db_as(role="system") as s:
        assert await count(s, "applications") == 1
        await s.commit()
    async with db_as(role="") as s2:
        assert await count(s2, "applications") == 0


async def test_every_employer_route_requires_membership():
    """Guardrail for new routes: anything under /v1/employers/{employer_id} must depend on a role."""
    guards = {member_viewer, member_recruiter, member_owner, admin_user}

    def deps(dependant):
        for d in dependant.dependencies:
            yield d.call
            yield from deps(d)

    checked = 0
    routers = (admin, applications, auth, candidate, employer, jobs_public, notifications)
    for route in (r for m in routers for r in m.router.routes):
        if isinstance(route, APIRoute) and "{employer_id}" in route.path:
            assert guards & set(deps(route.dependant)), f"{route.methods} {route.path} is unguarded"
            checked += 1
    assert checked >= 15
