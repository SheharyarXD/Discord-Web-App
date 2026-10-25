import { CLIENT_AWAKENING_RULE_TEXT } from "../domain/awakenings";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createAbilityParser, type AbilityParser, type Lexicon } from "../domain/ability-text";
import { inTransaction, parseInput, UnknownReferenceError, type Db } from "./db";
import { replaceEffects } from "./effects";
import { buildBlock, type StagedAbility } from "./profile-loader";
import { effectInput } from "./schemas";

/**
 * Lets the administrator add or change one talent, skill, passive or awakening by pasting its text.
 * The same parser that loaded the reference data turns each English line into effect rows, so a
 * hand-entered ability is stored exactly like an imported one: the verbatim line is kept, what the
 * parser cannot structure is kept as text and flagged, and Spanish lines are paired only when the
 * counts match. An awakening replaces the earlier numbered stage of the same talent or skill (client rule); otherwise it starts as UNKNOWN and nothing is guessed.
 */

export const ABILITY_KINDS = ["skill", "normal_skill", "special_skill", "passive", "talent", "talent_awakening", "skill_awakening"] as const;
export type AbilityKind = (typeof ABILITY_KINDS)[number];

export const abilityTextInput = z.object({
  ninjaSlug: z.string().trim().min(1),
  kind: z.enum(ABILITY_KINDS),
  name: z.string().trim().min(1).max(300),
  nameEs: z.string().trim().max(300).nullish(),
  /** One English line per entry, exactly as written in the source. */
  linesEn: z.array(z.string().trim().min(1).max(4000)).max(60),
  /** Supplied Spanish lines. Optional. */
  linesEs: z.array(z.string().trim().min(1).max(4000)).max(60).default([]),
  stage: z.number().int().min(0).max(20).nullish(),
  /** Editing an existing ability or talent option. */
  existingId: z.string().nullish(),
  /** Awakenings: the talent option (talent_awakening) or skill (skill_awakening) they belong to. */
  parentId: z.string().nullish(),
});
export type AbilityTextInput = z.input<typeof abilityTextInput>;

let cached: AbilityParser | null = null;
/** The vocabulary the parser knows comes from data/reference/lexicon.json (shipped with the application). */
export function abilityParser(): AbilityParser {
  if (!cached) {
    const file = path.resolve(process.cwd(), "data/reference/lexicon.json");
    cached = createAbilityParser(JSON.parse(readFileSync(file, "utf8")) as Lexicon);
  }
  return cached;
}

const STAGED_SLOT = { skill: "skill", normal_skill: "normal_skill", special_skill: "special_skill", passive: "skill", talent: "talent", talent_awakening: "talent_awakening", skill_awakening: "skill_awakening" } as const;

