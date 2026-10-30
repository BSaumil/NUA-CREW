"""Explainable heuristic match estimate.

Weights follow the product spec (semantic 30, skills 25, experience 15, commute 10, salary 10,
preference 5, trajectory 5). Components we cannot honestly evaluate yet are reported as
"not_evaluated" and excluded from the denominator; the result is an estimate, never a hire
probability, and gates can never be overridden by a high score.
"""

from dataclasses import dataclass, field
from decimal import Decimal

from app.schemas import MatchComponent

WEIGHTS = {
    "semantic": 30,
    "skills": 25,
    "experience": 15,
    "commute": 10,
    "salary": 10,
    "preference": 5,
    "trajectory": 5,
    "role": 20,  # hospitality role fit; only evaluated when both sides declared roles
}
_HOURS_PER_WEEK = Decimal(38)
_TO_HOURLY = {
    "hour": Decimal(1),
    "day": Decimal("7.6"),
    "week": _HOURS_PER_WEEK,
    "month": _HOURS_PER_WEEK * 52 / 12,
    "year": _HOURS_PER_WEEK * 52,
}


@dataclass
class JobCtx:
    skills: set[str]
    employment_type: str
    suburb: str | None
    state: str | None
    postcode: str | None
    pay_max: Decimal | None
    pay_period: str | None
    pay_basis: str
    role_code: str | None = None
    role_title: str | None = None
    department_code: str | None = None


@dataclass
class CandidateRoleCtx:
    code: str
    title: str
    department_code: str
    years: int | None = None


@dataclass
class CandidateCtx:
    skills: set[str]
    preferred_types: list[str]
    suburb: str | None
    state: str | None
    postcode: str | None
    min_hourly_pay: Decimal | None
    roles: list[CandidateRoleCtx] = field(default_factory=list)


@dataclass
class MatchResult:
    estimate: float | None
    components: list[MatchComponent]
    missing_skills: list[str] = field(default_factory=list)


def _skip(key: str, why: str) -> MatchComponent:
    return MatchComponent(
        key=key,
        weight=WEIGHTS[key],
        evaluated=False,
        score=None,
        evidence=why,
        basis="not_evaluated",
    )


def compute_match(job: JobCtx, cand: CandidateCtx) -> MatchResult:
    comps: list[MatchComponent] = []
    missing: list[str] = []

    comps.append(_skip("semantic", "Semantic matching is not enabled yet."))

    if job.skills:
        hit = job.skills & cand.skills
        missing = sorted(job.skills - cand.skills)
        comps.append(
            MatchComponent(
                key="skills",
                weight=WEIGHTS["skills"],
                evaluated=True,
                score=len(hit) / len(job.skills),
                evidence=f"{len(hit)} of {len(job.skills)} listed skills are on your profile.",
                basis="self_declared",
            )
        )
    else:
        comps.append(_skip("skills", "The employer did not list skills."))

    comps.append(_skip("experience", "Experience matching is not enabled yet."))

    if job.suburb and cand.suburb:
        if job.suburb.lower() == cand.suburb.lower():
            score, ev = 1.0, f"Same suburb ({job.suburb})."
        elif job.postcode and job.postcode == cand.postcode:
            score, ev = 0.9, "Same postcode."
        elif job.state and job.state == cand.state:
            score, ev = 0.4, "Same state. Travel time is not calculated yet."
        else:
            score, ev = 0.0, "Different state."
        comps.append(
            MatchComponent(
                key="commute",
                weight=WEIGHTS["commute"],
                evaluated=True,
                score=score,
                evidence=ev,
                basis="self_declared",
            )
        )
    else:
        comps.append(_skip("commute", "Location is missing on the job or your profile."))

    if cand.min_hourly_pay and job.pay_max is not None and job.pay_period:
        hourly_max = job.pay_max / _TO_HOURLY[job.pay_period]
        ratio = float(min(hourly_max / cand.min_hourly_pay, Decimal(1)))
        label = "estimated" if job.pay_basis == "estimated" else "disclosed"
        comps.append(
            MatchComponent(
                key="salary",
                weight=WEIGHTS["salary"],
                evaluated=True,
                score=ratio,
                evidence=f"Top of the {label} range is about ${hourly_max:.2f}/hour "
                f"against your ${cand.min_hourly_pay}/hour minimum.",
                basis="self_declared",
            )
        )
    else:
        comps.append(_skip("salary", "Pay or your pay expectation is not available."))

    if cand.preferred_types:
        ok = job.employment_type in cand.preferred_types
        comps.append(
            MatchComponent(
                key="preference",
                weight=WEIGHTS["preference"],
                evaluated=True,
                score=1.0 if ok else 0.0,
                evidence=(
                    "Matches your preferred employment type."
                    if ok
                    else "Not one of your preferred employment types."
                ),
                basis="self_declared",
            )
        )
    else:
        comps.append(_skip("preference", "No employment type preference set."))

    comps.append(_skip("trajectory", "Career trajectory matching is not enabled yet."))

    if job.role_code and cand.roles:
        exact = next((r for r in cand.roles if r.code == job.role_code), None)
        related = next((r for r in cand.roles if r.department_code == job.department_code), None)
        if exact:
            yrs = f" with {exact.years} years" if exact.years else ""
            score, ev = 1.0, f"You listed {exact.title}{yrs}."
        elif related:
            score, ev = 0.5, f"You listed {related.title}, in the same area as this role."
        else:
            score, ev = 0.0, "None of your listed roles are in this department."
        comps.append(
            MatchComponent(
                key="role",
                weight=WEIGHTS["role"],
                evaluated=True,
                score=score,
                evidence=ev,
                basis="self_declared",
            )
        )
    else:
        comps.append(
            _skip(
                "role",
                "The job has no listed role or you haven't added roles to your profile.",
            )
        )

    evaluated = [c for c in comps if c.evaluated and c.score is not None]
    total_w = sum(c.weight for c in evaluated)
    estimate = (
        round(sum(c.weight * (c.score or 0) for c in evaluated) / total_w * 100, 1)
        if total_w
        else None
    )
    return MatchResult(estimate=estimate, components=comps, missing_skills=missing)
