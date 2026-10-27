from alembic.config import Config

from alembic import command


def test_migrations_round_trip():
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")


def test_availability_migration_backfills_conservatively_and_downgrades_cleanly():
    """Old employment_type only implies what it truly implies; nothing else is guessed."""
    import asyncio
    import uuid

    from sqlalchemy import text

    from app.db import dispose_engine, get_sessionmaker
    from app.rls import set_context

    cfg = Config("alembic.ini")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "29143123078d")  # the revision before availability

    emp = uuid.uuid4()
    types = ["full_time", "part_time", "casual", "contract", "shift"]

    async def seed():
        async with get_sessionmaker()() as s:
            await set_context(s, role="system")
            await s.execute(
                text("insert into employers (id, name) values (:i, 'Old Cafe')"), {"i": emp}
            )
            for t in types:
                await s.execute(
                    text(
                        "insert into jobs (employer_id, title, description, employment_type, "
                        "status, origin) values (:e, :t, 'd', :t, 'draft', 'direct')"
                    ),
                    {"e": emp, "t": t},
                )
            await s.commit()
        await dispose_engine()

    async def read(sql):
        async with get_sessionmaker()() as s:
            await set_context(s, role="system")
            rows = (await s.execute(text(sql))).all()
        await dispose_engine()
        return rows

    asyncio.run(seed())
    command.upgrade(cfg, "head")
    rows = {
        r[0]: r[1:]
        for r in asyncio.run(
            read("select employment_type, engagement_basis, duration_type, hours_pattern from jobs")
        )
    }
    assert rows["full_time"] == ("employee", "unspecified", "full_time")
    assert rows["part_time"] == ("employee", "unspecified", "part_time")
    assert rows["casual"] == ("employee", "unspecified", "casual")
    # a contract may be an employment contract and a shift is not an employment category
    assert rows["contract"] == ("unspecified", "unspecified", "unspecified")
    assert rows["shift"] == ("unspecified", "unspecified", "unspecified")
    command.downgrade(cfg, "29143123078d")
    command.upgrade(cfg, "head")
