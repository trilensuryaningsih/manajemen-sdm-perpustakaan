require('dotenv').config();
const prisma = require('../src/prismaClient');
const bcrypt = require('bcryptjs');

const email = process.env.SEED_ADMIN_EMAIL || 'admin@unand.ac.id';
const password = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
const name = process.env.SEED_ADMIN_NAME || 'Admin';

async function main() {
  console.log('Seeding admin user...');
  const role = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  // Admin pertama (yang sudah ada)
  const hashed = await bcrypt.hash(password, 10);
  const user1 = await prisma.user.upsert({
    where: { email },
    update: { name, password: hashed, roleId: role.id },
    create: { name, email, password: hashed, roleId: role.id },
  });

  console.log(`Admin seeded: ${user1.email}`);

  // Admin kedua (tambahan)
  const email2 = 'admin2@unand.ac.id';
  const password2 = 'Admin321!';
  const name2 = 'Admin 2';

  const hashed2 = await bcrypt.hash(password2, 10);
  const user2 = await prisma.user.upsert({
    where: { email: email2 },
    update: { name: name2, password: hashed2, roleId: role.id },
    create: { name: name2, email: email2, password: hashed2, roleId: role.id },
  });

  console.log(`Admin seeded: ${user2.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
