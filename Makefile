.PHONY: install db-up db-down migrate seed api worker worker-once web employer test check e2e contracts

install:
	pnpm install
	cd services/api && uv sync

db-up:
	docker compose -f infra/docker/docker-compose.yml up -d --wait

db-down:
	docker compose -f infra/docker/docker-compose.yml down

migrate:
	cd services/api && uv run alembic upgrade head

seed:  ## development-only fictional fixture data
	cd services/api && uv run python -m app.devseed

api:
	cd services/api && uv run uvicorn app.main:app --reload --port 8000

worker:  ## ingestion scheduler + queue worker (loops until SIGTERM)
	cd services/api && uv run python -m app.worker

worker-once:  ## drain due ingestion work and exit
	cd services/api && uv run python -m app.worker --once

web:
	pnpm --filter @nua-crew/web dev

employer:
	pnpm --filter @nua-crew/employer dev

test:
	cd services/api && uv run pytest -q
	pnpm test

check:  ## everything CI runs except the browser e2e
	cd services/api && uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest -q
	pnpm typecheck && pnpm lint && pnpm test && pnpm format:check

e2e:
	pnpm e2e

contracts:
	pnpm contracts
