-- ─────────────────────────────────────────────────────────────────────────────
-- Tenant isolation + PostgreSQL Row-Level Security (Phase 2)
-- ─────────────────────────────────────────────────────────────────────────────
-- Goals:
--   1. Tag every user-owned row with a tenantId (single bootstrap tenant today;
--      structured for future region/white-label partitioning).
--   2. Add RLS policies that scope each request to its own user_id (and tenant),
--      so one user can NEVER read/mutate another's private rows even if a future
--      query forgets to filter by userId. This is defense-in-depth on top of the
--      existing service-layer scoping.
--
-- IMPORTANT (kill-switch): policies are created here but RLS is NOT enabled in
-- this migration. The API calls reconcileRls() at boot; when RLS_ENABLED=true it
-- runs `FORCE ROW LEVEL SECURITY` on these tables, and when false it runs
-- `DISABLE`. This keeps the layer shipped-but-dormant until it has been
-- smoke-tested against a real database, so it cannot silently block legitimate
-- reads (webhooks / admin / discovery) in an unverified state.
--
-- CRITICAL OPERATIONAL REQUIREMENT: PostgreSQL exempts SUPERUSERS from RLS. The
-- API must therefore connect as a LEAST-PRIVILEGE, NON-SUPERUSER role (e.g.
-- `africonnect_app`), never the bootstrap/superuser role (avnadmin on Aiven,
-- POSTGRES_USER in docker-compose). A live smoke test proved that connecting as
-- a superuser silently leaked EVERY user's rows past these policies. Create the
-- app role and grant it CRUD on the schema, then point DATABASE_URL at it.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Tenant partition root ----------------------------------------------------
CREATE TABLE IF NOT EXISTS "tenants" (
  "id"        text PRIMARY KEY,
  "name"      text NOT NULL DEFAULT 'Default tenant',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);
INSERT INTO "tenants" ("id", "name") VALUES ('tnt_bootstrap', 'Default tenant')
  ON CONFLICT ("id") DO NOTHING;

-- 2. tenantId column + index on every user-owned table -------------------------
-- (Existing rows default to the bootstrap tenant; new rows inherit the default.)
ALTER TABLE "auth_users"            ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "auth_sessions"         ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "auth_verification_tokens" ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "vetting_applications"  ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "profile_profiles"      ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "match_matches"         ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "match_daily_queues"    ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "chat_conversations"     ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "chat_messages"         ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "event_rsvps"           ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "event_stars"           ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "billing_subscriptions"  ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "billing_payments"      ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "notify_notifications"   ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "notify_preferences"     ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "vetting_sessions"       ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "admin_audit_logs"       ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';
ALTER TABLE "analytics_profile_views" ADD COLUMN IF NOT EXISTS "tenantId" text NOT NULL DEFAULT 'tnt_bootstrap';

CREATE INDEX IF NOT EXISTS "auth_users_tenantId_idx"            ON "auth_users"            ("tenantId");
CREATE INDEX IF NOT EXISTS "auth_sessions_tenantId_idx"         ON "auth_sessions"         ("tenantId");
CREATE INDEX IF NOT EXISTS "auth_verification_tokens_tenantId_idx" ON "auth_verification_tokens" ("tenantId");
CREATE INDEX IF NOT EXISTS "vetting_applications_tenantId_idx"  ON "vetting_applications"  ("tenantId");
CREATE INDEX IF NOT EXISTS "profile_profiles_tenantId_idx"      ON "profile_profiles"      ("tenantId");
CREATE INDEX IF NOT EXISTS "match_matches_tenantId_idx"         ON "match_matches"         ("tenantId");
CREATE INDEX IF NOT EXISTS "match_daily_queues_tenantId_idx"    ON "match_daily_queues"    ("tenantId");
CREATE INDEX IF NOT EXISTS "chat_conversations_tenantId_idx"     ON "chat_conversations"     ("tenantId");
CREATE INDEX IF NOT EXISTS "chat_messages_tenantId_idx"         ON "chat_messages"         ("tenantId");
CREATE INDEX IF NOT EXISTS "event_rsvps_tenantId_idx"           ON "event_rsvps"           ("tenantId");
CREATE INDEX IF NOT EXISTS "event_stars_tenantId_idx"           ON "event_stars"           ("tenantId");
CREATE INDEX IF NOT EXISTS "billing_subscriptions_tenantId_idx"  ON "billing_subscriptions"  ("tenantId");
CREATE INDEX IF NOT EXISTS "billing_payments_tenantId_idx"      ON "billing_payments"      ("tenantId");
CREATE INDEX IF NOT EXISTS "notify_notifications_tenantId_idx"   ON "notify_notifications"   ("tenantId");
CREATE INDEX IF NOT EXISTS "notify_preferences_tenantId_idx"     ON "notify_preferences"     ("tenantId");
CREATE INDEX IF NOT EXISTS "vetting_sessions_tenantId_idx"       ON "vetting_sessions"       ("tenantId");
CREATE INDEX IF NOT EXISTS "admin_audit_logs_tenantId_idx"       ON "admin_audit_logs"       ("tenantId");
CREATE INDEX IF NOT EXISTS "analytics_profile_views_tenantId_idx" ON "analytics_profile_views" ("tenantId");

