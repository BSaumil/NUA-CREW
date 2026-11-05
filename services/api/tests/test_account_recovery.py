"""Password reset and email verification: security properties, not just the happy path."""

import logging
import re
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.config import Settings, get_settings
from app.services import email
from tests.conftest import PASSWORD, auth, db_as, register_candidate, register_employer

NEW_PASSWORD = "a-brand-new-passphrase-2026"
TOKEN_RE = re.compile(r"token=([A-Za-z0-9_-]+)")


class Mailbox:
    """An in-memory sender standing in for a real provider."""

    def __init__(self) -> None:
        self.messages: list[email.EmailMessage] = []

    async def send(self, message: email.EmailMessage) -> None:
        self.messages.append(message)

    def to(self, address: str) -> list[email.EmailMessage]:
        return [m for m in self.messages if m.to == address]

    def token(self, address: str, subject_contains: str) -> str:
        for m in reversed(self.to(address)):
            if subject_contains in m.subject:
                found = TOKEN_RE.search(m.text)
                assert found, "the message has no link"
                return found.group(1)
        raise AssertionError(f"no '{subject_contains}' message for {address}")


@pytest.fixture
def mailbox(monkeypatch: pytest.MonkeyPatch):
    box = Mailbox()
    # "file" only means "email delivery is switched on" here; the sender below replaces it.
    monkeypatch.setattr(get_settings(), "email_provider", "file")
    email.set_sender(box)
    yield box
    email.set_sender(None)


async def _users_token_rows(address: str):
    async with db_as("system") as s:
        return (
            await s.execute(
                text(
                    "SELECT t.purpose, t.token_hash, t.used_at FROM auth_tokens t "
                    "JOIN users u ON u.id = t.user_id WHERE lower(u.email) = lower(:e)"
                ),
                {"e": address},
            )
        ).all()


async def _audit_actions() -> list[str]:
    async with db_as("system") as s:
        return list((await s.execute(text("SELECT action FROM audit_events"))).scalars())


async def forgot(client, address: str):
    return await client.post("/v1/auth/password/forgot", json={"email": address})


async def reset(client, token: str, password: str = NEW_PASSWORD):
    return await client.post(
        "/v1/auth/password/reset", json={"token": token, "new_password": password}
    )


async def login(client, address: str, password: str):
    return await client.post("/v1/auth/login", json={"email": address, "password": password})


# ---- forgot password: nothing reveals whether an account exists -------------------------------
async def test_forgot_answers_identically_for_known_and_unknown_addresses(client, mailbox):
    await register_candidate(client, "known@nua-crew.example.com")
    mailbox.messages.clear()  # drop the registration email
    a = await forgot(client, "known@nua-crew.example.com")
    b = await forgot(client, "nobody-here@nua-crew.example.com")
    assert a.status_code == b.status_code == 202
    assert a.json() == b.json() == {"status": "accepted", "email_delivery": True}
    assert len(mailbox.to("known@nua-crew.example.com")) == 1
    assert mailbox.to("nobody-here@nua-crew.example.com") == []
    assert await _users_token_rows("nobody-here@nua-crew.example.com") == []


async def test_forgot_is_case_insensitive_and_links_to_the_right_web_app(client, mailbox):
    await register_candidate(client, "Mixed.Case@nua-crew.example.com")
    await register_employer(client, "owner@nua-crew.example.com")
    mailbox.messages.clear()
    await forgot(client, "mixed.case@NUA-CREW.example.com")
    await forgot(client, "owner@nua-crew.example.com")
    candidate = mailbox.to("Mixed.Case@nua-crew.example.com")[0]
    employer = mailbox.to("owner@nua-crew.example.com")[0]
    s = get_settings()
    assert f"{s.candidate_web_url}/reset-password?token=" in candidate.text
    assert f"{s.employer_web_url}/reset-password?token=" in employer.text
    assert "NUA CREW" in candidate.subject and "30 minutes" in candidate.text


async def test_forgot_creates_nothing_when_this_deployment_cannot_send_email(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "email_provider", "none")
    await register_candidate(client, "quiet@nua-crew.example.com")
    r = await forgot(client, "quiet@nua-crew.example.com")
    assert r.status_code == 202
    assert r.json()["email_delivery"] is False  # the screen must not claim an email was sent
    assert await _users_token_rows("quiet@nua-crew.example.com") == []


