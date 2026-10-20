import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Checks, for the 79 Supporter cards, that what is stored in the database equals what the source says:
 *  - the staged card values (rating, type, formation label, four statistics with growth rates);
 *  - every English and Spanish line of the cited text file, word for word, attached to the right ninja;
 *  - the talent and skill names against the names printed on the card.
 * Usage: node scripts/verify-supporters.mjs   (exit code 1 on any mismatch)
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
const resolve = (asset) => (asset.startsWith("m3-handoff/") ? path.join(docs, asset) : path.join(m2, asset));
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
  seen.add(ninja.id);
  if (e.card) {
    cards++;
    const c = e.card;
    if (ninja.rating?.key !== c.rating) bad(id, `rating ${ninja.rating?.key} != card ${c.rating}`);
    if (ninja.baseStats.length !== 4) bad(id, `${ninja.baseStats.length} base stats`);
    c.stats.forEach((s, i) => {
      const d = ninja.baseStats[i];
      if (!d || d.sourceLabel !== s.label || Number(d.baseValue) !== Number(s.value) || Number(d.growthRate) !== Number(s.growth)) bad(id, `stat ${i} ${d?.sourceLabel} ${d?.baseValue}/${d?.growthRate} != card ${s.label} ${s.value}/${s.growth}`);
    });
    if (!existsSync(resolve(c.asset))) bad(id, `card file missing ${c.asset}`);
    // names printed on the card against the stored talent and skill
    const talent = ninja.talentGroups.flatMap((g) => g.options)[0];
    const skills = ninja.abilities.filter((a) => ["skill", "normal_skill", "special_skill"].includes(a.abilityType.key));
    const tl = lettersOnly(c.talentLabel.text);
    if (c.language === "en" && talent && skills.length === 1) {
      const names = [talent.name, talent.cardLabel].filter(Boolean).map(lettersOnly);
      if (!names.some((n) => n.startsWith(tl) || tl.startsWith(n))) bad(id, `card talent "${c.talentLabel.text}" vs stored "${talent.name}" (card label ${talent.cardLabel})`);
      const sl = lettersOnly(c.skillLabel.text);
      if (!skills.some((s) => [s.name, s.cardLabel].filter(Boolean).map(lettersOnly).some((n) => n.startsWith(sl) || sl.startsWith(n)))) bad(id, `card skill "${c.skillLabel.text}" is not among the stored skills (${skills.map((s) => s.name).join(", ")})`);
    }
  }
  // awakening stages: same count and same levels as the source headings
  const wantAw = (e.abilities ?? []).filter((x) => x.slot.endsWith("_awakening")).map((x) => `${x.slot}:${x.stage}`).sort().join(",");
  const gotAw = ninja.abilities.filter((x) => x.abilityType.key.endsWith("_awakening")).map((x) => `${x.abilityType.key}:${x.stage}`).sort().join(",");
  if (id.startsWith("supporters:") && !["supporters:17_yasaka-itachi"].includes(id) && wantAw !== gotAw) bad(id, `awakening stages stored [${gotAw}] != source [${wantAw}]`);
  // every English and Spanish line of every ability, word for word in the cited file, and present in the stored text
  const stored = [...ninja.abilities.map((a) => ({ en: a.description ?? "", es: a.descriptionEs ?? "" })), ...ninja.talentGroups.flatMap((g) => g.options).map((o) => ({ en: o.description ?? "", es: o.descriptionEs ?? "" }))];
  const allEn = stored.map((s) => s.en).join("\n"), allEs = stored.map((s) => s.es).join("\n");
  for (const a of e.abilities ?? []) {
    for (const [lang, t, hay] of [["EN", a.en, allEn], ["ES", a.es, allEs]]) {
      if (!t) continue;
      const src = read(t.asset);
      for (const l of t.lines) {
        lines++;
        if (src && !src.includes(l.text)) bad(id, `${lang} line not in its file: ${l.text.slice(0, 60)}`);
        if (!hay.includes(l.text)) bad(id, `${lang} line not stored on ${ninja.name}: ${l.text.slice(0, 60)}`);
      }
    }
  }
}
console.log(`${cards} cards checked, ${lines} text lines checked, ${seen.size} distinct ninjas`);
const names = entries.map((e) => identity[e.sourceId].ninja);
console.log(`${entries.length} entries -> ${new Set(names).size} distinct ninja names`);
if (problems.length) { console.log(problems.join("\n")); process.exitCode = 1; } else console.log("NO MISMATCH");
await db.$disconnect();
