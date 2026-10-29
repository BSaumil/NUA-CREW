"""Pure unit tests for the pay engine: fixtures come from the supplied workbook/PDF (29 Oct 2026).

They prove the arithmetic and the *refusal* behaviour (never fabricating a compliant result);
they do not claim the figures match the live Fair Work pay guide.
"""

from datetime import date, time
from decimal import Decimal

import pytest

from app.hospitality_schemas import PayAssessmentIn, RosterShiftIn
from app.services.hospitality.awards import (
    STATE_ZONES,
    apply_bp,
    assess,
    round_half_up,
    to_minor,
)
from app.services.hospitality.importer import load
from app.services.hospitality.rules import ruleset_from_seed

ON = date(2026, 7, 15)


def base(**kw):
    data = dict(
        state="VIC",
        instrument="MA000119",
        coverage_confirmed=True,
        classification="L2",
        classification_confirmed=True,
        employment="casual",
        pay_period="hour",
        pay_amount=Decimal("33.85"),
    )
    data.update(kw)
    return PayAssessmentIn(**data)


def run(inp, holidays=None, on=ON, **kw):
    return assess(inp, ruleset_from_seed(inp.instrument, holidays), effective_on=on, **kw)


def test_seed_reconciles_with_the_supplied_workbook():
    """Computed casual ordinary == the workbook's casual column for every one of the 33 rows."""
    awards = load("awards.json")
    rules = {
        code: ruleset_from_seed(code)
        for code in {r["instrument_code"] for r in awards["rate_versions"]}
    }
    checked = 0
    for rv in awards["rate_versions"]:
        rs = rules[rv["instrument_code"]]
        rule = rs.multiplier("casual", rv["classification_code"], "weekday")
        assert rule is not None, rv
        assert (
            apply_bp(rv["hourly_minor"], rule.multiplier_bp) == rv["supplied_casual_ordinary_minor"]
        ), rv
        checked += 1
    assert checked == 33


def test_roles_seed_counts_and_ids():
    doc = load("roles.json")
    assert len(doc["roles"]) == 287 and len(doc["departments"]) == 14
    codes = [r["code"] for r in doc["roles"]]
    assert codes == [f"HC-{i:04d}" for i in range(1, 288)]
    assert {r["department_code"] for r in doc["roles"]} == {d["code"] for d in doc["departments"]}
    assert all(1 <= r["tier"] <= 9 for r in doc["roles"])


def test_money_is_exact_integer_cents():
    assert to_minor(Decimal("32.175")) == 3218  # half-up, not banker's
    assert round_half_up(Decimal("2.5")) == 3
    assert apply_bp(2574, 12500) == 3218  # Introductory casual: 25.74 x 125% = 32.175 -> 32.18
    assert isinstance(apply_bp(2708, 17500), int)


@pytest.mark.parametrize(
    ("instrument", "klass", "employment", "expected"),
    [
        ("MA000119", "L1", "casual", 3305),
        ("MA000119", "L3", "casual", 3496),
        ("MA000119", "L6", "casual", 4016),
        ("MA000119", "L2", "full_time", 2708),
        ("MA000009", "L5", "casual", 3913),
        ("MA000003", "FF1", "casual", 3476),
        ("MA000003", "FF3B", "part_time", 3027),
        ("MA000058", "L4", "casual", 3681),
    ],
)
def test_published_reference_minimums(instrument, klass, employment, expected):
    r = run(base(instrument=instrument, classification=klass, employment=employment))
    assert r.minimum_ordinary_hourly_minor == expected


def test_pdf_worked_examples_for_sunday_level_2():
    restaurant = run(base(instrument="MA000119"))
    assert restaurant.weekend_and_holiday_minimums["sunday"] == 4062  # 150% x $27.08
    hospitality = run(base(instrument="MA000009"))
    assert hospitality.weekend_and_holiday_minimums["sunday"] == 4739  # 175% x $27.08
    assert restaurant.weekend_and_holiday_minimums["public_holiday"] == 6770  # 250%
    permanent = run(base(employment="part_time"))
    assert permanent.weekend_and_holiday_minimums["saturday"] == 3385  # 125% x $27.08


def test_restaurant_casual_sunday_differs_by_level():
    low = run(base(classification="L2"))
    high = run(base(classification="L3"))
    assert low.weekend_and_holiday_minimums["sunday"] == 4062  # 150%
    assert high.weekend_and_holiday_minimums["sunday"] == 4895  # 175% x 27.97 = 48.9475 -> 48.95