export async function saveAbilityText(db: Db, input: AbilityTextInput, parser: AbilityParser = abilityParser()): Promise<{ id: string; effectRows: number; needsReview: number }> {
  const d = parseInput(abilityTextInput, input, "ability text");
  const staged: StagedAbility = {
    slot: STAGED_SLOT[d.kind],
    heading: d.name,
    name: d.name,
    stage: d.stage ?? null,
    condition: null,
    en: { asset: "admin", lines: d.linesEn.map((text) => ({ text })) },
    es: d.linesEs.length ? { asset: "admin", heading: d.nameEs ?? d.name, name: d.nameEs ?? null, lines: d.linesEs.map((text) => ({ text })) } : null,
  };
  const block = buildBlock(parser, staged);
  const effects = block.effects.map((e) => effectInput.parse(e));
  const common = {
    name: d.name,
    nameEs: d.nameEs ?? null,
    description: block.description || null,
    descriptionEs: block.descriptionEs,
    translationStatus: block.translationStatus,
    note: block.notes.join(";") || null,
    reviewStatus: block.review,
  };

  return inTransaction(db, async (tx) => {
    const ninja = await tx.ninja.findUnique({ where: { slug: d.ninjaSlug }, select: { id: true } });
    if (!ninja) throw new UnknownReferenceError("ninja", d.ninjaSlug);

    if (d.kind === "talent") {
      let group = await tx.talentGroup.findFirst({ where: { ninjaId: ninja.id }, orderBy: { sortOrder: "asc" }, select: { id: true } });
      if (!group) group = await tx.talentGroup.create({ data: { ninjaId: ninja.id, selectionMode: "ONE_OF", reviewStatus: "NEEDS_REVIEW" }, select: { id: true } });
      const count = await tx.talentOption.count({ where: { groupId: group.id } });
      const option = d.existingId
        ? await tx.talentOption.update({ where: { id: d.existingId }, data: common, select: { id: true } })
        : await tx.talentOption.create({ data: { groupId: group.id, sortOrder: count, ...common }, select: { id: true } });
      await replaceEffects(tx, { talentOptionId: option.id }, effects);
      return { id: option.id, effectRows: effects.length, needsReview: block.counts.needsReview + block.counts.textOnly };
    }

    const type = await tx.abilityType.findUnique({ where: { key: d.kind === "passive" ? "passive" : d.kind }, select: { id: true } });
    if (!type) throw new UnknownReferenceError("ability type", d.kind);
    const parent =
      d.kind === "talent_awakening" ? { talentOptionId: d.parentId ?? null, parentAbilityId: null }
      : d.kind === "skill_awakening" ? { parentAbilityId: d.parentId ?? null, talentOptionId: null }
      : { parentAbilityId: null, talentOptionId: null };
    if ((d.kind === "talent_awakening" || d.kind === "skill_awakening") && !d.parentId) throw new UnknownReferenceError("parent of the awakening", d.kind);
    // The parent must be a talent (for a talent awakening) or a skill (for a skill awakening) of THIS ninja.
    if (d.kind === "talent_awakening" && !(await tx.talentOption.findFirst({ where: { id: d.parentId!, group: { ninjaId: ninja.id } }, select: { id: true } }))) {
      throw new UnknownReferenceError("talent of this ninja", d.parentId!);
    }
    if (d.kind === "skill_awakening" && !(await tx.ability.findFirst({ where: { id: d.parentId!, ninjaId: ninja.id, parentAbilityId: null, talentOptionId: null, abilityType: { key: { in: ["skill", "normal_skill", "special_skill"] } } }, select: { id: true } }))) {
      throw new UnknownReferenceError("skill of this ninja", d.parentId!);
    }
    // Client rule: a new awakening replaces the previous stage of the same talent or skill. Without an earlier numbered stage nothing is assumed.
    let rule: { stackingRule: string; supersedesId?: string; ruleSourceText?: string } = { stackingRule: "UNKNOWN" };
    if (d.kind.endsWith("awakening") && d.stage != null) {
      const earlier = await tx.ability.findFirst({
        where: { ...parent, stage: { lt: d.stage }, ...(d.existingId ? { id: { not: d.existingId } } : {}) },
        orderBy: { stage: "desc" },
        select: { id: true },
      });
      if (earlier) rule = { stackingRule: "REPLACES_PRIOR", supersedesId: earlier.id, ruleSourceText: CLIENT_AWAKENING_RULE_TEXT };
    }
    const values = { ...common, abilityTypeId: type.id, stage: d.stage ?? null, ...parent, ...(d.kind.endsWith("awakening") ? rule : {}) };
    const row = d.existingId
      ? await tx.ability.update({ where: { id: d.existingId }, data: values, select: { id: true } })
      : await tx.ability.create({ data: { ninjaId: ninja.id, sortOrder: await tx.ability.count({ where: { ninjaId: ninja.id } }), ...values }, select: { id: true } });
    await replaceEffects(tx, { abilityId: row.id }, effects);
    return { id: row.id, effectRows: effects.length, needsReview: block.counts.needsReview + block.counts.textOnly };
  });
}

/** Removes an ability (with its awakenings and effects) or a talent option (with its awakenings). */
export async function deleteAbility(db: Db, id: string, what: "ability" | "talent"): Promise<boolean> {
  if (what === "talent") return (await db.talentOption.deleteMany({ where: { id } })).count > 0;
  return (await db.ability.deleteMany({ where: { id } })).count > 0;
}
