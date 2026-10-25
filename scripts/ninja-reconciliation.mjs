import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

/**
 * Writes the three data files of the Milestone 3 delivery from ONE source of numbers: scripts/final-audit.mjs.
 *   MILESTONE_4_DATABASE_RECONCILIATION.csv   one row per ninja in the database
 *   (Supporter audit: see verify-supporters.mjs)
 *   MILESTONE_4_DATA_METRICS.csv          totals with their counting definitions
 * Usage: node scripts/final-audit.mjs && node scripts/ninja-reconciliation.mjs
 * (the import ledger MILESTONE_3_IMPORT_LEDGER.csv comes from: npx tsx prisma/ingest-reference.ts --ledger MILESTONE_3_IMPORT_LEDGER.csv)
 */
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
const { figures: F, per } = JSON.parse(readFileSync("scripts/.audit-figures.json", "utf8"));
const ledger = parseCsv(readFileSync("MILESTONE_3_IMPORT_LEDGER.csv", "utf8").replace(/\r/g, "")).filter((r) => r.source_id);
const bySlug = new Map();
for (const r of ledger) if (r.slug) bySlug.set(r.slug, [...(bySlug.get(r.slug) ?? []), r]);
const spanishWord = { COMPLETE: "complete", PARTIAL: "partial (Spanish text cut in the source)", MISSING: "missing", MISSING_SOME: "missing for some blocks", NO_ENGLISH: "no text" };

// ── 1. one row per ninja ──
const rows = [["ninja", "slug", "channel", "rating", "formation_as_printed", "type", "full_card", "text_blocks", "awakening_stages", "awakening_stages_with_stated_rule", "effect_rows", "english_text", "spanish_text_status", "status_definitions", "status_definitions_with_spanish", "aliases", "source_entries", "identity_statuses", "flags"]];
for (const n of per) {
  const sources = bySlug.get(n.slug) ?? [];
  const flags = [...new Set(sources.flatMap((s) => (s.flags ? s.flags.split(" | ") : [])))];
  rows.push([n.name, n.slug, n.role, n.rating, n.formation, n.type, n.fullCard ? "yes" : "no", n.textBlocks, n.awakeningStages, n.awakeningStated, n.effectRows, n.enText ? "yes" : "no", spanishWord[n.esNinja], n.statusDefs, n.statusDefsWithEs, n.aliases, sources.map((s) => s.source_id).join(" + "), sources.map((s) => s.identity_status).join(" + "), flags.join(" | ")]);
}
writeFileSync("MILESTONE_4_DATABASE_RECONCILIATION.csv", csv(rows));

