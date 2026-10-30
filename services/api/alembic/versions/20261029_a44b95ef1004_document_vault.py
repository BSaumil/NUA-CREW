"""Private document vault and consented application attachments.

Revision ID: a44b95ef1004
Revises: b44c05ef1004
"""

from alembic import op
from sqlalchemy import text

revision = "a44b95ef1004"
down_revision = "b44c05ef1004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""CREATE TABLE candidate_documents (
        id uuid PRIMARY KEY, candidate_id uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        kind varchar(20) NOT NULL, title varchar(160) NOT NULL, filename varchar(160) NOT NULL,
        content_type varchar(80) NOT NULL, size_bytes integer NOT NULL, client_key varchar(80) NOT NULL,
        status varchar(12) NOT NULL DEFAULT 'pending', sha256 varchar(64), issuer varchar(160),
        jurisdiction varchar(8), completed_on date, review_due_on date, scanned_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_document_kind CHECK (kind IN ('resume','rsa','food_safety','first_aid','qualification','other')),
        CONSTRAINT ck_document_status CHECK (status IN ('pending','ready')),
        CONSTRAINT ck_document_size CHECK (size_bytes > 0 AND size_bytes <= 4194304),
        CONSTRAINT uq_document_client_key UNIQUE(candidate_id,client_key)
    )""")
    op.execute(
        "CREATE INDEX ix_candidate_documents_candidate_id ON candidate_documents(candidate_id)"
    )
    op.execute("""CREATE TABLE application_documents (
        application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        document_id uuid NOT NULL REFERENCES candidate_documents(id) ON DELETE CASCADE,
        candidate_id uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
        PRIMARY KEY(application_id,document_id)
    )""")
    op.execute(
        "CREATE INDEX ix_application_documents_candidate_id ON application_documents(candidate_id)"
    )
    op.execute("""CREATE TABLE document_deletions (
        id uuid PRIMARY KEY, candidate_id uuid NOT NULL, attempts integer NOT NULL DEFAULT 0
    )""")
    own = "app_privileged() OR candidate_id = app_candidate_id()"
    for table in ("candidate_documents", "application_documents"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_owner ON {table} FOR ALL USING ({own}) WITH CHECK ({own})"
        )
    op.execute("ALTER TABLE document_deletions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE document_deletions FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY deletion_insert ON document_deletions FOR INSERT WITH CHECK (" + own + ")"
    )
    op.execute(
        "CREATE POLICY deletion_worker ON document_deletions FOR ALL USING (app_privileged()) WITH CHECK (app_privileged())"
    )
    # A deletion, including account cascade, cannot lose its storage cleanup job.
    op.execute("""CREATE FUNCTION queue_document_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN INSERT INTO document_deletions(id,candidate_id) VALUES(OLD.id,OLD.candidate_id)
      ON CONFLICT(id) DO NOTHING; RETURN OLD; END $$""")
    op.execute(
        "CREATE TRIGGER document_cleanup BEFORE DELETE ON candidate_documents FOR EACH ROW EXECUTE FUNCTION queue_document_deletion()"
    )


def downgrade() -> None:
    op.execute("SELECT set_config('app.role','system',true)")
    remaining = op.get_bind().scalar(
        text(
            "SELECT (SELECT count(*) FROM candidate_documents) + (SELECT count(*) FROM document_deletions)"
        )
    )
    if remaining:
        raise RuntimeError(
            "Remove documents through the API and drain storage cleanup before downgrade."
        )
    op.execute("DROP TRIGGER document_cleanup ON candidate_documents")
    op.execute("DROP FUNCTION queue_document_deletion()")
    op.drop_table("application_documents")
    op.drop_table("candidate_documents")
    op.drop_table("document_deletions")
