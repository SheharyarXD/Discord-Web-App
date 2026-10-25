import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Creates the FIRST administrator of a PostgreSQL database. Inserts one user and nothing else; refuses to touch an existing account.
 * The owner chooses the e-mail and the password; neither is stored anywhere.
 *   npx prisma generate --schema prisma/postgres/schema.prisma
 *   ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='<10+ characters>' node scripts/with-vercel-env.mjs production -- node scripts/create-admin.mjs
 * (afterwards: npx prisma generate   to return the local client to SQLite)
 */
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
if (password.length < 10) throw new Error("ADMIN_PASSWORD must have at least 10 characters");
const db = new PrismaClient();
try {
  if (await db.user.findUnique({ where: { email } })) throw new Error("that e-mail already has an account; nothing was changed");
  await db.user.create({ data: { email, name: "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
  console.log(`administrator ${email} created (${await db.user.count()} user(s) in the database)`);
} finally {
  await db.$disconnect();
}
