import json
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.config import get_settings
from app.services.ingestion.sanitize import clean_text

ALWAYS_REQUIRED = {"title", "description", "apply_url", "employment_type"}
OPTIONAL_FIELDS = {
    "company",
    "category",
    "suburb",
    "state",
    "postcode",
    "pay_min",
    "pay_max",
    "pay_period",
    "skills",
}


class ParsedJob(BaseModel):
    external_id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=20000)
    apply_url: str
    employment_type: Literal["full_time", "part_time", "casual", "contract", "shift"]
    company: str | None = Field(None, max_length=200)
    category: str | None = Field(None, max_length=100)
    suburb: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=3)
    postcode: str | None = Field(None, pattern=r"^\d{4}$")
    pay_min: str | None = None
    pay_max: str | None = None
    pay_period: Literal["hour", "day", "week", "month", "year"] | None = None
    skills: list[str] = Field(default=[], max_length=30)

    @field_validator("title", "description", "company", "category", "suburb", mode="before")
    @classmethod
    def _clean(cls, v: object) -> object:
        return clean_text(v) if isinstance(v, str) else v

    @field_validator("apply_url")
    @classmethod
    def _https(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("apply_url must be https")
        return v


class Connector:
    """Source interface: discover -> fetch -> parse, plus permission verification.

    `snapshot=True` means a run lists every live record, so absent ones may be expired.
    """

    snapshot = True

    def discover(self) -> list[str]:
        raise NotImplementedError

    def fetch(self, ref: str) -> dict[str, Any]:
        raise NotImplementedError

    def parse(self, raw: dict[str, Any]) -> ParsedJob:
        return ParsedJob.model_validate(raw)

    def verify_permission(self, permitted_fields: list[str]) -> bool:
        """The grant must at least cover the fields needed to display and attribute a job."""
        return ALWAYS_REQUIRED.issubset(permitted_fields)


class FixtureConnector(Connector):
    """Reads a local JSON file confined to the fixtures directory. Never touches the network."""

    def __init__(self, filename: str) -> None:
        base = Path(get_settings().fixtures_dir).resolve()
        path = (base / filename).resolve()
        if base not in path.parents:
            raise ValueError("fixture path escapes fixtures directory")
        self._records = {r["external_id"]: r for r in json.loads(path.read_text())["records"]}

    def discover(self) -> list[str]:
        return list(self._records)

    def fetch(self, ref: str) -> dict[str, Any]:
        return dict(self._records[ref])


def build_connector(kind: str, config: dict[str, Any]) -> Connector:
    if kind == "fixture":
        return FixtureConnector(str(config.get("file", "licensed_feed.json")))
    raise ValueError(f"No connector implemented for kind={kind!r} (no live collection yet)")
