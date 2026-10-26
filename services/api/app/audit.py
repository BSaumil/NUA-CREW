import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEvent
from app.rls import system_scope


async def audit(
    session: AsyncSession,
    actor_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: object | None = None,
    **meta: Any,
) -> None:
    """Write an audit row. Audit rows are operator-only data, so the insert runs in system scope."""
    async with system_scope(session):
        session.add(
            AuditEvent(
                actor_user_id=actor_id,
                action=action,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id is not None else None,
                meta=meta,
            )
        )
