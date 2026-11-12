"""Vercel's documented FastAPI discovery entrypoint.

Export the canonical application unchanged. The API's database role guard,
rate-limiting startup checks, and protected routes stay in app.main.
"""

from app.main import app

__all__ = ["app"]
