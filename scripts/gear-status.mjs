import { PrismaClient } from "@prisma/client";

/**
 * Read-only counts of the equipment and jewelry data and of the tables the import must never change.
 *   node scripts/with-vercel-env.mjs production -- node scripts/gear-status.mjs
 * Needs the PostgreSQL client as the default client (prisma generate --schema prisma/postgres/schema.prisma).
 */
const db = new PrismaClient({ datasourceUrl: process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL });
async function main() {
  const ninjaEffects = await db.effect.count({ where: { OR: [{ abilityId: { not: null } }, { talentOptionId: { not: null } }] } });
  const out = {
    gear: {
      families: await db.gearFamily.count(),
      nameOnlyFamilies: await db.gearFamily.count({ where: { sourceStatus: "NAME_ONLY" } }),
      equipmentSetVersions: await db.equipmentSet.count({ where: { familyId: { not: null } } }),
      jewelrySetVersions: await db.jewelrySet.count({ where: { familyId: { not: null } } }),
      equipmentPieces: await db.equipment.count({ where: { set: { familyId: { not: null } } } }),
      jewelryCategories: await db.jewelry.count({ where: { set: { familyId: { not: null } } } }),
      equipmentBonuses: await db.equipmentSetBonus.count(),
      jewelryBonuses: await db.jewelrySetBonus.count(),
      gearEffects: await db.effect.count({ where: { OR: [{ equipmentId: { not: null } }, { equipmentSetBonusId: { not: null } }, { jewelryId: { not: null } }, { jewelrySetBonusId: { not: null } }] } }),
      textOnlyGearEffects: await db.effect.count({ where: { structuredStatus: "TEXT_ONLY", OR: [{ equipmentSetBonusId: { not: null } }, { jewelrySetBonusId: { not: null } }] } }),
      sourceAssets: await db.sourceAsset.count({ where: { path: { startsWith: "gear-source/" } } }),
      sourceRecords: await db.sourceRecord.count({ where: { key: { startsWith: "gear:" } } }),
    },
    unchanged: {
      ninjas: await db.ninja.count(),
      abilities: await db.ability.count(),
      ninjaEffects,
      users: await db.user.count(),
      sessions: await db.session.count(),
      ninjaSourceAssets: await db.sourceAsset.count({ where: { NOT: { path: { startsWith: "gear-source/" } } } }),
    },
  };
  console.log(JSON.stringify(out));
  await db.$disconnect();
}
main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});
