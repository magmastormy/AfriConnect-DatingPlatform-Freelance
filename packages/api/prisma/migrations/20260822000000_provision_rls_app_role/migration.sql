-- ─────────────────────────────────────────────────────────────────────────────
-- RLS activation prerequisite: least-privilege application role (Phase 2)
-- ─────────────────────────────────────────────────────────────────────────────
-- The tenant-isolation RLS policies (20260819100000_add_tenant_isolation_rls)
-- are bypassed entirely for PostgreSQL SUPERUSERs. This means the API MUST NOT
-- connect as the bootstrap/superuser role (avnadmin on Aiven, POSTGRES_USER in
-- docker-compose) once RLS is enabled — doing so silently leaks every user's
-- rows past the policies (verified by the live RLS smoke test).
--
-- This migration creates the dedicated non-superuser application role that the
-- API must connect as when RLS_ENABLED=true, and grants it CRUD on the public
-- schema. The app database URL (DATABASE_URL) should point at this role, not the
-- superuser. With RLS forced on at boot, only this role is subject to the
-- per-request policies; superuser operations go through the migration/admin path.
--
-- Idempotent: safe to re-run; uses IF NOT EXISTS / conditional grants.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'africonnect_app') THEN
    CREATE ROLE africonnect_app LOGIN PASSWORD 'change_me_in_prod';
  END IF;
END
$$;

-- Least privilege: no superuser, no replication, no bypassrls. It must be
-- subject to RLS for the isolation layer to mean anything.
ALTER ROLE africonnect_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

-- Grant usage + CRUD on the public schema so the app can operate, while the
-- policies (not table grants) govern cross-tenant visibility.
GRANT USAGE ON SCHEMA public TO africonnect_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO africonnect_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO africonnect_app;

-- Future tables: ensure the role keeps the same rights without manual re-grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO africonnect_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO africonnect_app;
