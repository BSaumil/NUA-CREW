from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-32bytes!"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="NUA_", extra="ignore")

    env: str = "development"
    # When on, a direct employer job cannot be published without a hospitality role (and so
    # without a pay check). On by default (owner decision, 2026-11-07) after the gap list was built.
    require_role_on_publish: bool = True
    # Owner decision: posting and applying need a verified email. Enforced only while email can be
    # delivered (see services/verified_email.py), so it cannot lock everyone out without a provider.
    require_verified_email: bool = True
    # Who may create an account through the API itself (the web UI is not the barrier: the API is
    # reachable directly). "closed" refuses everyone, "allowlist" accepts only addresses or
    # @domains in registration_allowlist, "open" is public enrolment. Closed by default, per role,
    # and only the owner opens it. Tests and local development open it explicitly.
    candidate_registration: Literal["closed", "allowlist", "open"] = "closed"
    employer_registration: Literal["closed", "allowlist", "open"] = "closed"
    # Exact emails ("a@b.com") or whole domains ("@b.com"), case-insensitive.
    registration_allowlist: list[str] = []
    database_url: str = "postgresql+asyncpg://nua_runtime:nua_runtime_dev@localhost:5432/nua_crew"
    # Alembic connects with this schema-owning role when set; the API never does (ADR-008).
    migration_database_url: str | None = None
    # None = enforce outside development, warn in development.
    require_rls_safe_role: bool | None = None
    jwt_secret: str = DEV_JWT_SECRET
    jwt_issuer: str = "nua-crew-api"
    access_token_minutes: int = 30
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8081",  # Expo web build used for browser tests
    ]
    db_null_pool: bool = False
    auth_rate_limit_per_minute: int = 10
    application_limit_per_hour: int = 60
    job_create_limit_per_hour: int = 60
    talent_search_limit_per_hour: int = 60
    # Distinct candidates one employer can be shown per rolling 24h (limits availability probing).
    talent_daily_candidate_budget: int = 200
    # How long a search result's opaque reference stays usable for an invitation.
    talent_ref_ttl_days: int = 7
    invitation_default_expiry_days: int = 7
    invitation_employer_daily_limit: int = 30
    invitation_job_daily_limit: int = 15
    invitation_candidate_daily_limit: int = 3  # new invitations a person receives per 24h, in total
    invitation_decline_cooldown_days: int = 30  # employer-wide, whichever teammate asks again
    message_limit_per_minute: int = 30
    redis_url: str | None = None
    push_provider: str = "none"  # "expo" enables real push delivery
    # Outbound email (password reset, email verification). "none" sends nothing. "file" writes each
    # message to a local folder for development and browser tests only; it is refused elsewhere.
    # A real provider is an owner decision and is not wired yet.
    email_provider: Literal["none", "file"] = "none"
    email_file_dir: str = ".dev-mail"
    # Where the links in emails point. Candidates and employers use separate web apps.
    candidate_web_url: str = "http://localhost:3000"
    employer_web_url: str = "http://localhost:3001"
    ingestion_stale_after_seconds: int = 7 * 24 * 3600
    fixtures_dir: str = "fixtures"
    document_storage: Literal["disabled", "local", "s3"] = "disabled"
    document_local_root: str = ".private-documents"
    document_s3_bucket: str | None = None
    document_s3_region: str = "ap-southeast-2"
    document_clamd_host: str | None = None
    document_clamd_port: int = 3310
    stripe_mode: Literal["disabled", "test"] = "disabled"
    stripe_secret_key: SecretStr | None = None
    stripe_webhook_secret: SecretStr | None = None
    billing_terms_approved: bool = False
    billing_return_url: str = "http://localhost:3001/billing"
    paid_advertising_enabled: bool = False

    @model_validator(mode="after")
    def _no_dev_secret_outside_dev(self) -> "Settings":
        if self.env != "development" and self.jwt_secret == DEV_JWT_SECRET:
            raise ValueError("NUA_JWT_SECRET must be set outside development")
        if self.stripe_mode == "test" and self.stripe_secret_key:
            key = self.stripe_secret_key.get_secret_value()
            if not key.startswith(("sk_test_", "rk_test_")):
                raise ValueError("Only Stripe test keys are supported; live charging is disabled")
        if self.email_provider == "file" and self.env != "development":
            raise ValueError("NUA_EMAIL_PROVIDER=file is for development only")
        if self.email_provider != "none" and self.env != "development":
            for name in ("candidate_web_url", "employer_web_url"):
                if not getattr(self, name).startswith("https://"):
                    raise ValueError(
                        f"NUA_{name.upper()} must be an https:// URL when email is sent"
                    )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
