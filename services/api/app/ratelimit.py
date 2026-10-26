"""Sliding-window rate limiting. Redis when configured (shared across instances), else in-process.

Limits are abuse guards, not exclusion: defaults are generous and a limited candidate always gets a
clear message. If Redis is unreachable the limiter degrades to the in-process window (logged) rather
than blocking sign-in or taking the API down.
"""

import logging
import time
import uuid
from collections import defaultdict, deque
from typing import Protocol

from redis import asyncio as aioredis
from redis.exceptions import RedisError

from app.config import get_settings
from app.errors import ApiError

log = logging.getLogger(__name__)


def _limited() -> ApiError:
    return ApiError(429, "rate_limited", "Too many attempts. Please wait a moment and try again.")


class Limiter(Protocol):
    async def check(self, key: str, limit: int, window_s: int = 60) -> None: ...
    async def reset(self) -> None: ...


class MemoryLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    async def check(self, key: str, limit: int, window_s: int = 60) -> None:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > window_s:
            q.popleft()
        if len(q) >= limit:
            raise _limited()
        q.append(now)

    async def reset(self) -> None:
        self._hits.clear()


# Atomic sliding window on one sorted set per key, timed by Redis itself so instances agree.
_LUA = """
local t = redis.call('TIME')
local now = t[1] * 1000 + math.floor(t[2] / 1000)
local window = tonumber(ARGV[1]) * 1000
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], now, ARGV[3])
redis.call('PEXPIRE', KEYS[1], window)
return 1
"""


class RedisLimiter:
    def __init__(self, url: str, prefix: str = "nua:rl:") -> None:
        self._redis = aioredis.from_url(url, socket_timeout=0.5, socket_connect_timeout=0.5)
        self._script = self._redis.register_script(_LUA)
        self._prefix = prefix
        self._fallback = MemoryLimiter()

    async def check(self, key: str, limit: int, window_s: int = 60) -> None:
        try:
            ok = await self._script(
                keys=[self._prefix + key], args=[window_s, limit, uuid.uuid4().hex]
            )
        except (RedisError, OSError):
            log.warning("rate limiter: Redis unavailable, using in-process fallback")
            await self._fallback.check(key, limit, window_s)
            return
        if not ok:
            raise _limited()

    async def reset(self) -> None:
        await self._fallback.reset()
        try:
            async for k in self._redis.scan_iter(match=self._prefix + "*"):
                await self._redis.delete(k)
        except (RedisError, OSError):
            pass

    async def close(self) -> None:
        await self._redis.aclose()


_limiter: Limiter | None = None


def get_limiter() -> Limiter:
    global _limiter
    if _limiter is None:
        url = get_settings().redis_url
        _limiter = RedisLimiter(url) if url else MemoryLimiter()
    return _limiter


def set_limiter(limiter: Limiter | None) -> None:
    global _limiter
    _limiter = limiter
