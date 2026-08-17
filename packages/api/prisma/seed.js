/* eslint-disable */
/**
 * AfriConnect mock-data seed (plain JS — runs with `node prisma/seed.js`).
 *
 * Creates:
 *   - 2 admins (role `admin` + `superadmin`), both active, with minimal profiles
 *   - 15 regular users across tiers:
 *       6 free+vetted (member/active, approved app, no subscription)
 *       5 premium+vetted (premium/active, approved app, active subscription)
 *       2 pending vetting (applicant/pending, submitted|under_review)
 *       1 suspended member
 *       1 rejected applicant
 *   - a vetting Application for every user (linked via userId, varied proof-of-work)
 *   - completed Profiles (photos as [{url}], industries, district, nearbyEnabled)
 *   - Subscriptions for premium users
 *   - a handful of Matches (free<->premium mutuals to exercise the cap)
 *   - 3 Events (2 published, 1 pending) with RSVPs
 *   - ProfileViews + EventStars for analytics
 *
 * Idempotent: clears all mock rows (email ending @africonnect.mock) before seeding.
 * The operator `PlatformSettings` row (id=1) is left untouched.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DOMAIN = '@africonnect.mock';

// ── vocabularies (must match the Prisma enums exactly) ──────────────────────
const NATIONALITIES = ['South Africa', 'Zimbabwe'];
const CITIES = ['johannesburg', 'cape_town', 'pietermaritzburg', 'durban', 'pretoria'];
const GENDERS = ['male', 'female', 'non_binary', 'other'];
const EDU = ['diploma', 'bachelors', 'honours', 'masters', 'phd', 'professional'];
const INDUSTRIES = [
  'Technology',
  'Finance & Banking',
  'Healthcare',
  'Engineering',
  'Education',
  'Legal',
  'Marketing & Advertising',
  'Media & Communications',
  'Management Consulting',
  'Entrepreneur / Founder',
  'Government & Public Sector',
  'Hospitality & Tourism',
  'Retail & Consumer',
  'Construction & Real Estate',
  'Energy & Mining',
  'Agriculture',
  'Non-profit & NGO',
  'Creative & Arts',
  'Science & Research',
  'Other',
];
const POW = ['resume', 'work_badge', 'selfie_company', 'linkedin'];

const FIRST = [
  'Thabo',
  'Naledi',
  'Kwame',
  'Amina',
  'Sipho',
  'Zanele',
  'Tendai',
  'Lerato',
  'Obi',
  'Nomusa',
  'Kofi',
  'Tariro',
  'Sizwe',
  'Yasmin',
  'Bongani',
  'Chipo',
  'Mandla',
];
const LAST = [
  'Mokoena',
  'Chikowe',
  'Mensah',
  'Dlamini',
  'Okoro',
  'Ncube',
  'Khuma',
  'Zulu',
  'Mwangi',
  'Sibanda',
  'Adeyemi',
  'Mutasa',
  'Hlongwane',
  'Booysen',
  'Tshabalala',
  'Phiri',
  'Nkosi',
];
const PROFESSIONS = [
  'Software Engineer',
  'Investment Analyst',
  'Medical Doctor',
  'Civil Engineer',
  'University Lecturer',
  'Corporate Lawyer',
  'Brand Strategist',
  'Journalist',
  'Management Consultant',
  'Startup Founder',
  'Public Servant',
  'Hotel Manager',
  'Architect',
  'Agronomist',
  'Researcher',
  'Creative Director',
];
const EMPLOYERS = [
  'Standard Bank',
  'Discovery Health',
  'MTN',
  'UCT',
  'Webber Wentzel',
  'Nando’s',
  'Deloitte',
  'SweepSouth',
  'SARS',
  'Sun International',
  'AECOM',
  'AgriSSA',
  'CSIR',
  'MultiChoice',
];
const INSTITUTIONS = [
  'University of Cape Town',
  'Wits',
  'University of Zimbabwe',
  'Stellenbosch',
  'UP',
  'UJ',
  'NUST',
  'Rhodes',
];
const INTERESTS = [
  'travel',
  'reading',
  'running',
  'cooking',
  'gospel music',
  'football',
  'photography',
  'wine',
  'hiking',
  'chess',
];
const DEALBREAKERS = [
  'smoking',
  'dishonesty',
  'long-distance',
  'no ambition',
  'poor communication',
];
const DISTRICTS = [
  'Sandton',
  'Camps Bay',
  'Morningside',
  'Arcadia',
  'Umhlanga',
  'Hatfield',
  'Berea',
  'Brooklyn',
];
const BIOS = [
  'Faith-driven, ambitious, and quietly funny. Looking for someone to build with.',
  'Engineer by day, chef by night. I love a good road trip and deeper conversations.',
  'Founder who believes in hard work and soft hearts. Weekend hiker.',
  'Doctor, dog-lover, and amateur pianist. Seeking genuine connection.',
  'Lawyer with a creative streak. Wine tastings are my love language.',
  'Consultant who travels too much but always comes home. Family-first.',
];
const HEADLINES = [
  'Building & blooming',
  'Faith, family, future',
  'Soft life enthusiast',
  'Ambitious & grounded',
  'Here for the right reasons',
  'Calm, kind, curious',
];

// ── helpers ─────────────────────────────────────────────────────────────────
let phoneSeq = 0;
const nextPhone = () => `+2782${(1000000 + ++phoneSeq).toString()}`;
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
const photoUrls = (seed, n = 3) =>
  Array.from({ length: n }, (_, i) => ({ url: `https://picsum.photos/seed/${seed}-${i}/600/800` }));
const dobFromAge = (age) => {
  const y = 2026 - age;
  const m = 1 + Math.floor(Math.random() * 12);
  const d = 1 + Math.floor(Math.random() * 27);
  return new Date(y, m - 1, d);
};

// ── clear previous mock data (idempotent) ───────────────────────────────────
async function clear() {
  await prisma.profileView.deleteMany({});
  await prisma.match.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.rSVP.deleteMany({});
  await prisma.eventStar.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.application.deleteMany({ where: { email: { endsWith: DOMAIN } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: DOMAIN } } });
}

async function main() {
  await clear();
  const users = [];
  let adminA = null;
  let adminB = null;

  // ── 2 admins ─────────────────────────────────────────────────────────────
  const adminSpecs = [
    { email: `admin1${DOMAIN}`, first: 'Thabo', last: 'Mokoena', role: 'admin', status: 'active' },
    {
      email: `admin2${DOMAIN}`,
      first: 'Nadia',
      last: 'Chikowe',
      role: 'superadmin',
      status: 'active',
    },
  ];
  for (const s of adminSpecs) {
    const u = await prisma.user.create({
      data: {
        email: s.email,
        phone: nextPhone(),
        role: s.role,
        status: s.status,
        emailVerified: true,
        phoneVerified: true,
      },
    });
    await prisma.profile.create({
      data: {
        userId: u.id,
        firstName: s.first,
        lastName: s.last,
        displayName: s.first,
        dateOfBirth: dobFromAge(36),
        gender: rand(GENDERS),
        city: rand(CITIES),
        nationality: rand(NATIONALITIES),
        profession: 'Platform Operations',
        employer: 'AfriConnect',
        educationLevel: 'masters',
        institution: 'University of Cape Town',
        industries: ['Technology'],
        bio: 'AfriConnect administrator.',
        headline: 'Keeping the village safe.',
        photos: photoUrls(`admin-${s.email}`, 1),
        isComplete: true,
        completenessScore: 100,
      },
    });
    const rec = { id: u.id, role: s.role, status: s.status, cat: 'admin', isPremium: false };
    users.push(rec);
    if (!adminA) adminA = rec;
    else adminB = rec;
  }

  // ── 15 regular users across tiers ────────────────────────────────────────
  const categories = [
    ...Array(6).fill('free'),
    ...Array(5).fill('premium'),
    ...Array(2).fill('pending'),
    'suspended',
    'rejected',
  ];
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const first = FIRST[i % FIRST.length];
    const last = LAST[i % LAST.length];
    const email = `mock${i + 1}${DOMAIN}`;
    const gender = rand(GENDERS);
    const nationality = rand(NATIONALITIES);
    const city = rand(CITIES);
    const edu = rand(EDU);
    const dob = dobFromAge(24 + ((i * 2) % 20));
    const profession = PROFESSIONS[i % PROFESSIONS.length];
    const employer = EMPLOYERS[i % EMPLOYERS.length];
    const institution = INSTITUTIONS[i % INSTITUTIONS.length];
    const pow = POW[i % POW.length];

    let role,
      status,
      appStatus,
      hasProfile,
      premiumPlan = null;
    switch (cat) {
      case 'free':
        role = 'member';
        status = 'active';
        appStatus = 'approved';
        hasProfile = true;
        break;
      case 'premium':
        role = 'premium';
        status = 'active';
        appStatus = 'approved';
        hasProfile = true;
        premiumPlan = i % 5 === 0 ? 'platinum' : 'premium';
        break;
      case 'pending':
        role = 'applicant';
        status = 'pending';
        appStatus = i % 2 ? 'under_review' : 'submitted';
        hasProfile = false;
        break;
      case 'suspended':
        role = 'member';
        status = 'suspended';
        appStatus = 'approved';
        hasProfile = true;
        break;
      case 'rejected':
        role = 'applicant';
        status = 'pending';
        appStatus = 'rejected';
        hasProfile = false;
        break;
    }

    const u = await prisma.user.create({
      data: {
        email,
        phone: nextPhone(),
        role,
        status,
        emailVerified: status === 'active',
        phoneVerified: status === 'active',
      },
    });

    await prisma.application.create({
      data: {
        userId: u.id,
        firstName: first,
        lastName: last,
        email,
        phone: u.phone,
        dateOfBirth: dob,
        gender,
        nationality,
        profession,
        employer,
        educationLevel: edu,
        institution,
        city,
        status: appStatus,
        linkedInUrl:
          pow === 'linkedin' ? `https://linkedin.com/in/${first}-${last}`.toLowerCase() : null,
        idDocumentUrl: `https://picsum.photos/seed/${email}-id/400/250`,
        degreeCertificateUrl:
          edu !== 'diploma' ? `https://picsum.photos/seed/${email}-deg/400/250` : null,
        selfieUrl: `https://picsum.photos/seed/${email}-selfie/400/400`,
        proofOfWorkType: pow,
        proofOfWorkUrl:
          pow === 'linkedin' ? null : `https://picsum.photos/seed/${email}-pow/400/400`,
        reviewedBy:
          appStatus === 'approved' || appStatus === 'rejected' || appStatus === 'on_hold'
            ? adminA
              ? adminA.id
              : null
            : null,
        reviewedAt:
          appStatus === 'approved' || appStatus === 'rejected' || appStatus === 'on_hold'
            ? new Date()
            : null,
      },
    });

    if (hasProfile) {
      await prisma.profile.create({
        data: {
          userId: u.id,
          firstName: first,
          lastName: last,
          displayName: `${first} ${last[0]}.`,
          dateOfBirth: dob,
          gender,
          nationality,
          city,
          bio: BIOS[i % BIOS.length],
          headline: HEADLINES[i % HEADLINES.length],
          profession,
          employer,
          educationLevel: edu,
          institution,
          industries: sample(INDUSTRIES, 3),
          interests: sample(INTERESTS, 4),
          dealbreakers: sample(DEALBREAKERS, 2),
          photos: photoUrls(email, 3),
          isComplete: true,
          completenessScore: 100,
          district: DISTRICTS[i % DISTRICTS.length],
          nearbyEnabled: i % 2 === 0,
        },
      });
    }

    if (premiumPlan) {
      await prisma.subscription.create({
        data: {
          userId: u.id,
          plan: premiumPlan,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
        },
      });
    }

    users.push({ id: u.id, cat, role, status, isPremium: !!premiumPlan });
  }

  // ── matches (free<->premium mutuals to exercise the cap; plus some likes/passes) ──
  const freeUsers = users.filter((u) => u.cat === 'free');
  const premUsers = users.filter((u) => u.cat === 'premium');
  let m = 0;
  for (const f of freeUsers) {
    const targets = premUsers.slice(0, 2 + (m % 2)); // 2–3 premium each → under the cap of 5
    for (const p of targets) {
      await prisma.match.create({
        data: {
          userId: f.id,
          matchedUserId: p.id,
          status: 'mutual',
          userAction: 'liked',
          matchedUserAction: 'liked',
          matchedAt: new Date(),
        },
      });
      m++;
    }
  }
  for (let k = 0; k < 6; k++) {
    const a = users[k];
    const b = users[(k + 5) % users.length];
    if (a.id === b.id) continue;
    await prisma.match.create({
      data: {
        userId: a.id,
        matchedUserId: b.id,
        status: k % 2 ? 'passed' : 'liked',
        userAction: k % 2 ? 'passed' : 'liked',
      },
    });
  }

  // ── events ────────────────────────────────────────────────────────────────
  const creator = users.find((u) => u.isPremium) || users[0];
  const eventSpecs = [
    {
      title: 'Johannesburg Wine & Dine Mixer',
      type: 'wine_dine',
      city: 'johannesburg',
      status: 'published',
    },
    { title: 'Cape Town Sunset Gala', type: 'gala', city: 'cape_town', status: 'published' },
    { title: 'Durban Networking Brunch', type: 'mixer', city: 'durban', status: 'pending' },
  ];
  for (const e of eventSpecs) {
    const ev = await prisma.event.create({
      data: {
        title: e.title,
        description: `A curated ${e.type.replace('_', ' ')} event for African professionals.`,
        eventType: e.type,
        city: e.city,
        venueName: 'The Marble Terrace',
        venueAddress: `123 Nelson Mandela Sq, ${e.city}`,
        venueMapUrl: null,
        startTime: new Date(Date.now() + 7 * 864e5),
        endTime: new Date(Date.now() + 7 * 864e5 + 3 * 36e5),
        capacity: 80,
        ticketPrice: '250.00',
        dressCode: 'Smart casual',
        status: e.status,
        featured: e.status === 'published',
        createdBy: creator.id,
      },
    });
    const someUsers = users.filter((u) => u.status === 'active').slice(0, 5);
    for (const su of someUsers) {
      await prisma.rSVP.create({ data: { eventId: ev.id, userId: su.id, status: 'confirmed' } });
    }
  }

  // ── analytics: profile views + event stars ───────────────────────────────
  const viewers = users.filter((u) => u.status === 'active');
  for (let k = 0; k < 14; k++) {
    const v = viewers[k % viewers.length];
    const t = users[(k + 3) % users.length];
    if (v.id === t.id) continue;
    await prisma.profileView.create({ data: { viewerId: v.id, viewedUserId: t.id } });
  }
  for (let k = 0; k < 4; k++) {
    const giver = users[(k + 1) % users.length];
    const receiver = users[(k + 6) % users.length];
    if (giver.id === receiver.id) continue;
    await prisma.eventStar.create({
      data: {
        eventId: (await prisma.event.findFirst()).id,
        starerId: giver.id,
        starreeId: receiver.id,
        isMutual: false,
      },
    });
  }

  // ── summary ───────────────────────────────────────────────────────────────
  const [uCount, pCount, aCount, sCount, mCount, eCount, vCount] = await Promise.all([
    prisma.user.count(),
    prisma.profile.count(),
    prisma.application.count(),
    prisma.subscription.count(),
    prisma.match.count(),
    prisma.event.count(),
    prisma.profileView.count(),
  ]);
  console.log(
    `✅ Seed complete → users:${uCount} profiles:${pCount} applications:${aCount} subscriptions:${sCount} matches:${mCount} events:${eCount} profileViews:${vCount}`,
  );
  console.log(
    `   admins: ${adminA.role}, ${adminB.role} | login with any *${DOMAIN} email (built-in OTP / no password in mock)`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
