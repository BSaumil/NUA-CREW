"""API runtime privilege guard: owners bypass row-level security by default.

Pure-unit checks run without a database; services/api/tests/test_rls.py separately
exercises actual PostgreSQL tenant isolation under the runtime role.
"""

from types import SimpleNamespace

import pytest

from app import db
from app.db import RoleInfo


@pytest.mark.parametrize(
    "extra",
    [
        {"superuser": True},
        {"bypass_rls": True},
        {"owns_protected_tables": True},
        {"owns_database": True},
        {"owns_schema": True},
        {"can_create_schema_objects": True},
    ],
)
def test_each_privileged_runtime_role_is_unsafe(extra: dict[str, bool]) -> None:
    info = RoleInfo("incorrect_runtime", False, False, **extra)
    assert info.unsafe


def test_dml_only_runtime_role_is_safe() -> None:
    info = RoleInfo("nua_runtime", False, False)
    assert info.unsafe is False


@pytest.mark.asyncio
async def test_staging_startup_refuses_table_owner(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def table_owner() -> RoleInfo:
        return RoleInfo("neon_default_owner", False, False, owns_protected_tables=True)

    monkeypatch.setattr(db, "current_role", table_owner)
    monkeypatch.setattr(
        db,
        "get_settings",
        lambda: SimpleNamespace(env="staging", require_rls_safe_role=None),
    )
    with pytest.raises(RuntimeError, match="owns RLS-protected tables"):
        await db.assert_rls_safe_role()


@pytest.mark.asyncio
async def test_staging_startup_accepts_dml_only_role(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def restricted() -> RoleInfo:
        return RoleInfo("nua_runtime", False, False)

    monkeypatch.setattr(db, "current_role", restricted)
    monkeypatch.setattr(
        db,
        "get_settings",
        lambda: SimpleNamespace(env="staging", require_rls_safe_role=None),
    )
    info = await db.assert_rls_safe_role()
    assert info.name == "nua_runtime"


@pytest.mark.asyncio
async def test_development_warns_but_does_not_block(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    async def owner() -> RoleInfo:
        return RoleInfo("dev_owner", False, False, owns_database=True)

    monkeypatch.setattr(db, "current_role", owner)
    monkeypatch.setattr(
        db,
        "get_settings",
        lambda: SimpleNamespace(env="development", require_rls_safe_role=None),
    )
    await db.assert_rls_safe_role()
    assert "database owner privileges" in caplog.text
