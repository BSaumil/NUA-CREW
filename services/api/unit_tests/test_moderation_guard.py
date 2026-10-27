"""The operator boundary must reject non-operators before touching private report rows."""

import uuid

import httpx
import pytest

from app.db import get_session
from app.deps import current_user
from app.main import create_app
from app.models import User


@pytest.mark.parametrize("role", ["anonymous", "candidate", "employer"])
async def test_moderation_cannot_be_accessed_by_non_operators(role):
    app = create_app()

    async def no_database():
        yield object()  # Any SQL attempt fails the test; no private rows should be queried.

    app.dependency_overrides[get_session] = no_database
    if role != "anonymous":

        async def viewer():
            return User(id=uuid.uuid4(), role=role, email="test@example.invalid")

        app.dependency_overrides[current_user] = viewer
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        expected = 401 if role == "anonymous" else 403
        assert (await client.get("/v1/admin/message-reports")).status_code == expected
        response = await client.post(
            f"/v1/admin/message-reports/{uuid.uuid4()}/review",
            json={"outcome": "resolved", "reason_code": "spam"},
        )
        assert response.status_code == expected
