"""Public job search shared by the API route and saved-search alerts."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import ColumnElement, Select, case, func, literal, or_, select

from app.models import Job, JobSkill, Skill
from app.services.jobs import slugify
from app.services.matching import _TO_HOURLY

Sort = Literal["relevance", "newest", "pay", "distance"]
SAVED_SEARCH_KEYS = {
    "q", "suburb", "state", "employment_type", "category", "skill", "min_hourly",
    "near_lat", "near_lng", "radius_km", "posted_within_days",
}  # fmt: skip


@dataclass
class SearchParams:
    q: str | None = None
    suburb: str | None = None
    state: str | None = None
    employment_type: str | None = None
    category: str | None = None
    skill: str | None = None
    min_hourly: float | None = None
    near_lat: float | None = None
    near_lng: float | None = None
    radius_km: float | None = None
    posted_within_days: int | None = None
    published_after: datetime | None = None  # used by alerts
    sort: Sort = "relevance"

    @classmethod
    def from_saved(cls, data: dict[str, Any]) -> "SearchParams":
        return cls(**{k: v for k, v in data.items() if k in SAVED_SEARCH_KEYS})


def hourly_max_expr() -> ColumnElement[float]:
    """Top of the advertised range normalised to dollars/hour (38-hour week, as in matching)."""
    expr: ColumnElement[float] = case(
        *[(Job.pay_period == period, Job.pay_max / float(f)) for period, f in _TO_HOURLY.items()],
        else_=None,
    )
    return expr


def distance_expr(lat: float, lng: float) -> ColumnElement[float]:
    """Great-circle distance in km from (lat, lng) to the job's approximate centroid."""
    rad = func.radians
    cos_angle = func.cos(rad(literal(lat))) * func.cos(rad(Job.lat)) * func.cos(
        rad(Job.lng) - rad(literal(lng))
    ) + func.sin(rad(literal(lat))) * func.sin(rad(Job.lat))
    result: ColumnElement[float] = 6371.0 * func.acos(func.least(1.0, cos_angle))
    return result


def build(p: SearchParams) -> tuple[Select[Any], Select[Any]]:
    """Returns (jobs query without paging, count query)."""
    where: list[ColumnElement[bool]] = [
        Job.status == "published",
        or_(Job.expires_at.is_(None), Job.expires_at > func.now()),
    ]
    if p.suburb:
        where.append(func.lower(Job.suburb) == p.suburb.lower())
    if p.state:
        where.append(Job.state == p.state.upper())
    if p.employment_type:
        where.append(Job.employment_type == p.employment_type)
    if p.category:
        where.append(func.lower(Job.category) == p.category.lower())
    if p.skill:
        where.append(
            Job.id.in_(
                select(JobSkill.job_id)
                .join(Skill, Skill.id == JobSkill.skill_id)
                .where(Skill.slug == slugify(p.skill))
            )
        )
    if p.min_hourly is not None:
        where.append(hourly_max_expr() >= p.min_hourly)
    if p.posted_within_days:
        where.append(
            Job.published_at > func.now() - func.make_interval(0, 0, 0, p.posted_within_days)
        )
    if p.published_after is not None:
        where.append(Job.published_at > p.published_after)
    near = p.near_lat is not None and p.near_lng is not None
    if near:
        assert p.near_lat is not None and p.near_lng is not None  # noqa: S101
        dist = distance_expr(p.near_lat, p.near_lng)
        where.append(Job.lat.is_not(None))
        if p.radius_km:
            where.append(dist <= p.radius_km)

    stmt = select(Job).where(*where)
    count = select(func.count()).select_from(Job).where(*where)
    tsq = None
    if p.q and p.q.strip():
        tsq = func.websearch_to_tsquery("english", p.q)
        stmt = stmt.where(Job.search_vector.op("@@")(tsq))
        count = count.where(Job.search_vector.op("@@")(tsq))

    newest = [Job.published_at.desc().nulls_last(), Job.id]
    if p.sort == "pay":
        stmt = stmt.order_by(hourly_max_expr().desc().nulls_last(), *newest)
    elif p.sort == "distance" and near:
        assert p.near_lat is not None and p.near_lng is not None  # noqa: S101
        stmt = stmt.order_by(distance_expr(p.near_lat, p.near_lng).asc().nulls_last(), *newest)
    elif p.sort == "relevance" and tsq is not None:
        stmt = stmt.order_by(func.ts_rank_cd(Job.search_vector, tsq).desc(), *newest)
    else:
        stmt = stmt.order_by(*newest)
    return stmt, count
