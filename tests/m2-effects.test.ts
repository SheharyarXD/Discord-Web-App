import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  effectConditionState,
  evaluateActivation,
  isConditional,
  makeEffectView,
  resolveEffectUsage,
  type ConditionView,
  type StatusDefinitionView,
} from "../src/domain/effects";
import { UnknownReferenceError, ValidationError } from "../src/game/db";
import { getNinjaDetail, upsertNinja, vocabulary } from "../src/game/ninjas";
import { findStatusEffectsByTerm, getStatusEffect, listStatusEffects, upsertStatusEffect } from "../src/game/status-effects";
import { failure, dbRejects, TRIGGER_REJECTION, HANDOFF_DIR, seedTestVocabulary, testDb } from "./helpers";

const db = testDb();
const regression = JSON.parse(readFileSync(path.join(HANDOFF_DIR, "04_TEMPLATES/shatter_storm_regression_cases.json"), "utf8")) as {
  definition: { default_magnitude_percent: number };
  cases: { case: string; usage_override_percent: number | null; expected_effective_stat_bonus_percent: number; expected_application_chance_percent: number | null; duration_rounds?: number; example_raw_text?: string }[];
};

const STORM = "t-shatter-storm";
const detail = async (slug: string) => (await getNinjaDetail(db, slug, { includeUnpublished: true }))!;
const firstEffect = async (slug: string) => (await detail(slug)).abilities[0]!.effects[0]!;

beforeAll(async () => {
  await seedTestVocabulary(db);
  // Same definition as the guide's "Shatter Storm/Breaking Wind", under a test key.
  await upsertStatusEffect(db, {
    key: STORM,
    name: "T Shatter Storm/Breaking Wind",
    aliases: ["T Shatter Storm", "T Breaking Wind"],
    description: "Increases attack and defenses by 15% (unless other is stated)",
    polarity: "BUFF",
    cleansability: "UNCLEANSABLE",
    overrideDocumented: true,
    categoryKeys: ["stat_modifier"],
    modifiers: [
      { statLabel: "attack", statisticKey: "attack", direction: "INCREASE", magnitude: regression.definition.default_magnitude_percent },
      { statLabel: "defenses", statisticKey: "defenses", direction: "INCREASE", magnitude: regression.definition.default_magnitude_percent },
    ],
  });
});
afterAll(() => db.$disconnect());

