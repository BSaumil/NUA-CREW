"""Human support review of minimal reported excerpts; never expose an entire private inbox."""

import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.audit import audit
from app.deps import AdminUser, Session
from app.errors import conflict, not_found
from app.models import Conversation, MessageReport
from app.schemas import Orm

router = APIRouter(prefix="/v1/admin/message-reports", tags=["moderation"])


class ModerationReportOut(Orm):
    id: uuid.UUID
    conversation_id: uuid.UUID | None
    reporter_role: str
    reason: str
    excerpt: str | None
    status: str
    created_at: datetime


class ReviewReportIn(BaseModel):
    outcome: Literal["resolved", "dismissed", "close_conversation"]
    reason_code: Literal["harassment", "spam", "scam", "other", "no_violation"]


@router.get("", response_model=list[ModerationReportOut])
async def list_reports(
    admin: AdminUser,
    session: Session,
    status: Literal["open", "closed"] = "open",
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[MessageReport]:
    rows = list(
        await session.scalars(
            select(MessageReport)
            .where(MessageReport.status == status)
            .order_by(MessageReport.created_at.desc(), MessageReport.id.desc())
            .limit(limit)
            .offset(offset)
        )
    )
    await audit(
        session, admin.id, "moderation.reports_viewed", "message_report",
        report_ids=[str(r.id) for r in rows], status=status,
    )  # fmt: skip
    return rows


@router.post("/{report_id}/review", response_model=ModerationReportOut)
async def review_report(
    report_id: uuid.UUID, body: ReviewReportIn, admin: AdminUser, session: Session
) -> MessageReport:
    report = await session.scalar(
        select(MessageReport).where(MessageReport.id == report_id).with_for_update()
    )
    if report is None:
        raise not_found("report")
    if report.status != "open":
        raise conflict("report_already_reviewed", "Another reviewer has already closed this report")
    if body.outcome == "close_conversation":
        if report.conversation_id is None:
            raise conflict(
                "conversation_removed", "The conversation was deleted; resolve the report"
            )
        conv = await session.scalar(
            select(Conversation).where(Conversation.id == report.conversation_id).with_for_update()
        )
        if conv is None:
            raise conflict(
                "conversation_removed", "The conversation was deleted; resolve the report"
            )
        conv.status = "closed"
        # Preserve a stronger block reason and its employer access restriction.
        if conv.closed_reason != "blocked":
            conv.closed_reason = "moderated"
        await audit(session, admin.id, "moderation.conversation_closed", "conversation", conv.id)
    report.status = "closed"
    await session.flush()
    await audit(
        session, admin.id, "moderation.report_reviewed", "message_report", report.id,
        outcome=body.outcome, reason_code=body.reason_code,
    )  # fmt: skip
    return report
