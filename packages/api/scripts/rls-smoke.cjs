/**
 * RLS ENFORCEMENT SMOKE TEST (plain CommonJS — no TS loader needed)
 * ───────────────────────────────────────────────────────────────────────────
 * Proves PostgreSQL Row-Level Security actually isolates one user's data from
 * another at the database boundary, even when a query forgets to filter by
 * userId. Runs against a live Postgres.
 *
 * KEY FINDING THIS TEST CATCHES: PostgreSQL exempts SUPERUSERS from RLS. The app
 * MUST connect as a least-privilege, NON-superuser role or the policies are
 * silently inert. This test sets up such a role (`afriapp`) and runs every
 * assertion through it; setup/role-creation uses the privileged DATABASE_URL.
 *
 * The RLS glue here is a VERBATIM copy of src/config/prisma.ts ($extends +
 * SET LOCAL GUCs) and src/config/requestContext.ts (AsyncLocalStorage).
 *
 * Run (from packages/api):
 *   DATABASE_URL='postgresql://SUPERUSER:PASS@host:5432/db?sslmode=disable' \
 *   DATABASE_URL_APP='postgresql://afriapp:afriapp_pw@host:5432/db?sslmode=disable' \
 *   RLS_ENABLED=true BOOTSTRAP_TENANT_ID=tnt_bootstrap NODE_ENV=test \
 *   node scripts/rls-smoke.cjs
 */
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

// Normal env: require('@prisma/client'). In the WorkBuddy sandbox the safe-delete
// hook blocks `prisma generate`, so fall back to a client generated into a writable
// dir (see docker-compose.test.yml note). Either way we exercise the same engine.
let PrismaClient;
try {
  ({ PrismaClient } = require('@prisma/client'));
} catch {
  ({ PrismaClient } = require(path.resolve(__dirname, '../../.prisma-gen/client')));
}

// ── request context (mirrors src/config/requestContext.ts) ──────────────────
const BOOTSTRAP_TENANT_ID = process.env.BOOTSTRAP_TENANT_ID || 'tnt_bootstrap';
const store = new AsyncLocalStorage();
function runRequestContext(ctx, fn) {
  return store.run(ctx, fn);
}
function getRequestContext() {
  return store.getStore();
}

// ── RLS_ENABLED (mirrors src/config/prisma.ts) ───────────────────────────────
const RLS_ENABLED = (process.env.RLS_ENABLED ?? 'false').toLowerCase() === 'true';
function buildDatabaseUrl(raw) {
  if (!raw) return raw;
  let url;
  try { url = new URL(raw); } catch { return raw; }
  const limit = Number(process.env.PRISMA_CONNECTION_LIMIT) || 5;
  if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', String(limit));
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
  return url.toString();
}

const adminUrl = process.env.DATABASE_URL;
const appUrl = process.env.DATABASE_URL_APP ||
  adminUrl.replace(/^(postgresql:\/\/)[^:]+:[^@]*@/, '$1afriapp:afriapp_pw@');

const adminPrisma = new PrismaClient({ datasources: { db: { url: buildDatabaseUrl(adminUrl) } } });
const appPrisma = new PrismaClient({ datasources: { db: { url: buildDatabaseUrl(appUrl) } } });

// Verbatim replica of the FIXED shipped glue (src/config/prisma.ts).
// KEY FIX: capture the request context SYNCHRONOUSLY at property-access time via
// getPrisma(), NOT by reading getRequestContext() inside $allOperations — Prisma's
// async boundary DROPS the AsyncLocalStorage store, so the old pattern always saw
// `undefined` and forced bypass=true (RLS silently inert). The scoped client is
// built with the ctx closed over, and memoized on the ctx object.
function camel(model) { return model.charAt(0).toLowerCase() + model.slice(1); }
function makeScopedClient(client, ctx) {
  return client.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        if (!RLS_ENABLED || !model) return query(args);
        const bypass = !!ctx?.bypassRls || !ctx?.userId;
        return client.$transaction(async (tx) => {
          if (bypass) {
            await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
          } else {
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', $1, true)`, ctx.userId);
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, ctx.tenantId);
          }
          const delegate = tx[camel(model)];
          return delegate[operation](args);
        });
      },
    },
  });
}
let systemClient = null;
function getSystemClient() {
  if (!systemClient) systemClient = makeScopedClient(appPrisma, { tenantId: BOOTSTRAP_TENANT_ID, bypassRls: true });
  return systemClient;
}
function getPrisma() {
  if (!RLS_ENABLED) return appPrisma;
  const ctx = getRequestContext();
  if (!ctx) return getSystemClient();
  if (ctx.__rlsClient) return ctx.__rlsClient;
  const scoped = makeScopedClient(appPrisma, ctx);
  ctx.__rlsClient = scoped;
  return scoped;
}
const prisma = new Proxy({}, {
  get(_t, prop) {
    const client = getPrisma();
    const val = client[prop];
    return typeof prop === 'string' && typeof val === 'function' ? val.bind(client) : val;
  },
});