describe("10. Shatter Storm: default vs per-usage override (core regression)", () => {
  const usageCase = (name: string) => regression.cases.find((c) => c.case === name)!;

  beforeAll(async () => {
    const individual = usageCase("individual_override");
    await upsertNinja(db, {
      name: "T10 overrides to 20",
      abilities: [
        {
          typeKey: "skill",
          name: "Storm call",
          effects: [
            {
              statusKey: STORM,
              magnitudeOverride: individual.usage_override_percent,
              durationTurns: individual.duration_rounds,
              targetKey: "ally",
              targetText: "ally assaulters",
              sourceText: "Makes ally assaulters enter (20%) shatter storm state for 2 rounds.",
              conditions: [{ scope: "TARGET", typeKey: "role", roleKey: "assaulters" }],
            },
          ],
        },
      ],
    });
    await upsertNinja(db, { name: "T10 uses default", abilities: [{ typeKey: "skill", name: "Plain storm", effects: [{ statusKey: STORM, durationTurns: 3 }] }] });
  });

  it("the dictionary default is 15% on attack and on defenses", async () => {
    const definition = (await getStatusEffect(db, STORM))!;
    expect(definition.modifiers.map((m) => [m.statLabel, m.direction, m.magnitude, m.valueType])).toEqual([
      ["attack", "INCREASE", 15, "PERCENT"],
      ["defenses", "INCREASE", 15, "PERCENT"],
    ]);
    expect(definition.aliases).toEqual(["T Breaking Wind", "T Shatter Storm"]);
    expect(definition.overrideDocumented).toBe(true);
  });

  it("(20%) replaces the strength of BOTH modifiers for that one usage — it is not a chance", async () => {
    const expected = usageCase("individual_override");
    const effect = await firstEffect("t10-overrides-to-20");
    expect(effect.status!.magnitudeOverride).toBe(20);
    expect(effect.status!.resolved.modifiers.map((m) => [m.statLabel, m.effectiveMagnitude, m.origin])).toEqual([
      ["attack", expected.expected_effective_stat_bonus_percent, "OVERRIDE"],
      ["defenses", expected.expected_effective_stat_bonus_percent, "OVERRIDE"],
    ]);
    expect(effect.status!.resolved.magnitudeOrigin).toBe("OVERRIDE");
    // The four dimensions stay apart.
    expect(effect.chancePercent).toBeNull();
    expect(effect.status!.resolved.chancePercent).toBe(expected.expected_application_chance_percent);
    expect(effect.durationTurns).toBe(2);
    expect(effect.status!.resolved.durationRounds).toBe(2);
    expect(effect.targetName).toBe("Aliado");
    expect(effect.targetText).toBe("ally assaulters");
    expect(effect.targetFilters.map((f) => [f.typeKey, f.valueKey])).toEqual([["role", "assaulters"]]);
    // A target filter narrows who receives it; it does not make the effect conditional.
    expect(effect.conditions).toEqual([]);
    expect(isConditional(effect)).toBe(false);

    const row = await db.effect.findFirstOrThrow({ where: { ability: { ninja: { slug: "t10-overrides-to-20" } } } });
    expect(row.magnitudeOverride?.toString()).toBe("20");
    expect(row.chancePercent).toBeNull();
    expect(row.value).toBeNull();
  });

  it("another ninja's usage is unaffected and stays at 15%; the definition is untouched", async () => {
    const expected = usageCase("different_ninja_unaffected");
    const effect = await firstEffect("t10-uses-default");
    expect(effect.status!.magnitudeOverride).toBeNull();
    expect(effect.status!.resolved.modifiers.map((m) => [m.effectiveMagnitude, m.origin])).toEqual([
      [expected.expected_effective_stat_bonus_percent, "DEFAULT"],
      [expected.expected_effective_stat_bonus_percent, "DEFAULT"],
    ]);
    expect(effect.chancePercent).toBe(expected.expected_application_chance_percent);
    expect(effect.durationTurns).toBe(3);
    const stored = await db.statusEffectModifier.findMany({ where: { statusEffect: { key: STORM } } });
    expect(stored.map((m) => m.magnitude?.toString())).toEqual(["15", "15"]);
  });

  it("changing one usage's override changes only that usage", async () => {
    await upsertNinja(db, {
      name: "T10 overrides to 20",
      abilities: [{ typeKey: "skill", name: "Storm call", effects: [{ statusKey: STORM, magnitudeOverride: 25, durationTurns: 2 }] }],
    });
    expect((await firstEffect("t10-overrides-to-20")).status!.resolved.modifiers.map((m) => m.effectiveMagnitude)).toEqual([25, 25]);
    expect((await firstEffect("t10-uses-default")).status!.resolved.modifiers.map((m) => m.effectiveMagnitude)).toEqual([15, 15]);
    expect((await getStatusEffect(db, STORM))!.modifiers.map((m) => m.magnitude)).toEqual([15, 15]);
  });

  it("the resolver is pure: every regression case resolves and nothing is mutated", async () => {
    const definition = Object.freeze((await getStatusEffect(db, STORM))!) as StatusDefinitionView;
    Object.freeze(definition.modifiers);
    definition.modifiers.forEach(Object.freeze);
    for (const c of regression.cases) {
      const resolved = resolveEffectUsage(definition, { magnitudeOverride: c.usage_override_percent, durationTurns: c.duration_rounds });
      expect(resolved.modifiers.map((m) => m.effectiveMagnitude), c.case).toEqual([c.expected_effective_stat_bonus_percent, c.expected_effective_stat_bonus_percent]);
      expect(resolved.chancePercent, c.case).toBe(c.expected_application_chance_percent);
      expect(resolved.magnitudeOrigin, c.case).toBe(c.usage_override_percent === null ? "DEFAULT" : "OVERRIDE");
    }
    expect(definition.modifiers.map((m) => m.magnitude)).toEqual([15, 15]);
  });

  it("an explicit chance lives in its own field and never touches the strength", async () => {
    await upsertNinja(db, {
      name: "T10 chance",
      abilities: [{ typeKey: "skill", name: "Maybe storm", effects: [{ statusKey: STORM, chancePercent: 30, durationTurns: 1 }] }],
    });
    const effect = await firstEffect("t10-chance");
    expect(effect.chancePercent).toBe(30);
    expect(effect.status!.resolved.modifiers.map((m) => [m.effectiveMagnitude, m.origin])).toEqual([[15, "DEFAULT"], [15, "DEFAULT"]]);
  });

  it("components that are not overridable keep their default; a missing number stays missing", () => {
    const resolved = resolveEffectUsage(
      {
        modifiers: [
          { statLabel: "a", statisticKey: null, statisticName: null, direction: "INCREASE", magnitude: 15, valueType: "PERCENT", overridable: true, note: null },
          { statLabel: "b", statisticKey: null, statisticName: null, direction: "DECREASE", magnitude: 5, valueType: "PERCENT", overridable: false, note: null },
          { statLabel: "c", statisticKey: null, statisticName: null, direction: "INCREASE", magnitude: null, valueType: "PERCENT", overridable: false, note: null },
        ],
      },
      { magnitudeOverride: 20 },
    );
    expect(resolved.modifiers.map((m) => [m.effectiveMagnitude, m.origin])).toEqual([[20, "OVERRIDE"], [5, "DEFAULT"], [null, "UNSPECIFIED"]]);
    expect(resolved.magnitudeOrigin).toBe("MIXED");
    expect(resolved.chancePercent).toBeNull();
  });

  it("rejects an override without a status, a chance outside 0–100, and an effect with two owners", async () => {
    const bad = (effect: object) => upsertNinja(db, { name: "T10 invalid", abilities: [{ typeKey: "skill", name: "x", effects: [effect as never] }] });
    await expect(bad({ statisticKey: "attack", value: 5, magnitudeOverride: 20 })).rejects.toBeInstanceOf(ValidationError);
    await expect(bad({ statusKey: STORM, chancePercent: 120 })).rejects.toBeInstanceOf(ValidationError);
    await expect(bad({ statusKey: "no-such-status" })).rejects.toBeInstanceOf(UnknownReferenceError);
    expect(await db.ninja.count({ where: { slug: "t10-invalid" } })).toBe(0);

    const ability = await db.ability.findFirstOrThrow({ where: { ninja: { slug: "t10-uses-default" } } });
    const gem = await db.gem.create({ data: { slug: "t10-gem", name: "t10 gem" } });
    expect(await dbRejects(() => db.effect.create({ data: { abilityId: ability.id, gemId: gem.id, description: "x" } }))).toBe(TRIGGER_REJECTION);
    expect(await dbRejects(() => db.effect.create({ data: { description: "orphan" } }))).toBe(TRIGGER_REJECTION);
    expect(await dbRejects(() => db.effect.create({ data: { gemId: gem.id, magnitudeOverride: 20 } }))).toBe(TRIGGER_REJECTION);
    expect(await dbRejects(() => db.effect.create({ data: { gemId: gem.id, description: "x", chancePercent: 101 } }))).toBe(TRIGGER_REJECTION);
  });
});

