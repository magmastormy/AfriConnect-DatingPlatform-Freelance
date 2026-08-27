/* Approve users as vetted (member/active) + premium subscription.
 * Mirrors the native flows:
 *  - admin.service.ts reviewApplication(approved)  -> role=member, status=active, emailVerified=true
 *  - vetting.service.ts approve()                  -> applications approved, session approved, notification
 *  - billing.service.ts grantSubscription()        -> subscription upsert plan/status/period
 * Usage: node scripts/approve-vetted-premium.cjs "email1" "email2" [--months=12]
 */
const fs = require('fs');
const path = require('path');

const prismaClientPath = path.join(
  __dirname, '..', '..', '..',
  'node_modules', '.pnpm', '@prisma+client@5.22.0_prisma@5.22.0',
  'node_modules', '.prisma', 'client', 'default.js',
);

function loadEnv(name) {
  const raw = fs.readFileSync(path.join(__dirname, '..', '..', '..', '.env'), 'utf8');
  const m = raw.match(new RegExp('^' + name + '=(.+)$', 'm'));
  if (!m) throw new Error(name + ' not found in root .env');
  return m[1].trim();
}

async function resolveClerkEmails(secretKey) {
  const users = [];
  for (let off = 0; ; off += 100) {
    const r = await fetch('https://api.clerk.com/v1/users?limit=100&offset=' + off, {
      headers: { Authorization: 'Bearer ' + secretKey },
    });
    if (!r.ok) throw new Error('Clerk API ' + r.status);
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    for (const u of j) {
      const prim = (u.email_addresses || []).find((e) => e.id === u.primary_email_address_id);
      if (prim) users.push({ clerkId: u.id, email: prim.email_address.toLowerCase() });
    }
    if (j.length < 100) break;
  }
  return users;
}

async function main() {
  const args = process.argv.slice(2);
  const monthsIdx = args.findIndex((a) => a.startsWith('--months='));
  const months = monthsIdx >= 0 ? parseInt(args.splice(monthsIdx, 1)[0].split('=')[1], 10) : 12;
  if (!Number.isFinite(months) || months < 1) throw new Error('Invalid --months value');
  const targets = args.map((e) => e.trim().toLowerCase());
  if (!targets.length) throw new Error('Pass at least one email address');

  const databaseUrl = loadEnv('DATABASE_URL');
  const { PrismaClient } = require(prismaClientPath);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  // Resolve real emails from Clerk (DB rows may carry @clerk.local placeholders).
  const clerkUsers = await resolveClerkEmails(loadEnv('CLERK_SECRET_KEY'));
  const clerkByEmail = new Map(clerkUsers.map((u) => [u.email, u.clerkId]));

  const admin = await prisma.user.findFirst({
    where: { role: 'superadmin', status: 'active' },
    select: { id: true, email: true },
  });

  try {
    for (const email of targets) {
      const clerkId = clerkByEmail.get(email);
      const user = clerkId
        ? await prisma.user.findUnique({ where: { clerkId } })
        : await prisma.user.findUnique({ where: { email } });

      if (!user) {
        console.log(`[SKIP] ${email}: no auth_users row (Clerk match: ${clerkId || 'none'})`);
        continue;
      }

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + months);

      await prisma.$transaction(async (tx) => {
        // 1. Vetting approval — exactly what admin review + vetting.approve() do.
        await tx.user.update({
          where: { id: user.id },
          data: {
            role: 'member',
            status: 'active',
            emailVerified: true,
            // Fix the @clerk.local placeholder so admin lists / lookups show the real email.
            ...(user.email.endsWith('@clerk.local') && clerkId ? { email } : {}),
          },
        });
        const apps = await tx.application.updateMany({
          where: { userId: user.id, status: { in: ['submitted', 'under_review'] } },
          data: { status: 'approved', reviewedAt: new Date() },
        });
        const sessions = await tx.vettingSession.updateMany({
          where: { userId: user.id, status: 'pending' },
          data: { status: 'approved' },
        });

        // 2. Premium grant — exactly what billing.grantSubscription() does.
        await tx.subscription.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            plan: 'premium',
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: periodEnd,
          },
          update: {
            plan: 'premium',
            status: 'active',
            currentPeriodEnd: periodEnd,
          },
        });

        // 3. In-app notification, same as vetting.approve() dispatches.
        await tx.notification.create({
          data: {
            userId: user.id,
            type: 'vetting.approved',
            title: 'You\u2019re verified',
            body: 'Your ID verification passed. You can now connect with members and join events.',
            channel: 'in_app',
            link: '/portal',
          },
        });

        // 4. Audit trail, same as the admin service writes.
        if (admin) {
          await tx.adminAudit.create({
            data: {
              adminId: admin.id,
              action: 'application.approved',
              entity: 'user',
              entityId: user.id,
              scope: 'vetting',
              metadata: { script: 'approve-vetted-premium.cjs', email },
            },
          });
          await tx.adminAudit.create({
            data: {
              adminId: admin.id,
              action: 'subscription.grant',
              entity: 'subscription',
              entityId: user.id,
              scope: 'billing',
              metadata: { plan: 'premium', months, script: 'approve-vetted-premium.cjs', email },
            },
          });
        }

        console.log(
          `[OK] ${email} -> user ${user.id}` +
            ` | role=member status=active emailVerified=true` +
            ` | applications approved: ${apps.count}` +
            ` | vetting sessions approved: ${sessions.count}` +
            ` | premium subscription until ${periodEnd.toISOString().slice(0, 10)}`,
        );
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
