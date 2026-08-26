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
-- Aiven-safe: all privileged operations are wrapped to handle
--   `insufficient_privilege` (SQLSTATE 42501) gracefully — on managed
--   Postgres (Aiven, Neon, etc.) the deploy role is not a true superuser and
--   `ALTER ROLE ... SUPERUSER` is forbidden. We catch that and continue so
--   `prisma migrate deploy` does not fail in production.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'africonnect_app') THEN
    BEGIN
      CREATE ROLE africonnect_app LOGIN PASSWORD 'change_me_in_prod';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'provision_rls_app_role: cannot CREATE ROLE africonnect_app — insufficient privilege, skipping (expected on Aiven)';
    WHEN duplicate_object THEN
      -- race: role was created concurrently
      NULL;
    WHEN OTHERS THEN
      RAISE NOTICE 'provision_rls_app_role: CREATE ROLE failed: %', SQLERRM;
    END;
  END IF;
END
$$;

-- Least privilege: no superuser, no replication, no bypassrls. It must be
-- subject to RLS for the isolation layer to mean anything.
-- Wrapped: on Aiven `avnadmin` is not a superuser and cannot ALTER SUPERUSER.
DO $$
BEGIN
  BEGIN
    ALTER ROLE africonnect_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'provision_rls_app_role: cannot ALTER ROLE africonnect_app — insufficient privilege, skipping';
  WHEN undefined_object THEN
    RAISE NOTICE 'provision_rls_app_role: role africonnect_app does not exist yet, skipping ALTER';
  WHEN OTHERS THEN
    RAISE NOTICE 'provision_rls_app_role: ALTER ROLE failed: %', SQLERRM;
  END;
END
$$;

-- Grant usage + CRUD on the public schema so the app can operate, while the
-- policies (not table grants) govern cross-tenant visibility.
-- Each GRANT is wrapped so a single permission error does not abort the whole
-- migration on managed Postgres where the deploy user may lack GRANT OPTION.
DO $$
BEGIN
  BEGIN
    GRANT USAGE ON SCHEMA public TO africonnect_app;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'provision_rls_app_role: GRANT USAGE ON SCHEMA failed — insufficient privilege';
  WHEN OTHERS THEN
    RAISE NOTICE 'provision_rls_app_role: GRANT USAGE failed: %', SQLERRM;
  END;

  BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO africonnect_app;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'provision_rls_app_role: GRANT ON ALL TABLES failed — insufficient privilege';
  WHEN OTHERS THEN
    RAISE NOTICE 'provision_rls_app_role: GRANT ON ALL TABLES failed: %', SQLERRM;
  END;

  BEGIN
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO africonnect_app;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'provision_rls_app_role: GRANT ON SEQUENCES failed — insufficient privilege';
  WHEN OTHERS THEN
    RAISE NOTICE 'provision_rls_app_role: GRANT ON SEQUENCES failed: %', SQLERRM;
  END;
END
$$;

-- Future tables: ensure the role keeps the same rights without manual re-grants.
DO $$
BEGIN
  BEGIN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO africonnect_app;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'provision_rls_app_role: ALTER DEFAULT PRIVILEGES (tables) failed — insufficient privilege';
  WHEN OTHERS THEN
    RAISE NOTICE 'provision_rls_app_role: ALTER DEFAULT PRIVILEGES (tables) failed: %', SQLERRM;
  END;

  BEGIN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO africonnect_app;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'provision_rls_app_role: ALTER DEFAULT PRIVILEGES (sequences) failed — insufficient privilege';
  WHEN OTHERS THEN
    RAISE NOTICE 'provision_rls_app_role: ALTER DEFAULT PRIVILEGES (sequences) failed: %', SQLERRM;
  END;
END
$$;
