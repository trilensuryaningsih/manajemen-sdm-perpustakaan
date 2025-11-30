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

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, password: hashed, roleId: role.id },
    create: { name, email, password: hashed, roleId: role.id },
  });

  console.log(`Admin seeded: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
