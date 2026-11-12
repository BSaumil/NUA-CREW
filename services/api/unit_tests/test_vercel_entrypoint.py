"""Vercel must export the canonical FastAPI application, never a second one."""

from fastapi import FastAPI

from app.index import app as vercel_app
from app.main import app as canonical_app


def test_vercel_entrypoint_reuses_the_protected_application() -> None:
    assert isinstance(vercel_app, FastAPI)
    # Identity is stronger than inspecting the route registry: bundled FastAPI may
    # represent include_router() entries as _IncludedRouter objects without .path.
    # Sharing the exact object also shares all routers, middleware, lifespan and guards.
    assert vercel_app is canonical_app
    assert vercel_app.router.lifespan_context is canonical_app.router.lifespan_context
