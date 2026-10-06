import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedVocabulary } from "./vocabulary";

const MIN_PASSWORD_LENGTH = 10;
const db = new PrismaClient();

/**
 * Seeds structural vocabulary and the initial administrator.
 * ADMIN_EMAIL / ADMIN_PASSWORD come from the environment — never from source code.
 * Re-running never overwrites an existing user's password.
 */
async function main() {
  await seedVocabulary(db);
  console.log("✔ Structural vocabulary seeded");

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("• ADMIN_EMAIL/ADMIN_PASSWORD not set — administrator not created.");
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must have at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") await db.user.update({ where: { email }, data: { role: "ADMIN" } });
    console.log(`• Administrator ${email} already exists — password unchanged.`);
    return;
  }
  await db.user.create({
    data: { email, name: "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`✔ Administrator ${email} created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
