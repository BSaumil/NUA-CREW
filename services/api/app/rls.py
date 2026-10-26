"""Per-request Postgres row-level-security context (ADR-003).

Policies in the database read four transaction-local settings. They are set after the caller is
authenticated and vanish when the request transaction ends, so a pooled connection never carries
one request's identity into the next. Anonymous requests have no settings and see only public rows.
"""

import uuid
from collections.abc import AsyncIterator, Iterable
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

SYSTEM = "system"


async def set_context(
    session: AsyncSession,
    *,
    user_id: uuid.UUID | None = None,
    role: str = "",
    candidate_id: uuid.UUID | None = None,
    employer_ids: Iterable[uuid.UUID] = (),
) -> None:
    await session.execute(
        text(
            "SELECT set_config('app.user_id', :u, true), set_config('app.role', :r, true), "
            "set_config('app.candidate_id', :c, true), set_config('app.employer_ids', :e, true)"
        ),
        {
            "u": str(user_id) if user_id else "",
            "r": role,
            "c": str(candidate_id) if candidate_id else "",
            "e": ",".join(str(i) for i in employer_ids),
        },
    )


async def _set_role(session: AsyncSession, role: str) -> None:
    await session.execute(text("SELECT set_config('app.role', :r, true)"), {"r": role})


@asynccontextmanager
async def system_scope(session: AsyncSession) -> AsyncIterator[None]:
    """Run a few explicit writes that must cross tenants (registration, notifications, audit).

    Pending ORM work is flushed before the scope opens and again before it closes so that
    statements execute under the intended role, never one side of the boundary or the other.
    """
    await session.flush()
    prev = (
        await session.execute(text("SELECT coalesce(current_setting('app.role', true), '')"))
    ).scalar_one()
    await _set_role(session, SYSTEM)
    completed = False
    try:
        yield
        await session.flush()
        completed = True
    finally:
        if completed:  # on error the request transaction is rolled back anyway
            await _set_role(session, prev)
