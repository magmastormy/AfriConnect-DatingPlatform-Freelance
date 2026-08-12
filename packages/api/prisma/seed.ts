import { prisma } from '../src/config/prisma';

/**
 * Idempotent seed: creates the bootstrap superadmin, a generalist admin, and one
 * specialist admin per scope so the split-role system is exercisable locally.
 * Passwordless OTP is the primary auth path; these accounts seed known logins
 * for local use only. Never seed real credentials in production.
 */
async function main() {
  const admins: { email: string; role: string; label: string }[] = [
    {
      email: process.env.SUPERADMIN_EMAIL || 'superadmin@afri-connect.co.za',
      role: 'superadmin',
      label: 'SuperAdmin',
    },
    {
      email: process.env.ADMIN_EMAIL || 'admin@afri-connect.co.za',
      role: 'admin',
      label: 'General Admin',
    },
    { email: 'vetting@afri-connect.co.za', role: 'admin_vetting', label: 'Vetting Admin' },
    { email: 'events@afri-connect.co.za', role: 'admin_events', label: 'Events Admin' },
    { email: 'billing@afri-connect.co.za', role: 'admin_billing', label: 'Billing Admin' },
    { email: 'support@afri-connect.co.za', role: 'admin_support', label: 'Support Admin' },
    { email: 'content@afri-connect.co.za', role: 'admin_content', label: 'Content Admin' },
  ];

  for (const a of admins) {
    const existing = await prisma.user.findUnique({ where: { email: a.email } });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: a.email,
          phone: '+270****' + Math.floor(Math.random() * 10000),
          role: a.role as never,
          status: 'active',
          emailVerified: true,
        },
      });
      console.log(`Seeded ${a.label}: ${a.email}`);
    } else {
      console.log(`${a.label} already exists: ${a.email}`);
    }
  }

  // Demo member pair to exercise matching + chat locally.
  const demoEmails = ['demo.male@afri-connect.co.za', 'demo.female@afri-connect.co.za'];
  for (const email of demoEmails) {
    const found = await prisma.user.findUnique({ where: { email } });
    if (!found) {
      const user = await prisma.user.create({
        data: {
          email,
          phone: '+27000000' + Math.floor(Math.random() * 1000),
          role: UserRole.Member,
          status: UserStatus.Active,
          emailVerified: true,
        },
      });
      await prisma.profile.create({
        data: {
          userId: user.id,
          firstName: email.split('.')[0],
          lastName: 'Demo',
          dateOfBirth: new Date('1992-01-01'),
          gender: email.includes('male') ? 'male' : 'female',
          city: 'johannesburg',
          bio: 'Seeded demo profile.',
          isComplete: true,
          completenessScore: 80,
        },
      });
      console.log(`Seeded demo member: ${email}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