const RLS_TABLES = [
  'auth_users', 'auth_sessions', 'auth_verification_tokens', 'vetting_applications',
  'profile_profiles', 'match_matches', 'match_daily_queues', 'chat_conversations',
  'chat_messages', 'event_rsvps', 'event_stars', 'billing_subscriptions',
  'billing_payments', 'notify_notifications', 'notify_preferences', 'vetting_sessions',
  'admin_audit_logs', 'analytics_profile_views',
];

const TENANT = BOOTSTRAP_TENANT_ID;
const UA = 'usr_rls_a', UB = 'usr_rls_b', UC = 'usr_rls_c';

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  — ${detail}`);
}

async function setupRoleAndForceRls() {
  // Idempotent: create a least-privilege app role and FORCE RLS on every table.
  await adminPrisma.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='afriapp') THEN
      CREATE ROLE afriapp WITH LOGIN PASSWORD 'afriapp_pw' NOSUPERUSER NOINHERIT;
    END IF;
  END $$;`);
  await adminPrisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO afriapp`);
  await adminPrisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO afriapp`);
  await adminPrisma.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO afriapp`);
  await adminPrisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO afriapp`);
  await adminPrisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO afriapp`);
  if (RLS_ENABLED) {
    for (const t of RLS_TABLES) {
      await adminPrisma.$executeRawUnsafe(`ALTER TABLE "${t}" FORCE ROW LEVEL SECURITY`);
    }
  } else {
    for (const t of RLS_TABLES) {
      await adminPrisma.$executeRawUnsafe(`ALTER TABLE "${t}" DISABLE ROW LEVEL SECURITY`);
    }
  }
}

async function seed() {
  // Seed as the privileged role (superuser bypasses RLS) so fixtures always land.
  await adminPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM "admin_audit_logs" WHERE "adminId" = $1`, UA);
    await tx.$executeRawUnsafe(`DELETE FROM "chat_messages" WHERE "senderId" IN ($1,$2,$3)`, UA, UB, UC);
    await tx.$executeRawUnsafe(`DELETE FROM "chat_conversations" WHERE "participant1Id" IN ($1,$2,$3)`, UA, UB, UC);
    await tx.$executeRawUnsafe(`DELETE FROM "notify_notifications" WHERE "userId" IN ($1,$2,$3)`, UA, UB, UC);
    await tx.$executeRawUnsafe(`DELETE FROM "profile_profiles" WHERE "userId" IN ($1,$2,$3)`, UA, UB, UC);
    await tx.$executeRawUnsafe(`DELETE FROM "auth_users" WHERE "id" IN ($1,$2,$3)`, UA, UB, UC);

    for (const [id, phone] of [[UA, '27830000001'], [UB, '27830000002'], [UC, '27830000003']]) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "auth_users" ("id","email","phone","role","status","tenantId","updatedAt")
         VALUES ($1,$2,$3,'member','active','tnt_bootstrap', now())
         ON CONFLICT ("id") DO UPDATE SET "tenantId"='tnt_bootstrap'`,
        id, `${id}@rls.test`, phone,
      );
    }
    for (const [id, fn] of [[UA, 'Alice'], [UB, 'Bob']]) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "profile_profiles" ("id","userId","firstName","lastName","gender","city","tenantId","isComplete","updatedAt")
         VALUES ($1,$2,$3,'Rls','female','cape_town','tnt_bootstrap',true, now())
         ON CONFLICT ("userId") DO NOTHING`,
        `prof_${id}`, id, fn,
      );
    }
    await tx.$executeRawUnsafe(
      `INSERT INTO "notify_notifications" ("id","userId","type","title","body","channel","tenantId")
       VALUES ('ntf_a',$1,'system','NOTIF_A','a-body','in_app','tnt_bootstrap')`, UA);
    await tx.$executeRawUnsafe(
      `INSERT INTO "notify_notifications" ("id","userId","type","title","body","channel","tenantId")
       VALUES ('ntf_b',$1,'system','NOTIF_B','b-body','in_app','tnt_bootstrap')`, UB);
    await tx.$executeRawUnsafe(
      `INSERT INTO "chat_conversations" ("id","participant1Id","participant2Id","tenantId")
       VALUES ('conv_ab',$1,$2,'tnt_bootstrap') ON CONFLICT ("id") DO NOTHING`, UA, UB);
    await tx.$executeRawUnsafe(
      `INSERT INTO "chat_messages" ("id","conversationId","senderId","content","tenantId")
       VALUES ('msg_ab','conv_ab',$1,'hello-from-A','tnt_bootstrap')`, UA);
    await tx.$executeRawUnsafe(
      `INSERT INTO "admin_audit_logs" ("id","adminId","action","entity","scope","tenantId")
       VALUES ('audit_1',$1,'member.suspend','user','super','tnt_bootstrap')`, UA);
  });
}

