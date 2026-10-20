import "dotenv/config";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  analyzeReleaseList,
  loadReferenceData,
  readReferenceFile,
  type ReferenceInventory,
  type ReleaseFile,
  type StagedEvidenceFile,
} from "../src/game/reference-loader";

/**
 * Operator-run loader for the staged reference data:   npm run db:ingest
 *
 * Reads data/reference/*.json (transcribed by hand from the supplied screenshots) and upserts
 * it. Safe to re-run. It opens no network connection and has no Discord code path at all.
 * `--export-staging` also writes the reviewed staging tables as CSV, in the handoff templates' columns.
 * `--dry-run` loads into a temporary COPY of the database and reports what would change; the real
 *   database is not opened for writing.
 * `--ledger <file>` writes one CSV row per source entry (and per release-list ninja with no profile).
 */
const dir = path.resolve("data/reference");
const csv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";

function exportStaging() {
  const out = path.join(dir, "staging");
  mkdirSync(out, { recursive: true });
  const analysis = analyzeReleaseList(readReferenceFile<ReleaseFile>(dir, "release-order.json"));
  writeFileSync(
    path.join(out, "ninja_release_staging.csv"),
    csv([
      ["original_name", "release_year", "release_month", "release_order_in_source", "original_forum_category", "confirmed_formation", "rating", "manual_combat_class", "game_type", "source_image", "source_region", "review_status", "ambiguity_notes"],
      ...analysis.entries.map((e) => [
        e.name, e.year, e.month, e.order, "", "", "", "", "",
        [...e.fullIn, ...e.partialIn.map((a) => `${a} (partial)`)].join(" | "),
        `release-order list, line ${e.order}`,
        e.fullIn.length ? "confirmed" : "partially_confirmed",
        "Release list only: role, formation, rating, class and type are not shown in this source.",
      ]),
    ]),
  );
  const staged = readReferenceFile<StagedEvidenceFile>(dir, "staged-evidence.json");
  writeFileSync(
    path.join(out, "effect_usage_staging.csv"),
    csv([
      ["owner_name", "owner_type", "ability_name", "status_or_effect_name", "raw_text", "default_stat_modifier_percent", "usage_override_percent", "application_chance_percent", "duration_rounds", "target_original", "required_nature", "other_conditions", "source_image", "review_status", "ambiguity_notes"],
      ...staged.items.map((i) => [
        i.ownerName, i.ownerName ? "ninja" : "", i.abilityName, i.statusKey, i.rawText, i.defaultStatModifierPercent, i.usageOverridePercent,
        i.applicationChancePercent, i.durationRounds, i.targetOriginal, i.requiredNature, i.otherConditions,
        [i.asset, ...i.alsoIn].join(" | "), i.reviewStatus.toLowerCase(), i.ambiguityNote,
      ]),
    ]),
  );
  const sources = readReferenceFile<{ assets: { path: string; section: string; description: string; fullyLegible: boolean; duplicateOf?: string; remainingQuestions: string; notes: string }[] }>(dir, "sources.json");
  const extracted = (assetPath: string) => {
    const capture = analysis.entries.filter((e) => e.fullIn.some((a) => assetPath.endsWith(a))).length;
    return capture || "";
  };
  writeFileSync(
    path.join(out, "source_review_log.csv"),
    csv([
      ["asset_filename", "section", "description", "reviewed", "fully_legible", "extracted_record_count", "duplicate_of", "remaining_questions", "reviewer_notes"],
      ...sources.assets.map((a) => [a.path, a.section, a.description, "yes", a.fullyLegible ? "yes" : "no", extracted(a.path), a.duplicateOf ?? "", a.remainingQuestions, a.notes]),
    ]),
  );
  console.log(`✔ Staging CSVs written to ${path.relative(process.cwd(), out)}`);
}

