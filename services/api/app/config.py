from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-32bytes!"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="NUA_", extra="ignore")

    env: str = "development"
    # When on, a direct employer job cannot be published without a hospitality role (and so
    # without a pay check). Off by default until existing adverts have been reconciled.
    require_role_on_publish: bool = False
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
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