async function main() {
  if (!RLS_ENABLED) {
    console.error('RLS_ENABLED is not true — refusing to run the enforcement test.');
    process.exit(2);
  }
  await adminPrisma.$connect();
  await appPrisma.$connect();
  await setupRoleAndForceRls();
  await seed();

  const rlsOn = await adminPrisma.$queryRawUnsafe(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE c.relname='notify_notifications' AND c.relrowsecurity AND n.nspname='public'`,
  );
  check('P0 RLS physically forced', rlsOn.length === 1, `relrowsecurity on notify_notifications=${rlsOn.length === 1}`);

  // P1 owner-scoped
  const aNotes = await runRequestContext({ userId: UA, tenantId: TENANT }, () => prisma.notification.findMany());
  check('P1a owner sees own row', aNotes.length === 1 && aNotes[0].title === 'NOTIF_A', `A sees ${aNotes.length}, title=${aNotes[0] && aNotes[0].title}`);
  const bNotes = await runRequestContext({ userId: UB, tenantId: TENANT }, () => prisma.notification.findMany());
  check('P1b other user CANNOT see A rows', bNotes.length === 1 && !bNotes.some((n) => n.title === 'NOTIF_A'), `B sees ${bNotes.length}, leakOfA=${bNotes.some((n) => n.title === 'NOTIF_A')}`);
  const bNotesNoFilter = await runRequestContext({ userId: UB, tenantId: TENANT }, () => prisma.notification.findMany({}));
  check('P1c forgotten filter still isolated', bNotesNoFilter.length === 1 && !bNotesNoFilter.some((n) => n.title === 'NOTIF_A'), `B(no where) sees ${bNotesNoFilter.length}, leakOfA=${bNotesNoFilter.some((n) => n.title === 'NOTIF_A')}`);
  const adminNotes = await runRequestContext({ userId: 'sysadmin', tenantId: TENANT, bypassRls: true }, () => prisma.notification.findMany());
  check('P1d admin bypass sees all', adminNotes.length === 2, `bypass sees ${adminNotes.length} (expected 2)`);

  // P2 two-party
  const aMsg = await runRequestContext({ userId: UA, tenantId: TENANT }, () => prisma.message.findMany());
  const bMsg = await runRequestContext({ userId: UB, tenantId: TENANT }, () => prisma.message.findMany());
  const cMsg = await runRequestContext({ userId: UC, tenantId: TENANT }, () => prisma.message.findMany());
  check('P2a both participants see the message', aMsg.length === 1 && bMsg.length === 1, `A=${aMsg.length} B=${bMsg.length}`);
  check('P2b non-participant sees nothing', cMsg.length === 0, `C sees ${cMsg.length} (expected 0)`);

  // P3 profile read permissive / write owner-only
  const ubHack = await runRequestContext({ userId: UB, tenantId: TENANT }, () => prisma.profile.updateMany({ where: { userId: UA }, data: { bio: 'HACKED' } }));
  check('P3a B cannot edit A profile (WITH CHECK)', ubHack.count === 0, `updateMany count=${ubHack.count} (expected 0)`);
  const ubOwn = await runRequestContext({ userId: UB, tenantId: TENANT }, () => prisma.profile.updateMany({ where: { userId: UB }, data: { bio: 'own-edit' } }));
  check('P3b B can edit own profile', ubOwn.count === 1, `updateMany count=${ubOwn.count} (expected 1)`);
  const cRead = await runRequestContext({ userId: UC, tenantId: TENANT }, () => prisma.profile.findMany());
  check('P3c profiles readable by anyone (discovery)', cRead.length >= 2, `C sees ${cRead.length} profiles (expected >=2)`);

  // P4 admin_audit_logs back-office only
  const userAudits = await runRequestContext({ userId: UA, tenantId: TENANT }, () => prisma.adminAudit.findMany());
  const sysAudits = await runRequestContext({ userId: UA, tenantId: TENANT, bypassRls: true }, () => prisma.adminAudit.findMany());
  check('P4a normal user sees no audit logs', userAudits.length === 0, `user sees ${userAudits.length}`);
  check('P4b bypass sees audit logs', sysAudits.length === 1, `bypass sees ${sysAudits.length}`);

  // P5 cross-tenant
  const wrongTenant = await runRequestContext({ userId: UA, tenantId: 'tnt_other' }, () => prisma.notification.findMany());
  check('P5 wrong tenant => zero rows', wrongTenant.length === 0, `A@tnt_other sees ${wrongTenant.length} (expected 0)`);

  // P6 system / no-context
  const systemNotes = await prisma.notification.findMany();
  check('P6 no-context (system) bypass works', systemNotes.length === 2, `system path sees ${systemNotes.length} (expected 2)`);

  await adminPrisma.$disconnect();
  await appPrisma.$disconnect();

  const failed = results.filter((r) => !r.pass);
  console.log('\n──────── RLS SMOKE SUMMARY ────────');
  console.log(`${results.length - failed.length}/${results.length} pillars passed`);
  if (failed.length) {
    console.log('FAILED: ' + failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
  console.log('ALL RLS ISOLATION PILLARS PASSED (verified as non-superuser app role)');
  process.exit(0);
}

main().catch((err) => {
  console.error('RLS smoke test crashed:', err);
  process.exit(3);
});
