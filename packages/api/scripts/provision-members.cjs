/* Provision members: vet + premium + build a complete profile.
 * Idempotent — safe to re-run on already-approved users (approves + creates profile).
 * Usage:
 *   node scripts/provision-members.cjs \
 *     --email=ptchiremba@gmail.com \
 *     --email=ashwintapiwakaserera@gmail.com \
 *     --email=veerhea4@gmail.com --female=veerhea4@gmail.com \
 *     --email=stanleystorm26@gmail.com \
 *     [--months=12] [--city=johannesburg]
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

function parseArgs(argv) {
  const emails = [];
  const females = new Set();
  let months = 12;
  let city = 'johannesburg';
  for (const a of argv) {
    const m = a.match(/^--([a-zA-Z]+)=(.*)$/);
    if (!m) continue;
    if (m[1] === 'email') emails.push(m[2].trim().toLowerCase());
    else if (m[1] === 'female') m[2].split(',').forEach((e) => females.add(e.trim().toLowerCase()));
    else if (m[1] === 'months') months = parseInt(m[2], 10);
    else if (m[1] === 'city') city = m[2].trim();
  }
  return { emails, females, months, city };
}

async function resolveClerk(secretKey) {
  const map = new Map();
  for (let off = 0; ; off += 100) {
    const r = await fetch('https://api.clerk.com/v1/users?limit=100&offset=' + off, {
      headers: { Authorization: 'Bearer ' + secretKey },
    });
    if (!r.ok) throw new Error('Clerk API ' + r.status);
    const j = await r.json();
    if (!Array.isArray(j) || !j.length) break;
    for (const u of j) {
      const prim = (u.email_addresses || []).find((e) => e.id === u.primary_email_address_id);
      if (prim) {
        map.set(prim.email_address.toLowerCase(), {
          clerkId: u.id,
          email: prim.email_address.toLowerCase(),
          firstName: u.first_name || prim.email_address.split('@')[0],
          lastName: u.last_name || '',
        });
      }
    }
    if (j.length < 100) break;
  }
  return map;
}

async function main() {
  const { emails, females, months, city } = parseArgs(process.argv.slice(2));
  if (!emails.length) throw new Error('Pass at least one --email=');
  if (!Number.isFinite(months) || months < 1) throw new Error('Invalid --months');

  const databaseUrl = loadEnv('DATABASE_URL');
  const { PrismaClient } = require(prismaClientPath);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const clerk = await resolveClerk(loadEnv('CLERK_SECRET_KEY'));
  const admin = await prisma.user.findFirst({ where: { role: 'superadmin', status: 'active' } });

  try {
    for (const email of emails) {
      const c = clerk.get(email);
      if (!c) {
        console.log(`[SKIP] ${email}: not found in Clerk`);
        continue;
      }
      const user = await prisma.user.findUnique({ where: { clerkId: c.clerkId } });
      if (!user) {
        console.log(`[SKIP] ${email}: no auth_users row for clerkId ${c.clerkId}`);
        continue;
      }

      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + months);
      const gender = females.has(email) ? 'female' : 'male';

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            role: 'member',
            status: 'active',
            emailVerified: true,
            ...(user.email.endsWith('@clerk.local') ? { email } : {}),
          },
        });
        await tx.application.updateMany({
          where: { userId: user.id, status: { in: ['submitted', 'under_review'] } },
          data: { status: 'approved', reviewedAt: new Date() },
        });
        await tx.vettingSession.updateMany({
          where: { userId: user.id, status: 'pending' },
          data: { status: 'approved' },
        });
        await tx.subscription.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id, plan: 'premium', status: 'active',
            currentPeriodStart: new Date(), currentPeriodEnd: periodEnd,
          },
          update: { plan: 'premium', status: 'active', currentPeriodEnd: periodEnd },
        });
        const existingNotif = await tx.notification.findFirst({
          where: { userId: user.id, type: 'vetting.approved' },
        });
        if (!existingNotif) {
          await tx.notification.create({
            data: {
              userId: user.id, type: 'vetting.approved', title: 'You’re verified',
              body: 'Your ID verification passed. You can now connect with members and join events.',
              channel: 'in_app', link: '/portal',
            },
          });
        }

        // Build / refresh a complete, discoverable profile.
        const first = c.firstName || email.split('@')[0];
        const last = c.lastName || '';
        const profileData = {
          userId: user.id,
          firstName: first,
          lastName: last,
          gender,
          city,
          dateOfBirth: new Date('1995-06-15'), // required for nearby discovery cards
          nationality: 'South Africa',
          isPaused: false,
          isComplete: true,
          completenessScore: 70,
          nearbyEnabled: true,
          interests: [],
          dealbreakers: [],
        };
        const existing = await tx.profile.findUnique({ where: { userId: user.id } });
        if (existing) {
          await tx.profile.update({ where: { userId: user.id }, data: profileData });
        } else {
          await tx.profile.create({ data: profileData });
        }

        if (admin) {
          await tx.adminAudit.create({
            data: {
              adminId: admin.id, action: 'member.provisioned', entity: 'user',
              entityId: user.id, scope: 'vetting',
              metadata: { plan: 'premium', months, gender, script: 'provision-members.cjs', email },
            },
          });
        }
        console.log(
          `[OK] ${email} (${first} ${last}, ${gender}) -> vetted+premium until ${periodEnd.toISOString().slice(0, 10)} | profile ${existing ? 'refreshed' : 'created'}`,
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
