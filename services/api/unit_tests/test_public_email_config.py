"""Public registration must not strand accounts without verification delivery."""

import pytest
from pydantic import ValidationError

from app.config import Settings


@pytest.mark.parametrize("role", ["candidate_registration", "employer_registration"])
def test_public_production_signup_requires_email_provider(role: str) -> None:
    kwargs = {role: "open"}
    with pytest.raises(ValidationError, match="Public registration requires a real"):
        Settings(
            _env_file=None,
            env="production",
            jwt_secret="fixture-secret-not-used-in-production",  # noqa: S106
            email_provider="none",
            **kwargs,
        )


def test_protected_staging_remains_configurable_without_email() -> None:
    settings = Settings(
        _env_file=None,
        env="staging",
        jwt_secret="fixture-secret-not-used-in-staging",  # noqa: S106
        email_provider="none",
        candidate_registration="allowlist",
    )
    assert settings.candidate_registration == "allowlist"
