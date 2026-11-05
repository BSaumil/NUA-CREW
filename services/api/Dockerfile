# syntax=docker/dockerfile:1
# Build from the services/api directory: docker build -t nua-crew-api:test .
# One immutable image is used for the API and the background worker; override CMD for the worker.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS dependencies
ENV UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /srv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PATH="/srv/.venv/bin:$PATH"
WORKDIR /srv
RUN groupadd --system --gid 10001 nua && useradd --system --uid 10001 --gid nua --home-dir /srv nua
COPY --from=dependencies --chown=nua:nua /srv/.venv /srv/.venv
COPY --chown=nua:nua app ./app
COPY --chown=nua:nua alembic ./alembic
COPY --chown=nua:nua alembic.ini ./alembic.ini
USER nua
EXPOSE 8000
# Liveness only; the orchestrator separately checks /readyz for database readiness.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=4)" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
