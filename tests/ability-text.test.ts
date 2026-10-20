import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createAbilityParser, effectNoteCodes, numbersIn, VALUE_NOTE_DECREASE, VALUE_NOTE_INCREASE, type Lexicon } from "../src/domain/ability-text";
import { canCombineStages, resolveAwakenings } from "../src/domain/awakenings";
import { effectConditionState, makeEffectView, splitChoices } from "../src/domain/effects";
import { ruleFormation } from "../src/domain/ninja";
import { REFERENCE_DIR } from "./helpers";

const lexicon = JSON.parse(readFileSync(path.join(REFERENCE_DIR, "lexicon.json"), "utf8")) as Lexicon;
const { parseLine } = createAbilityParser(lexicon);
const rows = (line: string) => parseLine(line).effects;

describe("strength, chance, rate and duration never share a field", () => {
  it("«(20%) shatter storm» is the strength of that usage, not a chance", () => {
    const [row] = rows("Makes ally assaulters enter (20%) shatter storm state for 2 rounds.");
    expect(row).toMatchObject({ kind: "STATUS", statusKey: "shatter-storm", magnitudeOverride: "20", durationTurns: 2, targetKey: "ally", structuredStatus: "STRUCTURED" });
    expect(row!.chancePercent).toBeUndefined();
    expect(row!.rateValue).toBeUndefined();
    expect(row!.conditions).toEqual([{ scope: "TARGET", typeKey: "formation", formationKey: "assaulter", operator: "REQUIRES", alternativeGroup: 0 }]);
  });

  it("Sai: 60% chance, (10%) strength, 2 rounds, one random ally, after being attacked", () => {
    const [dispel, storm] = rows("After being attacked, 30% chance to dispel all allies' debuffs, and 60% chance to make 1 random ally enter (10%) shatter storm for 2 rounds.");
    expect(dispel).toMatchObject({ kind: "DISPEL", description: "debuffs", chancePercent: "30", targetKey: "ally", triggerText: "After being attacked" });
    expect(storm).toMatchObject({
      kind: "STATUS", statusKey: "shatter-storm", magnitudeOverride: "10", chancePercent: "60", durationTurns: 2,
      targetKey: "ally", targetCount: 1, targetSelector: "RANDOM", triggerText: "After being attacked",
    });
  });

  it("a «rate» is stored as a rate with its kind, never as a chance", () => {
    expect(rows("Attacks enemies with 100% growth rate.")[0]).toMatchObject({ kind: "ATTACK", rateValue: "100", rateKind: "GROWTH" });
    expect(rows("Heals self with 70% rate.")[0]).toMatchObject({ kind: "HEAL", rateValue: "70", rateKind: "INTENSITY" });
    expect(rows("55% rate to chaos enemies for 2 rounds.")[0]).toMatchObject({ kind: "STATUS", statusKey: "chaos", rateValue: "55", rateKind: "APPLICATION", durationTurns: 2 });
    for (const line of ["Attacks enemies with 100% growth rate.", "Heals self with 70% rate.", "55% rate to chaos enemies for 2 rounds."]) {
      expect(rows(line).every((r) => r.chancePercent === undefined), line).toBe(true);
    }
  });

  it("wording no pattern covers in full is kept as text, with no number pulled out of it", () => {
    const [row, ...rest] = rows("Increases self defenses with 120% rate for 2 rounds.");
    expect(rest).toEqual([]);
    expect(row).toEqual({ kind: "TEXT", description: "Increases self defenses with 120% rate for 2 rounds", conditions: [], structuredStatus: "TEXT_ONLY" });
    expect(parseLine("Increases self defenses with 120% rate for 2 rounds.").fullyStructured).toBe(false);
  });

  it("a stat named without a number gets no number, only its direction", () => {
    const up = rows("Increases self force and hp, 80% speed, 60% damage rate, and 55% avoid injury.");
    expect(up.map((r) => [r.statisticKey, r.value, r.valueNote])).toEqual([
      ["force", null, VALUE_NOTE_INCREASE], ["hp", null, VALUE_NOTE_INCREASE], ["speed", "80", undefined], ["damage-rate", "60", undefined], ["avoid-injury", "55", undefined],
    ]);
    expect(rows("Decreases enemies' attack and defenses for 2 rounds.").map((r) => [r.statisticKey, r.value, r.valueNote, r.durationTurns])).toEqual([
      ["attack", null, VALUE_NOTE_DECREASE, 2], ["defenses", null, VALUE_NOTE_DECREASE, 2],
    ]);
    // "A and B by 30%": the number is written once for both.
    expect(rows("Decreases enemies' punch rate and aid rate by 30% for 2 rounds.").map((r) => [r.statisticKey, r.value, r.valueNote])).toEqual([
      ["punch-rate", "-30", undefined], ["aid-rate", "-30", undefined],
    ]);
  });

  it("an awakening that restates a base number keeps both numbers", () => {
    expect(rows("Increases self speed from 83% → 86%.")).toEqual([
      { kind: "STAT", statisticKey: "speed", value: "86", valueType: "PERCENT", replacesValue: "83", targetKey: "self", targetText: "self", conditions: [], structuredStatus: "STRUCTURED" },
    ]);
  });
});

