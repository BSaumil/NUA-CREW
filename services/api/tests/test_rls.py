"""Database-level isolation: these queries have NO tenant filter on purpose.

They prove Postgres itself withholds other tenants' rows even if application code forgets a WHERE.
"""

import uuid

import pytest
from fastapi.routing import APIRoute
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.deps import admin_user, member_owner, member_recruiter, member_viewer
from app.rls import set_context
from app.routers import (
    admin,
    applications,
    auth,
    candidate,
    employer,
    invites_employer,
    jobs_public,
    notifications,
    talent,
)
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
            "job_versions", "consents", "ingestion_sources", "source_permissions", "ingestion_tasks",
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
    routers = (
        admin,
        applications,
        auth,
        candidate,
        employer,
        jobs_public,
        notifications,
        talent,
        invites_employer,
    )
    for route in (r for m in routers for r in m.router.routes):
        if isinstance(route, APIRoute) and "{employer_id}" in route.path:
            assert guards & set(deps(route.dependant)), f"{route.methods} {route.path} is unguarded"
            checked += 1
    assert checked >= 15


# ---------------------------------------------------------------- database role guards (ADR-008)
async def test_runtime_role_cannot_bypass_rls():
    from app.db import current_role

    info = await current_role()
    assert not info.superuser and not info.bypass_rls, info
    # ...and it is DML-only: it owns nothing and cannot create objects (ADR-008).
    assert info.privileges == (), info


async def test_startup_guard_refuses_privileged_roles_outside_development(monkeypatch):
    from app import db
    from app.config import get_settings

    async def privileged(*_a, **_k):
        return db.RoleInfo("postgres", True, True)

    monkeypatch.setattr(db, "current_role", privileged)
    settings = get_settings()
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 40)
    with pytest.raises(RuntimeError, match="NOT enforced"):
        await db.assert_rls_safe_role()
    monkeypatch.setattr(settings, "env", "development")  # development only warns
    assert (await db.assert_rls_safe_role()).unsafe
    monkeypatch.setattr(settings, "require_rls_safe_role", True)  # ...unless told to enforce
    with pytest.raises(RuntimeError):
        await db.assert_rls_safe_role()


@pytest.mark.parametrize(
    "role",
    [
        ("owner", False, False, ("table users",)),
        ("schema_owner", False, False, ("schema public",)),
        ("db_owner", False, False, ("database nua_crew_test",)),
        ("can_create", False, False, ("CREATE on schema public",)),
    ],
)
async def test_startup_guard_refuses_a_role_that_owns_or_can_alter_the_schema(monkeypatch, role):
    """Ownership is enough to disable RLS or drop a policy, so it is refused outside development
    even when the role is neither a superuser nor BYPASSRLS."""
    from app import db
    from app.config import get_settings

    info = db.RoleInfo(*role)
    assert info.unsafe

    async def owner(*_a, **_k):
        return info

    monkeypatch.setattr(db, "current_role", owner)
    settings = get_settings()
    monkeypatch.setattr(settings, "env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 40)
    with pytest.raises(RuntimeError, match="owns or can alter the schema"):
        await db.assert_rls_safe_role()
    monkeypatch.setattr(settings, "env", "development")  # development only warns
    assert (await db.assert_rls_safe_role()).unsafe


async def test_a_role_with_no_privileges_is_safe():
    from app import db

    assert not db.RoleInfo("nua_runtime", False, False, ()).unsafe


@pytest.mark.skipif(
    not __import__("os").environ.get("NUA_MIGRATION_DATABASE_URL"),
    reason="split migrator/runtime roles not configured",
)
async def test_runtime_role_is_not_the_owner_and_cannot_change_the_schema():
    """With split roles the API cannot disable RLS, drop policies or alter tables, and the startup
    guard really does detect an owning role in a live catalog."""
    import os

    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError
    from sqlalchemy.ext.asyncio import create_async_engine

    from app.db import current_role, get_engine

    # The detector works: the schema owner is reported as owning tables, the schema and the database.
    owner_engine = create_async_engine(os.environ["NUA_MIGRATION_DATABASE_URL"])
    try:
        owner = await current_role(owner_engine)
    finally:
        await owner_engine.dispose()
    assert owner.unsafe and not owner.superuser, owner
    assert any(p.startswith("table ") for p in owner.privileges), owner
    assert "schema public" in owner.privileges, owner

    # The runtime role owns nothing and is refused every schema change.
    assert (await current_role()).privileges == ()
    for statement in (
        "ALTER TABLE users DISABLE ROW LEVEL SECURITY",
        "ALTER TABLE users NO FORCE ROW LEVEL SECURITY",
        "CREATE TABLE nua_should_not_exist (id int)",
    ):
        async with get_engine().connect() as conn:
            with pytest.raises(DBAPIError, match="(?i)must be owner|permission denied"):
                await conn.execute(text(statement))
            await conn.rollback()
    async with db_as(role="system") as s:
        owner = (
            await s.execute(text("select tableowner from pg_tables where tablename='applications'"))
        ).scalar_one()
        me = (await s.execute(text("select current_user"))).scalar_one()
        assert owner != me
        for stmt in (
            "ALTER TABLE applications DISABLE ROW LEVEL SECURITY",
            "DROP POLICY applications_select ON applications",
            "DROP TABLE users CASCADE",
            "CREATE TABLE evil (id int)",
            "ALTER TABLE applications NO FORCE ROW LEVEL SECURITY",
        ):
            with pytest.raises(DBAPIError):
                await s.execute(text(stmt))
            await s.rollback()
            await set_context(s, role="system")


async def test_docker_initdb_copy_of_bootstrap_sql_is_identical():
    import asyncio
    import pathlib

    def read() -> tuple[str, str]:
        root = pathlib.Path(__file__).resolve().parents[3]
        return (
            (root / "db/roles/bootstrap.sql").read_text(),
            (root / "infra/docker/initdb/bootstrap.sql").read_text(),
        )

    a, b = await asyncio.to_thread(read)
    assert a == b
