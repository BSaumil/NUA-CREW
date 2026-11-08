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
    # What the role owns or can alter, found in the catalog: tables in `public` it owns or inherits
    # ownership of (`pg_has_role(..., 'MEMBER')`, so a NOINHERIT membership still counts), the
    # `public` schema, the database, and CREATE on `public`. A role that owns the tables can run
    # `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` or drop a policy, so one injection or bug would
    # switch the second wall off. The runtime role must be DML-only (ADR-003, ADR-008).
    privileges: tuple[str, ...] = ()

    @property
    def unsafe(self) -> bool:
        return self.superuser or self.bypass_rls or bool(self.privileges)


# `ORDER BY ... LIMIT` keeps the message short; any row at all makes the role unsafe.
_OWNED_SQL = text(
    """
    SELECT 'table ' || c.relname AS what
      FROM pg_class c
     WHERE c.relnamespace = 'public'::regnamespace
       AND c.relkind IN ('r', 'p')
       AND pg_has_role(current_user, c.relowner, 'MEMBER')
    UNION ALL
    SELECT 'schema public'
      FROM pg_namespace n
     WHERE n.nspname = 'public' AND pg_has_role(current_user, n.nspowner, 'MEMBER')
    UNION ALL
    SELECT 'database ' || d.datname
      FROM pg_database d
     WHERE d.datname = current_database() AND pg_has_role(current_user, d.datdba, 'MEMBER')
    UNION ALL
    SELECT 'CREATE on schema public'
     WHERE has_schema_privilege(current_user, 'public', 'CREATE')
    ORDER BY 1
    LIMIT 8
    """
)


async def current_role(engine: AsyncEngine | None = None) -> RoleInfo:
    eng = engine or get_engine()
    sql = text("SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
    async with eng.connect() as conn:
        row = (await conn.execute(sql)).one()
        owned = tuple((await conn.execute(_OWNED_SQL)).scalars().all())
    return RoleInfo(row[0], row[1], row[2], owned)


async def assert_rls_safe_role() -> RoleInfo:
    """The API must run as a DML-only role that row-level security applies to (ADR-003/ADR-008).

    Unsafe means any of: superuser, BYPASSRLS, or a role that owns (or inherits ownership of) the
    tables or schema, or can create objects in them. Outside development this refuses to start; in
    development it warns loudly. Fail closed: a check that cannot run raises and blocks startup.
    """
    s = get_settings()
    info = await current_role()
    enforce = (
        s.require_rls_safe_role if s.require_rls_safe_role is not None else s.env != "development"
    )
    if info.unsafe:
        if info.superuser or info.bypass_rls:
            msg = (
                f"Database role {info.name!r} is a superuser or has BYPASSRLS: row-level security "
                "is NOT enforced. Connect as the nua_runtime role (see db/roles/bootstrap.sql)."
            )
        else:
            msg = (
                f"Database role {info.name!r} owns or can alter the schema "
                f"({', '.join(info.privileges)}), so it could switch row-level security off: the "
                "second wall is NOT enforced. Connect as the DML-only nua_runtime role and keep "
                "the owner for migrations only (see db/roles/bootstrap.sql)."
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
