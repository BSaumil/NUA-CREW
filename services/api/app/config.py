from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "dev-only-insecure-secret-change-me-32bytes!"  # noqa: S105


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="NUA_", extra="ignore")

    env: str = "development"
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

    @model_validator(mode="after")
    def _no_dev_secret_outside_dev(self) -> "Settings":
        if self.env != "development" and self.jwt_secret == DEV_JWT_SECRET:
            raise ValueError("NUA_JWT_SECRET must be set outside development")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
