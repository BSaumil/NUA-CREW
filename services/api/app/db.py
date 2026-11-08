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
    # A table owner bypasses RLS by default; schema/database owners can regain DDL control.
    # Membership checks include privileges inherited from an owner role.
    owns_protected_tables: bool = False
    owns_database: bool = False
    owns_schema: bool = False
    can_create_schema_objects: bool = False

    @property
    def unsafe(self) -> bool:
        return any(
            (
                self.superuser,
                self.bypass_rls,
                self.owns_protected_tables,
                self.owns_database,
                self.owns_schema,
                self.can_create_schema_objects,
            )
        )


async def current_role(engine: AsyncEngine | None = None) -> RoleInfo:
    """Inspect *effective* runtime privileges, not only role attributes.

    PostgreSQL owners normally bypass row-level security, even when they are
    neither superusers nor marked BYPASSRLS. Inherited owner membership and
    schema/database ownership are therefore also unsafe for the web API.
    """
    eng = engine or get_engine()
    sql = text(
        """
        SELECT r.rolname, r.rolsuper, r.rolbypassrls,
          EXISTS (
            SELECT 1
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind IN ('r', 'p')
              AND c.relrowsecurity
              AND pg_has_role(r.oid, c.relowner, 'USAGE')
          ) AS owns_protected_tables,
          EXISTS (
            SELECT 1 FROM pg_database d
            WHERE d.datname = current_database()
              AND pg_has_role(r.oid, d.datdba, 'USAGE')
          ) AS owns_database,
          EXISTS (
            SELECT 1 FROM pg_namespace n
            WHERE n.nspname = 'public'
              AND pg_has_role(r.oid, n.nspowner, 'USAGE')
          ) AS owns_schema,
          has_schema_privilege(r.oid, 'public', 'CREATE') AS can_create_schema_objects
        FROM pg_roles r
        WHERE r.rolname = current_user
        """
    )
    async with eng.connect() as conn:
        row = (await conn.execute(sql)).one()
    return RoleInfo(
        name=row[0],
        superuser=bool(row[1]),
        bypass_rls=bool(row[2]),
        owns_protected_tables=bool(row[3]),
        owns_database=bool(row[4]),
        owns_schema=bool(row[5]),
        can_create_schema_objects=bool(row[6]),
    )


async def assert_rls_safe_role() -> RoleInfo:
    """Refuse privileged runtime credentials outside development.

    A least-privilege runtime account has DML access only. Never point the
    serving API at the Neon database's table/schema owner or migrator role.
    """
    s = get_settings()
    info = await current_role()
    enforce = (
        s.require_rls_safe_role if s.require_rls_safe_role is not None else s.env != "development"
    )
    if info.unsafe:
        reasons = [
            name
            for name, present in (
                ("superuser", info.superuser),
                ("BYPASSRLS", info.bypass_rls),
                ("owns RLS-protected tables", info.owns_protected_tables),
                ("database owner privileges", info.owns_database),
                ("public schema owner privileges", info.owns_schema),
                ("CREATE on public schema", info.can_create_schema_objects),
            )
            if present
        ]
        msg = (
            f"Database role {info.name!r} is unsafe for runtime: {', '.join(reasons)}. "
            "Use a separate DML-only role such as nua_runtime; "
            "never connect the serving API using schema/migration credentials."
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
