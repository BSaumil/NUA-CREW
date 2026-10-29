"""Award-aware minimum pay assessment.

Design rules (from the owner's directive, enforced here):

* A job title is never an award classification. The engine only *assesses* a classification the
  employer has confirmed; it never infers one from a role.
* All money is integer cents. Multipliers are integer basis points. Rounding is half-up to the
  cent at one documented point (``round_half_up``), never floating point.
* Nothing is reported as compliant unless coverage and classification were employer-confirmed,
  the worker is an adult, and every needed rule exists. Everything the engine cannot assess is
  listed in ``not_assessed`` and, where it matters, turns the result into ``requires_review``.
* Rates are date-versioned. A job assessed against an old version stays auditable because the
  rate-version ids used are stored with the result.
* The rates/penalties shipped today are ``supplied_unverified`` (workbook/PDF of 29 Oct 2026).
  That is surfaced in every result until an administrator verifies the version.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from app.hospitality_schemas import (
    CheckOut,
    PayAssessmentIn,
    PayAssessmentResult,
    RateSourceOut,
    RosterSegmentOut,
    RosterShiftOut,
    SuperOut,
)

SUPER_BP = 1200  # 12% superannuation guarantee; employer cost on top, never part of cash wage
STATE_ZONES = {
    "VIC": "Australia/Melbourne",
    "NSW": "Australia/Sydney",
    "ACT": "Australia/Sydney",
    "TAS": "Australia/Hobart",
    "QLD": "Australia/Brisbane",
    "SA": "Australia/Adelaide",
    "WA": "Australia/Perth",
    "NT": "Australia/Darwin",
}
NOT_ASSESSED = [
    "Evening and night penalties or allowances",
    "Overtime and ordinary-hours limits",
    "Allowances (split shift, meal, uniform, travel and others)",
    "Minimum engagement, broken shifts and breaks",
    "Leave and leave loading",
    "Junior, apprentice and trainee rates",
    "Enterprise agreements and annualised salary offsets",
]
DAY_LABEL = {
    "weekday": "Weekday",
    "saturday": "Saturday",
    "sunday": "Sunday",
    "public_holiday": "Public holiday",
}


def round_half_up(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def apply_bp(minor: int, bp: int) -> int:
    """Cents x basis points / 10,000 rounded half-up to the cent (no floats)."""
    return round_half_up(Decimal(minor) * Decimal(bp) / Decimal(10000))


def to_minor(amount: Decimal) -> int:
    return round_half_up(amount * 100)


@dataclass(frozen=True)
class RateRow:
    code: str
    label: str
    kind: str
    rate_version_id: object
    effective_from: date
    weekly_minor: int
    hourly_minor: int
    annual_minimum_minor: int | None
    data_status: str
    source_url: str


@dataclass(frozen=True)
class PenaltyRow:
    employment: str
    classification_codes: tuple[str, ...]
    day_kind: str
    multiplier_bp: int
    data_status: str


@dataclass
class RuleSet:
    instrument_code: str
    title: str
    source_url: str
    rates: dict[str, RateRow] = field(default_factory=dict)
    penalties: list[PenaltyRow] = field(default_factory=list)
    holidays: set[date] = field(default_factory=set)
    holiday_calendar_loaded: bool = False

    def multiplier(self, employment: str, code: str, day_kind: str) -> PenaltyRow | None:
        group = "casual" if employment == "casual" else "permanent"
        for p in self.penalties:
            if p.employment == group and p.day_kind == day_kind and code in p.classification_codes:
                return p
        return None


def _check(out: list[CheckOut], code: str, level: str, text: str) -> None:
    out.append(CheckOut(code=code, level=level, text=text))


def _segments(
    day: date, start: time, end: time, zone: ZoneInfo
) -> tuple[datetime, datetime, list[tuple[date, int]]]:
    """Split a shift at local midnight; minutes are real elapsed time (DST-safe)."""
    s = datetime.combine(day, start, tzinfo=zone)
    end_day = day if end > start else day + timedelta(days=1)
    e = datetime.combine(end_day, end, tzinfo=zone)
    out: list[tuple[date, int]] = []
    cursor = s
    while cursor < e:
        next_midnight = datetime.combine(cursor.date() + timedelta(days=1), time(0), tzinfo=zone)
        stop = min(e, next_midnight)
        minutes = int(
            (stop.astimezone(ZoneInfo("UTC")) - cursor.astimezone(ZoneInfo("UTC"))).total_seconds()
            // 60
        )
        out.append((cursor.date(), minutes))
        cursor = stop
    return s, e, out


def _day_kind(d: date, rules: RuleSet) -> str:
    if d in rules.holidays:
        return "public_holiday"
    return {5: "saturday", 6: "sunday"}.get(d.weekday(), "weekday")


def assess(
    inp: PayAssessmentIn,
    rules: RuleSet | None,
    *,
    effective_on: date,
    role_needs_review: bool = False,
) -> PayAssessmentResult:
    checks: list[CheckOut] = []
    reasons_review: list[str] = []
    offered_minor = to_minor(inp.pay_amount)

    def result(
        status: str,
        summary: str,
        *,
        classification_label: str | None = None,
        minimum: int | None = None,
        basis: str | None = None,
        others: dict[str, int | None] | None = None,
        shifts: list[RosterShiftOut] | None = None,
        sources: list[RateSourceOut] | None = None,
        super_: SuperOut | None = None,
        data_status: str = "supplied_unverified",
    ) -> PayAssessmentResult:
        return PayAssessmentResult(
            status=status,
            blocking=status == "below_minimum",
            summary=summary,
            instrument=inp.instrument,
            classification=inp.classification,
            classification_label=classification_label,
            employment=inp.employment,
            offered_hourly_minor=offered_minor if inp.pay_period == "hour" else None,
            minimum_ordinary_hourly_minor=minimum,
            minimum_weekday_basis=basis,
            weekend_and_holiday_minimums=others or {},
            checks=checks,
            shifts=shifts or [],
            sources=sources or [],
            super=super_,
            not_assessed=NOT_ASSESSED,
            data_status=data_status,
            needs_acknowledgement=status in ("requires_review", "missing_source"),
        )

    # ---- 1. coverage ---------------------------------------------------------------------
    if inp.instrument in ("enterprise_agreement", "award_free", "unknown"):
        why = {
            "enterprise_agreement": "An enterprise agreement can replace an award; its pay terms "
            "are not loaded here.",
            "award_free": "No award was selected. Award-free status needs a coverage assessment.",
            "unknown": "Award coverage has not been established.",
        }[inp.instrument]
        _check(checks, "coverage_unresolved", "warn", why)
        _check(
            checks,
            "review_path",
            "info",
            "Check coverage with the Fair Work Ombudsman or the Fair Work pay calculator, then "
            "acknowledge this review to publish.",
        )
        return result(
            "requires_review",
            "We can't confirm a minimum for this arrangement. Review it before publishing.",
        )
    if rules is None:
        _check(
            checks,
            "rules_missing",
            "warn",
            f"No rate data is loaded for {inp.instrument}.",
        )
        return result("missing_source", "No pay rules are loaded for this award.")

    if inp.worker_class != "adult":
        _check(
            checks,
            "worker_class",
            "warn",
            "Junior, apprentice and trainee rates depend on age, year and award schedule and are "
            "not calculated here. Adult rates must not be substituted.",
        )
        return result(
            "requires_review",
            "Junior, apprentice and trainee pay needs a manual review.",
        )
    if inp.pay_includes_super:
        _check(
            checks,
            "super_inclusive",
            "warn",
            "Pay that includes super can't be compared with the award cash minimum. Enter the "
            "cash rate excluding super.",
        )
        reasons_review.append("super_inclusive")

    # ---- 2. classification (employer-confirmed only) ---------------------------------------
    if not inp.classification:
        _check(
            checks,
            "classification_required",
            "warn",
            "Choose the classification that matches the actual duties. A job title alone is not "
            "enough.",
        )
        return result("requires_review", "Choose a classification to see the minimum rate.")
    rate = rules.rates.get(inp.classification)
    if rate is None or rate.effective_from > effective_on:
        _check(
            checks,
            "rate_missing",
            "warn",
            f"No {inp.instrument} rate for {inp.classification} is effective on {effective_on}.",
        )
        return result("missing_source", "No rate is loaded for that classification and date.")
    if not inp.classification_confirmed:
        _check(
            checks,
            "classification_unconfirmed",
            "warn",
            "Confirm that this classification matches the duties, skills and training of the job.",
        )
        reasons_review.append("classification_unconfirmed")
    if not inp.coverage_confirmed:
        _check(
            checks,
            "coverage_unconfirmed",
            "warn",
            "Confirm that this award covers your business and the work being done.",
        )
        reasons_review.append("coverage_unconfirmed")
    if role_needs_review:
        _check(
            checks,
            "role_needs_review",
            "warn",
            "This kind of role is often managerial, trade or covered by another award. Check "
            "coverage carefully; the title does not decide the award.",
        )
        reasons_review.append("role_needs_review")
    if rate.kind == "manager":
        _check(
            checks,
            "manager_classification",
            "warn",
            "Manager levels have separate annual minimums and eligibility rules.",
        )
        reasons_review.append("manager")

    sources = [
        RateSourceOut(
            instrument=inp.instrument,
            classification=rate.code,
            rate_version_id=rate.rate_version_id,
            effective_from=rate.effective_from,
            hourly_minor=rate.hourly_minor,
            weekly_minor=rate.weekly_minor,
            data_status=rate.data_status,
            source_url=rate.source_url,
        )
    ]
    data_status = (
        "verified"
        if rate.data_status == "verified"
        and all(p.data_status == "verified" for p in rules.penalties)
        else "supplied_unverified"
    )
    if data_status != "verified":
        _check(
            checks,
            "rates_unverified",
            "info",
            "Reference rates are from the supplied 2026-27 edition and are awaiting verification "
            "against the Fair Work pay guide.",
        )

    # ---- 3. minimum ordinary hourly + day variants --------------------------------------
    weekday_rule = rules.multiplier(inp.employment, rate.code, "weekday")
    minimum = apply_bp(rate.hourly_minor, weekday_rule.multiplier_bp) if weekday_rule else None
    basis = (
        (
            "Casual ordinary rate includes 25% loading"
            if inp.employment == "casual"
            else "Permanent ordinary hourly rate"
        )
        if weekday_rule
        else None
    )
    others: dict[str, int | None] = {}
    for kind in ("saturday", "sunday", "public_holiday"):
        rule = rules.multiplier(inp.employment, rate.code, kind)
        others[kind] = apply_bp(rate.hourly_minor, rule.multiplier_bp) if rule else None
        if rule is None:
            _check(
                checks,
                f"{kind}_rule_missing",
                "info",
                f"{DAY_LABEL[kind]} rates for {inp.instrument} are not loaded, so they were not "
                "assessed.",
            )

    # ---- 4. non-hourly pay -----------------------------------------------------------------
    if inp.pay_period != "hour":
        _check(
            checks,
            "salary_review",
            "warn",
            "Salary and non-hourly pay needs annualised-salary or offset review; hourly "
            "equivalents are not inferred from a salary.",
        )
        status = "requires_review"
        if inp.pay_period == "week" and inp.employment == "full_time" and not reasons_review:
            if offered_minor < rate.weekly_minor:
                _check(
                    checks,
                    "below_weekly_minimum",
                    "block",
                    "The weekly pay is below the award's 38-hour weekly minimum.",
                )
                status = "below_minimum"
        if (
            rate.annual_minimum_minor is not None
            and inp.pay_period == "year"
            and offered_minor < rate.annual_minimum_minor
            and not reasons_review
        ):
            _check(
                checks,
                "below_annual_minimum",
                "block",
                "The salary is below the award's annual minimum for this manager level.",
            )
            status = "below_minimum"
        summary = (
            "The pay is below the award minimum."
            if status == "below_minimum"
            else "Salary needs a manual review before publishing."
        )
        return result(
            status,
            summary,
            classification_label=rate.label,
            minimum=minimum,
            basis=basis,
            others=others,
            sources=sources,
            data_status=data_status,
        )

    # ---- 5. hourly comparison ------------------------------------------------------------------
    if minimum is None:
        _check(
            checks,
            "weekday_rule_missing",
            "warn",
            "No ordinary-hours rule is loaded for this award and employment type.",
        )
        return result(
            "missing_source",
            "No ordinary-hours rule is loaded.",
            classification_label=rate.label,
            sources=sources,
            data_status=data_status,
            others=others,
        )

    below = offered_minor < minimum
    zone = ZoneInfo(STATE_ZONES[inp.state])
    shifts: list[RosterShiftOut] = []
    total_paid_minutes = 0
    roster_pay_minor = 0
    flat_shortfall = False
    missing_day_rule = False

    for sh in inp.roster:
        s, e, parts = _segments(sh.local_date, sh.local_start, sh.local_end, zone)
        elapsed = sum(m for _, m in parts)
        paid = max(0, elapsed - sh.break_minutes)
        total_paid_minutes += paid
        segs: list[RosterSegmentOut] = []
        remaining_break = sh.break_minutes
        for d, minutes in parts:
            kind = _day_kind(d, rules)
            rule = rules.multiplier(inp.employment, rate.code, kind)
            req = apply_bp(rate.hourly_minor, rule.multiplier_bp) if rule else None
            take = min(remaining_break, minutes)
            remaining_break -= take
            seg_paid = minutes - take
            est: int | None
            if inp.rate_structure == "flat_all_hours":
                est = offered_minor
                if req is None:
                    seg_status = "missing_source"
                    missing_day_rule = True
                elif offered_minor < req:
                    seg_status = "below_minimum"
                    flat_shortfall = True
                else:
                    seg_status = "compliant_as_assessed"
            else:
                weekday_bp = weekday_rule.multiplier_bp if weekday_rule else None
                est_calc = (
                    round_half_up(
                        Decimal(offered_minor) * Decimal(rule.multiplier_bp) / Decimal(weekday_bp)
                    )
                    if rule and weekday_bp
                    else None
                )
                est = est_calc
                seg_status = (
                    "compliant_as_assessed"
                    if (req is not None and not below)
                    else ("below_minimum" if below else "missing_source")
                )
            if est is not None:
                roster_pay_minor += round_half_up(Decimal(est) * Decimal(seg_paid) / Decimal(60))
            segs.append(
                RosterSegmentOut(
                    local_date=d,
                    day_kind=kind,
                    minutes=seg_paid,
                    award_minimum_minor=req,
                    estimated_pay_minor=est,
                    status=seg_status,
                )
            )
        shifts.append(
            RosterShiftOut(
                local_date=sh.local_date,
                starts_at=s.isoformat(),
                ends_at=e.isoformat(),
                time_zone=str(zone),
                paid_minutes=paid,
                segments=segs,
            )
        )
    if inp.rate_structure == "flat_all_hours" and not inp.roster:
        # Without a roster a flat rate must still cover weekend work; public holidays are noted.
        needed = [v for v in (minimum, others.get("saturday"), others.get("sunday")) if v]
        if needed and offered_minor < max(needed):
            flat_shortfall = True
            _check(
                checks,
                "flat_rate_weekend",
                "warn",
                f"A flat rate for all hours must cover weekend work: the award minimum reaches "
                f"{max(needed) / 100:.2f}/hour on the highest weekend day.",
            )
        _check(
            checks,
            "flat_rate_public_holiday",
            "info",
            "A flat rate must also cover any public holiday worked; see the public holiday "
            "minimum above.",
        )
    if inp.roster and not rules.holiday_calendar_loaded:
        _check(
            checks,
            "public_holiday_calendar_missing",
            "info",
            f"No public holiday calendar is loaded for {inp.state}. Shifts are treated as normal "
            "days; public holiday rates are shown separately above.",
        )

    if below:
        _check(
            checks,
            "below_ordinary_minimum",
            "block" if not reasons_review else "warn",
            f"The offered rate is below the {inp.employment} ordinary minimum for "
            f"{rate.label} under {inp.instrument}.",
        )
    if flat_shortfall:
        _check(
            checks,
            "below_shift_minimum",
            "block" if not reasons_review else "warn",
            "A flat rate for all hours is below the award minimum for at least one shift day.",
        )
    if missing_day_rule:
        _check(
            checks,
            "shift_rule_missing",
            "warn",
            "A rule needed for part of the roster is not loaded, so it can't be assessed.",
        )

    # ---- super (employer cost, separate from cash wages) ---------------------------------------
    super_out = SuperOut(
        rate_bp=SUPER_BP,
        per_hour_minor=apply_bp(offered_minor, SUPER_BP),
        roster_total_minor=apply_bp(roster_pay_minor, SUPER_BP) if inp.roster else None,
        note=(
            "12% superannuation guarantee is an employer cost on top of cash wages (Payday Super "
            "applies from 1 July 2026). Qualifying earnings can differ from the figure shown."
        ),
    )

    # ---- status ---------------------------------------------------------------------------------
    if below or flat_shortfall:
        confirmed = not reasons_review
        status = "below_minimum" if confirmed else "requires_review"
        summary = (
            "The offered rate is below the award minimum."
            if confirmed
            else "This may be below the award minimum if the selected award applies. Confirm "
            "coverage and classification."
        )
    elif reasons_review:
        status = "requires_review"
        summary = "Confirm coverage and classification to finish the pay check."
    elif missing_day_rule:
        status = "missing_source"
        summary = "Part of the roster can't be assessed because a rule is missing."
    else:
        status = "compliant_as_assessed"
        summary = (
            "Meets the ordinary minimum as assessed. Items listed as not assessed still apply."
        )
    return result(
        status,
        summary,
        classification_label=rate.label,
        minimum=minimum,
        basis=basis,
        others=others,
        shifts=shifts,
        sources=sources,
        super_=super_out,
        data_status=data_status,
    )
