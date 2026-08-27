/* Read-only status check for vetting/premium approval candidates.
 * Usage: node scripts/check-vetting-status.cjs "a@x.com" "b@x.com" ... */
const fs = require('fs');
const path = require('path');

const prismaClientPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'node_modules',
  '.pnpm',
  '@prisma+client@5.22.0_prisma@5.22.0',
  'node_modules',
  '.prisma',
  'client',
  'default.js',
);

function loadDatabaseUrl() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/);
    if (m) return m[1];
  }
  throw new Error('DATABASE_URL not found in packages/api/.env');
}

async function main() {
  const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase());
  if (!emails.length) {
    console.error('Pass at least one email address.');
    process.exit(1);
  }
  const databaseUrl = loadDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  const { PrismaClient } = require(prismaClientPath);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    for (const email of emails) {
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          applications: { select: { id: true, status: true, reviewedAt: true } },
          vettingSessions: { select: { id: true, status: true, mode: true } },
          subscriptions: true,
          profile: { select: { id: true, isComplete: true, isPaused: true } },
        },
      });
      if (!user) {
        console.log(`\n=== ${email} ===\n  USER NOT FOUND`);
        continue;
      }
      console.log(`\n=== ${email} ===`);
      console.log(`  user.id            : ${user.id}`);
      console.log(`  role / status      : ${user.role} / ${user.status}`);
      console.log(`  emailVerified      : ${user.emailVerified}`);
      console.log(`  profile            : ${user.profile ? `present (isComplete=${user.profile.isComplete}, isPaused=${user.profile.isPaused})` : 'MISSING'}`);
      console.log(`  applications       : ${user.applications.length ? JSON.stringify(user.applications) : 'none'}`);
      console.log(`  vettingSessions    : ${user.vettingSessions.length ? JSON.stringify(user.vettingSessions) : 'none'}`);
      console.log(
        `  subscription       : ${
          user.subscriptions
            ? `plan=${user.subscriptions.plan} status=${user.subscriptions.status} periodEnd=${user.subscriptions.currentPeriodEnd?.toISOString()}`
            : 'none'
        }`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
