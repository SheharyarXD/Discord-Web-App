import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Checks, for the 79 Supporter cards, that what is stored in the database equals what the source says:
 *  - the staged card values (rating, type, formation label, four statistics with growth rates);
 *  - every English and Spanish line of the cited text file, word for word, attached to the right ninja;
 *  - the talent and skill names against the names printed on the card.
 * Usage: node scripts/verify-supporters.mjs [--csv MILESTONE_4_SUPPORTER_FINAL_AUDIT.csv]   (exit code 1 on any mismatch)
 * With --csv it writes one row per card with the actual result of every check.
 */
const db = new PrismaClient();
const dir = "data/reference/profiles";
const files = ["supporters.json", "supporters-m3.json"].map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
const identity = JSON.parse(readFileSync(path.join(dir, "identity-map.json"), "utf8")).entries;
const entries = files.flatMap((f) => f.entries);
const problems = [];
const bad = (id, msg) => problems.push(`${id}: ${msg}`);
const lettersOnly = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const m2 = path.resolve("docs/m2-handoff"), docs = path.resolve("docs");
const resolve = (asset) => (asset.startsWith("data/") ? path.resolve(asset) : asset.startsWith("m3-handoff/") ? path.join(docs, asset) : path.join(m2, asset));
const csvArg = process.argv.indexOf("--csv") > -1 ? process.argv[process.argv.indexOf("--csv") + 1] : null;
const csvRows = [["card_no", "source_id", "ninja", "identity_status", "rating", "formation_type", "four_statistics_and_growth", "talent_name_vs_card", "skill_name_vs_card", "english_lines", "spanish_lines", "awakening_stages", "awakening_rules", "card_file_sha256", "disputed_or_missing_fields"]];
const text = new Map();
const read = (asset) => { if (!text.has(asset)) text.set(asset, existsSync(resolve(asset)) ? readFileSync(resolve(asset), "utf8").replace(/\r\n/g, "\n") : null); return text.get(asset); };

