import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createAbilityParser, effectNoteCodes, spanishBaseStatValues, type Lexicon } from "../src/domain/ability-text";
import { planProfiles, readProfileData } from "../src/game/profile-loader";
import { hrefWith, parseItemParams, parseNinjaParams } from "../src/server/query-params";
import { REFERENCE_DIR } from "./helpers";

const json = <T>(...parts: string[]) => JSON.parse(readFileSync(path.join(REFERENCE_DIR, ...parts), "utf8")) as T;
const data = readProfileData(REFERENCE_DIR)!;
const plan = planProfiles(data);
const planned = (name: string) => plan.ninjas.find((n) => n.name === name)!;
const blocks = (name: string) => {
  const n = planned(name);
  return [...(n.input.abilities ?? []), ...(n.input.talentGroups ?? []).flatMap((g) => g.options)].flatMap((b) => [b, ...(("awakenings" in b && b.awakenings) || [])]);
};

describe("client decisions after Milestone 2", () => {
  const vocab = json<{
    ratings: { rows: string[] };
    formations: { rows: { key: string; equivalentToKey?: string; equivalenceStatus?: string; equivalenceEvidence?: { sourceText: string } }[] };
    roles: { rows: { key: string; mappingStatus: string }[] };
  }>("vocabulary.json");

  it("the decisions are kept as a document that evidence can cite", () => {
    const doc = readFileSync(path.join(REFERENCE_DIR, "client-decisions-m3.md"), "utf8");
    for (const text of ["Assaulter = Center", "The Seventh Hokage = 7th Hokage", "Power: refers to Constitution", "S. Attack: a separate anti-block-rate statistic", "D, C, B-, B, B+, A-, A, A+, S-, S, S+, SS, SSS, SR, SSR", "Natsu Dragneel", "Cursed Tayuya"]) {
      expect(doc, text).toContain(text);
    }
  });

  it("all fifteen ranks, in the order the client listed them, with no ranking power invented", () => {
    expect(vocab.ratings.rows).toEqual(["D", "C", "B-", "B", "B+", "A-", "A", "A+", "S-", "S", "S+", "SS", "SSS", "SR", "SSR"]);
    expect(json<{ ratings: { orderNote: string } }>("vocabulary.json").ratings.orderNote).toMatch(/display order only/);
  });

  it("Assaulter = Center is approved with its evidence; the card keeps its own label", () => {
    const row = vocab.formations.rows.find((f) => f.key === "assaulter")!;
    expect([row.equivalentToKey, row.equivalenceStatus]).toEqual(["center", "APPROVED"]);
    expect(row.equivalenceEvidence!.sourceText).toBe("Assaulter = Center. They represent the same formation position.");
    expect(vocab.roles.rows.find((r) => r.key === "assaulters")!.mappingStatus).toBe("APPROVED");
    expect(vocab.roles.rows.filter((r) => r.mappingStatus === "APPROVED")).toHaveLength(1); // nothing else was confirmed
    expect(plan.ninjas.filter((n) => n.input.formationKey === "assaulter").length).toBeGreaterThan(50);
    expect(plan.ninjas.some((n) => n.input.formationKey === "center")).toBe(false); // card labels are not rewritten
  });

  it("the five name matches are aliases of the same ninja, never new characters", () => {
    for (const [canonical, alias] of [["7th Hokage", "The Seventh Hokage"], ["A-B Combo", "Ay-Bee Combo"], ["Might Guy", "Might Gai"], ["Shizuka", "Nadeshiko Shizuka"], ["10-Tails Obito", "10-Tailed Obito"]] as const) {
      const n = planned(canonical);
      expect(n.input.aliases!.map((a) => a.alias), canonical).toContain(alias);
      expect(n.input.aliases!.every((a) => a.status === "VERIFIED"), canonical).toBe(true);
      expect(plan.ninjas.some((x) => x.name === alias), alias).toBe(false);
    }
    // The four unidentified characters are still not linked to anything.
    for (const name of ["Illusion God Itachi", "Nagato uzumaki", "Immortal Madara", "Neji Hyuga"]) expect(plan.ninjas.some((n) => n.name === name)).toBe(false);
  });

  it("Power and S. Attack are their own statistics with the client's meaning", () => {
    const lex = json<{ statistics: { key: string; name?: string; nameEs?: string; note?: string; terms: string[] }[]; statuses: Lexicon["statuses"]; natures: Lexicon["natures"] }>("lexicon.json");
    const power = lex.statistics.find((s) => s.key === "power")!;
    expect(power).toMatchObject({ name: "Power", nameEs: "Constitución" });
    expect(power.note).toMatch(/Constitución.*HP/);
    expect(power.note).toMatch(/no se trata como Chakra/);
    const sAttack = lex.statistics.find((s) => s.key === "s-attack")!;
    expect(sAttack.nameEs).toMatch(/anti tasa de bloqueo/);
    expect(sAttack.note).toMatch(/No es el ataque estratégico/);
    expect(lex.statistics.find((s) => s.key === "strategy-attack")!.terms).not.toContain("s.attack");
    expect(lex.statistics.find((s) => s.key === "chakra")!.terms).not.toContain("power");
    // The parser keeps them apart.
    const { parseLine } = createAbilityParser(lex as Lexicon);
    expect(parseLine("Increases self s.attack by 20%.").effects[0]).toMatchObject({ statisticKey: "s-attack" });
    expect(parseLine("Increases self strategy attack by 20%.").effects[0]).toMatchObject({ statisticKey: "strategy-attack" });
    expect(parseLine("Increases self power by 20%.").effects[0]).toMatchObject({ statisticKey: "power" });
    expect(parseLine("Increases self chakra by 20%.").effects[0]).toMatchObject({ statisticKey: "chakra" });
  });

  it("the card's «Power» stays Power and is not turned into Chakra", () => {
    const keys = planned("Otsutsuki Momoshiki").input.baseStats!.map((s) => s.statisticKey);
    expect(keys).toEqual(["force", "power", "agility", "hp"]);
  });
});

