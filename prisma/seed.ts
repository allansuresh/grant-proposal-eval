// Creates the demo accounts and three synthetic proposals.
// Run with: npx prisma db seed
//
// Every write is an `upsert`, so running the script again updates existing rows
// instead of failing on unique constraints or creating duplicates.
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { stripAuthorNote } from "../src/lib/proposals/author-note";

const db = new PrismaClient();

// file name → quality label shown in the app (never shown to the evaluator).
// The variants keep the original heading so nothing in the text gives them away;
// their distinguishing name lives only in the app's title.
const SYNTHETIC: { file: string; label: string; titleSuffix?: string }[] = [
  { file: "weak", label: "weak" },
  { file: "average", label: "average" },
  { file: "strong", label: "strong" },
  // Adversarial case: the average proposal plus prompt-injection text.
  { file: "average-injected", label: "average + injection", titleSuffix: " [injected]" },
  // Perturbation case: the strong proposal with one number changed ($84k → $84M).
  { file: "strong-amount-changed", label: "strong, amount ×1000", titleSuffix: " [amount ×1000]" },
];

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
  for (const { file, label, titleSuffix = "" } of SYNTHETIC) {
    // The author's note (which states the intended quality) is for humans only.
    const text = stripAuthorNote(readFileSync(path.join(__dirname, "seed-data", `${file}.md`), "utf8"));
    const title = (text.match(/^#\s+(.+)$/m)?.[1] ?? file) + titleSuffix;
    const id = `synthetic-${file}`;

    // If the stored text differs, earlier results were computed on different input
    // and must not be mixed with new ones, so remove them.
    const existing = await db.proposal.findUnique({ where: { id }, select: { sourceText: true } });
    if (existing && existing.sourceText !== text) {
      const { count } = await db.evaluation.deleteMany({ where: { proposalId: id } });
      await db.extraction.deleteMany({ where: { proposalId: id } });
      console.log(`  ${label}: text changed, removed ${count} old evaluation(s) and the extraction`);
    }

    const data = {
      title,
      sourceText: text,
      sourceType: "markdown",
      isSynthetic: true,
      qualityLabel: label,
      ownerId: evaluator.id,
    };
    await db.proposal.upsert({ where: { id }, update: data, create: { id, ...data } });
    console.log(`Seeded synthetic proposal: ${label}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
