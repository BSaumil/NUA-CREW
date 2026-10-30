"""Loads an effective-dated RuleSet from the database (or from the committed seed for tests)."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AwardClassification,
    AwardRateVersion,
    IndustrialInstrument,
    PenaltyRuleVersion,
    PublicHoliday,
)
from app.services.hospitality.awards import PenaltyRow, RateRow, RuleSet
from app.services.hospitality.importer import load


async def load_ruleset(
    session: AsyncSession, instrument_code: str, on: date, state: str
) -> RuleSet | None:
    instrument = await session.get(IndustrialInstrument, instrument_code)
    if instrument is None or instrument.status != "active":
        return None
    rates: dict[str, RateRow] = {}
    rows = await session.execute(
        select(AwardClassification, AwardRateVersion)
        .join(AwardRateVersion, AwardRateVersion.classification_id == AwardClassification.id)
        .where(
            AwardClassification.instrument_code == instrument_code,
            AwardRateVersion.effective_from <= on,
            (AwardRateVersion.effective_to.is_(None)) | (AwardRateVersion.effective_to > on),
        )
        .order_by(AwardRateVersion.effective_from)
    )
    for cls, rv in rows:  # later effective_from overwrites earlier
        rates[cls.code] = RateRow(
            code=cls.code,
            label=cls.label,
            kind=cls.kind,
            rate_version_id=rv.id,
            effective_from=rv.effective_from,
            weekly_minor=rv.weekly_minor,
            hourly_minor=rv.hourly_minor,
            annual_minimum_minor=rv.annual_minimum_minor,
            data_status=rv.data_status,
            source_url=rv.source_url,
        )
    pens = await session.scalars(
        select(PenaltyRuleVersion).where(
            PenaltyRuleVersion.instrument_code == instrument_code,
            PenaltyRuleVersion.effective_from <= on,
            (PenaltyRuleVersion.effective_to.is_(None)) | (PenaltyRuleVersion.effective_to > on),
        )
    )
    holidays = await session.scalars(
        select(PublicHoliday.holiday_date).where(
            PublicHoliday.state == state,
            PublicHoliday.holiday_date >= on - timedelta(days=1),
            PublicHoliday.holiday_date <= on + timedelta(days=400),
        )
    )
    calendar_rows = list(holidays)
    return RuleSet(
        instrument_code=instrument.code,
        title=instrument.title,
        source_url=instrument.source_url,
        rates=rates,
        penalties=[
            PenaltyRow(
                employment=p.employment,
                classification_codes=tuple(p.classification_codes),
                day_kind=p.day_kind,
                multiplier_bp=p.multiplier_bp,
                data_status=p.data_status,
            )
            for p in pens
        ],
        holidays=set(calendar_rows),
        holiday_calendar_loaded=bool(calendar_rows),
    )


def ruleset_from_seed(instrument_code: str, holidays: set[date] | None = None) -> RuleSet:
    """Builds a RuleSet straight from the committed seed (unit tests, no database)."""
    doc = load("awards.json")
    inst = next(i for i in doc["instruments"] if i["code"] == instrument_code)
    kinds = {
        c["code"]: c for c in doc["classifications"] if c["instrument_code"] == instrument_code
    }
    rates = {
        rv["classification_code"]: RateRow(
            code=rv["classification_code"],
            label=kinds[rv["classification_code"]]["label"],
            kind=kinds[rv["classification_code"]]["kind"],
            rate_version_id="00000000-0000-0000-0000-000000000000",
            effective_from=date.fromisoformat(rv["effective_from"]),
            weekly_minor=rv["weekly_minor"],
            hourly_minor=rv["hourly_minor"],
            annual_minimum_minor=rv["annual_minimum_minor"],
            data_status=rv["data_status"],
            source_url=rv["source_url"],
        )
        for rv in doc["rate_versions"]
        if rv["instrument_code"] == instrument_code
    }
    penalties = [
        PenaltyRow(
            employment=p["employment"],
            classification_codes=tuple(p["classification_codes"]),
            day_kind=p["day_kind"],
            multiplier_bp=p["multiplier_bp"],
            data_status=p["data_status"],
        )
        for p in doc["penalty_rules"]
        if p["instrument_code"] == instrument_code
    ]
    return RuleSet(
        instrument_code=instrument_code,
        title=inst["title"],
        source_url=inst["source_url"],
        rates=rates,
        penalties=penalties,
        holidays=holidays or set(),
        holiday_calendar_loaded=bool(holidays),
    )