-- 3. RLS policies --------------------------------------------------------------
-- Helper expressions:
--   uid  = current_setting('app.current_user_id','on')   (NULL when unset)
--   tid  = current_setting('app.current_tenant_id','on')  (NULL when unset)
--   bypass = current_setting('app.bypass_rls','on') = 'on'  (admin / system / webhook)

-- Owner-scoped tables: userId must match AND tenant must match, or bypass.
CREATE POLICY "auth_users_iso"     ON "auth_users"            USING (current_setting('app.current_user_id','on') = id AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = id AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "auth_sessions_iso"  ON "auth_sessions"         USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "auth_verification_tokens_iso" ON "auth_verification_tokens" USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "vetting_applications_iso" ON "vetting_applications" USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "match_daily_queues_iso" ON "match_daily_queues" USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "event_rsvps_iso"     ON "event_rsvps"           USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "billing_subscriptions_iso" ON "billing_subscriptions" USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "billing_payments_iso" ON "billing_payments"     USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "notify_notifications_iso" ON "notify_notifications" USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "notify_preferences_iso" ON "notify_preferences" USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "vetting_sessions_iso" ON "vetting_sessions"     USING (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');

-- Two-party tables: either participant may read/write their own rows, or bypass.
CREATE POLICY "match_matches_iso"   ON "match_matches"         USING (current_setting('app.current_user_id','on') IN ("userId","matchedUserId") AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') IN ("userId","matchedUserId") AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "chat_conversations_iso" ON "chat_conversations" USING (current_setting('app.current_user_id','on') IN ("participant1Id","participant2Id") AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') IN ("participant1Id","participant2Id") AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "event_stars_iso"     ON "event_stars"           USING (current_setting('app.current_user_id','on') IN ("starerId","starreeId") AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') IN ("starerId","starreeId") AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "analytics_profile_views_iso" ON "analytics_profile_views" USING (current_setting('app.current_user_id','on') IN ("viewerId","viewedUserId") AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') IN ("viewerId","viewedUserId") AND current_setting('app.current_tenant_id','on') = "tenantId" OR current_setting('app.bypass_rls','on') = 'on');

-- chat_messages: a participant may see any message in a conversation they belong
-- to (not just the ones they sent); sender may edit/recall their own.
CREATE POLICY "chat_messages_iso"   ON "chat_messages"         USING (
  current_setting('app.current_user_id','on') = "senderId"
  OR EXISTS (SELECT 1 FROM "chat_conversations" c WHERE c."id" = "chat_messages"."conversationId" AND current_setting('app.current_user_id','on') IN (c."participant1Id", c."participant2Id"))
  OR current_setting('app.bypass_rls','on') = 'on'
) WITH CHECK (
  current_setting('app.current_user_id','on') = "senderId"
  OR current_setting('app.bypass_rls','on') = 'on'
);

-- Profile is a discovery asset: anyone (authenticated or not) may READ profiles,
-- but only the owner (or admin) may INSERT/UPDATE/DELETE their own.
CREATE POLICY "profile_read"  ON "profile_profiles" FOR SELECT USING (true);
CREATE POLICY "profile_write" ON "profile_profiles" FOR INSERT WITH CHECK (current_setting('app.current_user_id','on') = "userId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "profile_upd"   ON "profile_profiles" FOR UPDATE USING (current_setting('app.current_user_id','on') = "userId" OR current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.current_user_id','on') = "userId" OR current_setting('app.bypass_rls','on') = 'on');
CREATE POLICY "profile_del"   ON "profile_profiles" FOR DELETE USING (current_setting('app.current_user_id','on') = "userId" OR current_setting('app.bypass_rls','on') = 'on');

-- admin_audit_logs: back-office only (never user-scoped).
CREATE POLICY "admin_audit_logs_iso" ON "admin_audit_logs" USING (current_setting('app.bypass_rls','on') = 'on') WITH CHECK (current_setting('app.bypass_rls','on') = 'on');

-- NOTE: RLS is intentionally NOT enabled here. The API enables it at boot via
-- reconcileRls() only when RLS_ENABLED=true. Until then these policies are inert.
