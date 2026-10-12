'use strict';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DURATIONS = [
  { months: 1, name: '1 Month', priceCents: 30000 },
  { months: 3, name: '3 Months', priceCents: 81000 },
  { months: 6, name: '6 Months', priceCents: 150000 },
  { months: 12, name: '1 Year', priceCents: 276000 },
];

const COACHES = [
  { coachNumber: 1, name: 'Ahmed', specialty: 'Strength & Conditioning', bio: '10 years coaching powerlifting and bodybuilding. National-level competitor turned coach.', capacity: 30 },
  { coachNumber: 2, name: 'Mohamed', specialty: 'Weight Loss & Nutrition', bio: 'Certified nutritionist. Specializes in sustainable fat loss and meal planning.', capacity: 25 },
  { coachNumber: 3, name: 'Osama', specialty: 'CrossFit & Functional Training', bio: 'CrossFit L2 trainer. High-intensity group and one-on-one functional training.', capacity: null },
];

async function main() {
  const password = await bcrypt.hash('Coach@123', 10);
  const superPassword = await bcrypt.hash('Super@123', 10);

  // Super Admin
  const existingSuper = await prisma.user.findUnique({ where: { username: 'superadmin' } });
  if (!existingSuper) {
    await prisma.user.create({
      data: {
        username: 'superadmin',
        email: 'superadmin@gym.example',
        password: superPassword,
        role: 'SUPER_ADMIN',
        isVerified: true,
      },
    });
    console.log('Seeded SUPER_ADMIN (username: superadmin)');
  }

  // Coaches
  for (const c of COACHES) {
    const username = c.name.toLowerCase(); // ahmed / mohamed / osama
    let user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          username,
          email: `${username}@gym.example`,
          password,
          role: 'ADMIN',
          isVerified: true,
          coachProfile: {
            create: {
              coachNumber: c.coachNumber,
              name: c.name,
              bio: c.bio,
              specialty: c.specialty,
              capacity: c.capacity,
            },
          },
        },
        include: { coachProfile: true },
      });
      console.log(`Seeded coach ${c.name} (#${c.coachNumber})`);
    }

    const coach = user.coachProfile ?? (await prisma.coach.findUnique({ where: { userId: user.id } }));
    if (!coach) throw new Error(`Coach profile missing for ${username}`);

    for (const d of DURATIONS) {
      const exists = await prisma.plan.findUnique({
        where: { coachId_months: { coachId: coach.id, months: d.months } },
      });
      if (!exists) {
        await prisma.plan.create({
          data: { coachId: coach.id, name: d.name, months: d.months, priceCents: d.priceCents },
        });
      }
    }
  }
  console.log(`Seeded ${DURATIONS.length * COACHES.length} plans (identical prices across coaches)`);

  console.log('\nDefault logins:');
  console.log('  superadmin / Super@123');
  console.log('  ahmed|Mohamed|osama / Coach@123');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
