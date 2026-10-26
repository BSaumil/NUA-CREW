"""row level security

Revision ID: b1c2d3e4f5a6
Revises: abcada03429b
Create Date: 2026-10-26 18:00:00
"""

from alembic import op

revision = "b1c2d3e4f5a6"
down_revision = "abcada03429b"
branch_labels = None
depends_on = None

# Tables with RLS enabled and FORCEd (the application connects as the table owner in development;
# production should connect as a non-owner role as well — see ADR-003).
TABLES = [
    "employers", "employer_memberships", "locations", "jobs", "job_skills", "job_versions",
    "applications", "application_events", "candidate_profiles", "candidate_skills", "resumes",
    "resume_versions", "notifications", "audit_events", "consents", "ingestion_sources",
    "source_permissions", "job_source_observations", "source_fetch_runs",
]  # fmt: skip

MINE = "employer_id = ANY(app_employer_ids())"
JOB_IS_MINE = (
    "EXISTS (SELECT 1 FROM jobs j WHERE j.id = {col} AND j.employer_id = ANY(app_employer_ids()))"
)

POLICIES = [
    # employers: name/ABN are public; changes only by privileged actors or the organisation itself
    "CREATE POLICY employers_select ON employers FOR SELECT USING (true)",
    "CREATE POLICY employers_insert ON employers FOR INSERT WITH CHECK (app_privileged())",
    "CREATE POLICY employers_update ON employers FOR UPDATE "
    "USING (app_privileged() OR id = ANY(app_employer_ids()))",
    "CREATE POLICY employers_delete ON employers FOR DELETE USING (app_privileged())",
    # memberships: you see your own and your colleagues'
    "CREATE POLICY memberships_all ON employer_memberships FOR ALL "
    f"USING (app_privileged() OR user_id = app_user_id() OR {MINE}) "
    f"WITH CHECK (app_privileged() OR {MINE})",
    "CREATE POLICY locations_all ON locations FOR ALL "
    f"USING (app_privileged() OR {MINE}) WITH CHECK (app_privileged() OR {MINE})",
    # jobs: drafts are private to the organisation; everything else is readable
    "CREATE POLICY jobs_select ON jobs FOR SELECT "
    f"USING (app_privileged() OR status <> 'draft' OR {MINE})",
    "CREATE POLICY jobs_insert ON jobs FOR INSERT WITH CHECK (app_privileged() OR " + MINE + ")",
    "CREATE POLICY jobs_update ON jobs FOR UPDATE USING (app_privileged() OR " + MINE + ")",
    "CREATE POLICY jobs_delete ON jobs FOR DELETE USING (app_privileged() OR " + MINE + ")",
    "CREATE POLICY job_skills_select ON job_skills FOR SELECT "
    "USING (EXISTS (SELECT 1 FROM jobs j WHERE j.id = job_id))",
    "CREATE POLICY job_skills_write ON job_skills FOR ALL "
    f"USING (app_privileged() OR {JOB_IS_MINE.format(col='job_id')}) "
    f"WITH CHECK (app_privileged() OR {JOB_IS_MINE.format(col='job_id')})",
    "CREATE POLICY job_versions_all ON job_versions FOR ALL "
    f"USING (app_privileged() OR {JOB_IS_MINE.format(col='job_id')}) "
    f"WITH CHECK (app_privileged() OR {JOB_IS_MINE.format(col='job_id')})",
    # applications: the candidate who made it, or the organisation that owns the job
    "CREATE POLICY applications_select ON applications FOR SELECT USING (app_privileged() "
    f"OR candidate_id = app_candidate_id() OR {JOB_IS_MINE.format(col='applications.job_id')})",
    "CREATE POLICY applications_insert ON applications FOR INSERT "
    "WITH CHECK (app_privileged() OR candidate_id = app_candidate_id())",
    "CREATE POLICY applications_update ON applications FOR UPDATE USING (app_privileged() "
    f"OR candidate_id = app_candidate_id() OR {JOB_IS_MINE.format(col='applications.job_id')})",
    "CREATE POLICY applications_delete ON applications FOR DELETE USING (app_privileged())",
    # events inherit visibility from their application
    "CREATE POLICY app_events_select ON application_events FOR SELECT "
    "USING (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_id))",
    "CREATE POLICY app_events_insert ON application_events FOR INSERT "
    "WITH CHECK (EXISTS (SELECT 1 FROM applications a WHERE a.id = application_id))",
    "CREATE POLICY app_events_delete ON application_events FOR DELETE USING (app_privileged())",
    # candidates: own profile; employers only see people who applied to them
    "CREATE POLICY profiles_select ON candidate_profiles FOR SELECT USING (app_privileged() "
    "OR user_id = app_user_id() OR EXISTS (SELECT 1 FROM applications a "
    "WHERE a.candidate_id = candidate_profiles.id))",
    "CREATE POLICY profiles_insert ON candidate_profiles FOR INSERT "
    "WITH CHECK (app_privileged() OR user_id = app_user_id())",
    "CREATE POLICY profiles_update ON candidate_profiles FOR UPDATE "
    "USING (app_privileged() OR user_id = app_user_id())",
    "CREATE POLICY profiles_delete ON candidate_profiles FOR DELETE USING (app_privileged())",
    "CREATE POLICY cand_skills_select ON candidate_skills FOR SELECT "
    "USING (EXISTS (SELECT 1 FROM candidate_profiles p WHERE p.id = candidate_id))",
    "CREATE POLICY cand_skills_write ON candidate_skills FOR ALL "
    "USING (app_privileged() OR EXISTS (SELECT 1 FROM candidate_profiles p "
    "WHERE p.id = candidate_id AND p.user_id = app_user_id())) "
    "WITH CHECK (app_privileged() OR EXISTS (SELECT 1 FROM candidate_profiles p "
    "WHERE p.id = candidate_id AND p.user_id = app_user_id()))",
    "CREATE POLICY resumes_all ON resumes FOR ALL "
    "USING (app_privileged() OR candidate_id = app_candidate_id()) "
    "WITH CHECK (app_privileged() OR candidate_id = app_candidate_id())",
    "CREATE POLICY resume_versions_select ON resume_versions FOR SELECT USING "
    "(EXISTS (SELECT 1 FROM resumes r WHERE r.id = resume_id) OR app_privileged() "
    "OR EXISTS (SELECT 1 FROM applications a WHERE a.resume_version_id = resume_versions.id))",
    "CREATE POLICY resume_versions_write ON resume_versions FOR ALL "
    "USING (app_privileged() OR EXISTS (SELECT 1 FROM resumes r WHERE r.id = resume_id)) "
    "WITH CHECK (app_privileged() OR EXISTS (SELECT 1 FROM resumes r WHERE r.id = resume_id))",
    # per-user and operator-only data
    "CREATE POLICY notifications_select ON notifications FOR SELECT "
    "USING (app_privileged() OR user_id = app_user_id())",
    "CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (app_privileged())",
    "CREATE POLICY notifications_update ON notifications FOR UPDATE "
    "USING (app_privileged() OR user_id = app_user_id())",
    "CREATE POLICY notifications_delete ON notifications FOR DELETE USING (app_privileged())",
    "CREATE POLICY consents_all ON consents FOR ALL "
    "USING (app_privileged() OR user_id = app_user_id()) "
    "WITH CHECK (app_privileged() OR user_id = app_user_id())",
    "CREATE POLICY audit_all ON audit_events FOR ALL USING (app_privileged()) "
    "WITH CHECK (app_privileged())",
    "CREATE POLICY sources_all ON ingestion_sources FOR ALL USING (app_privileged()) "
    "WITH CHECK (app_privileged())",
    "CREATE POLICY source_perms_all ON source_permissions FOR ALL USING (app_privileged()) "
    "WITH CHECK (app_privileged())",
    "CREATE POLICY observations_all ON job_source_observations FOR ALL "
    "USING (app_privileged()) WITH CHECK (app_privileged())",
    "CREATE POLICY fetch_runs_all ON source_fetch_runs FOR ALL USING (app_privileged()) "
    "WITH CHECK (app_privileged())",
]


