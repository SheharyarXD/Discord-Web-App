import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { auditGear, importGear, planGear, readLedger, readTranscriptions } from "../src/game/gear-import";

/**
 * Equipment and jewelry import.
 *   npx tsx scripts/import-gear.ts --dry-run [--out <folder>]     plan and audit only, no database
 *   npx tsx scripts/import-gear.ts --apply                         write to the database named by TARGET_DATABASE_URL (or DATABASE_URL)
 * Idempotent: a second --apply changes nothing. Existing ninja, account and effect rows are never touched.
 */
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const out = outIndex >= 0 ? args[outIndex + 1]! : "scratch-out";
const plan = planGear(readTranscriptions());
const ledger = readLedger();
const audit = auditGear(plan, ledger);

async function main() {
  if (args.includes("--dry-run")) {
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, "gear-dry-run.json"), JSON.stringify(audit, null, 1));
    console.log(JSON.stringify(audit.counts, null, 1));
    console.log(`review items: ${audit.reviewItems.length}; unassigned images: ${audit.unassignedImages.length}`);
  } else if (args.includes("--apply")) {
    const url = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!url) throw new Error("no database url");
    const db = new PrismaClient({ datasourceUrl: url });
    // RESUME=1 skips families that are already complete (all versions present); a normal run revisits everything.
  const done = new Set<string>();
  if (process.env.RESUME === "1") {
    for (const f of plan) {
      const eq = await db.equipmentSet.count({ where: { family: { slug: f.slug } } });
      const jw = await db.jewelrySet.count({ where: { family: { slug: f.slug } } });
      if (eq === f.versions.filter((v) => v.kind === "equipment").length && jw === f.versions.filter((v) => v.kind === "jewelry").length && (await db.gearFamily.count({ where: { slug: f.slug } })) === 1 && (eq + jw > 0 || f.nameOnly)) done.add(f.slug);
    }
  }
  const skip = (slug: string) => done.has(slug);
  const before = { ninjas: await db.ninja.count(), abilities: await db.ability.count(), users: await db.user.count() };
    const result = await importGear(db, plan, ledger, Number(process.env.IMPORT_CONCURRENCY ?? (url.startsWith("file:") ? 1 : 3)), skip);
    const after = { ninjas: await db.ninja.count(), abilities: await db.ability.count(), users: await db.user.count() };
    console.log(JSON.stringify({ result, before, after }, null, 1));
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("unrelated tables changed");
    await db.$disconnect();
  } else {
    console.log("usage: --dry-run | --apply");
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
