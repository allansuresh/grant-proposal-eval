// Creates the two demo accounts. Run with: npx prisma db seed
//
// `upsert` makes the script idempotent: running it twice updates the existing
// rows instead of failing on the unique email constraint.
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error("Set DEMO_PASSWORD (10+ characters) in .env before seeding.");
  }
  const passwordHash = await hashPassword(password);

  const accounts: { email: string; role: Role }[] = [
    { email: "demo-admin@example.com", role: Role.ADMIN },
    { email: "demo-evaluator@example.com", role: Role.EVALUATOR },
  ];

  for (const { email, role } of accounts) {
    await db.user.upsert({
      where: { email },
      update: { passwordHash, role },
      create: { email, passwordHash, role },
    });
    console.log(`Seeded ${role.toLowerCase()}: ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
