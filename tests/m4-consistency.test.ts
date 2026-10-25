import { describe, expect, it } from "vitest";
import { normalizeTerm } from "../src/domain/localize";
import { planProfiles, readProfileData } from "../src/game/profile-loader";
import { readReferenceFile, type ReleaseFile } from "../src/game/reference-loader";
import { REFERENCE_DIR } from "./helpers";

/** Milestone 4: the populated data is consistent with the agreed database structure. Pure checks on the plan the loader writes. */
const data = readProfileData(REFERENCE_DIR)!;
const plan = planProfiles(data);
const releaseNames = readReferenceFile<ReleaseFile>(REFERENCE_DIR, "release-order.json").entries.map(([, , name]) => name);

describe("populated data", () => {
  it("every ninja of the release list has exactly one record, and no name or alias points at two ninjas", () => {
    const names = plan.ninjas.map((n) => n.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of releaseNames) expect(names, name).toContain(name);
    const owner = new Map<string, string>();
    for (const n of plan.ninjas) owner.set(normalizeTerm(n.name), n.name);
    const clashes: string[] = [];
    for (const n of plan.ninjas) {
      for (const a of n.input.aliases ?? []) {
        const key = normalizeTerm(a.alias);
        const other = owner.get(key);
        if (other && other !== n.name) clashes.push(`${a.alias} (alias of ${n.name}) is the name of ${other}`);
        owner.set(key, n.name);
      }
    }
    // One known case: the card of «Uchiha Obito (golden)» prints the name plate «Uchiha Obito», the same as the Vanguard ninja. The plate is kept as printed; a search finds both ninjas.
    expect(clashes).toEqual(["Uchiha Obito (alias of Uchiha Obito (golden)) is the name of Uchiha Obito"]);
  });

  it("a card gives every ninja four attributes, all numeric, and a rating from the 15 stored ranks", () => {
    const ranks = ["D", "C", "B-", "B", "B+", "A-", "A", "A+", "S-", "S", "S+", "SS", "SSS", "SR", "SSR"];
    for (const n of plan.ninjas.filter((x) => x.input.baseStats)) {
      expect(n.input.baseStats, n.name).toHaveLength(4);
      expect(ranks, n.name).toContain(n.input.ratingKey);
      for (const s of n.input.baseStats!) {
        expect(Number(s.baseValue), `${n.name} ${s.sourceLabel}`).toBeGreaterThan(0);
        expect(Number(s.growthRate), `${n.name} ${s.sourceLabel}`).toBeGreaterThan(0);
      }
    }
  });

  it("every effect row keeps the line it came from, and no talent or skill with English text lacks it", () => {
    for (const n of plan.ninjas) {
      const blocks = [...(n.input.abilities ?? []), ...(n.input.talentGroups ?? []).flatMap((g) => g.options)];
      for (const b of blocks) {
        for (const e of b.effects ?? []) expect(e.sourceText, `${n.name} · ${b.name}`).toBeTruthy();
        for (const w of b.awakenings ?? []) for (const e of w.effects ?? []) expect(e.sourceText, `${n.name} · ${w.name}`).toBeTruthy();
      }
    }
  });

  it("awakening stages of one talent or skill are never numbered twice, and a replacing stage names a stage that exists", () => {
    for (const n of plan.ninjas) {
      const lists = [...(n.input.abilities ?? []).map((a) => a.awakenings ?? []), ...(n.input.talentGroups ?? []).flatMap((g) => g.options.map((o) => o.awakenings ?? []))];
      for (const list of lists) {
        const stages = list.map((w) => w.stage).filter((s): s is number => s != null);
        expect(new Set(stages).size, n.name).toBe(stages.length);
        for (const w of list) if (w.supersedesStage != null) expect(stages, `${n.name} stage ${w.stage}`).toContain(w.supersedesStage);
      }
    }
  });

  it("English stays the original where the two languages differ: Spanish never replaces a stored English text", () => {
    for (const n of plan.ninjas) {
      const blocks = [...(n.input.abilities ?? []), ...(n.input.talentGroups ?? []).flatMap((g) => g.options)];
      for (const b of blocks) if (b.descriptionEs) expect(b.description, `${n.name} · ${b.name}`).toBeTruthy();
    }
  });
});
