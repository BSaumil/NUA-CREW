"""Saved-search alerts: one notification per search when new matching jobs appear."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CandidateProfile, SavedSearch
from app.services.notify import notify
from app.services.search import SearchParams, build

MIN_GAP = timedelta(hours=1)  # at most one alert per search per hour; jobs simply accumulate


async def run_alerts(session: AsyncSession, now: datetime | None = None) -> int:
    """Create `job.alert` notifications; returns how many. Caller must run privileged."""
    now = now or datetime.now(UTC)
    searches = list(
        await session.scalars(
            select(SavedSearch)
            .where(SavedSearch.alerts_enabled.is_(True))
            .order_by(SavedSearch.created_at)
            .with_for_update(skip_locked=True)
        )
    )
    created = 0
    for s in searches:
        since = s.last_alerted_at or s.created_at
        if now - since < MIN_GAP:
            continue
        candidate = await session.get(CandidateProfile, s.candidate_id)
        if candidate is None:
            continue
        params = SearchParams.from_saved(s.params)
        params.published_after = since
        params.sort = "newest"
        stmt, count_stmt = build(params)
        total = await session.scalar(count_stmt) or 0
        if total == 0:
            continue
        top = list(await session.scalars(stmt.limit(3)))
        plural = "s" if total != 1 else ""
        await notify(
            session,
            candidate.user_id,
            "job.alert",
            f"{total} new job{plural} for \u201c{s.name}\u201d",
            ", ".join(j.title for j in top),
            saved_search_id=str(s.id),
            count=total,
            job_ids=[str(j.id) for j in top],
        )
        s.last_alerted_at = now
        created += 1
    return created