def upgrade() -> None:
    op.execute(
        "CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS "
        "$$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$"
    )
    op.execute(
        "CREATE FUNCTION app_candidate_id() RETURNS uuid LANGUAGE sql STABLE AS "
        "$$ SELECT nullif(current_setting('app.candidate_id', true), '')::uuid $$"
    )
    op.execute(
        "CREATE FUNCTION app_employer_ids() RETURNS uuid[] LANGUAGE sql STABLE AS "
        "$$ SELECT coalesce(string_to_array(nullif(current_setting('app.employer_ids', true), ''), "
        "',')::uuid[], '{}'::uuid[]) $$"
    )
    op.execute(
        "CREATE FUNCTION app_privileged() RETURNS boolean LANGUAGE sql STABLE AS "
        "$$ SELECT coalesce(current_setting('app.role', true), '') IN ('system', 'admin') $$"
    )
    for t in TABLES:
        op.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {t} FORCE ROW LEVEL SECURITY")
    for p in POLICIES:
        op.execute(p)


def downgrade() -> None:
    op.execute(
        """
        DO $$ DECLARE r record; BEGIN
            FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
                EXECUTE format('DROP POLICY %I ON %I', r.policyname, r.tablename);
            END LOOP;
        END $$
        """
    )
    for t in TABLES:
        op.execute(f"ALTER TABLE {t} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {t} DISABLE ROW LEVEL SECURITY")
    for f in ("app_privileged()", "app_employer_ids()", "app_candidate_id()", "app_user_id()"):
        op.execute(f"DROP FUNCTION {f}")
