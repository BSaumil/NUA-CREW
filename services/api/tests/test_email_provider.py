"""The provider-backed email sender: what it sends, what it refuses, and what it never logs."""

import json
import logging

import httpx
import pytest

from app.config import Settings
from app.services import email
from app.services.email import DeliveryError, EmailMessage, ResendSender

MSG = EmailMessage(
    to="person@nua-crew.example.com", subject="Hello", text="Open https://x/y?token=SECRETLINK"
)


def _sender(handler) -> ResendSender:
    return ResendSender(
        "re_test_key",
        "NUA CREW <no-reply@mail.nua-crew.example.com>",
        transport=httpx.MockTransport(handler),
    )


async def test_sends_one_plain_text_message_with_the_key_and_an_idempotency_key():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"id": "abc"})

    await _sender(handler).send(MSG)
    assert len(seen) == 1
    req = seen[0]
    assert str(req.url) == "https://api.resend.com/emails"
    assert req.headers["authorization"] == "Bearer re_test_key"
    assert req.headers["idempotency-key"]
    body = json.loads(req.content)
    assert body == {
        "from": "NUA CREW <no-reply@mail.nua-crew.example.com>",
        "to": ["person@nua-crew.example.com"],
        "subject": "Hello",
        "text": MSG.text,
    }
    assert "html" not in body  # plain text only


@pytest.mark.parametrize("status", [400, 401, 422, 429, 500, 503])
async def test_a_provider_refusal_is_a_delivery_error_with_only_the_status(status):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"message": "bad address person@nua-crew.example.com"})

    with pytest.raises(DeliveryError) as exc:
        await _sender(handler).send(MSG)
    assert str(status) in str(exc.value)
    assert "person@" not in str(exc.value)  # the provider's body is never carried


async def test_an_unreachable_provider_is_a_delivery_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("slow", request=request)

    with pytest.raises(DeliveryError, match="ConnectTimeout"):
        await _sender(handler).send(MSG)


async def test_deliver_never_raises_and_never_logs_the_message_or_link(caplog):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"message": "person@nua-crew.example.com"})

    email.set_sender(_sender(handler))
    try:
        with caplog.at_level(logging.DEBUG):
            await email.deliver(MSG)  # must not raise
    finally:
        email.set_sender(None)
    assert "delivery failed" in caplog.text
    assert "SECRETLINK" not in caplog.text
    assert "person@" not in caplog.text
    assert "re_test_key" not in caplog.text


def test_resend_needs_a_key_a_sender_and_https():
    base = {
        "jwt_secret": "x" * 40,
        "candidate_web_url": "https://a.example.com",
        "employer_web_url": "https://b.example.com",
    }
    ok = {"email_api_key": "re_x", "email_from": "NUA CREW <no-reply@mail.example.com>"}
    assert Settings(env="staging", email_provider="resend", **ok, **base).email_provider == "resend"
    with pytest.raises(ValueError, match="EMAIL_API_KEY"):
        Settings(env="staging", email_provider="resend", email_from=ok["email_from"], **base)
    with pytest.raises(ValueError, match="EMAIL_FROM"):
        Settings(env="staging", email_provider="resend", email_api_key="re_x", **base)
    with pytest.raises(ValueError, match="EMAIL_FROM"):
        Settings(
            env="staging",
            email_provider="resend",
            email_api_key="re_x",
            email_from="nobody",
            **base,
        )
    with pytest.raises(ValueError, match="https"):
        Settings(env="staging", email_provider="resend", email_api_base="http://x", **ok, **base)


def test_a_real_provider_requires_https_links_outside_development():
    ok = {
        "email_api_key": "re_x",
        "email_from": "NUA CREW <no-reply@mail.example.com>",
        "jwt_secret": "x" * 40,
    }
    with pytest.raises(ValueError, match="https"):
        Settings(
            env="staging", email_provider="resend", **ok
        )  # default web URLs are http://localhost


def test_the_api_key_is_not_in_the_settings_repr():
    s = Settings(
        env="development",
        email_provider="resend",
        email_api_key="re_super_secret",
        email_from="a <a@b.co>",
    )
    assert "re_super_secret" not in repr(s)
    assert "re_super_secret" not in str(s.model_dump())