describe("English is the original; Spanish fills only what English leaves without a number", () => {
  it("reads the numbers the Spanish gives to base attributes", () => {
    expect([...spanishBaseStatValues("Aumenta la agilidad propia en 15% y la velocidad en 15%.")]).toEqual([["agility", "15"]]);
    expect([...spanishBaseStatValues("Aumenta la fuerza y la agilidad propias en 15%, la velocidad en 10%.")].sort()).toEqual([["agility", "15"], ["force", "15"]]);
    expect([...spanishBaseStatValues("Aumenta la agilidad y la fuerza propias en 35%, 25% velocidad.")].sort()).toEqual([["agility", "35"], ["force", "35"]]);
    expect([...spanishBaseStatValues("Aumenta la velocidad en 15% y el ataque en 20%.")]).toEqual([]);
    expect([...spanishBaseStatValues("Aumenta la fuerza propia.")]).toEqual([]);
  });

  it("fills an omitted agility from the Spanish and says so, while a conflicting number keeps the English", () => {
    const toad = blocks("Toad Sage").flatMap((b) => b.effects ?? []).filter((e) => e.sourceText === "Increases self agility, 15% speed.");
    const agility = toad.find((e) => e.statisticKey === "agility")!;
    expect([agility.value, agility.valueType, effectNoteCodes(agility.note)]).toEqual(["15", "PERCENT", expect.arrayContaining(["VALUE_FROM_ES"])]);
    expect(toad.find((e) => e.statisticKey === "speed")!.value).toBe("15"); // the English number, untouched

    // Eight Gates Gai: English speed 15%, Spanish speed 10%. The English stays; both are kept and flagged.
    const gai = blocks("Eight Gates Gai").flatMap((b) => b.effects ?? []).filter((e) => e.sourceText === "Increases self force and agility, 15% speed, 10% damage rate, and 15% punch rate.");
    expect(gai.find((e) => e.statisticKey === "speed")!.value).toBe("15");
    expect(gai.find((e) => e.statisticKey === "speed")!.descriptionEs).toContain("la velocidad en 10%");
    expect(gai.every((e) => effectNoteCodes(e.note).includes("ES_NUMBERS_DIFFER"))).toBe(true);
    expect(gai.filter((e) => e.statisticKey === "force" || e.statisticKey === "agility").every((e) => e.value === "15")).toBe(true);
  });

  it("never fills a number from Spanish where English gave one or where the stat is not named in the Spanish", () => {
    const all = plan.ninjas.flatMap((n) => blocks(n.name)).flatMap((b) => b.effects ?? []);
    const filled = all.filter((e) => effectNoteCodes(e.note).includes("VALUE_FROM_ES"));
    expect(filled.length).toBeGreaterThan(10);
    for (const e of filled) {
      expect(["force", "agility", "hp", "chakra"], e.sourceText!).toContain(e.statisticKey);
      expect(e.descriptionEs, e.sourceText!).toBeTruthy();
      // The English gives that stat no number of its own («N% agility», «agility by N%»). A bracket that may cover it is the very ambiguity the Spanish settles.
      expect(e.sourceText!, "the English line has no number of its own for that stat").not.toMatch(new RegExp(`\\d+% ${e.statisticKey}\\b|\\b${e.statisticKey} by \\d`));
    }
  });
});

