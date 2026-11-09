"""Local SELF-TEST of the staging acceptance runner against the in-process API.

This proves the runner logic only. It is `local-selftest` and is never hosted acceptance.
"""

import sys
import uuid
from pathlib import Path

from sqlalchemy import text

from app.config import get_settings
from app.db import get_sessionmaker
from app.models import User
from app.security import hash_password
from app.services import email
from tests.conftest import PASSWORD, db_as
from tests.test_account_recovery import Mailbox

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import staging_acceptance as sa  # noqa: E402


async def test_runner_end_to_end_locally(client, monkeypatch):
    box = Mailbox()
    monkeypatch.setattr(get_settings(), "email_provider", "file")
    email.set_sender(box)
    admin_email = f"admin-{uuid.uuid4().hex[:6]}@accept.nua-crew.example"
    async with get_sessionmaker()() as s:
        s.add(User(email=admin_email, password_hash=hash_password(PASSWORD), role="admin"))
        await s.commit()
    cfg = sa.Config(
        base_url="http://test",
        allow_publish=True,
        email_domain="accept.nua-crew.example",
        admin_email=admin_email,
        admin_password=PASSWORD,
        target_kind="local-selftest",
    )

    def provider(address: str) -> str | None:
        try:
            return box.token(address, "Confirm your NUA CREW email")
        except AssertionError:
            return None

    try:
        report = await sa.Runner(cfg, client, token_provider=provider).run()
    finally:
        email.set_sender(None)

    by = {s.id: s for s in report.steps}
    failed = [f"{s.id}: {s.detail}" for s in report.steps if s.status == "failed"]
    assert not failed, failed
    for sid in (
        "job.publish",
        "app.apply",
        "app.replay",
        "app.duplicate",
        "emp.status",
        "persist.candidate",
        "idor.job",
        "idor.application_candidate",
        "idor.application_employer",
        "conc.apply",
        "mkt.nz_disabled",
    ):
        assert by[sid].status == "passed", (sid, by[sid])
    assert report.target_kind == "local-selftest" and not report.accepted  # not_run items remain
    blob = report.to_json()
    assert (
        PASSWORD not in blob and "@accept.nua-crew.example" not in blob
    )  # no raw emails or secrets
    async with db_as("system") as s:
        left = await s.scalar(text("select count(*) from users where email like 'accept-%'"))
    assert left is not None
