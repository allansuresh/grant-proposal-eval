// Creates the demo accounts and three synthetic proposals.
// Run with: npx prisma db seed
//
// Every write is an `upsert`, so running the script again updates existing rows
// instead of failing on unique constraints or creating duplicates.
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

// file name → quality label shown in the app
const SYNTHETIC = [
  { file: "weak", label: "weak" },
  { file: "average", label: "average" },
  { file: "strong", label: "strong" },
  // Adversarial case: the average proposal plus prompt-injection text.
  { file: "average-injected", label: "average + injection" },
] as const;

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 10) {
    throw new Error("Set DEMO_PASSWORD (10+ characters) in .env before seeding.");
  }
  const passwordHash = await hashPassword(password);

  await db.user.upsert({
    where: { email: "demo-admin@example.com" },
    update: { passwordHash, role: Role.ADMIN },
    create: { email: "demo-admin@example.com", passwordHash, role: Role.ADMIN },
  });
  const evaluator = await db.user.upsert({
    where: { email: "demo-evaluator@example.com" },
    update: { passwordHash, role: Role.EVALUATOR },
    create: { email: "demo-evaluator@example.com", passwordHash, role: Role.EVALUATOR },
  });
  console.log("Seeded demo-admin@example.com and demo-evaluator@example.com");

  // The synthetic proposals belong to the demo evaluator, so both demo
  // accounts see them. Fixed ids make the upsert idempotent.
  for (const { file, label } of SYNTHETIC) {
    const text = readFileSync(path.join(__dirname, "seed-data", `${file}.md`), "utf8").trim();
    const title = text.match(/^#\s+(.+)$/m)?.[1] ?? file;
    const data = {
      title,
      sourceText: text,
      sourceType: "markdown",
      isSynthetic: true,
      qualityLabel: label,
      ownerId: evaluator.id,
    };
    await db.proposal.upsert({
      where: { id: `synthetic-${file}` },
      update: data,
      create: { id: `synthetic-${file}`, ...data },
    });
    console.log(`Seeded synthetic proposal: ${label}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
