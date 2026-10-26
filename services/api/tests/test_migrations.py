from alembic.config import Config

from alembic import command


def test_migrations_round_trip():
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