describe("awakening rules stated in the brief", () => {
  const rules = json<{
    rules: { sourceId: string; slot: string; stage: number; rule: string; supersedesStage: number | null }[];
    confirmedRulesWithoutText: { ninja: string; slot: string; stage: number | null; rule: string; status: string }[];
  }>("profiles", "awakening-rules.json");

  it("the rules that can be attached are attached: Hinata, Kusanagi Kyo, First Hokage, Sage Jugo", () => {
    expect(rules.rules.map((r) => [r.sourceId, r.stage, r.rule]).sort()).toEqual([
      ["assaulters:44", 3, "CANCELS_PRIOR"], ["assaulters:51", 2, "REPLACES_PRIOR"], ["supporters:43_cursed-tayuya", 3, "UPGRADES_BASE"], ["supporters:74_natsu-dragneel", 1, "UPGRADES_BASE"],
      ["supporters:74_natsu-dragneel", 2, "REPLACES_PRIOR"], ["vanguards:2-02-sage-jugo", 3, "UPGRADES_BASE"], ["vanguards:2-14-hinata-soccer-star", 2, "REPLACES_PRIOR"],
    ]);
  });

  it("Natsu Dragneel and Cursed Tayuya now have their ability text, so their rules are attached and nothing waits any more", () => {
    expect(rules.confirmedRulesWithoutText).toEqual([]);
    const natsu = plan.ninjas.find((n) => n.name === "Natsu Dragneel")!;
    const talent = natsu.input.talentGroups![0]!.options[0]!;
    expect(talent.awakenings!.map((w) => [w.stage, w.stackingRule, w.supersedesStage])).toEqual([[1, "UNKNOWN", null], [2, "REPLACES_PRIOR", 1]]);
    expect(talent.awakenings![1]!.ruleSourceText).toBe("The effects of Talent Awakening 2 replace those of Talent Awakening 1.");
    // Skill awakening 1 replaces the base skill's growth rate and target (all enemies 330% to one random enemy 550%), nothing else.
    const skill = natsu.input.abilities!.find((a) => a.typeKey === "skill")!;
    expect(skill.awakenings!.map((w) => [w.stage, w.stackingRule])).toEqual([[1, "UPGRADES_BASE"]]);
    expect(skill.effects![0]).toMatchObject({ kind: "ATTACK", sourceText: "Attacks all enemies with 330% growth rate." });
    expect(skill.awakenings![0]!.effects![0]).toMatchObject({ kind: "ATTACK", sourceText: "Attacks one random enemy with 550% growth rate." });
    expect(skill.effects!.length).toBeGreaterThan(5);
    const tayuya = plan.ninjas.find((n) => n.name === "Cursed Tayuya")!;
    expect(tayuya.input.talentGroups![0]!.options[0]!.awakenings!.map((w) => [w.stage, w.stackingRule])).toEqual([[1, "UNKNOWN"], [2, "UNKNOWN"], [3, "UPGRADES_BASE"]]);
    const stage3 = tayuya.input.talentGroups![0]!.options[0]!.awakenings![2]!;
    expect(stage3.conditionText).toBe("Special Tayuya Card Awakening");
    expect(stage3.effects!.find((e) => e.statisticKey === "speed")).toMatchObject({ value: "92", replacesValue: "88" });
  });
});

describe("search parameters", () => {
  it("builds ninja filters from the address and drops what is malformed", () => {
    expect(parseNinjaParams({ q: "gai", rating: ["SSR", "S+"], formation: "center", class: ["TANK", "x"], stat1: "force", min1: "1000", max1: "abc", stat2: "hp", max2: "5,5", sort: "stat:desc:force", page: "3" })).toEqual({
      page: 3,
      query: "gai",
      ratingKeys: ["SSR", "S+"],
      formationKeys: ["center"],
      combatClasses: ["TANK"],
      statFilters: [{ statisticKey: "force", min: "1000" }, { statisticKey: "hp", max: "5.5" }],
      sort: { by: "stat", direction: "desc", statisticKey: "force" },
    });
    expect(parseNinjaParams({ page: "-4", sort: "stat:desc" })).toEqual({ page: 1 }); // a statistic sort without the statistic means the default order
    expect(parseNinjaParams({ stat1: "force" })).toEqual({ page: 1 }); // a row with no number is no filter
  });
  it("builds item filters and keeps administrator-only flags out of public parsing", () => {
    expect(parseItemParams("equipment", { type: "weapon", set: "a", stat1: "attack", min1: "5", sort: "name:desc" })).toEqual({
      kind: "equipment", page: 1, typeKeys: ["weapon"], setSlugs: ["a"], statFilters: [{ statisticKey: "attack", min: "5" }], sort: { by: "name", direction: "desc" },
    });
    expect(parseItemParams("gem", {}).includeUnpublished).toBeUndefined();
    expect(parseItemParams("gem", {}, { includeUnpublished: true }).includeUnpublished).toBe(true);
    expect(parseItemParams("equipment", { sort: "release:asc" }).sort).toBeUndefined(); // ninja-only sort
  });
  it("links keep the other filters and drop empty values", () => {
    expect(hrefWith("/ninjas", { q: "a", rating: ["S", "SS"], page: "4" }, { page: undefined })).toBe("/ninjas?q=a&rating=S&rating=SS");
    expect(hrefWith("/ninjas", { q: "a" }, { page: "2" })).toBe("/ninjas?q=a&page=2");
    expect(hrefWith("/ninjas", {}, {})).toBe("/ninjas");
  });
});