describe("conditions", () => {
  const state = (line: string) => rows(line).map((r) => effectConditionState(makeEffectView({ id: "row", conditions: r.conditions.map((c, i) => ({ id: String(i), scope: c.scope, typeKey: c.typeKey, typeName: c.typeKey, valueKey: c.valueKey ?? c.formationKey ?? null, valueName: null, operator: c.operator, numericValue: null, note: null, alternativeGroup: c.alternativeGroup })), conditionText: r.conditionText ?? null, structuredStatus: r.structuredStatus, triggerText: r.triggerText ?? null })));

  it("«thunder, water, and wind chakra allies» is three alternatives, never three requirements at once", () => {
    const [row] = rows("Increases thunder, water, and wind chakra allies' control rate by 25%.");
    expect(row!.conditions.map((c) => [c.scope, c.typeKey, c.valueKey, c.alternativeGroup])).toEqual([
      ["ACTIVATION", "nature", "thunder", 0], ["ACTIVATION", "nature", "water", 1], ["ACTIVATION", "nature", "wind", 2],
    ]);
  });

  it("a nature, trait or battle-mode requirement is never shown as always active", () => {
    for (const line of [
      "Increases thunder, water, and wind chakra allies' control rate by 25%.",
      "Increases jinchuriki allies' attack by 20%.",
      "Born with 50% s.block (not effective in PvE).",
      "Increases female allies' attack by 20%.",
      "Earth chakra enemies enter seal and upwind state for 2 rounds, and dispels their buffs.",
    ]) {
      expect(state(line).every((s) => s !== "UNCONDITIONAL"), line).toBe(true);
    }
    expect(state("Increases self defenses by 5% for 3 rounds.")).toEqual(["UNCONDITIONAL"]);
    expect(state("After being attacked, 75% chance to restore 30 self fury.")).toEqual(["TRIGGERED"]);
  });

  it("requirement wording it cannot structure is kept as text and still marks the row conditional", () => {
    const [row] = rows("Increases female allies' attack by 20%.");
    expect(row).toMatchObject({ kind: "TEXT", structuredStatus: "TEXT_ONLY", conditionText: "female allies" });
  });

  it("PvE and PvP numbers stay two separate rows", () => {
    const both = rows("Increases self s.crit by 20% (25% chance to trigger in PvE, 100% in PvP).");
    expect(both.map((r) => [r.value, r.chancePercent, r.conditions[0]?.valueKey, r.conditions[0]?.operator])).toEqual([["20", "25", "pve", "REQUIRES"], ["20", "100", "pvp", "REQUIRES"]]);
    expect(rows("Born with 50% s.block (not effective in PvE).")[0]!.conditions).toEqual([{ scope: "ACTIVATION", typeKey: "battle_mode", valueKey: "pve", operator: "EXCLUDES", alternativeGroup: 0 }]);
  });

  it("a formation word narrows the target; it is not a requirement on the user", () => {
    const [aid, attack] = rows("Increases ally assaulters' aid rate by 40% and attack by 5% for 3 rounds.");
    expect([aid!.value, attack!.value, aid!.durationTurns, attack!.durationTurns]).toEqual(["40", "5", 3, 3]);
    expect(aid!.conditions).toEqual([{ scope: "TARGET", typeKey: "formation", formationKey: "assaulter", operator: "REQUIRES", alternativeGroup: 0 }]);
  });

  it("flags what the source leaves open instead of deciding it", () => {
    const andOr = rows("70% rate to shock and/or accupoint enemies for 2 rounds.");
    expect(andOr.map((r) => [r.statusKey, r.structuredStatus, effectNoteCodes(r.note)])).toEqual([["shock", "NEEDS_REVIEW", ["AND_OR"]], ["acupoint", "NEEDS_REVIEW", ["AND_OR"]]]);
    const noSide = rows("Increases assaulters' aid rate by 65% for 2 rounds.")[0]!;
    expect([noSide.targetKey, effectNoteCodes(noSide.note)]).toEqual([undefined, ["SIDE_UNKNOWN"]]);
    const bracket = rows("Increases self force and hp (40%), 30% speed, 30% damage rate, and 30% avoid injury.");
    expect(bracket.map((r) => [r.statisticKey, r.value, r.structuredStatus])).toEqual([
      ["force", null, "STRUCTURED"], ["hp", "40", "NEEDS_REVIEW"], ["speed", "30", "STRUCTURED"], ["damage-rate", "30", "STRUCTURED"], ["avoid-injury", "30", "STRUCTURED"],
    ]);
  });
});