const COUNTED = ["ninja", "ninjaAlias", "ninjaBaseStat", "ability", "talentGroup", "talentOption", "effect", "condition", "statusEffect", "statistic", "sourceAsset", "sourceRecord"] as const;
async function tableCounts(db: PrismaClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of COUNTED) counts[table] = await (db[table] as unknown as { count: () => Promise<number> }).count();
  return counts;
}

function writeLedger(file: string, inventory: ReferenceInventory) {
  const p = inventory.profiles;
  if (!p) throw new Error("--ledger: no ninja profiles were loaded");
  const header = ["source_id", "channel", "channel_collection", "name_as_posted", "card_name_plate", "identity_status", "ninja", "slug", "action", "completeness", "has_card", "rating", "formation_label", "type_label", "base_stats", "ability_blocks", "en_lines", "es_lines", "effect_rows_structured", "effect_rows_needs_review", "effect_rows_text_only", "spanish", "card_asset", "text_asset_en", "text_asset_es", "evidence_records", "flags", "collector_notes"];
  const rows = p.ledger.map((r) => [r.sourceId, r.channel, r.collectionStatus, r.nameAsPosted, r.cardNamePlate, r.identityStatus, r.ninja, r.slug, r.action, r.completeness, r.hasCard ? "yes" : "no", r.rating, r.formationLabel, r.typeLabel, r.baseStats, r.abilityBlocks, r.enLines, r.esLines, r.rowsStructured, r.rowsNeedsReview, r.rowsTextOnly, r.spanish, r.cardAsset, r.textAsset, r.textAssetEs, r.evidenceRecords, r.flags.join(" | "), r.notes.join(" | ")]);
  const sparse = p.releaseOnly.map((name) => ["", "release-order", "COMPLETE", name, "", "EXACT", name, "", "LOADED", "NAME_ONLY", "no", "", "", "", 0, 0, 0, 0, 0, 0, 0, "NONE", "", "", "", 0, "NO_PROFILE_SUPPLIED", ""]);
  mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  writeFileSync(file, csv([header, ...rows, ...sparse]));
  console.log(`✔ Ledger written to ${file} (${rows.length} source entries, ${sparse.length} release-list ninjas with no profile)`);
}

/** The SQLite file DATABASE_URL points at (Prisma resolves it relative to the schema folder). */
function databaseFile(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("file:")) throw new Error("--dry-run needs a SQLite DATABASE_URL (file:...)");
  return path.resolve("prisma", url.slice("file:".length));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--export-staging")) exportStaging();
  const ledgerFile = args.includes("--ledger") ? args[args.indexOf("--ledger") + 1] : undefined;
  const dryRun = args.includes("--dry-run");

  let copy: string | undefined;
  if (dryRun) {
    copy = path.join(os.tmpdir(), `furia-ninja-dry-run-${process.pid}.db`);
    copyFileSync(databaseFile(), copy);
  }
  const db = copy ? new PrismaClient({ datasources: { db: { url: `file:${copy}` } } }) : new PrismaClient();
  try {
    const before = await tableCounts(db);
    const inventory = await loadReferenceData(db, dir);
    const after = await tableCounts(db);
    // The ledger has one row per source entry: it goes to the CSV, not to the console.
    const { profiles, ...rest } = inventory;
    console.log(JSON.stringify({ ...rest, profiles: profiles && { ...profiles, ledger: `${profiles.ledger.length} rows`, releaseOnly: profiles.releaseOnly.length } }, null, 2));
    console.log(dryRun ? "DRY RUN on a copy. The database was not changed. Rows before → after:" : "Rows before → after:");
    for (const table of COUNTED) console.log(`  ${table.padEnd(14)} ${String(before[table]).padStart(6)} → ${String(after[table]).padStart(6)}  (${after[table]! - before[table]! >= 0 ? "+" : ""}${after[table]! - before[table]!})`);
    if (ledgerFile) writeLedger(ledgerFile, inventory);
  } finally {
    await db.$disconnect();
    if (copy) rmSync(copy, { force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
