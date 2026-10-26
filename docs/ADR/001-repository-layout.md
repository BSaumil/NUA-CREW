# ADR-001: Repository layout and divergences

**Status:** accepted. Follows the brief's layout. Divergences: `packages/config` is empty (not needed yet); `tests/e2e` is a pnpm workspace package; `services/ingestion-worker` and `services/ai-worker` are not created — ingestion is a module inside `services/api` until a durable queue exists (modular monolith first, per the brief).
