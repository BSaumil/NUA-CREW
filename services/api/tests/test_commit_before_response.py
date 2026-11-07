import pytest
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import Session


async def test_a_write_is_committed_before_the_response_is_sent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A client that sends its next request the moment it sees the response must find the write.

    FastAPI runs the cleanup of a `yield` dependency after the response has been sent unless it
    is declared with `scope="function"`. Our one-transaction-per-request session commits in that
    cleanup, so a fast follow-up request could arrive before the commit and read stale data
    (observed as a publish call answering "job not found" right after the create succeeded).
    """
    app = FastAPI()

    @app.post("/write")
    async def write(session: Session) -> dict[str, str]:
        await session.execute(text("select 1"))
        return {"ok": "1"}

    commits: list[bool] = []
    original = AsyncSession.commit

    async def spy(self: AsyncSession) -> None:
        commits.append(True)
        await original(self)

    monkeypatch.setattr(AsyncSession, "commit", spy)

    seen_at_response_start: list[bool] = []

    async def receive() -> dict[str, object]:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, object]) -> None:
        if message["type"] == "http.response.start":
            seen_at_response_start.append(bool(commits))

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "path": "/write",
        "raw_path": b"/write",
        "query_string": b"",
        "headers": [],
        "server": ("test", 80),
        "client": ("test", 1),
        "scheme": "http",
        "root_path": "",
    }
    await app(scope, receive, send)  # type: ignore[arg-type]

    assert seen_at_response_start == [True], "the response was sent before the commit"
    assert commits == [True]
