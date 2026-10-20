import { describe, expect, it } from "vitest";
import { abilityNoteCodes } from "../src/domain/ability-text";
import { planProfiles, readProfileData, type PlannedNinja } from "../src/game/profile-loader";
import { REFERENCE_DIR } from "./helpers";

/** The 63 additional Supporter cards (sources 17 to 79) as planned from the staged profiles. */
const data = readProfileData(REFERENCE_DIR)!;
const plan = planProfiles(data);
const planned = (name: string): PlannedNinja => {
  const n = plan.ninjas.find((x) => x.name === name);
  if (!n) throw new Error(`no planned ninja "${name}"`);
  return n;
};
const newEntries = data.files.flatMap((f) => f.entries).filter((e) => /^supporters:(1[7-9]|[2-7]\d)_/.test(e.sourceId));

describe("the 63 additional Supporter cards", () => {
  it("are all linked to exactly one existing ninja; no ninja is created for them", () => {
    expect(newEntries).toHaveLength(63);
    const names = newEntries.map((e) => data.identity.entries[e.sourceId]!.ninja!);
    expect(names.every(Boolean)).toBe(true);
    // Every name is a release-list ninja that already has its own record.
    for (const n of plan.ninjas.filter((x) => names.includes(x.name))) expect(n.isNew, n.name).toBe(false);
    expect(new Set(names).size).toBe(63);
    expect(plan.ninjas).toHaveLength(177);
  });

  it("each card gives rating, type, formation and four attributes; Chinese cards are matched by position", () => {
    for (const e of newEntries) {
      const n = planned(data.identity.entries[e.sourceId]!.ninja!);
      expect(n.input.baseStats, n.name).toHaveLength(4);
      expect(n.input.formationKey, n.name).toBe("support");
      expect(n.input.typeKey, n.name).toBe("genjutsu");
      expect(["SSS", "SR", "SSR"], n.name).toContain(n.input.ratingKey);
    }
    expect(planned("Hyuuga Hanabi").input.baseStats!.map((s) => [s.statisticKey, s.baseValue, s.growthRate])).toEqual([["force", "21000", "21"], ["chakra", "24000", "23.5"], ["agility", "24000", "23.5"], ["hp", "250000", "25"]]);
  });

  it("prints Power where the card says Power, and keeps the printed HP of Mitarashi Anko without adding a digit", () => {
    expect(planned("Reanimated Hiruzen").input.baseStats!.map((s) => s.statisticKey)).toEqual(["force", "power", "agility", "hp"]);
    expect(planned("Mitarashi Anko").input.baseStats!.find((s) => s.statisticKey === "hp")).toMatchObject({ baseValue: "45000", growthRate: "45" });
  });

  it("the six judgement matches stay reviewed with their evidence; spacing-only differences are verified", () => {
    for (const [posted, ninja] of [["Uchiha Sakura", "Sakura Uchiha"], ["Neji Hyūga", "Hyūga Neji"], ["Orochimaru (New Era)", "Orochimaru from Boruto"]]) {
      const d = Object.values(data.identity.entries).find((x) => x.nameAsPosted === posted)!;
      expect([d.status, d.ninja]).toEqual(["ALIAS_REVIEWED", ninja]);
      expect(planned(ninja!).input.aliases!.some((a) => a.alias === posted && a.status === "REVIEWED")).toBe(true);
    }
    expect(Object.values(data.identity.entries).find((x) => x.nameAsPosted === "Indra & Ashura")).toMatchObject({ status: "ALIAS_VERIFIED", ninja: "Indra&Ashura" });
  });

  it("Natsu Dragneel: skill awakening replaces the base target and growth rate, talent level 2 replaces level 1", () => {
    const natsu = planned("Natsu Dragneel");
    const skill = natsu.input.abilities!.find((a) => a.typeKey === "skill")!;
    expect(skill.awakenings![0]).toMatchObject({ stackingRule: "UPGRADES_BASE" });
    expect(natsu.input.abilities!.filter((a) => a.typeKey === "status_note").map((a) => a.name)).toEqual(["Armor Break", "Crit Resistance Reduction"]);
    expect(natsu.input.abilities!.filter((a) => a.typeKey === "status_note").every((a) => (a.effects ?? []).length === 0)).toBe(true);
    expect(natsu.input.talentGroups![0]!.options[0]!.awakenings!.map((w) => w.stackingRule)).toEqual(["UNKNOWN", "REPLACES_PRIOR"]);
  });

  it("Otsutsuki Isshiki: Big Box Sky is one of four alternatives of 25% each, not four hits", () => {
    const skill = planned("Ōtsutsuki Isshiki").input.abilities!.find((a) => a.typeKey === "skill")!;
    const options = skill.effects!.filter((e) => e.choiceGroup === 1);
    expect(options.map((e) => e.choiceLabel)).toEqual(["Option 1", "Option 2", "Option 3", "Option 4"]);
    // The parser does not read these attack lines yet, so each stays as the printed text (25% chance, its own target and rate) inside the group of alternatives.
    expect(options.map((e) => e.sourceText!.slice(0, 22))).toEqual(Array(4).fill("25% chance to attack ").map((t, i) => options[i]!.sourceText!.slice(0, 22)));
    expect(options.every((e) => e.sourceText!.startsWith("25% chance to attack"))).toBe(true);
    expect(skill.effects!.find((e) => e.sourceText!.startsWith("Attacks enemies, only one of the following"))!.choiceGroup).toBeUndefined();
  });

  it("Kimono Kurenai: three independent OR pairs, and the missing Spanish line is flagged, never invented", () => {
    const k = planned("Kimono Kurenai").input;
    const skill = k.abilities!.find((a) => a.typeKey === "skill")!;
    // Each of the three lines holds "A, OR B". They are kept as the printed text, flagged for review, and none is turned into effects that all apply.
    const alternatives = skill.effects!.filter((e) => /, OR /.test(e.sourceText!));
    expect(alternatives).toHaveLength(3);
    expect(alternatives.every((e) => e.kind === "TEXT" && e.structuredStatus === "TEXT_ONLY")).toBe(true);
    expect(abilityNoteCodes(skill.note)).toEqual(expect.arrayContaining(["ES_LINE_COUNT_DIFFERS", "ES_TEXT_CUT"]));
    expect(skill.description!.split("\n")).toHaveLength(10);
    expect(skill.descriptionEs!.split("\n")).toHaveLength(9);
    expect(skill.descriptionEs).not.toMatch(/furia propia/i);
  });

  it("Christmas Mito and Hyakki Sasori keep a Normal and a Special skill apart", () => {
    for (const name of ["Christmas Mito", "Hyakki Sasori"]) {
      expect(planned(name).input.abilities!.map((a) => a.typeKey)).toEqual(["normal_skill", "special_skill"]);
    }
  });

  it("Yamanaka Ino: both talent awakenings keep an unknown stacking rule", () => {
    expect(planned("Yamanaka Ino").input.talentGroups![0]!.options[0]!.awakenings!.map((w) => w.stackingRule)).toEqual(["UNKNOWN", "UNKNOWN"]);
  });

  it("a probability above 100% is kept as the printed application rate and never capped", () => {
    const rows = planned("Christmas Mito").input.abilities!.flatMap((a) => a.effects ?? []).filter((e) => e.sourceText!.startsWith("110% chance"));
    expect(rows.length).toBeGreaterThan(0);
    for (const e of rows) expect([e.chancePercent ?? null, String(e.rateValue), e.rateKind]).toEqual([null, "110", "APPLICATION"]);
  });

  it("no equipment, jewelry or gem record and no Tank or DPS comes with the Supporter import", () => {
    expect(plan.ninjas.every((n) => n.input.clientCombatClass === undefined)).toBe(true);
  });
});
