import { PrismaClient } from "@prisma/client";

/** Read-only status of a database: row counts and the NUMBER of users per role (no e-mail or other personal data is printed). */
const db = new PrismaClient();
try {
  const roles = await db.user.groupBy({ by: ["role", "isActive"], _count: true });
  console.log(JSON.stringify({
    ninjas: await db.ninja.count(), abilities: await db.ability.count(), effects: await db.effect.count(), sourceAssets: await db.sourceAsset.count(),
    users: roles.map((r) => `${r.role}${r.isActive ? "" : " (inactive)"}: ${r._count}`),
  }));
} finally {
  await db.$disconnect();
}
