import uuid

from fastapi import APIRouter
from sqlalchemy import func, select

from app.deps import CurrentUser, Session
from app.errors import not_found
from app.models import Notification
from app.schemas import NotificationOut

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(user: CurrentUser, session: Session) -> list[Notification]:
    return list(
        await session.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(100)
        )
    )


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID, user: CurrentUser, session: Session
) -> Notification:
    n = (
        await session.scalars(
            select(Notification).where(
                Notification.id == notification_id, Notification.user_id == user.id
            )
        )
    ).one_or_none()
    if n is None:
        raise not_found("notification")
    n.read_at = n.read_at or func.now()
    await session.flush()
    await session.refresh(n)
    return n
