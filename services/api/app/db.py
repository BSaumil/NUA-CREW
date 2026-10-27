import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.config import get_settings

log = logging.getLogger(__name__)
_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        s = get_settings()
        kwargs = {"poolclass": NullPool} if s.db_null_pool else {"pool_pre_ping": True}
        _engine = create_async_engine(s.database_url, **kwargs)
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    """One transaction per request: commit on success, roll back on error."""
    async with get_sessionmaker()() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@dataclass(frozen=True)
class RoleInfo:
    name: str
    superuser: bool
    bypass_rls: bool

    @property
    def unsafe(self) -> bool:
        return self.superuser or self.bypass_rls


async def current_role(engine: AsyncEngine | None = None) -> RoleInfo:
    eng = engine or get_engine()
    sql = text("SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
    async with eng.connect() as conn:
        row = (await conn.execute(sql)).one()
    return RoleInfo(row[0], row[1], row[2])


async def assert_rls_safe_role() -> RoleInfo:
    """A superuser or BYPASSRLS role ignores every row-level-security policy (ADR-003/ADR-008).

    Outside development this refuses to start; in development it warns loudly.
    """
    s = get_settings()
    info = await current_role()
    enforce = (
        s.require_rls_safe_role if s.require_rls_safe_role is not None else s.env != "development"
    )
    if info.unsafe:
        msg = (
            f"Database role {info.name!r} is a superuser or has BYPASSRLS: row-level security is "
            "NOT enforced. Connect as the nua_runtime role (see db/roles/bootstrap.sql)."
        )
        if enforce:
            raise RuntimeError(msg)
        log.warning(msg)
    return info


async def dispose_engine() -> None:
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _sessionmaker = None
