"""Re-imports the committed hospitality seed (idempotent).

    cd services/api && uv run python -m app.hospitality_import

Run with the migration (schema owner) connection; verified rates keep their verification only when
the stored figures are unchanged (see app.services.hospitality.importer).
"""

import asyncio
import json

from sqlalchemy import text

from app.db import dispose_engine, get_engine
from app.services.hospitality.importer import import_seed


async def main() -> None:
    try:
        async with get_engine().begin() as conn:
            await conn.execute(text("SELECT set_config('app.role', 'system', true)"))
            counts = await conn.run_sync(import_seed)
        print(json.dumps(counts, indent=2))  # noqa: T201
    finally:
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