describe("9. conditional nature", () => {
  beforeAll(async () => {
    await vocabulary.nature(db, { key: "t9-fire", name: "T9 Fire" });
    await vocabulary.nature(db, { key: "t9-wind", name: "T9 Wind" });
    await upsertNinja(db, {
      name: "T9 conditional",
      abilities: [
        {
          typeKey: "passive",
          name: "Needs nature",
          effects: [
            { statisticKey: "attack", value: 30, valueType: "PERCENT", conditions: [{ typeKey: "nature", valueKey: "t9-fire" }] },
            { statisticKey: "attack", value: 10, valueType: "PERCENT" },
            { statisticKey: "speed", value: 5, valueType: "PERCENT", conditionText: "Only while the moon is out", structuredStatus: "NEEDS_REVIEW" },
            { statisticKey: "speed", value: 7, valueType: "PERCENT", structuredStatus: "NEEDS_REVIEW" },
            {
              statisticKey: "attack", value: 12, valueType: "PERCENT",
              conditions: [
                { typeKey: "nature", valueKey: "t9-fire", alternativeGroup: 0 },
                { typeKey: "nature", valueKey: "t9-wind", alternativeGroup: 1 },
                { typeKey: "gender", operator: "EXCLUDES", note: "placeholder", alternativeGroup: 1 },
              ],
            },
          ],
        },
      ],
    });
  });

  it("a nature requirement is stored as a structured condition and reads back as conditional", async () => {
    const [required, plain] = (await detail("t9-conditional")).abilities[0]!.effects;
    expect(required!.conditions.map((c) => [c.scope, c.typeKey, c.valueKey, c.valueName, c.operator])).toEqual([["ACTIVATION", "nature", "t9-fire", "T9 Fire", "REQUIRES"]]);
    expect(effectConditionState(required!)).toBe("CONDITIONAL");
    expect(isConditional(required!)).toBe(true);
    expect(effectConditionState(plain!)).toBe("UNCONDITIONAL");
    const stored = await db.condition.count({ where: { effect: { ability: { ninja: { slug: "t9-conditional" } } }, conditionValue: { key: "t9-fire" } } });
    expect(stored).toBe(2);
  });

  it("missing information never makes a conditional effect count as active", async () => {
    const [required, plain] = (await detail("t9-conditional")).abilities[0]!.effects;
    expect(evaluateActivation(required!)).toBe("UNKNOWN"); // nothing known about the subject
    expect(evaluateActivation(required!, { role: ["supporters"] })).toBe("UNKNOWN"); // nature still unknown
    expect(evaluateActivation(required!, { nature: [] })).toBe("NOT_MET");
    expect(evaluateActivation(required!, { nature: ["t9-wind"] })).toBe("NOT_MET");
    expect(evaluateActivation(required!, { nature: ["t9-fire"] })).toBe("MET");
    expect(evaluateActivation(plain!)).toBe("MET");
  });

  it("text-only or unreviewed requirements are conditional too, and can never evaluate to MET", async () => {
    const [, , textOnly, unreviewed] = (await detail("t9-conditional")).abilities[0]!.effects;
    expect(effectConditionState(textOnly!)).toBe("CONDITIONAL_UNRESOLVED");
    expect(textOnly!.conditionText).toBe("Only while the moon is out");
    expect(effectConditionState(unreviewed!)).toBe("NEEDS_REVIEW");
    for (const effect of [textOnly!, unreviewed!]) {
      expect(isConditional(effect)).toBe(true);
      expect(evaluateActivation(effect, { nature: ["t9-fire"] })).toBe("UNKNOWN");
    }
  });

  it("supports AND / OR / NOT combinations", async () => {
    const combined = (await detail("t9-conditional")).abilities[0]!.effects[4]!;
    expect(evaluateActivation(combined, { nature: ["t9-fire"] })).toBe("MET"); // first alternative
    expect(evaluateActivation(combined, { nature: ["t9-wind"] })).toBe("UNKNOWN"); // second needs the gender fact
    expect(evaluateActivation(combined, { nature: [] })).toBe("NOT_MET");
    const c = (valueKey: string, operator: ConditionView["operator"], alternativeGroup = 0): ConditionView => ({
      id: valueKey + operator, scope: "ACTIVATION", typeKey: "nature", typeName: "Nature", valueKey, valueName: valueKey, operator, numericValue: null, note: null, alternativeGroup,
    });
    const notWind = makeEffectView({ id: "x", conditions: [c("fire", "REQUIRES"), c("wind", "EXCLUDES")] });
    expect(evaluateActivation(notWind, { nature: ["fire"] })).toBe("MET");
    expect(evaluateActivation(notWind, { nature: ["fire", "wind"] })).toBe("NOT_MET");
  });

  it("a condition can point at a specific ninja or a formation", async () => {
    await upsertNinja(db, { name: "T9 subject" });
    await upsertNinja(db, {
      name: "T9 targeted",
      abilities: [
        {
          typeKey: "passive",
          name: "Pair bonus",
          effects: [
            { statisticKey: "attack", value: 8, valueType: "PERCENT", conditions: [{ typeKey: "ninja", ninjaSlug: "t9-subject" }, { scope: "TARGET", typeKey: "formation", formationKey: "support" }] },
          ],
        },
      ],
    });
    const effect = (await detail("t9-targeted")).abilities[0]!.effects[0]!;
    expect(effect.conditions.map((x) => [x.typeKey, x.valueKey])).toEqual([["ninja", "t9-subject"]]);
    expect(effect.targetFilters.map((x) => [x.typeKey, x.valueKey, x.valueName])).toEqual([["formation", "support", "Apoyo"]]);
    // The referenced ninja cannot be deleted from under the condition.
    expect(await failure(() => db.ninja.delete({ where: { slug: "t9-subject" } }))).not.toBe("");
  });
});