async def test_forgot_is_rate_limited_per_address_whether_or_not_it_exists(client, mailbox):
    await register_candidate(client, "limited@nua-crew.example.com")
    for address in ("limited@nua-crew.example.com", "ghost@nua-crew.example.com"):
        codes = [(await forgot(client, address)).status_code for _ in range(4)]
        assert codes == [202, 202, 202, 429], address  # same limit, so it leaks nothing


async def test_inactive_accounts_get_no_reset_email(client, mailbox):
    await register_candidate(client, "gone@nua-crew.example.com")
    async with db_as("system") as s:
        await s.execute(
            text("UPDATE users SET is_active=false WHERE email='gone@nua-crew.example.com'")
        )
        await s.commit()
    mailbox.messages.clear()
    assert (await forgot(client, "gone@nua-crew.example.com")).status_code == 202
    assert mailbox.messages == []


# ---- reset: single use, expiry, purpose, sessions ---------------------------------------------
async def test_reset_changes_the_password_and_signs_every_device_out(client, mailbox):
    addr = "flow@nua-crew.example.com"
    r = await client.post(
        "/v1/auth/register/candidate",
        json={
            "email": addr,
            "password": PASSWORD,
            "full_name": "Flow Tester",
            "accept_terms": True,
            "client": "mobile",
        },
    )
    old_refresh = r.json()["refresh_token"]
    await forgot(client, addr)
    token = mailbox.token(addr, "Reset your")

    assert (await reset(client, token)).status_code == 204
    assert (await login(client, addr, NEW_PASSWORD)).status_code == 200
    assert (await login(client, addr, PASSWORD)).status_code == 401
    refreshed = await client.post("/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert refreshed.status_code == 401  # the old device must sign in again
    assert any("was changed" in m.subject for m in mailbox.to(addr))
    actions = await _audit_actions()
    assert "auth.password_reset_requested" in actions
    assert "auth.password_reset_completed" in actions


async def test_a_reset_link_works_once(client, mailbox):
    addr = "once@nua-crew.example.com"
    await register_candidate(client, addr)
    await forgot(client, addr)
    token = mailbox.token(addr, "Reset your")
    assert (await reset(client, token)).status_code == 204
    again = await reset(client, token, "yet-another-passphrase-2027")
    assert again.status_code == 400
    assert again.json()["error"]["code"] == "invalid_or_expired_token"
    assert (await login(client, addr, NEW_PASSWORD)).status_code == 200  # unchanged by the replay


async def test_a_newer_request_retires_the_older_link(client, mailbox):
    addr = "newer@nua-crew.example.com"
    await register_candidate(client, addr)
    await forgot(client, addr)
    first = mailbox.token(addr, "Reset your")
    await forgot(client, addr)
    second = mailbox.token(addr, "Reset your")
    assert first != second
    assert (await reset(client, first)).status_code == 400
    assert (await reset(client, second)).status_code == 204


async def test_expired_unknown_and_wrong_purpose_links_all_look_the_same(client, mailbox):
    addr = "expiry@nua-crew.example.com"
    await register_candidate(client, addr)  # also sends a verification email
    await forgot(client, addr)
    reset_token = mailbox.token(addr, "Reset your")
    verify_token = mailbox.token(addr, "Confirm your")
    async with db_as("system") as s:
        await s.execute(
            text(
                "UPDATE auth_tokens SET expires_at = now() - interval '1 minute' "
                "WHERE purpose='password_reset'"
            )
        )
        await s.commit()
    bodies = []
    for token in (reset_token, "x" * 43, verify_token):  # expired, unknown, wrong purpose
        r = await reset(client, token)
        assert r.status_code == 400
        bodies.append(r.json())
    assert bodies[0] == bodies[1] == bodies[2]
    assert (await login(client, addr, PASSWORD)).status_code == 200  # still the old password


async def test_reset_enforces_the_password_rules_and_token_shape(client, mailbox):
    addr = "rules@nua-crew.example.com"
    await register_candidate(client, addr)
    await forgot(client, addr)
    token = mailbox.token(addr, "Reset your")
    assert (await reset(client, token, "short")).status_code == 422
    assert (await reset(client, "tiny")).status_code == 422
    # the failed attempts did not use the token up
    assert (await reset(client, token)).status_code == 204


async def test_a_reset_for_an_account_disabled_afterwards_is_refused(client, mailbox):
    addr = "disabled-later@nua-crew.example.com"
    await register_candidate(client, addr)
    await forgot(client, addr)
    token = mailbox.token(addr, "Reset your")
    async with db_as("system") as s:
        await s.execute(
            text("UPDATE users SET is_active=false WHERE lower(email)=lower(:e)"), {"e": addr}
        )
        await s.commit()
    assert (await reset(client, token)).status_code == 400


async def test_reset_also_proves_the_address_is_theirs(client, mailbox):
    addr = "proves@nua-crew.example.com"
    headers = await register_candidate(client, addr)
    assert (await client.get("/v1/auth/me", headers=headers)).json()["email_verified"] is False
    await forgot(client, addr)
    assert (await reset(client, mailbox.token(addr, "Reset your"))).status_code == 204
    token = (await login(client, addr, NEW_PASSWORD)).json()["access_token"]
    assert (await client.get("/v1/auth/me", headers=auth(token))).json()["email_verified"] is True


# ---- what is stored and what is logged --------------------------------------------------------
async def test_only_a_hash_is_stored_and_the_link_is_never_logged(client, mailbox, caplog):
    addr = "secret@nua-crew.example.com"
    await register_candidate(client, addr)
    with caplog.at_level(logging.DEBUG):
        await forgot(client, addr)
        token = mailbox.token(addr, "Reset your")
        await reset(client, token)
    assert token not in caplog.text
    rows = await _users_token_rows(addr)
    assert rows, "tokens should exist"
    for _purpose, stored, _used in rows:
        assert stored != token and len(stored) == 64 and token not in stored
    async with db_as("system") as s:
        leaked = await s.scalar(
            text("SELECT count(*) FROM auth_tokens WHERE token_hash = :t OR email = :t"),
            {"t": token},
        )
    assert leaked == 0


# ---- email verification -----------------------------------------------------------------------
async def test_registration_sends_a_verification_email_and_the_link_verifies(client, mailbox):
    addr = "verify@nua-crew.example.com"
    headers = await register_candidate(client, addr)
    assert (await client.get("/v1/auth/me", headers=headers)).json()["email_verified"] is False
    token = mailbox.token(addr, "Confirm your")
    r = await client.post("/v1/auth/email/verify/confirm", json={"token": token})
    assert r.status_code == 200 and r.json() == {"status": "verified"}
    assert (await client.get("/v1/auth/me", headers=headers)).json()["email_verified"] is True
    again = await client.post("/v1/auth/email/verify/confirm", json={"token": token})
    assert again.status_code == 400  # single use
    assert "email.verified" in await _audit_actions()


async def test_employers_get_the_employer_link(client, mailbox):
    await register_employer(client, "boss@nua-crew.example.com")
    message = mailbox.to("boss@nua-crew.example.com")[0]
    assert f"{get_settings().employer_web_url}/verify-email?token=" in message.text


async def test_resend_needs_a_session_is_limited_and_stops_once_verified(client, mailbox):
    addr = "resend@nua-crew.example.com"
    headers = await register_candidate(client, addr)
    assert (await client.post("/v1/auth/email/verify/request")).status_code == 401
    codes = [
        (await client.post("/v1/auth/email/verify/request", headers=headers)).status_code
        for _ in range(4)
    ]
    assert codes == [202, 202, 202, 429]
    token = mailbox.token(addr, "Confirm your")
    assert (
        await client.post("/v1/auth/email/verify/confirm", json={"token": token})
    ).status_code == 200
    mailbox.messages.clear()
    done = await client.post("/v1/auth/email/verify/request", headers=headers)
    assert done.status_code == 200 and done.json()["status"] == "already_verified"
    assert mailbox.messages == []


async def test_a_verification_link_cannot_verify_a_different_address(client, mailbox):
    addr = "before@nua-crew.example.com"
    headers = await register_candidate(client, addr)
    token = mailbox.token(addr, "Confirm your")
    async with db_as("system") as s:
        await s.execute(
            text("UPDATE users SET email='after@nua-crew.example.com' WHERE lower(email)=:e"),
            {"e": addr},
        )
        await s.commit()
    r = await client.post("/v1/auth/email/verify/confirm", json={"token": token})
    assert r.status_code == 400
    assert (await client.get("/v1/auth/me", headers=headers)).json()["email_verified"] is False


async def test_changing_the_password_while_signed_in_sends_a_notice(client, mailbox):
    addr = "notice@nua-crew.example.com"
    headers = await register_candidate(client, addr)
    mailbox.messages.clear()
    r = await client.post(
        "/v1/account/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        headers=headers,
    )
    assert r.status_code == 204
    assert any("was changed" in m.subject for m in mailbox.to(addr))


async def test_deleting_the_account_removes_its_tokens(client, mailbox):
    addr = "bye@nua-crew.example.com"
    headers = await register_candidate(client, addr)
    await forgot(client, addr)
    assert await _users_token_rows(addr)
    r = await client.request("DELETE", "/v1/account", json={"password": PASSWORD}, headers=headers)
    assert r.status_code == 204
    async with db_as("system") as s:
        assert await s.scalar(text("SELECT count(*) FROM auth_tokens")) == 0


# ---- the database boundary (RLS) --------------------------------------------------------------
async def test_signed_in_users_cannot_read_or_write_tokens_directly(client, mailbox):
    addr = "rls@nua-crew.example.com"
    await register_candidate(client, addr)
    await forgot(client, addr)
    async with db_as("system") as s:
        user_id = await s.scalar(text("SELECT id FROM users WHERE lower(email)=:e"), {"e": addr})
        assert await s.scalar(text("SELECT count(*) FROM auth_tokens")) >= 1
    for ctx in ({"role": ""}, {"role": "candidate", "user_id": user_id}):
        role = ctx.pop("role")
        async with db_as(role, **ctx) as s:
            assert await s.scalar(text("SELECT count(*) FROM auth_tokens")) == 0
            with pytest.raises(DBAPIError):
                await s.execute(
                    text(
                        "INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) "
                        "VALUES (:u, 'password_reset', :h, now() + interval '1 hour')"
                    ),
                    {"u": user_id, "h": uuid.uuid4().hex + uuid.uuid4().hex},
                )


async def test_the_table_has_forced_row_level_security():
    async with db_as("system") as s:
        row = (
            await s.execute(
                text(
                    "SELECT relrowsecurity, relforcerowsecurity FROM pg_class "
                    "WHERE relname = 'auth_tokens'"
                )
            )
        ).one()
    assert tuple(row) == (True, True)


# ---- transports and configuration -------------------------------------------------------------
async def test_the_file_transport_writes_a_private_file(tmp_path):
    sender = email.FileSender(str(tmp_path / "mail"))
    await sender.send(email.EmailMessage(to="a@b.example", subject="Hi", text="Body"))
    files = list((tmp_path / "mail").glob("*.json"))
    assert len(files) == 1
    assert oct(files[0].stat().st_mode & 0o777) == "0o600"
    assert '"to": "a@b.example"' in files[0].read_text()


async def test_the_null_transport_keeps_nothing(tmp_path, caplog):
    with caplog.at_level(logging.INFO):
        await email.NullSender().send(
            email.EmailMessage(to="a@b.example", subject="Hi", text="https://x?token=secret123")
        )
    assert "secret123" not in caplog.text and "a@b.example" not in caplog.text


async def test_a_failing_provider_never_breaks_the_request_or_logs_the_message(
    client, mailbox, caplog
):
    class Broken:
        async def send(self, message: email.EmailMessage) -> None:
            raise RuntimeError("provider down")

    email.set_sender(Broken())
    await register_candidate(client, "broken@nua-crew.example.com")
    with caplog.at_level(logging.DEBUG):
        r = await forgot(client, "broken@nua-crew.example.com")
    assert r.status_code == 202
    assert "token=" not in caplog.text


def test_the_development_mail_folder_is_refused_outside_development():
    base = {"jwt_secret": "x" * 40}
    with pytest.raises(ValueError, match="development only"):
        Settings(env="staging", email_provider="file", **base)
    assert Settings(env="staging", email_provider="none", **base).email_provider == "none"
    assert Settings(env="development", email_provider="file").email_provider == "file"
