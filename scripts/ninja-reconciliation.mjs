import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Writes two files from the live database and the staged profiles:
 *   MILESTONE_3_DATA_RECONCILIATION.csv         one row per ninja in the database
 *   MILESTONE_3_SUPPORTER_SYNC_AUDIT.csv        the 79 Supporter cards and the text sources behind them
 * Usage: node scripts/ninja-reconciliation.mjs
 */
const db = new PrismaClient();
const q = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
const csv = (rows) => rows.map((r) => r.map(q).join(",")).join("\n") + "\n";
const parseCsv = (text) => {
  const out = [];
  let row = [], field = "", inq = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inq) { if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') inq = false; else field += c; }
    else if (c === '"') inq = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); out.push(row); row = []; field = ""; }
    else field += c;
  }
  const [head, ...body] = out;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};
const ledger = parseCsv(readFileSync("MILESTONE_3_IMPORT_LEDGER.csv", "utf8").replace(/\r/g, "")).filter((r) => r.source_id);
const bySlug = new Map();
for (const r of ledger) if (r.slug) bySlug.set(r.slug, [...(bySlug.get(r.slug) ?? []), r]);

const ninjas = await db.ninja.findMany({
  orderBy: [{ releaseOrder: "asc" }, { name: "asc" }],
  include: {
    role: true, formation: true, rating: true, ninjaType: true,
    baseStats: true,
    abilities: { include: { abilityType: true, effects: { select: { structuredStatus: true } } } },
    talentGroups: { include: { options: { include: { effects: { select: { structuredStatus: true } }, awakenings: true } } } },
    aliases: true,
  },
});
const rows = [["ninja", "slug", "channel", "release", "rating", "formation_as_printed", "type", "card", "base_stats", "talent_options", "skills", "awakenings", "awakenings_with_stated_rule", "effect_rows", "rows_needing_review_or_text_only", "english_text", "spanish_text", "aliases", "source_entries", "identity_statuses", "flags", "completeness"]];
for (const n of ninjas) {
  const sources = bySlug.get(n.slug) ?? [];
  const skills = n.abilities.filter((a) => ["skill", "normal_skill", "special_skill"].includes(a.abilityType.key));
  const awakenings = [...n.abilities.filter((a) => a.abilityType.key.endsWith("_awakening")), ...n.talentGroups.flatMap((g) => g.options.flatMap((o) => o.awakenings))];
  const effects = [...n.abilities.flatMap((a) => a.effects), ...n.talentGroups.flatMap((g) => g.options.flatMap((o) => o.effects))];
  const withText = n.abilities.filter((a) => a.description).length + n.talentGroups.flatMap((g) => g.options).filter((o) => o.description).length;
  const withEs = n.abilities.filter((a) => a.descriptionEs).length + n.talentGroups.flatMap((g) => g.options).filter((o) => o.descriptionEs).length;
  const flags = [...new Set(sources.flatMap((s) => (s.flags ? s.flags.split(" | ") : [])))];
  rows.push([
    n.name, n.slug, n.role?.key ?? "", n.releaseYear ? `${n.releaseYear}-${String(n.releaseMonth).padStart(2, "0")}` : "", n.rating?.key ?? "", n.formation?.name ?? "", n.ninjaType?.name ?? "",
    n.baseStats.length ? "yes" : "no", n.baseStats.length, n.talentGroups.flatMap((g) => g.options).length, skills.length, awakenings.length,
    awakenings.filter((a) => a.stackingRule !== "UNKNOWN").length, effects.length, effects.filter((e) => e.structuredStatus !== "STRUCTURED").length,
    withText ? "yes" : "no", withEs ? (withEs >= withText ? "complete" : "partial") : "no", n.aliases.length,
    sources.map((s) => s.source_id).join(" + "), sources.map((s) => s.identity_status).join(" + "), flags.join(" | "),
    sources.some((s) => s.completeness) ? sources.map((s) => s.completeness)[0] : "NAME_ONLY",
  ]);
}
writeFileSync("MILESTONE_3_DATA_RECONCILIATION.csv", csv(rows));
console.log(`reconciliation: ${rows.length - 1} ninjas`);

// ── the 79 Supporter cards ──
const handoff = "docs/m3-handoff/M3_FINAL_SUPPORTER_SYNC_HANDOFF/02_SUPPORTER_SOURCE";
const sha = (file) => (existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : "");
const man = parseCsv(readFileSync(`${handoff}/M3_Supporters_and_Client_Changes_Handoff/sources/supporters_additional_17_to_79/supporters_additional_manifest_63.csv`, "utf8").replace(/^﻿/, "").replace(/\r/g, ""));
const sup = ledger.filter((r) => r.channel === "supporters");
const audit = [["card_no", "name_as_posted", "ninja_in_database", "identity_status", "card_file", "card_sha256", "card_status", "text_source", "english_lines", "spanish_lines", "spanish_status", "effect_rows_structured", "rows_needing_review", "rows_text_only", "mapping_status", "notes"]];
for (const r of sup) {
  const no = Number(r.source_id.match(/:(\d+)_/)?.[1] ?? 0);
  const cardFile = r.card_asset ? r.card_asset.replace(/^m3-handoff\//, "docs/m3-handoff/") : "";
  const cardPath = cardFile && !cardFile.startsWith("docs/") ? "docs/m2-handoff/" + cardFile : cardFile;
  const note = [];
  if (no === 74) note.push("Spanish has no copy of the two status definition lines (Armor Break, Crit Resistance Reduction); English kept");
  if (no === 47) note.push("Spanish source stops after alternative 3; fury line has no Spanish (not invented)");
  if (no === 70) note.push("HP printed as 45000 on the card; stored as printed, needs review");
  if (no === 76) note.push("Card skill label differs from the text heading (Explosive Shadow Stab / Shadow Fang)");
  if (r.flags.includes("CARD_LANGUAGE_ZH")) note.push("Chinese card, labels matched by position, name plate not translated");
  if (r.flags.includes("CARD_LABEL_CUT")) note.push("a name on the card is cut off by the layout");
  if (r.identity_status === "ALIAS_REVIEWED") note.push("name matched by judgement, client to confirm");
  if (no === 17 || no === 77) note.push("enriches an existing ninja record");
  const esFull = r.spanish === "SUPPLIED" && !r.flags.includes("ES_TEXT_CUT");
  audit.push([
    no || r.source_id, r.name_as_posted, r.ninja, r.identity_status, cardPath, sha(cardPath), r.has_card === "yes" ? "VERIFIED (read from image)" : "NOT_FOUND",
    r.text_asset_en ? (no >= 17 ? "NEW_63_EN_ES_TRANSCRIPT_RECOVERY" : "supporters 1-16 EN/ES staging") : "NOT_FOUND", r.en_lines, r.es_lines,
    esFull ? "VERIFIED" : r.spanish === "NONE" ? "NOT_FOUND" : "PARTIAL", r.effect_rows_structured, r.effect_rows_needs_review, r.effect_rows_text_only,
    r.action === "LOADED" || r.action === "MERGED" ? (r.has_card === "yes" ? "VERIFIED" : "PARTIAL") : "BLOCKED", note.join("; "),
  ]);
}
writeFileSync("MILESTONE_3_SUPPORTER_SYNC_AUDIT.csv", csv(audit));
console.log(`audit: ${audit.length - 1} cards (${man.length} in the 63-card manifest)`);
await db.$disconnect();
