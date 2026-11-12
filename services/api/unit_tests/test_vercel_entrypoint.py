"""The Vercel entrypoint must reuse the same protected FastAPI application."""

from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.index import app as vercel_app
from app.main import app as canonical_app


def test_vercel_entrypoint_reuses_the_protected_application() -> None:
    assert isinstance(vercel_app, FastAPI)
    assert vercel_app is canonical_app
    assert vercel_app.router.lifespan_context is canonical_app.router.lifespan_context
    paths = {route.path for route in vercel_app.routes if isinstance(route, APIRoute)}
    assert paths >= {"/healthz", "/readyz", "/v1/jobs"}
