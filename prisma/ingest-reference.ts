import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  analyzeReleaseList,
  loadReferenceData,
  readReferenceFile,
  type ReleaseFile,
  type StagedEvidenceFile,
} from "../src/game/reference-loader";

/**
 * Operator-run loader for the staged reference data:   npm run db:ingest
 *
 * Reads data/reference/*.json (transcribed by hand from the supplied screenshots) and upserts
 * it. Safe to re-run. It opens no network connection and has no Discord code path at all.
 * `--export-staging` also writes the reviewed staging tables as CSV, in the handoff templates' columns.
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

async function main() {
  if (process.argv.includes("--export-staging")) exportStaging();
  const db = new PrismaClient();
  try {
    const inventory = await loadReferenceData(db, dir);
    console.log(JSON.stringify(inventory, null, 2));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