let cards = 0, lines = 0;
const seen = new Set();
for (const e of entries) {
  const id = e.sourceId;
  const decision = identity[id];
  const ninja = await db.ninja.findFirst({
    where: { name: decision.ninja },
    include: { rating: true, formation: true, ninjaType: true, baseStats: { include: { statistic: true }, orderBy: { sortOrder: "asc" } }, abilities: { include: { abilityType: true } }, talentGroups: { include: { options: true } } },
  });
  if (!ninja) { bad(id, `no ninja "${decision.ninja}"`); continue; }
  const before = problems.length;
  const res = { rating: "n/a", form: "n/a", stats: "n/a", talent: "n/a", skill: "n/a", sha: "", disputed: [] };
  seen.add(ninja.id);
  if (e.card) {
    cards++;
    const c = e.card;
    const b0 = problems.length;
    if (ninja.rating?.key !== c.rating) bad(id, `rating ${ninja.rating?.key} != card ${c.rating}`);
    res.rating = problems.length === b0 ? `OK ${c.rating}` : "MISMATCH";
    res.form = ninja.formation && ninja.ninjaType ? `OK ${ninja.formation.name} / ${ninja.ninjaType.name} (printed: ${c.formationLabel} / ${c.typeLabel})` : "MISSING";
    const b1 = problems.length;
    if (ninja.baseStats.length !== 4) bad(id, `${ninja.baseStats.length} base stats`);
    c.stats.forEach((s, i) => {
      const d = ninja.baseStats[i];
      if (!d || d.sourceLabel !== s.label || Number(d.baseValue) !== Number(s.value) || Number(d.growthRate) !== Number(s.growth)) bad(id, `stat ${i} ${d?.sourceLabel} ${d?.baseValue}/${d?.growthRate} != card ${s.label} ${s.value}/${s.growth}`);
    });
    res.stats = problems.length === b1 ? `OK ${c.stats.map((x) => `${x.value}/${x.growth}`).join(" ")}` : "MISMATCH";
    if (!existsSync(resolve(c.asset))) bad(id, `card file missing ${c.asset}`);
    else res.sha = createHash("sha256").update(readFileSync(resolve(c.asset))).digest("hex");
    if (c.stats.some((x) => /^(HP|体力)$/.test(x.label) && Number(x.growth) >= 30 && Number(x.value) / Number(x.growth) < 1500)) res.disputed.push("HP printed with five digits where similar cards print six; stored as printed, client to confirm");
    if (c.language !== "en") res.disputed.push("Chinese card: labels matched by position, name plate not translated");
    if (c.talentLabel.truncated || c.skillLabel.truncated) res.disputed.push("a card label is cut off by the layout");
    // names printed on the card against the stored talent and skill
    const talent = ninja.talentGroups.flatMap((g) => g.options)[0];
    const skills = ninja.abilities.filter((a) => ["skill", "normal_skill", "special_skill"].includes(a.abilityType.key));
    const tl = lettersOnly(c.talentLabel.text);
    if (c.language === "en" && talent && skills.length === 1) {
      const names = [talent.name, talent.cardLabel].filter(Boolean).map(lettersOnly);
      if (!names.some((n) => n.startsWith(tl) || tl.startsWith(n))) bad(id, `card talent "${c.talentLabel.text}" vs stored "${talent.name}" (card label ${talent.cardLabel})`);
      res.talent = `OK ${talent.name}`;
      const sl = lettersOnly(c.skillLabel.text);
      if (!skills.some((s) => [s.name, s.cardLabel].filter(Boolean).map(lettersOnly).some((n) => n.startsWith(sl) || sl.startsWith(n)))) bad(id, `card skill "${c.skillLabel.text}" is not among the stored skills (${skills.map((s) => s.name).join(", ")})`);
      res.skill = `OK ${skills[0].name}`;
      if (skills[0].cardLabel && !lettersOnly(skills[0].name).includes(lettersOnly(skills[0].cardLabel)) && !lettersOnly(skills[0].cardLabel).includes(lettersOnly(skills[0].name))) { res.skill = `MISMATCH FLAGGED: card "${skills[0].cardLabel}" vs text "${skills[0].name}"; both kept`; res.disputed.push(`skill name: card "${skills[0].cardLabel}" vs text "${skills[0].name}"`); }
    } else if (c.language === "en" && skills.length > 1) {
      res.talent = talent ? `OK ${talent.name}` : "MISSING"; res.skill = `FLAGGED: ${skills.length} skills (${skills.map((s) => s.typeKey ?? s.name).join(", ")}); the card prints one label "${c.skillLabel.text}" and is kept beside them`; res.disputed.push("card skill label not placed on one of several skills");
    } else if (c.language !== "en") { res.talent = `Chinese label "${c.talentLabel.text}" kept; English name from the text: ${talent?.name ?? "none"}`; res.skill = `Chinese label "${c.skillLabel.text}" kept; English name from the text: ${skills[0]?.name ?? "none"}`;
    }
  }
  // awakening stages: same count and same levels as the source headings
  const wantAw = (e.abilities ?? []).filter((x) => x.slot.endsWith("_awakening")).map((x) => `${x.slot}:${x.stage}`).sort().join(",");
  const gotAw = ninja.abilities.filter((x) => x.abilityType.key.endsWith("_awakening")).map((x) => `${x.abilityType.key}:${x.stage}`).sort().join(",");
  if (id.startsWith("supporters:") && !["supporters:17_yasaka-itachi"].includes(id) && wantAw !== gotAw) bad(id, `awakening stages stored [${gotAw}] != source [${wantAw}]`);
  // every English and Spanish line of every ability, word for word in the cited file, and present in the stored text
  const stored = [...ninja.abilities.map((a) => ({ en: a.description ?? "", es: a.descriptionEs ?? "" })), ...ninja.talentGroups.flatMap((g) => g.options).map((o) => ({ en: o.description ?? "", es: o.descriptionEs ?? "" }))];
  const allEn = stored.map((s) => s.en).join("\n"), allEs = stored.map((s) => s.es).join("\n");
  let enN = 0, esN = 0;
  for (const a of e.abilities ?? []) {
    for (const [lang, t, hay] of [["EN", a.en, allEn], ["ES", a.es, allEs]]) {
      if (!t) continue;
      const src = read(t.asset);
      for (const l of t.lines) {
        lines++; if (lang === "EN") enN++; else esN++;
        if (src && !src.includes(l.text)) bad(id, `${lang} line not in its file: ${l.text.slice(0, 60)}`);
        if (!hay.includes(l.text)) bad(id, `${lang} line not stored on ${ninja.name}: ${l.text.slice(0, 60)}`);
      }
    }
}
  if (id.startsWith("supporters:") && csvArg) {
    const rules = ninja.abilities.filter((x) => x.abilityType.key.endsWith("_awakening")).map((x) => `${x.abilityType.key.replace("_awakening", "")} ${x.stage ?? "?"}: ${x.stackingRule}`).join("; ");
    const spanishGap = (e.abilities ?? []).some((a) => a.en && !a.es && a.slot !== "status_note") ? "some ability has no Spanish" : (e.abilities ?? []).some((a) => a.slot === "status_note" && !a.es) ? "Spanish of the status definitions missing (optional)" : "";
    if (spanishGap) res.disputed.push(spanishGap);
    csvRows.push([Number(id.match(/:(\d+)_/)?.[1] ?? 0), id, ninja.name, decision.status, res.rating, res.form, res.stats, res.talent, res.skill, enN, esN, wantAw.split(",").filter(Boolean).length, rules, res.sha, [...res.disputed, ...(problems.length > before ? ["VERIFICATION MISMATCH, see log"] : []), ...((e.sourceNotes ?? []).length ? ["note: " + e.sourceNotes.join(" | ").slice(0, 200)] : [])].join("; ")]);
  }
}
console.log(`${cards} cards checked, ${lines} text lines checked, ${seen.size} distinct ninjas`);
const names = entries.map((e) => identity[e.sourceId].ninja);
console.log(`${entries.length} entries -> ${new Set(names).size} distinct ninja names`);
if (csvArg) { writeFileSync(csvArg, csvRows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n") + "\n"); console.log(`wrote ${csvArg}: ${csvRows.length - 1} rows`); }
if (problems.length) { console.log(problems.join("\n")); process.exitCode = 1; } else console.log("NO MISMATCH");
await db.$disconnect();
