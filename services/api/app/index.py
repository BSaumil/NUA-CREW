"""Vercel-discoverable FastAPI entrypoint.

The application, lifespan, database-role guard and API routes are defined in
`app.main`. This module only re-exports that exact ASGI app at the documented
`app/index.py` entrypoint; it must never provide an alternative unguarded app.
"""

from app.main import app

__all__ = ["app"]
