from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import Response

from app.config import get_settings
from app.db import assert_rls_safe_role, dispose_engine
from app.errors import install_error_handlers
from app.ratelimit import RedisLimiter, get_limiter
from app.routers import (
    account,
    admin,
    applications,
    auth,
    availability,
    candidate,
    employer,
    health,
    inbox_candidate,
    invites_employer,
    jobs_public,
    moderation,
    notifications,
    pricing,
    saved,
    talent,
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await assert_rls_safe_role()
    yield
    limiter = get_limiter()
    if isinstance(limiter, RedisLimiter):
        await limiter.close()
    await dispose_engine()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="NUA CREW API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
        response: Response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cache-Control", "no-store")
        return response

    install_error_handlers(app)
    for r in (
        health.router,
        auth.router,
        candidate.router,
        availability.router,
        talent.router,
        inbox_candidate.router,
        invites_employer.router,
        pricing.router,
        jobs_public.router,
        applications.router,
        employer.router,
        notifications.router,
        admin.router,
        saved.router,
        account.router,
        moderation.router,
    ):
        app.include_router(r)
    return app


app = create_app()
