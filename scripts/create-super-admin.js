const { PrismaClient, Role } = require('@prisma/client');
const { hash } = require('@node-rs/argon2');

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV !== 'production') {
    throw new Error('Set NODE_ENV=production to run the production admin bootstrap command.');
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set ADMIN_EMAIL to a valid email address.');
  }
  if (!name) throw new Error('Set ADMIN_NAME to the administrator name.');
  if (
    !password ||
    password.length < 12 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    throw new Error(
      'ADMIN_PASSWORD must be at least 12 characters and include lowercase, uppercase, a number, and a symbol.'
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('That email already has an account. The bootstrap command never changes existing users.');
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hash(password, {
        algorithm: 2,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      }),
      role: Role.SUPER_ADMIN,
    },
  });

  console.info(`Created the initial super-admin account for ${email}. Remove ADMIN_PASSWORD from the environment.`);
}

main()
  .catch((error) => {
    console.error('[admin-bootstrap] Failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
