import asyncio

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from alembic import context
from app.config import get_settings
from app.models import Base

target_metadata = Base.metadata


def _url() -> str:
    return str(context.config.attributes.get("url") or get_settings().database_url)


def _run(connection) -> None:  # type: ignore[no-untyped-def]
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def _run_async() -> None:
    engine = create_async_engine(_url(), poolclass=NullPool)
    async with engine.connect() as conn:
        await conn.run_sync(_run)
    await engine.dispose()


if context.is_offline_mode():
    context.configure(url=_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()
else:
    asyncio.run(_run_async())