def test_exactly_at_minimum_passes_and_one_cent_below_blocks():
    ok = run(base(pay_amount=Decimal("33.85")))
    assert ok.status == "compliant_as_assessed" and not ok.blocking
    low = run(base(pay_amount=Decimal("33.84")))
    assert low.status == "below_minimum" and low.blocking
    assert any(c.code == "below_ordinary_minimum" and c.level == "block" for c in low.checks)


def test_unconfirmed_coverage_or_classification_never_hard_blocks_or_passes():
    for kw in ({"coverage_confirmed": False}, {"classification_confirmed": False}):
        low = run(base(pay_amount=Decimal("20.00"), **kw))
        assert low.status == "requires_review" and not low.blocking
        assert low.needs_acknowledgement
        fine = run(base(pay_amount=Decimal("99.00"), **kw))
        assert fine.status == "requires_review"  # a high rate does not settle coverage


def test_unresolved_instruments_are_reviewed_not_assumed():
    for inst in ("enterprise_agreement", "award_free", "unknown"):
        r = assess(base(instrument=inst), None, effective_on=ON)
        assert r.status == "requires_review" and not r.blocking
    r = assess(base(), None, effective_on=ON)
    assert r.status == "missing_source"


def test_junior_apprentice_trainee_are_not_given_adult_rates():
    for wc in ("junior", "apprentice", "trainee"):
        r = run(base(worker_class=wc, pay_amount=Decimal("1.00")))
        assert (
            r.status == "requires_review"
            and not r.blocking
            and r.minimum_ordinary_hourly_minor is None
        )


def test_classification_must_be_chosen_by_the_employer():
    r = run(base(classification=None, classification_confirmed=False))
    assert r.status == "requires_review"
    assert any(c.code == "classification_required" for c in r.checks)


def test_effective_date_boundary_uses_missing_source_not_a_guess():
    before = run(base(), on=date(2026, 6, 30))
    assert before.status == "missing_source"
    on_day = run(base(), on=date(2026, 7, 1))
    assert on_day.status == "compliant_as_assessed"


def test_role_needing_review_cannot_pass():
    r = run(base(), role_needs_review=True)
    assert r.status == "requires_review"
    assert any(c.code == "role_needs_review" for c in r.checks)


def test_salary_is_never_compliant_and_never_converted_to_hourly():
    r = run(base(pay_period="year", pay_amount=Decimal("90000"), employment="full_time"))
    assert r.status == "requires_review" and r.offered_hourly_minor is None
    weekly_low = run(
        base(
            pay_period="week",
            pay_amount=Decimal("1000"),
            employment="full_time",
            classification="L1",
        )
    )
    assert weekly_low.status == "below_minimum"  # 38-hour weekly minimum is $1,004.90
    weekly_ok = run(
        base(
            pay_period="week",
            pay_amount=Decimal("1010"),
            employment="full_time",
            classification="L1",
        )
    )
    assert weekly_ok.status == "requires_review"
    casual_week = run(base(pay_period="week", pay_amount=Decimal("100"), employment="casual"))
    assert casual_week.status == "requires_review"  # hours unknown: no inference


def test_club_manager_annual_minimum():
    low = run(
        base(
            instrument="MA000058",
            classification="L8",
            employment="full_time",
            pay_period="year",
            pay_amount=Decimal("60000"),
        )
    )
    # Manager levels always need review, so the annual comparison is advisory only.
    assert low.status == "requires_review"
    assert any(c.code == "manager_classification" for c in low.checks)


def test_flat_rate_roster_checks_each_day_with_cross_midnight_split():
    roster = [
        RosterShiftIn(
            local_date=date(2026, 7, 17), local_start=time(20), local_end=time(2)
        ),  # Fri->Sat
        RosterShiftIn(
            local_date=date(2026, 7, 19), local_start=time(10), local_end=time(16), break_minutes=30
        ),  # Sun
    ]
    inp = base(rate_structure="flat_all_hours", pay_amount=Decimal("40.00"), roster=roster)
    r = run(inp)
    fri_sat, sun = r.shifts
    assert [s.day_kind for s in fri_sat.segments] == ["weekday", "saturday"]
    assert [s.minutes for s in fri_sat.segments] == [240, 120]
    assert sun.paid_minutes == 330 and sun.segments[0].day_kind == "sunday"
    assert sun.segments[0].award_minimum_minor == 4062
    assert sun.segments[0].status == "below_minimum"  # 40.00 < 40.62
    assert r.status == "below_minimum" and r.blocking
    ok = run(base(rate_structure="flat_all_hours", pay_amount=Decimal("40.62"), roster=roster))
    assert ok.status == "compliant_as_assessed"


