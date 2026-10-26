import os

# Must be set before any app import so Settings picks them up.
os.environ.setdefault(
    "NUA_DATABASE_URL", "postgresql+asyncpg://nua:nua_dev_password@localhost:5432/nua_crew_test"
)
os.environ["NUA_DB_NULL_POOL"] = "true"
os.environ["NUA_AUTH_RATE_LIMIT_PER_MINUTE"] = "1000"
os.environ["NUA_ENV"] = "development"

import uuid  # noqa: E402
from collections.abc import AsyncIterator  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.db import dispose_engine, get_engine, get_sessionmaker  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from app.security import auth_limiter, hash_password  # noqa: E402

PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session", autouse=True)
def _migrated() -> None:
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")


@pytest_asyncio.fixture(autouse=True)
async def _clean_db() -> AsyncIterator[None]:
    auth_limiter.reset()
    async with get_engine().begin() as conn:
        tables = (
            await conn.execute(
                text(
                    "SELECT tablename FROM pg_tables WHERE schemaname='public' "
                    "AND tablename <> 'alembic_version'"
                )
            )
        ).scalars()
        await conn.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
    yield
    await dispose_engine()


@pytest_asyncio.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def register_candidate(client: httpx.AsyncClient, email: str, name: str = "Test Candidate"):
    r = await client.post(
        "/v1/auth/register/candidate",
        json={"email": email, "password": PASSWORD, "full_name": name, "accept_terms": True},
    )
    assert r.status_code == 201, r.text
    return auth(r.json()["access_token"])


async def register_employer(client: httpx.AsyncClient, email: str, org: str = "Fictional Cafe"):
    r = await client.post(
        "/v1/auth/register/employer",
        json={
            "email": email,
            "password": PASSWORD,
            "full_name": "Owner Person",
            "organisation_name": org,
            "location": {"name": "Main", "suburb": "Fitzroy", "state": "VIC", "postcode": "3065"},
            "accept_terms": True,
        },
    )
    assert r.status_code == 201, r.text
    headers = auth(r.json()["access_token"])
    me = (await client.get("/v1/auth/me", headers=headers)).json()
    return headers, me["memberships"][0]["employer_id"]


async def admin_headers(client: httpx.AsyncClient) -> dict[str, str]:
    async with get_sessionmaker()() as s:
        s.add(
            User(
                email=f"admin-{uuid.uuid4().hex[:6]}@nua-crew.example.com",
                password_hash=hash_password(PASSWORD),
                role="admin",
            )
        )
        await s.commit()
        email = (await s.scalars(text("select email from users where role='admin'"))).first()
    r = await client.post("/v1/auth/login", json={"email": email, "password": PASSWORD})
    return auth(r.json()["access_token"])


async def verified_employer(client: httpx.AsyncClient, email: str, org: str = "Fictional Cafe"):
    headers, eid = await register_employer(client, email, org)
    admin = await admin_headers(client)
    r = await client.post(
        f"/v1/admin/employers/{eid}/verification",
        json={"status": "verified", "evidence": "Reviewed in test"},
        headers=admin,
    )
    assert r.status_code == 200, r.text
    return headers, eid


JOB = {
    "title": "Barista",
    "description": "Make coffee for a friendly neighbourhood cafe.",
    "employment_type": "casual",
    "category": "Hospitality",
    "pay_min": "28.00",
    "pay_max": "32.00",
    "pay_period": "hour",
    "super_included": False,
    "skills": ["Barista", "Customer Service"],
}


async def published_job(client, headers, eid, **over):
    locs = (await client.get(f"/v1/employers/{eid}/locations", headers=headers)).json()
    body = {**JOB, "location_id": locs[0]["id"], **over}
    r = await client.post(f"/v1/employers/{eid}/jobs", json=body, headers=headers)
    assert r.status_code == 201, r.text
    job = r.json()
    r = await client.post(f"/v1/employers/{eid}/jobs/{job['id']}/publish", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()
