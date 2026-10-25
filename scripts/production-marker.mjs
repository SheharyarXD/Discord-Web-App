import { PrismaClient } from "@prisma/client";

/**
 * Persistence check for a release: writes ("set"), reads ("check") or removes ("clear") ONE harmless marker row (a SourceAsset
 * named m4-persistence-check). Run it before a deployment and after it: if the row is still there, production data survives deployments.
 *   node scripts/with-vercel-env.mjs production -- node scripts/production-marker.mjs set|check|clear
 */
const db = new PrismaClient();
const path = "m4-persistence-check";
try {
  const action = process.argv[2];
  if (action === "set") {
    await db.sourceAsset.upsert({ where: { path }, update: {}, create: { path, category: "DOCUMENT", description: "temporary marker written by the release check; safe to delete" } });
    console.log("marker written");
  } else if (action === "check") {
    const row = await db.sourceAsset.findUnique({ where: { path } });
    console.log(row ? `marker present (created ${row.createdAt.toISOString()})` : "marker MISSING");
    process.exitCode = row ? 0 : 1;
  } else if (action === "clear") {
    console.log(`marker removed: ${(await db.sourceAsset.deleteMany({ where: { path } })).count}`);
  } else throw new Error("usage: production-marker.mjs set|check|clear");
  console.log(`rows: ninjas ${await db.ninja.count()}, source assets ${await db.sourceAsset.count()}, users ${await db.user.count()}`);
} finally {
  await db.$disconnect();
}
