import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedVocabulary } from "../prisma/vocabulary";
import { vocabulary } from "../src/game/ninjas";
import { ensureStatusCategory } from "../src/game/status-effects";

export const TEST_DB_URL = `file:${path.resolve(__dirname, ".tmp/test.db").replace(/\\/g, "/")}`;
export const REFERENCE_DIR = path.resolve(__dirname, "../data/reference");
export const HANDOFF_DIR = path.resolve(__dirname, "../docs/milestone-2-handoff");

export const testDb = () => new PrismaClient({ datasourceUrl: TEST_DB_URL });

/**
 * The vocabulary the M2 tests rely on, created through the real services with the same keys
 * the reference loader uses (so it is harmless whichever test file runs first).
 */
export async function seedTestVocabulary(db: PrismaClient): Promise<void> {
  await seedVocabulary(db);
  for (const [i, key] of ["force", "agility", "chakra", "hp"].entries()) {
    await vocabulary.statistic(db, { key, name: key === "hp" ? "HP" : key.charAt(0).toUpperCase() + key.slice(1), category: "base", sortOrder: i });
  }
  for (const key of ["attack", "defenses", "speed"]) {
    await vocabulary.statistic(db, { key, name: key, category: "combat", defaultValueType: "PERCENT", sortOrder: 100 });
  }
  await vocabulary.formation(db, { key: "support", name: "Support", nameEs: "Apoyo", translationStatus: "VERIFIED", primaryStatisticKey: "chakra", maxPerTeam: 3, sortOrder: 0 });
  await vocabulary.formation(db, { key: "center", name: "Center", nameEs: "Centro", translationStatus: "VERIFIED", primaryStatisticKey: "force", maxPerTeam: 2, sortOrder: 1 });
  await vocabulary.formation(db, { key: "vanguard", name: "Vanguard", nameEs: "Vanguardia", translationStatus: "VERIFIED", primaryStatisticKey: "force", maxPerTeam: 1, sortOrder: 2 });
  // Never downgrade a mapping another test file approved on purpose.
  for (const [key, formation] of [["supporters", "support"], ["assaulters", "center"], ["vanguards", "vanguard"]] as const) {
    const existing = await db.ninjaRole.findUnique({ where: { key } });
    if (!existing) await vocabulary.role(db, { key, name: key, mappedFormationKey: formation, mappingStatus: "PROPOSED" });
  }
  for (const [i, key] of ["S", "SS", "SSS", "SR", "SSR"].entries()) await vocabulary.rating(db, { key, name: key, sortOrder: i });
  for (const key of ["dot", "cc", "stat_modifier", "immunity", "protection", "restriction"]) await ensureStatusCategory(db, { key, name: key });
}

/** Rejects with whatever error the promise raises, as a string — handy for trigger messages. */
export async function failure(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (e) {
    return String(e instanceof Error ? e.message : e);
  }
  return "";
}

/**
 * Prisma reports a trigger's RAISE(ABORT) as a generic constraint failure with this code and
 * drops the trigger's own message. Tests that expect it are built so that no real foreign key
 * is involved; the trigger texts themselves are checked through raw SQL in m2-platform.test.ts.
 */
export const TRIGGER_REJECTION = "P2003";

/** The Prisma error code a write is rejected with, or "" when it goes through. */
export async function dbRejects(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (e) {
    return (e as { code?: string }).code ?? "UNKNOWN";
  }
  return "";
}