describe("11. glossary classification", () => {
  beforeAll(async () => {
    await upsertStatusEffect(db, { key: "t11-poison", name: "T11 Poison", cleansability: "CLEANSABLE", categoryKeys: ["dot"], structuredStatus: "TEXT_ONLY" });
    await upsertStatusEffect(db, { key: "t11-burn", name: "T11 Incinerate (or Burn)", aliases: ["T11 Incinerate", "T11 Burn"], cleansability: "UNCLEANSABLE", categoryKeys: ["dot"] });
    await upsertStatusEffect(db, {
      key: "t11-curse", name: "T11 Curse Fixation", description: "Uncleansable CC and 20% block rate reduction",
      polarity: "DEBUFF", cleansability: "UNCLEANSABLE", categoryKeys: ["cc", "stat_modifier"],
      modifiers: [{ statLabel: "block rate", direction: "DECREASE", magnitude: 20 }],
    });
    await upsertStatusEffect(db, { key: "t11-dodge", name: "T11 Super dodge", polarity: "BUFF", cleansability: "CLEANSABLE", categoryKeys: ["protection"] });
    await upsertStatusEffect(db, {
      key: "t11-s-dodge", name: "T11 S-Super Dodge", polarity: "BUFF", cleansability: "UNCLEANSABLE", categoryKeys: ["protection"],
      cleansabilityNote: "If the enemy is immune to S-Super Dodge, this buff can be cleansed (e.g. Hiruko)",
    });
    await upsertStatusEffect(db, { key: "t11-ameno", name: "T11 Amenotejikara/Shielding state", aliases: ["T11 Amenotejikara", "T11 Shielding state"], polarity: "BUFF", cleansability: "UNCLEANSABLE", description: "Ignores enemy damage (only direct damage from skill)" });
    await upsertStatusEffect(db, { key: "t11-shielding-state", name: "T11 Shielding state", polarity: "BUFF", cleansability: "UNCLEANSABLE", description: "Ignores enemy damage" });
    await upsertStatusEffect(db, { key: "t11-term", kind: "TERM", name: "T11 DoT (damage over time)", polarity: "NEUTRAL", categoryKeys: ["dot"] });
  });

  const keys = async (filter: Parameters<typeof listStatusEffects>[1]) =>
    (await listStatusEffects(db, filter)).map((s) => s.key).filter((k) => k.startsWith("t11-")).sort();

  it("buff/debuff, cleansability, DoT and CC are independent facets", async () => {
    expect(await keys({ categoryKeys: ["dot"], cleansability: "CLEANSABLE" })).toEqual(["t11-poison"]);
    expect(await keys({ categoryKeys: ["dot"], cleansability: "UNCLEANSABLE" })).toEqual(["t11-burn"]);
    expect(await keys({ polarity: "BUFF", cleansability: "CLEANSABLE" })).toEqual(["t11-dodge"]);
    expect(await keys({ polarity: "BUFF", cleansability: "UNCLEANSABLE" })).toEqual(["t11-ameno", "t11-s-dodge", "t11-shielding-state"]);
    expect(await keys({ kind: "TERM" })).toEqual(["t11-term"]);
    // A DoT listed apart from "debuffs" keeps an unstated polarity instead of a guessed one.
    expect((await getStatusEffect(db, "t11-poison"))!.polarity).toBe("UNKNOWN");
  });

  it("one status can carry several facets at once", async () => {
    const curse = (await getStatusEffect(db, "t11-curse"))!;
    expect(curse.categories.map((c) => c.key).sort()).toEqual(["cc", "stat_modifier"]);
    expect(curse).toMatchObject({ polarity: "DEBUFF", cleansability: "UNCLEANSABLE" });
    expect(await keys({ categoryKeys: ["cc"] })).toEqual(["t11-curse"]);
    expect(await keys({ categoryKeys: ["cc", "stat_modifier"], polarity: "DEBUFF" })).toEqual(["t11-curse"]);
    expect(await keys({ categoryKeys: ["cc", "dot"] })).toEqual([]);
  });

  it("keeps aliases, exceptions and the verbatim definition", async () => {
    expect((await findStatusEffectsByTerm(db, "t11 burn")).map((s) => s.key)).toEqual(["t11-burn"]);
    expect((await findStatusEffectsByTerm(db, "T11  INCINERATE")).map((s) => s.key)).toEqual(["t11-burn"]);
    const dodge = (await getStatusEffect(db, "t11-s-dodge"))!;
    expect(dodge.cleansability).toBe("UNCLEANSABLE");
    expect(dodge.cleansabilityNote).toContain("can be cleansed");
    expect((await getStatusEffect(db, "t11-curse"))!.description).toBe("Uncleansable CC and 20% block rate reduction");
  });

  it("a name shared by two entries resolves to both — neither overwrites the other", async () => {
    const hits = await findStatusEffectsByTerm(db, "T11 Shielding state");
    expect(hits.map((s) => s.key).sort()).toEqual(["t11-ameno", "t11-shielding-state"]);
    expect(new Set(hits.map((s) => s.description)).size).toBe(2);
  });

  it("re-submitting an entry updates it in place", async () => {
    const again = await upsertStatusEffect(db, { key: "t11-poison", name: "T11 Poison", cleansability: "CLEANSABLE", categoryKeys: ["dot"], aliases: ["T11 Venom"] });
    expect(again.created).toBe(false);
    expect(await db.statusEffect.count({ where: { key: "t11-poison" } })).toBe(1);
    expect((await getStatusEffect(db, "t11-poison"))!.aliases).toEqual(["T11 Venom"]);
    expect(await dbRejects(() => db.statusEffect.create({ data: { key: "t11-bad", name: "x", polarity: "GOOD" } }))).toBe(TRIGGER_REJECTION);
  });
});
