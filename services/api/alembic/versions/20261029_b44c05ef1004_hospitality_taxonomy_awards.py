"""Hospitality role taxonomy, award rules, pay assessments and candidate roles.

Revision ID: b44c05ef1004
Revises: a33b94de1003
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "b44c05ef1004"
down_revision = "a33b94de1003"
branch_labels = None
depends_on = None

REFERENCE = (
    "hospitality_departments",
    "hospitality_roles",
    "hospitality_role_aliases",
    "venue_types",
    "role_venue_compatibility",
    "industrial_instruments",
    "award_classifications",
    "award_rate_versions",
    "penalty_rule_versions",
    "public_holidays",
)


def uuid_pk() -> sa.Column:
    return sa.Column("id", sa.UUID(), primary_key=True, server_default=sa.text("gen_random_uuid()"))


def upgrade() -> None:
    op.create_table(
        "hospitality_departments",
        sa.Column("code", sa.String(48), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("workstream", sa.String(12), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
    )
    op.create_table(
        "hospitality_roles",
        sa.Column("code", sa.String(12), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("title_norm", sa.String(220), nullable=False),
        sa.Column(
            "department_code",
            sa.String(48),
            sa.ForeignKey("hospitality_departments.code"),
            nullable=False,
        ),
        sa.Column("tier", sa.Integer(), nullable=False),
        sa.Column("workstream", sa.String(12), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("scope_text", sa.String(200), nullable=False),
        sa.Column("compliance_note", sa.Text(), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("indicative_text", sa.String(200), nullable=False),
        sa.Column("indicative_level_min", sa.Integer()),
        sa.Column("indicative_level_max", sa.Integer()),
        sa.Column("duties_based", sa.Boolean(), nullable=False),
        sa.Column("apprentice", sa.Boolean(), nullable=False),
        sa.Column("introductory", sa.Boolean(), nullable=False),
        sa.Column("needs_review", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="active"),
        sa.CheckConstraint("tier BETWEEN 1 AND 9", name="ck_role_tier"),
    )
    op.create_index("ix_hospitality_roles_title_norm", "hospitality_roles", ["title_norm"])
    op.create_index(
        "ix_hospitality_roles_department_code", "hospitality_roles", ["department_code"]
    )
    op.create_table(
        "hospitality_role_aliases",
        uuid_pk(),
        sa.Column(
            "role_code",
            sa.String(12),
            sa.ForeignKey("hospitality_roles.code", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("alias", sa.String(200), nullable=False),
        sa.Column("alias_norm", sa.String(220), nullable=False),
        sa.UniqueConstraint("role_code", "alias_norm", name="uq_role_alias"),
    )
    op.create_index(
        "ix_hospitality_role_aliases_role_code", "hospitality_role_aliases", ["role_code"]
    )
    op.create_index(
        "ix_hospitality_role_aliases_alias_norm", "hospitality_role_aliases", ["alias_norm"]
    )
    op.create_table(
        "venue_types",
        sa.Column("code", sa.String(24), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("award_leads", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("coverage_confidence", sa.String(10), nullable=False),
    )
    op.create_table(
        "role_venue_compatibility",
        sa.Column(
            "role_code",
            sa.String(12),
            sa.ForeignKey("hospitality_roles.code", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "venue_code",
            sa.String(24),
            sa.ForeignKey("venue_types.code", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    op.create_table(
        "industrial_instruments",
        sa.Column("code", sa.String(16), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False, server_default="award"),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="active"),
    )
    op.create_table(
        "award_classifications",
        uuid_pk(),
        sa.Column(
            "instrument_code",
            sa.String(16),
            sa.ForeignKey("industrial_instruments.code"),
            nullable=False,
        ),
        sa.Column("code", sa.String(12), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.UniqueConstraint("instrument_code", "code", name="uq_award_class"),
    )
    op.create_table(
        "award_rate_versions",
        uuid_pk(),
        sa.Column(
            "classification_id",
            sa.UUID(),
            sa.ForeignKey("award_classifications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date()),
        sa.Column("weekly_minor", sa.Integer(), nullable=False),
        sa.Column("hourly_minor", sa.Integer(), nullable=False),
        sa.Column("supplied_casual_ordinary_minor", sa.Integer()),
        sa.Column("annual_minimum_minor", sa.Integer()),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("data_status", sa.String(20), nullable=False),
        sa.Column("source_note", sa.Text(), nullable=False),
        # Plain id (no FK): reference data must outlive any user row; audit_events keeps the actor.
        sa.Column("verified_by", sa.UUID()),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("classification_id", "effective_from", name="uq_rate_effective"),
        sa.CheckConstraint(
            "data_status IN ('supplied_unverified', 'verified')", name="ck_rate_data_status"
        ),
        sa.CheckConstraint(
            "effective_to IS NULL OR effective_to > effective_from", name="ck_rate_window"
        ),
    )
    op.create_index(
        "ix_award_rate_versions_classification_id", "award_rate_versions", ["classification_id"]
    )
    op.create_table(
        "penalty_rule_versions",
        uuid_pk(),
        sa.Column(
            "instrument_code",
            sa.String(16),
            sa.ForeignKey("industrial_instruments.code"),
            nullable=False,
        ),
        sa.Column("employment", sa.String(10), nullable=False),
        sa.Column("classification_codes", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("day_kind", sa.String(16), nullable=False),
        sa.Column("multiplier_bp", sa.Integer(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date()),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.Column("data_status", sa.String(20), nullable=False),
        sa.Column("source_note", sa.Text(), nullable=False),
        # Plain id (no FK): reference data must outlive any user row; audit_events keeps the actor.
        sa.Column("verified_by", sa.UUID()),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint(
            "instrument_code",
            "employment",
            "day_kind",
            "effective_from",
            "classification_codes",
            name="uq_penalty_rule",
        ),
        sa.CheckConstraint("employment IN ('permanent', 'casual')", name="ck_penalty_employment"),
        sa.CheckConstraint(
            "day_kind IN ('weekday', 'saturday', 'sunday', 'public_holiday')",
            name="ck_penalty_day_kind",
        ),
        sa.CheckConstraint(
            "data_status IN ('supplied_unverified', 'verified')", name="ck_penalty_data_status"
        ),
        sa.CheckConstraint("multiplier_bp BETWEEN 5000 AND 50000", name="ck_penalty_multiplier"),
    )
    op.create_table(
        "public_holidays",
        uuid_pk(),
        sa.Column("state", sa.String(3), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=False),
        sa.UniqueConstraint("state", "holiday_date", name="uq_public_holiday"),
    )
    op.create_table(
        "pay_assessments",
        uuid_pk(),
        sa.Column(
            "employer_id",
            sa.UUID(),
            sa.ForeignKey("employers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("job_id", sa.UUID(), sa.ForeignKey("jobs.id", ondelete="SET NULL")),
        sa.Column("created_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("effective_on", sa.Date(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("input_hash", sa.String(64), nullable=False),
        sa.Column("input", postgresql.JSONB(), nullable=False),
        sa.Column("result", postgresql.JSONB(), nullable=False),
        sa.CheckConstraint(
            "status IN ('compliant_as_assessed', 'below_minimum', 'requires_review', "
            "'missing_source')",
            name="ck_assessment_status",
        ),
    )
    op.create_index("ix_pay_assessments_employer_id", "pay_assessments", ["employer_id"])
    op.create_index("ix_pay_assessments_job_id", "pay_assessments", ["job_id"])
    op.create_table(
        "pay_assessment_acknowledgements",
        uuid_pk(),
        sa.Column(
            "assessment_id",
            sa.UUID(),
            sa.ForeignKey("pay_assessments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "employer_id",
            sa.UUID(),
            sa.ForeignKey("employers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column(
            "acknowledged_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("note", sa.String(1000)),
    )
    op.create_index(
        "ix_pay_assessment_acknowledgements_employer_id",
        "pay_assessment_acknowledgements",
        ["employer_id"],
    )
    op.create_table(
        "candidate_roles",
        uuid_pk(),
        sa.Column(
            "candidate_id",
            sa.UUID(),
            sa.ForeignKey("candidate_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "role_code", sa.String(12), sa.ForeignKey("hospitality_roles.code"), nullable=False
        ),
        sa.Column("years_experience", sa.Integer()),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("candidate_id", "role_code", name="uq_candidate_role"),
        sa.CheckConstraint(
            "years_experience IS NULL OR years_experience BETWEEN 0 AND 60",
            name="ck_candidate_role_years",
        ),
    )
    op.create_index("ix_candidate_roles_candidate_id", "candidate_roles", ["candidate_id"])

    op.add_column("jobs", sa.Column("role_code", sa.String(12)))
    op.add_column("jobs", sa.Column("pay_assessment_id", sa.UUID()))
    op.create_foreign_key(
        "fk_jobs_role_code",
        "jobs",
        "hospitality_roles",
        ["role_code"],
        ["code"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_jobs_pay_assessment",
        "jobs",
        "pay_assessments",
        ["pay_assessment_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_jobs_role_code", "jobs", ["role_code"])

    # --- row-level security -------------------------------------------------------------
    # Reference data: world-readable (it is the public taxonomy), writable only by system scope.
    for table in REFERENCE:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"CREATE POLICY {table}_read ON {table} FOR SELECT USING (true)")
        op.execute(
            f"CREATE POLICY {table}_insert ON {table} FOR INSERT WITH CHECK (app_privileged())"
        )
        op.execute(f"CREATE POLICY {table}_update ON {table} FOR UPDATE USING (app_privileged())")
        op.execute(f"CREATE POLICY {table}_delete ON {table} FOR DELETE USING (app_privileged())")
    # Pay assessments: the issuing business only. Immutable: no UPDATE policy for tenants.
    for table in ("pay_assessments", "pay_assessment_acknowledgements"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        mine = "employer_id = ANY(app_employer_ids())"
        op.execute(
            f"CREATE POLICY {table}_read ON {table} FOR SELECT USING (app_privileged() OR {mine})"
        )
        op.execute(
            f"CREATE POLICY {table}_insert ON {table} FOR INSERT WITH CHECK (app_privileged() OR {mine})"
        )
        op.execute(f"CREATE POLICY {table}_update ON {table} FOR UPDATE USING (app_privileged())")
        op.execute(f"CREATE POLICY {table}_delete ON {table} FOR DELETE USING (app_privileged())")
    # Candidate roles: private to the person; employers never read this table.
    op.execute("ALTER TABLE candidate_roles ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE candidate_roles FORCE ROW LEVEL SECURITY")
    own = "candidate_id = app_candidate_id()"
    op.execute(
        "CREATE POLICY candidate_roles_all ON candidate_roles "
        f"USING (app_privileged() OR {own}) WITH CHECK (app_privileged() OR {own})"
    )

    # --- seed data (idempotent; also runnable later via app.hospitality_import) ------------
    from app.services.hospitality.importer import import_seed

    bind = op.get_bind()
    op.execute("SELECT set_config('app.role', 'system', true)")
    import_seed(bind)


def downgrade() -> None:
    op.drop_index("ix_jobs_role_code", "jobs")
    op.drop_constraint("fk_jobs_pay_assessment", "jobs", type_="foreignkey")
    op.drop_constraint("fk_jobs_role_code", "jobs", type_="foreignkey")
    op.drop_column("jobs", "pay_assessment_id")
    op.drop_column("jobs", "role_code")
    for table in (
        "candidate_roles",
        "pay_assessment_acknowledgements",
        "pay_assessments",
        "public_holidays",
        "penalty_rule_versions",
        "award_rate_versions",
        "award_classifications",
        "industrial_instruments",
        "role_venue_compatibility",
        "venue_types",
        "hospitality_role_aliases",
        "hospitality_roles",
        "hospitality_departments",
    ):
        op.drop_table(table)