def test_daylight_saving_shift_uses_real_elapsed_time():
    # NSW clocks go forward at 2am on 4 Oct 2026: a 22:00 -> 06:00 shift is 7 hours, not 8.
    roster = [RosterShiftIn(local_date=date(2026, 10, 3), local_start=time(22), local_end=time(6))]
    r = run(base(state="NSW", roster=roster), on=date(2026, 10, 1))
    shift = r.shifts[0]
    assert shift.paid_minutes == 7 * 60
    assert [s.day_kind for s in shift.segments] == ["saturday", "sunday"]
    assert [s.minutes for s in shift.segments] == [120, 300]
    assert shift.time_zone == STATE_ZONES["NSW"] == "Australia/Sydney"


def test_base_plus_penalties_estimates_scale_the_offered_rate():
    roster = [RosterShiftIn(local_date=date(2026, 7, 18), local_start=time(9), local_end=time(13))]
    r = run(base(pay_amount=Decimal("40.00"), roster=roster))  # Saturday, casual L2 restaurant
    seg = r.shifts[0].segments[0]
    assert seg.day_kind == "saturday"
    assert seg.award_minimum_minor == 4062  # 27.08 x 150% = 40.62
    assert seg.estimated_pay_minor == 4800  # 40.00 x (150/125)
    assert r.status == "compliant_as_assessed"
    assert r.super.per_hour_minor == 480  # 12% of $40.00, shown separately from cash wages
    assert r.super.roster_total_minor == round_half_up(
        Decimal(4800 * 240) / Decimal(60) * Decimal("0.12")
    )


def test_public_holiday_calendar_changes_day_kind_when_loaded():
    holiday = date(2026, 12, 25)
    roster = [RosterShiftIn(local_date=holiday, local_start=time(10), local_end=time(14))]
    with_cal = run(
        base(roster=roster, pay_amount=Decimal("90")), holidays={holiday}, on=date(2026, 12, 1)
    )
    assert with_cal.shifts[0].segments[0].day_kind == "public_holiday"
    assert with_cal.shifts[0].segments[0].award_minimum_minor == 6770
    without = run(base(roster=roster, pay_amount=Decimal("90")), on=date(2026, 12, 1))
    assert any(c.code == "public_holiday_calendar_missing" for c in without.checks)
    assert without.shifts[0].segments[0].day_kind in {"weekday", "saturday", "sunday"}


def test_clubs_weekend_rules_are_not_invented():
    roster = [RosterShiftIn(local_date=date(2026, 7, 19), local_start=time(10), local_end=time(14))]
    r = run(
        base(
            instrument="MA000058",
            classification="L3",
            rate_structure="flat_all_hours",
            roster=roster,
            pay_amount=Decimal("90"),
        )
    )
    assert r.status == "missing_source"
    assert r.weekend_and_holiday_minimums["sunday"] is None
    ordinary = run(base(instrument="MA000058", classification="L3", pay_amount=Decimal("34.96")))
    assert ordinary.status == "compliant_as_assessed"
    assert any(c.code == "sunday_rule_missing" for c in ordinary.checks)


def test_fast_food_sunday_differs_by_level():
    l1 = run(base(instrument="MA000003", classification="FF1", employment="part_time"))
    l2 = run(base(instrument="MA000003", classification="FF2", employment="part_time"))
    assert l1.weekend_and_holiday_minimums["sunday"] == 3476  # 125% x 27.81 = 34.7625
    assert l2.weekend_and_holiday_minimums["sunday"] == 4418  # 150% x 29.45 = 44.175 -> 44.18


def test_super_inclusive_pay_is_not_compared_with_the_cash_minimum():
    r = run(base(pay_includes_super=True))
    assert r.status == "requires_review"
    assert any(c.code == "super_inclusive" for c in r.checks)


def test_not_assessed_is_always_disclosed_and_data_status_flagged():
    r = run(base())
    assert any("Overtime" in n for n in r.not_assessed)
    assert r.data_status == "supplied_unverified"
    assert any(c.code == "rates_unverified" for c in r.checks)
