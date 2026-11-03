"""Migration guard: existing RLS tables are extended, never re-labelled in bulk."""

import pytest
from sqlalchemy import text

from app.db import get_engine


@pytest.mark.asyncio
async def test_jurisdiction_columns_exist_without_default_backfill() -> None:
    async with get_engine().connect() as conn:
        result = await conn.execute(
            text(
                "SELECT table_name, column_name, column_default "
                "FROM information_schema.columns WHERE table_schema='public' "
                "AND (table_name, column_name) IN "
                " (('employers','country_code'), ('jobs','country_code'), "
                " ('shifts','country_code'), ('pay_assessments','country_code'), "
                " ('pay_assessments','ruleset_code'))"
            )
        )
        rows = result.all()
        assert len(rows) == 5
        assert all(row.column_default is None for row in rows)

        constraints = await conn.execute(
            text(
                "SELECT conname FROM pg_constraint WHERE conname IN "
                "('ck_employers_country_code','ck_jobs_country_code',"
                "'ck_shifts_country_code','ck_pay_assessments_country_code',"
                "'ck_locations_country_iso')"
            )
        )
        assert len(constraints.all()) == 5
