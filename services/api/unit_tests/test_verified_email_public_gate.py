"""The public hiring gate cannot silently disable itself when mail is offline."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.errors import ApiError
from app.services import verified_email


@pytest.mark.parametrize("environment", ["staging", "production"])
def test_hiring_writes_fail_closed_without_mail(environment: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        verified_email,
        "get_settings",
        lambda: SimpleNamespace(env=environment, require_verified_email=True),
    )
    monkeypatch.setattr(verified_email.email, "delivery_enabled", lambda: False)
    assert verified_email.gate_active() is True

    with pytest.raises(ApiError) as caught:
        verified_email.require_verified_email(Mock(email_verified_at=None))
    assert caught.value.status == 503
    assert caught.value.code == "email_verification_unavailable"


def test_development_without_mail_keeps_fixture_writes_possible(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        verified_email,
        "get_settings",
        lambda: SimpleNamespace(env="development", require_verified_email=True),
    )
    monkeypatch.setattr(verified_email.email, "delivery_enabled", lambda: False)
    assert verified_email.gate_active() is False
    verified_email.require_verified_email(Mock(email_verified_at=None))


def test_verified_email_is_still_required_when_delivery_is_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        verified_email,
        "get_settings",
        lambda: SimpleNamespace(env="production", require_verified_email=True),
    )
    monkeypatch.setattr(verified_email.email, "delivery_enabled", lambda: True)
    with pytest.raises(ApiError) as caught:
        verified_email.require_verified_email(Mock(email_verified_at=None))
    assert caught.value.status == 403
    assert caught.value.code == "email_not_verified"
    verified_email.require_verified_email(Mock(email_verified_at=object()))
