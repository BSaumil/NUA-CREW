"""Vercel's documented shim must export the exact guarded FastAPI application."""

from fastapi import FastAPI

from app.index import app as vercel_app
from app.main import app as canonical_app


def test_vercel_entrypoint_reuses_the_protected_application() -> None:
    assert isinstance(vercel_app, FastAPI)
    assert vercel_app is canonical_app
    assert vercel_app.router.lifespan_context is canonical_app.router.lifespan_context
    assert {r.path for r in vercel_app.routes} >= {"/healthz", "/readyz", "/v1/jobs"}
