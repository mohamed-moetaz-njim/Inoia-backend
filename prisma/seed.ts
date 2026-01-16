import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // 1. Hard safety guard
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    console.log('Production seed skipped (missing ALLOW_PROD_SEED)');
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // 2. Require credentials
  if (!adminEmail || !adminPassword) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables');
    process.exit(1);
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword);
    
    // Check if username 'admin' is taken
    const existingUsername = await prisma.user.findUnique({
      where: { username: 'admin' },
    });
    
    const username = existingUsername ? 'admin_' + Math.floor(Math.random() * 1000) : 'admin';

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: Role.ADMIN,
        username,
        usernameLocked: true,
        verificationToken: null, // emailVerified: true
      },
    });
    console.log('Admin user seeded successfully');
  } else {
    console.log('Admin already exists, skipping');
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
