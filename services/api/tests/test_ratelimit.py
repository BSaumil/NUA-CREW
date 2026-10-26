import asyncio
import os
import uuid

import pytest
from redis import asyncio as aioredis

from app.config import get_settings
from app.errors import ApiError
from app.ratelimit import MemoryLimiter, RedisLimiter, set_limiter
from tests.conftest import JOB, published_job, register_candidate, verified_employer

pytestmark = pytest.mark.asyncio

REDIS_URL = os.environ.get("NUA_TEST_REDIS_URL", "redis://localhost:6379/15")


async def _redis_up() -> bool:
    try:
        r = aioredis.from_url(REDIS_URL, socket_connect_timeout=0.5)
        await r.ping()
        await r.aclose()
        return True
    except Exception:
        return False


@pytest.fixture
async def redis_limiter():
    if not await _redis_up():
        pytest.skip(f"no Redis at {REDIS_URL}")
    lim = RedisLimiter(REDIS_URL, prefix=f"test:{uuid.uuid4().hex}:")
    yield lim
    await lim.reset()
    await lim.close()


async def _expect_limited(coro):
    with pytest.raises(ApiError) as e:
        await coro
    assert e.value.status == 429 and e.value.code == "rate_limited"


async def test_memory_limiter_window():
    lim = MemoryLimiter()
    for _ in range(3):
        await lim.check("k", 3, 1)
    await _expect_limited(lim.check("k", 3, 1))
    await lim.check("other", 3, 1)  # independent key
    await asyncio.sleep(1.1)
    await lim.check("k", 3, 1)  # window slid


async def test_redis_limiter_blocks_and_slides(redis_limiter):
    for _ in range(3):
        await redis_limiter.check("k", 3, 1)
    await _expect_limited(redis_limiter.check("k", 3, 1))
    await redis_limiter.check("other", 3, 1)
    await asyncio.sleep(1.1)
    await redis_limiter.check("k", 3, 1)


async def test_redis_limiter_is_atomic_under_concurrency(redis_limiter):
    results = await asyncio.gather(
        *[redis_limiter.check("burst", 5, 60) for _ in range(40)], return_exceptions=True
    )
    assert sum(r is None for r in results) == 5
    assert all(isinstance(r, ApiError) for r in results if r is not None)


async def test_redis_limit_is_shared_across_instances(redis_limiter):
    second = RedisLimiter(REDIS_URL, prefix=redis_limiter._prefix)  # another API process
    for _ in range(2):
        await redis_limiter.check("shared", 3, 60)
    await second.check("shared", 3, 60)
    await _expect_limited(redis_limiter.check("shared", 3, 60))
    await second.close()


async def test_redis_outage_degrades_to_in_process_limit():
    broken = RedisLimiter("redis://127.0.0.1:1/0")
    for _ in range(2):
        await broken.check("k", 2, 60)  # does not raise, does not block sign-in
    await _expect_limited(broken.check("k", 2, 60))  # still limited locally
    await broken.close()


async def test_application_limit_is_per_candidate_and_gives_clear_error(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "application_limit_per_hour", 2)
    emp, eid = await verified_employer(client, "owner@a.example.com")
    jobs = [await published_job(client, emp, eid, title=f"Job {i}") for i in range(3)]
    busy = await register_candidate(client, "busy@x.example.com")
    calm = await register_candidate(client, "calm@x.example.com")
    codes = [
        (await client.post(f"/v1/jobs/{j['id']}/applications", json={}, headers=busy)).status_code
        for j in jobs
    ]
    assert codes == [201, 201, 429]
    r = await client.post(f"/v1/jobs/{jobs[2]['id']}/applications", json={}, headers=calm)
    assert r.status_code == 201  # another candidate is unaffected


async def test_job_create_limit_is_per_employer(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "job_create_limit_per_hour", 2)
    a, ea = await verified_employer(client, "owner@a.example.com", "A")
    b, eb = await verified_employer(client, "owner@b.example.com", "B")
    codes = [
        (await client.post(f"/v1/employers/{ea}/jobs", json=JOB, headers=a)).status_code
        for _ in range(3)
    ]
    assert codes == [201, 201, 429]
    assert (await client.post(f"/v1/employers/{eb}/jobs", json=JOB, headers=b)).status_code == 201


async def test_api_login_throttle_works_through_redis(client, redis_limiter, monkeypatch):
    monkeypatch.setattr(get_settings(), "auth_rate_limit_per_minute", 2)
    set_limiter(redis_limiter)
    body = {"email": "r@x.example.com", "password": "nope-nope-nope"}
    codes = [(await client.post("/v1/auth/login", json=body)).status_code for _ in range(4)]
    assert codes == [401, 401, 429, 429]