describe("alternatives", () => {
  const lines = [
    "1) Deva Path — Decreases all allies' (except self) reflect damage taken by 70% rate, OR Animal Path — Ally supporters have a 70% chance to enter super dodge.",
    "2) Preta Path — Increases ally vanguard and assaulters' attack by 40% for 2 rounds, OR Ashura Path — Increases self defenses by 500% for 1 round.",
    "3) Naraka Path — Dispels allies' (except self) debuffs, OR Human Path — Decreases enemies' healing by 60% rate.",
  ];

  it("«A, OR B» becomes one choice group with two labelled options, never a sum", () => {
    for (const [i, line] of lines.entries()) {
      const parsed = rows(line);
      expect(new Set(parsed.map((r) => r.choiceGroup)), line).toEqual(new Set([i + 1]));
      const { fixed, choices } = splitChoices(parsed.map((r) => ({ choiceGroup: r.choiceGroup ?? null, choiceLabel: r.choiceLabel ?? null })));
      expect(fixed).toEqual([]);
      expect(choices).toHaveLength(1);
      expect(choices[0]!.options).toHaveLength(2);
    }
    expect(rows(lines[1]!).map((r) => [r.choiceLabel, r.statisticKey, r.value, r.durationTurns])).toEqual([["Preta Path", "attack", "40", 2], ["Ashura Path", "defenses", "500", 1]]);
    // The two formations of one option are alternatives of the target, inside that option.
    expect(rows(lines[1]!)[0]!.conditions.map((c) => [c.formationKey, c.alternativeGroup])).toEqual([["vanguard", 0], ["assaulter", 1]]);
  });

  it("an option it cannot structure stays as that option's text", () => {
    const parsed = rows(lines[0]!);
    expect(parsed.map((r) => r.choiceLabel)).toEqual(expect.arrayContaining(["Deva Path", "Animal Path"]));
    expect(parsed.filter((r) => r.kind === "TEXT").every((r) => r.structuredStatus === "TEXT_ONLY" && r.choiceGroup === 1)).toBe(true);
  });
});

describe("awakening stages", () => {
  const stage = (id: string, n: number | null, rule: Parameters<typeof resolveAwakenings>[0][number]["rule"], supersedesId: string | null = null) => ({ id, stage: n, rule, supersedesId });

  it("a level that replaces an earlier one switches it off: the two are never both active", () => {
    const stages = [stage("l1", 1, "UNKNOWN"), stage("l2", 2, "REPLACES_PRIOR", "l1")];
    expect(resolveAwakenings(stages, 1)).toEqual({ active: [], superseded: [], unknown: ["l1"], upgrades: [] });
    const at2 = resolveAwakenings(stages, 2);
    expect(at2.superseded).toEqual([{ id: "l1", byId: "l2", how: "REPLACED" }]);
    expect(at2.active).toEqual(["l2"]);
    expect([...at2.active, ...at2.unknown]).not.toContain("l1");
  });

  it("a level that cancels an earlier one does the same (as the handoff notes state for First Hokage)", () => {
    const stages = [stage("t1", 1, "UNKNOWN"), stage("t2", 2, "UNKNOWN"), stage("t3", 3, "CANCELS_PRIOR", "t2")];
    const at3 = resolveAwakenings(stages, 3);
    expect(at3.superseded).toEqual([{ id: "t2", byId: "t3", how: "CANCELLED" }]);
    expect(at3.active).toEqual(["t3"]);
    expect(at3.unknown).toEqual(["t1"]);
  });

  it("stages whose relation the source does not state are never combined", () => {
    const stages = [stage("a", 1, "UNKNOWN"), stage("b", 2, "UNKNOWN")];
    expect(resolveAwakenings(stages, 2)).toEqual({ active: [], superseded: [], unknown: ["a", "b"], upgrades: [] });
    expect(canCombineStages(stages)).toBe(false);
    expect(canCombineStages([stage("a", 1, "CUMULATIVE"), stage("b", 2, "CUMULATIVE")])).toBe(true);
  });

  it("an upgrade stage is reported as restating base numbers", () => {
    expect(resolveAwakenings([stage("u", 3, "UPGRADES_BASE")], 3)).toMatchObject({ active: ["u"], upgrades: ["u"] });
  });
});

describe("card label «Assaulter»", () => {
  const center = { key: "center", primary: "force", equivalenceStatus: "NONE", equivalentTo: null };
  it("takes the rule of Center only once the equivalence is approved", () => {
    expect(ruleFormation<{ key: string; primary: string | null }>({ key: "assaulter", primary: null, equivalenceStatus: "PROPOSED", equivalentTo: center }).key).toBe("assaulter");
    expect(ruleFormation<{ key: string; primary: string | null }>({ key: "assaulter", primary: null, equivalenceStatus: "APPROVED", equivalentTo: center }).primary).toBe("force");
  });
});

describe("comparing two versions of a line", () => {
  it("reads every number in order", () => {
    expect(numbersIn("Increases all allies' speed by 100% and hp by 30% for 2 rounds.")).toEqual(["100", "30", "2"]);
    expect(numbersIn("Aumenta la velocidad en un 22,5% durante 2 rondas.")).toEqual(["22.5", "2"]);
  });
});