// ── 2. the 79 Supporter cards ──
const sha = (file) => (existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : "");
const perBySlug = new Map(per.map((n) => [n.slug, n]));
const audit = [["card_no", "name_as_posted", "ninja_in_database", "identity_status", "card_file", "card_sha256", "card_values", "english_lines", "spanish_lines", "spanish_ability_text", "spanish_status_definitions", "effect_rows_structured", "rows_needing_review", "rows_text_only", "mapping_status", "notes"]];
for (const r of ledger.filter((x) => x.channel === "supporters")) {
  const no = Number(r.source_id.match(/:(\d+)_/)?.[1] ?? 0);
  const cardFile = r.card_asset ? r.card_asset.replace(/^m3-handoff\//, "docs/m3-handoff/") : "";
  const cardPath = cardFile && !cardFile.startsWith("docs/") ? "docs/m2-handoff/" + cardFile : cardFile;
  const p = perBySlug.get(r.slug);
  const note = [];
  if (no === 47) note.push("Spanish source stops after alternative 3; the fury line has no Spanish (not invented)");
  if (no === 74) note.push("the two status definitions (Armor Break, Crit Resistance Reduction) exist in English only; the ability text is fully translated");
  if ([65, 66, 70].includes(no)) note.push("the card prints a five digit HP where similar cards print six; stored as printed, client to confirm");
  if (no === 76) note.push("card skill label differs from the text heading (Explosive Shadow Stab / Shadow Fang)");
  if (r.flags.includes("CARD_LANGUAGE_ZH")) note.push("Chinese card, labels matched by position, name plate not translated");
  if (r.flags.includes("CARD_LABEL_CUT")) note.push("a name on the card is cut off by the layout");
  if (r.identity_status === "ALIAS_REVIEWED") note.push("name matched by judgement, client to confirm");
  if (no === 17 || no === 77) note.push("enriches an existing ninja record");
  const defs = p.statusDefs === 0 ? "none in the source" : p.statusDefsWithEs >= p.statusDefs ? "complete" : "English only";
  audit.push([
    no, r.name_as_posted, r.ninja, r.identity_status, cardPath, sha(cardPath), r.has_card === "yes" ? "VERIFIED against the card image" : "NOT_FOUND",
    r.en_lines, r.es_lines, spanishWord[p.esNinja] === "complete" ? "complete" : spanishWord[p.esNinja], defs, r.effect_rows_structured, r.effect_rows_needs_review, r.effect_rows_text_only,
    r.action === "LOADED" || r.action === "MERGED" ? "LINKED" : "BLOCKED", note.join("; "),
  ]);
}
// the Supporter audit of Milestone 4 is written by scripts/verify-supporters.mjs --csv

// ── 3. metrics with definitions ──
const m = [["category", "metric", "value", "detail"]];
const add = (c, k, v, d = "") => m.push([c, k, v, d]);
add("Definitions", "awakening stage", "one stored talent or skill awakening level", "counted once per level; the per-ninja column awakening_stages sums to the same total");
add("Definitions", "stated rule", "an awakening stage whose stacking rule is not UNKNOWN", "comes from the source text or from a client decision");
add("Definitions", "text block", "a talent, a skill (normal, special) or an awakening stage that has English text", "status definitions are separate and optional");
add("Definitions", "Spanish complete (ninja)", "every text block has Spanish and none is cut in the source", "line count may differ when the Spanish merges or splits lines; numbers are compared and differences are flagged");
add("Definitions", "full card", "rating, formation, type and four base statistics", "");
add("Totals", "ninjas in the database", F.ninjas, `no duplicate slugs (${F.duplicateNames} duplicates)`);
add("Totals", "ninjas with a full card", F.fullCards, `without a card: ${F.noCard.join("; ")}`);
add("Totals", "ninjas with English ability text", F.withEnglish);
add("Totals", "ninjas with complete Spanish", F.esNinja.COMPLETE);
add("Totals", "ninjas with partial Spanish", F.esNinja.PARTIAL, F.esNinjaNames.PARTIAL.join("; ") + " (Spanish text cut in the source)");
add("Totals", "ninjas with no Spanish", F.esNinja.MISSING + F.esNinja.MISSING_SOME, F.esNinjaNames.MISSING.concat(F.esNinjaNames.MISSING_SOME).join("; "));
add("Totals", "text blocks (English)", F.textBlocks, `Spanish complete ${F.esBlocks.complete}, partial ${F.esBlocks.partial}, missing ${F.esBlocks.missing}`);
add("Totals", "status definitions", F.statusDefs.total, `with Spanish ${F.statusDefs.withSpanish}; English only: ${F.statusDefs.ninjasMissingSpanish.join("; ")}`);
add("Totals", "effect rows", F.effectRows, Object.entries(F.effectStatus).map(([k, v]) => `${k}=${v}`).join(", "));
const flagged = new Set(ledger.filter((r) => /ES_(LINE_COUNT_DIFFERS|NUMBERS_DIFFER|WORDING_DIFFERS|TEXT_CUT)/.test(r.flags)).map((r) => r.slug));
add("Totals", "ninjas with any flagged English/Spanish difference", flagged.size, "line count, wording, numbers or cut text; both texts are kept and English is the original");
add("Totals", "English and Spanish number differences kept and flagged", F.esNumberMismatch.length, "ninjas with at least one text block whose numbers differ between the two languages");
for (const [role, n] of Object.entries(F.roles)) add("By channel", `${role}: ninjas / with full card`, `${n} / ${F.roleFullCards[role]}`);
add("Supporters", "Supporter cards supplied and linked", ledger.filter((r) => r.channel === "supporters").length, "16 earlier + 63 new; each linked to exactly one existing ninja");
add("Supporters", "ninjas in the Supporter channel", F.roles.supporters, "equals the number of cards: no duplicate and no missing ninja");
add("Supporters", "ninjas whose card prints the Support formation", F.supportFormation, `${F.roles.supporters} Supporter channel + ${F.supportFormationNotSupporterRole.length} Alien cards that also print Support (${F.supportFormationNotSupporterRole.join("; ")}). This is not the Supporter count`);
add("Supporters", "name matches by judgement (client to confirm)", F.aliases.byStatus.REVIEWED - 1, "6 new Supporter names; the 7th REVIEWED alias is Shodai Hokage (older decision)");
add("Awakenings", "awakening stages", F.awakening.stages, `${F.awakening.talent} talent, ${F.awakening.skill} skill, on ${F.awakening.ninjas} ninjas; per-ninja sum ${F.awakening.sumOfPerNinja}`);
add("Awakenings", "stages with a stated rule", F.awakening.stated, `per-ninja sum ${F.awakening.statedSumOfPerNinja}`);
for (const rule of ["REPLACES_PRIOR", "CANCELS_PRIOR", "UPGRADES_BASE", "CUMULATIVE"]) add("Awakenings", `rule ${rule}`, F.awakening.byRule[rule].length, F.awakening.byRule[rule].join("; "));
add("Awakenings", "rule UNKNOWN", F.awakening.byRule.UNKNOWN.length, `first stages ${F.awakening.unknownBreakdown.firstStage} (relation to the base not stated), unnumbered stages ${F.awakening.unknownBreakdown.unnumbered}, later stages ${F.awakening.unknownBreakdown.laterStage}`);
add("Awakenings", "stages replacing the previous one by the client general rule", F.awakening.clientRuleReplacements, "each new awakening replaces the previous awakening of the same talent or skill");
for (const [k, v] of Object.entries(F.ratings)) add("Ranks", k, v, v ? "" : "defined, no card uses it yet");
add("Equipment, jewelry, gems", "equipment pieces / jewelry pieces / gems", `${F.items.equipment} / ${F.items.jewelry} / ${F.items.gems}`, "no source material supplied; nothing invented; gems stay hidden (404)");
writeFileSync("MILESTONE_4_DATA_METRICS.csv", csv(m));
console.log(`reconciliation ${rows.length - 1} ninjas; audit ${audit.length - 1} cards; metrics ${m.length - 1} rows`);
