"""Migration uses workplace evidence, never country guesses."""
import asyncio
import uuid

from alembic.config import Config
from sqlalchemy import text

from alembic import command
from app.db import dispose_engine, get_sessionmaker
from app.rls import set_context


def test_market_migration_backfills_evidence_only():
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "b44c05ef1004")
    au_employer, unknown_employer = uuid.uuid4(), uuid.uuid4()
    venue_id, au_job, unknown_job = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()

    async def seed() -> None:
        async with get_sessionmaker()() as s:
            await set_context(s, role="system")
            await s.execute(
                text("INSERT INTO employers (id,name,abn) VALUES (:id,'AU Cafe','54299131653')"),
                {"id": au_employer},
            )
            await s.execute(
                text("INSERT INTO employers (id,name) VALUES (:id,'Unknown')"),
                {"id": unknown_employer},
            )
            await s.execute(
                text(
                    "INSERT INTO locations (id,employer_id,name,suburb,state,postcode,country) "
                    "VALUES (:id,:employer,'Venue','Fitzroy','VIC','3065','AU')"
                ),
                {"id": venue_id, "employer": au_employer},
            )
            for jid, eid, lid in [
                (au_job, au_employer, venue_id),
                (unknown_job, unknown_employer, None),
            ]:
                await s.execute(
                    text(
                        "INSERT INTO jobs (id,employer_id,location_id,title,description,"
                        "employment_type,status,origin,pay_currency) "
                        "VALUES (:id,:employer,:location,'Job','Desc','casual','draft','direct','AUD')"
                    ),
                    {"id": jid, "employer": eid, "location": lid},
                )
            await s.commit()
        await dispose_engine()

    asyncio.run(seed())
    command.upgrade(cfg, "head")

    async def read() -> tuple[dict[uuid.UUID, str | None], dict[uuid.UUID, str | None]]:
        async with get_sessionmaker()() as s:
            await set_context(s, role="system")
            employers = (
                await s.execute(
                    text("SELECT id,country_code FROM employers WHERE id IN (:a,:b)"),
                    {"a": au_employer, "b": unknown_employer},
                )
            ).all()
            jobs = (
                await s.execute(
                    text("SELECT id,country_code FROM jobs WHERE id IN (:a,:b)"),
                    {"a": au_job, "b": unknown_job},
                )
            ).all()
        await dispose_engine()
        return dict(employers), dict(jobs)

    employers, jobs = asyncio.run(read())
    assert employers == {au_employer: "AU", unknown_employer: None}
    assert jobs == {au_job: "AU", unknown_job: None}
