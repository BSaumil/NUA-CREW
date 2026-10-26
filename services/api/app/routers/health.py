from fastapi import APIRouter
from sqlalchemy import text

from app.deps import Session

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz")
async def readyz(session: Session) -> dict[str, str]:
    await session.execute(text("SELECT 1"))
    return {"status": "ready"}
