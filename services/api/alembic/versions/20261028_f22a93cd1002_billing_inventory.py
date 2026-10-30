"""Billing domain records and capacity-limited inventory; no payment adapter or checkout.

Revision ID: f22a93cd1002
Revises: e11a92bc1001
"""

from alembic import op

revision = "f22a93cd1002"
down_revision = "e11a92bc1001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for ddl in (
        """CREATE TABLE billing_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      action varchar(30) NOT NULL, amount_minor integer NOT NULL,
      client_key varchar(80) NOT NULL, terms_hash varchar(64) NOT NULL,
      checkout_session_id varchar(200) UNIQUE, payment_intent_id varchar(200) UNIQUE,
      refund_id varchar(200) UNIQUE, review_required boolean NOT NULL DEFAULT false,
      status varchar(20) NOT NULL DEFAULT 'pending',
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_billing_order_retry UNIQUE(employer_id, client_key),
      CONSTRAINT ck_order_amount CHECK (amount_minor IN (1900,3000,4900)),
      CONSTRAINT ck_order_status CHECK (status IN ('pending','settled','expired','refund_required','refunded'))
    )""",
        """CREATE TABLE promotion_reservations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL UNIQUE REFERENCES billing_orders(id) ON DELETE CASCADE,
      employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      market varchar(300) NOT NULL, slot integer NOT NULL,
      starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, hold_expires_at timestamptz NOT NULL,
      status varchar(10) NOT NULL DEFAULT 'held',
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT ck_promotion_slot CHECK (slot BETWEEN 1 AND 5 AND ends_at > starts_at),
      CONSTRAINT ck_promotion_status CHECK (status IN ('held','active','released')),
      CONSTRAINT ex_promotion_capacity EXCLUDE USING gist
        (market WITH =, slot WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
        WHERE (status IN ('held','active'))
    )""",
        """CREATE TABLE ad_entitlements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL UNIQUE REFERENCES billing_orders(id) ON DELETE CASCADE,
      employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true
    )""",
        """CREATE TABLE published_promotions (
      id uuid PRIMARY KEY REFERENCES promotion_reservations(id) ON DELETE CASCADE,
      job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      market varchar(300) NOT NULL, slot integer NOT NULL,
      starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, active boolean NOT NULL DEFAULT true
    )""",
        """CREATE INDEX ix_published_promotions_job_id ON published_promotions(job_id)""",
        """CREATE TABLE billing_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES billing_orders(id) ON DELETE CASCADE,
      employer_id uuid NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
      provider varchar(40) NOT NULL, event_key varchar(200) NOT NULL, fingerprint varchar(64) NOT NULL,
      event_kind varchar(20) NOT NULL, amount_minor integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT uq_billing_provider_event UNIQUE(provider,event_key)
    )""",
        """CREATE FUNCTION forbid_billing_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Billing ledger is append-only'; END $$""",
        """CREATE TRIGGER billing_ledger_immutable BEFORE UPDATE OR DELETE ON billing_ledger
      FOR EACH ROW EXECUTE FUNCTION forbid_billing_ledger_mutation();""",
    ):
        op.execute(ddl)
    for table in ("billing_orders", "promotion_reservations", "ad_entitlements", "billing_ledger"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_read ON {table} FOR SELECT USING (app_privileged() OR employer_id = ANY(app_employer_ids()))"
        )
        op.execute(
            f"CREATE POLICY {table}_insert ON {table} FOR INSERT WITH CHECK (app_privileged())"
        )
        if table != "billing_ledger":
            op.execute(
                f"CREATE POLICY {table}_update ON {table} FOR UPDATE USING (app_privileged()) WITH CHECK (app_privileged())"
            )
            op.execute(
                f"CREATE POLICY {table}_delete ON {table} FOR DELETE USING (app_privileged())"
            )
    op.execute("ALTER TABLE published_promotions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE published_promotions FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY published_promotions_read ON published_promotions FOR SELECT USING (true)"
    )
    op.execute(
        "CREATE POLICY published_promotions_write ON published_promotions FOR ALL USING (app_privileged()) WITH CHECK (app_privileged())"
    )


def downgrade() -> None:
    op.drop_table("published_promotions")
    op.drop_table("billing_ledger")
    op.execute("DROP FUNCTION forbid_billing_ledger_mutation()")
    op.drop_table("ad_entitlements")
    op.drop_table("promotion_reservations")
    op.drop_table("billing_orders")
