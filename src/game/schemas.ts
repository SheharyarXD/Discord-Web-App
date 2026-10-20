import { z } from "zod";
import {
  ALIAS_KINDS,
  ALIAS_STATUSES,
  CLEANSABILITIES,
  COMBAT_CLASSES,
  CONDITION_OPERATORS,
  CONDITION_SCOPES,
  CONTENT_STATUSES,
  EFFECT_KINDS,
  JEWELRY_BONUS_KINDS,
  MAX_MONTH,
  MIN_MONTH,
  MODIFIER_DIRECTIONS,
  POLARITIES,
  RATE_KINDS,
  REVIEW_STATUSES,
  SELECTION_MODES,
  SET_STRUCTURE_STATUSES,
  STACKING_RULES,
  STATUS_KINDS,
  STRUCTURED_STATUSES,
  TIER_STACKING,
  TRANSLATION_STATUSES,
  VALUE_TYPES,
} from "../domain/constants";

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as [T[keyof T], ...T[keyof T][]];

const text = z.string().trim().min(1).max(8000);
const optionalText = text.nullish();
const key = z.string().trim().min(1).max(120);

/**
 * A game number. Accepted as a number or a plain decimal string and handed to the database as
 * a string, so "22.5" is stored as 22.5 and never as a binary approximation of it.
 */
export const decimal = z
  .union([z.number().finite(), z.string().trim().regex(/^-?\d+(\.\d+)?$/, "must be a plain decimal number")])
  .transform((v) => String(v));

const reviewStatus = z.enum(values(REVIEW_STATUSES));
const translationStatus = z.enum(values(TRANSLATION_STATUSES));

// ───────────────────────── Effects & conditions ─────────────────────────

export const conditionInput = z.object({
  scope: z.enum(values(CONDITION_SCOPES)).default("ACTIVATION"),
  typeKey: key,
  /** Catalogue value (e.g. a nature key). */
  valueKey: key.nullish(),
  /** Direct subjects. */
  ninjaSlug: key.nullish(),
  formationKey: key.nullish(),
  roleKey: key.nullish(),
  operator: z.enum(values(CONDITION_OPERATORS)).default("REQUIRES"),
  numericValue: decimal.nullish(),
  note: optionalText,
  sourceText: optionalText,
  alternativeGroup: z.number().int().min(0).default(0),
});
export type ConditionInput = z.input<typeof conditionInput>;

export const effectInput = z
  .object({
    statisticKey: key.nullish(),
    value: decimal.nullish(),
    valueType: z.enum(values(VALUE_TYPES)).default("FLAT"),
    statusKey: key.nullish(),
    /** Strength override for this usage only. Not a chance. */
    magnitudeOverride: decimal.nullish(),
    targetKey: key.nullish(),
    targetText: optionalText,
    durationTurns: z.number().int().min(0).nullish(),
    /** Explicit activation chance, only when the source states one. */
    chancePercent: decimal.nullish(),
    triggerText: optionalText,
    conditionText: optionalText,
    structuredStatus: z.enum(values(STRUCTURED_STATUSES)).default("STRUCTURED"),
    sourceText: optionalText,
    description: optionalText,
    descriptionEs: optionalText,
    translationStatus: translationStatus.default("MISSING"),
    kind: z.enum(values(EFFECT_KINDS)).default("STAT"),
    /** A rate the source states. `rateKind` says what it is, so it can never pass for a chance. */
    rateValue: decimal.nullish(),
    rateKind: z.enum(values(RATE_KINDS)).nullish(),
    replacesValue: decimal.nullish(),
    valueNote: optionalText,
    targetCount: z.number().int().min(1).nullish(),
    targetSelector: key.nullish(),
    excludesSelf: z.boolean().default(false),
    /** Rows sharing a choiceGroup are alternatives of which one applies. */
    choiceGroup: z.number().int().min(0).nullish(),
    choiceLabel: optionalText,
    sourceLine: z.number().int().min(0).nullish(),
    note: optionalText,
    conditions: z.array(conditionInput).default([]),
  })
  .superRefine((e, ctx) => {
    if (e.rateValue != null && !e.rateKind) {
      ctx.addIssue({ code: "custom", path: ["rateKind"], message: "a rate must say what kind of rate it is" });
    }
    if (e.choiceLabel != null && e.choiceGroup == null) {
      ctx.addIssue({ code: "custom", path: ["choiceGroup"], message: "a choice label needs a choice group" });
    }
    if (!e.statisticKey && !e.statusKey && !e.description && !e.sourceText) {
      ctx.addIssue({ code: "custom", message: "an effect needs a statistic, a status, or text" });
    }
    if (e.magnitudeOverride != null && !e.statusKey) {
      ctx.addIssue({ code: "custom", path: ["magnitudeOverride"], message: "an override needs a status to override" });
    }
    if (e.chancePercent != null && (Number(e.chancePercent) < 0 || Number(e.chancePercent) > 100)) {
      ctx.addIssue({ code: "custom", path: ["chancePercent"], message: "must be between 0 and 100" });
    }
  });
export type EffectInput = z.input<typeof effectInput>;
export type ParsedEffectInput = z.output<typeof effectInput>;

// ───────────────────────── Status dictionary ─────────────────────────

export const statusEffectInput = z.object({
  key: key.optional(),
  kind: z.enum(values(STATUS_KINDS)).default("STATUS"),
  name: text,
  nameEs: optionalText,
  aliases: z.array(text).default([]),
  description: optionalText,
  descriptionEs: optionalText,
  translationStatus: translationStatus.default("MISSING"),
  polarity: z.enum(values(POLARITIES)).default("UNKNOWN"),
  cleansability: z.enum(values(CLEANSABILITIES)).default("UNKNOWN"),
  cleansabilityNote: optionalText,
  overrideDocumented: z.boolean().default(false),
  timingNote: optionalText,
  note: optionalText,
  structuredStatus: z.enum(values(STRUCTURED_STATUSES)).default("STRUCTURED"),
  reviewStatus: reviewStatus.default("NEEDS_REVIEW"),
  sortOrder: z.number().int().default(0),
  categoryKeys: z.array(key).default([]),
  modifiers: z
    .array(
      z.object({
        statLabel: text,
        statisticKey: key.nullish(),
        direction: z.enum(values(MODIFIER_DIRECTIONS)).default("INCREASE"),
        magnitude: decimal.nullish(),
        valueType: z.enum(values(VALUE_TYPES)).default("PERCENT"),
        overridable: z.boolean().default(true),
        note: optionalText,
      }),
    )
    .default([]),
});
export type StatusEffectInput = z.input<typeof statusEffectInput>;

// ───────────────────────── Ninjas ─────────────────────────

export const releaseInput = z.object({
  year: z.number().int().min(1990).max(2200),
  month: z.number().int().min(MIN_MONTH).max(MAX_MONTH),
});

const abilityCore = {
  name: text,
  nameEs: optionalText,
  description: optionalText,
  descriptionEs: optionalText,
  translationStatus: translationStatus.default("MISSING"),
  triggerText: optionalText,
  stage: z.number().int().min(0).nullish(),
  /** Name printed on the card, kept next to the name used in the ability text. */
  cardLabel: optionalText,
  cardLabelCut: z.boolean().default(false),
  sourceHeading: optionalText,
  conditionText: optionalText,
  note: optionalText,
  reviewStatus: reviewStatus.default("NEEDS_REVIEW"),
  effects: z.array(effectInput).optional(),
};

/** An awakening stage of a talent or of a skill. */
const awakeningInput = z.object({
  ...abilityCore,
  typeKey: key,
  /** Only an explicit source statement justifies anything but UNKNOWN. */
  stackingRule: z.enum(values(STACKING_RULES)).default("UNKNOWN"),
  /** Stage number of the earlier awakening this one replaces or cancels. */
  supersedesStage: z.number().int().min(0).nullish(),
  ruleSourceText: optionalText,
});
export type AwakeningInput = z.input<typeof awakeningInput>;

export const ninjaInput = z.object({
  /** Original source name, exactly as written. Each named variant is its own ninja. */
  name: text,
  slug: key.optional(),
  nameEs: optionalText,
  description: optionalText,
  descriptionEs: optionalText,
  translationStatus: translationStatus.optional(),
  imageUrl: z.url().max(2000).nullish(),
  /** Source category (reference forum label). */
  roleKey: key.nullish(),
  /** In-game formation — only from direct evidence. */
  formationKey: key.nullish(),
  ratingKey: key.nullish(),
  typeKey: key.nullish(),
  /** Client label: exactly one of TANK / DPS, or null for unassigned. */
  clientCombatClass: z.enum(values(COMBAT_CLASSES)).nullish(),
  release: releaseInput.nullish(),
  releaseOrder: z.number().int().min(0).nullish(),
  status: z.enum(values(CONTENT_STATUSES)).optional(),
  reviewStatus: reviewStatus.optional(),
  natureKeys: z.array(key).optional(),
  /** Other names for the same ninja (card name plate, thread title). Never replace `name`. */
  aliases: z
    .array(
      z.object({
        alias: text,
        kind: z.enum(values(ALIAS_KINDS)),
        locale: z.string().trim().min(2).max(10).default("en"),
        status: z.enum(values(ALIAS_STATUSES)).default("REVIEWED"),
        note: optionalText,
      }),
    )
    .optional(),
  baseStats: z
    .array(
      z.object({
        statisticKey: key,
        sourceLabel: text,
        baseValue: decimal,
        growthRate: decimal.nullish(),
      }),
    )
    .optional(),
  abilities: z.array(z.object({ ...abilityCore, typeKey: key, awakenings: z.array(awakeningInput).optional() })).optional(),
  talentGroups: z
    .array(
      z.object({
        name: optionalText,
        selectionMode: z.enum(values(SELECTION_MODES)).default("ONE_OF"),
        minSelections: z.number().int().min(0).default(1),
        maxSelections: z.number().int().min(1).default(1),
        reviewStatus: reviewStatus.default("NEEDS_REVIEW"),
        note: optionalText,
        options: z
          .array(
            z.object({
              name: text,
              nameEs: optionalText,
              description: optionalText,
              descriptionEs: optionalText,
              translationStatus: translationStatus.default("MISSING"),
              cardLabel: optionalText,
              cardLabelCut: z.boolean().default(false),
              sourceHeading: optionalText,
              note: optionalText,
              reviewStatus: reviewStatus.default("NEEDS_REVIEW"),
              effects: z.array(effectInput).optional(),
              /** Awakening stages of this talent. */
              awakenings: z.array(awakeningInput).optional(),
            }),
          )
          .min(1),
      }),
    )
    .optional(),
});
export type NinjaInput = z.input<typeof ninjaInput>;

// ───────────────────────── Equipment & jewelry ─────────────────────────

const itemBase = {
  name: text,
  slug: key.optional(),
  nameEs: optionalText,
  description: optionalText,
  descriptionEs: optionalText,
  translationStatus: translationStatus.default("MISSING"),
  status: z.enum(values(CONTENT_STATUSES)).default("DRAFT"),
  reviewStatus: reviewStatus.default("NEEDS_REVIEW"),
  /** The piece's own statistics/effects — never the set tiers. */
  effects: z.array(effectInput).default([]),
};

export const equipmentSetInput = z.object({
  name: text,
  slug: key.optional(),
  nameEs: optionalText,
  description: optionalText,
  descriptionEs: optionalText,
  translationStatus: translationStatus.default("MISSING"),
  tierStacking: z.enum(values(TIER_STACKING)).default("UNKNOWN"),
  reviewStatus: reviewStatus.default("NEEDS_REVIEW"),
  /** Any piece threshold; 2/4/6 are data. */
  bonuses: z
    .array(
      z.object({
        requiredPieces: z.number().int().min(1),
        description: optionalText,
        descriptionEs: optionalText,
        effects: z.array(effectInput).default([]),
      }),
    )
    .default([]),
  items: z.array(z.object({ ...itemBase, slotKey: key.nullish() })).default([]),
});
export type EquipmentSetInput = z.input<typeof equipmentSetInput>;

export const jewelrySetInput = z.object({
  name: text,
  slug: key.optional(),
  nameEs: optionalText,
  description: optionalText,
  descriptionEs: optionalText,
  translationStatus: translationStatus.default("MISSING"),
  structureStatus: z.enum(values(SET_STRUCTURE_STATUSES)).default("UNCONFIRMED"),
  tierStacking: z.enum(values(TIER_STACKING)).default("UNKNOWN"),
  reviewStatus: reviewStatus.default("NEEDS_REVIEW"),
  groups: z.array(z.object({ key, name: text, nameEs: optionalText })).default([]),
  items: z.array(z.object({ ...itemBase, typeKey: key.nullish(), groupKey: key.nullish() })).default([]),
  bonuses: z
    .array(
      z
        .object({
          /** Set → bonus needs pieces of that sub-group; omitted → of the whole set. */
          groupKey: key.nullish(),
          requirementKind: z.enum(values(JEWELRY_BONUS_KINDS)).default("PIECE_COUNT"),
          requiredPieces: z.number().int().min(1).nullish(),
          requiredItemNames: z.array(text).default([]),
          description: optionalText,
          descriptionEs: optionalText,
          effects: z.array(effectInput).default([]),
        })
        .superRefine((b, ctx) => {
          if (b.requirementKind === "PIECE_COUNT" && b.requiredPieces == null) {
            ctx.addIssue({ code: "custom", path: ["requiredPieces"], message: "PIECE_COUNT needs requiredPieces" });
          }
          if (b.requirementKind === "SPECIFIC_ITEMS" && b.requiredItemNames.length === 0) {
            ctx.addIssue({ code: "custom", path: ["requiredItemNames"], message: "SPECIFIC_ITEMS needs items" });
          }
        }),
    )
    .default([]),
});
export type JewelrySetInput = z.input<typeof jewelrySetInput>;

/** A minimum and/or maximum on one statistic. Both ends are inclusive. */
export const statFilter = z
  .object({ statisticKey: key, min: decimal.nullish(), max: decimal.nullish() })
  .refine((f) => f.min == null || f.max == null || Number(f.min) <= Number(f.max), { message: "min must not be greater than max", path: ["min"] });
export type StatFilter = z.input<typeof statFilter>;

export const SORT_DIRECTIONS = ["asc", "desc"] as const;

// ───────────────────────── Single items (administration) ─────────────────────────

/** One equipment piece, with or without a set. Its own statistics are `effects`; set tiers live on the set. */
export const equipmentInput = z.object({
  ...itemBase,
  slotKey: key.nullish(),
  /** Slug of an existing equipment set. */
  setSlug: key.nullish(),
});
export type EquipmentInput = z.input<typeof equipmentInput>;

export const jewelryInput = z.object({
  ...itemBase,
  typeKey: key.nullish(),
  setSlug: key.nullish(),
  /** Key of a sub-group of that set. */
  groupKey: key.nullish(),
});
export type JewelryInput = z.input<typeof jewelryInput>;

export const gemInput = z.object({
  name: text,
  slug: key.optional(),
  typeKey: key.nullish(),
  level: z.number().int().min(0).nullish(),
  description: optionalText,
  status: z.enum(values(CONTENT_STATUSES)).default("DRAFT"),
  effects: z.array(effectInput).default([]),
});
export type GemInput = z.input<typeof gemInput>;

/** Item lists: equipment, jewelry or gems. */
export const ITEM_KINDS = ["equipment", "jewelry", "gem"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const itemListParams = z.object({
  kind: z.enum(ITEM_KINDS),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).optional(),
  /** Name, Spanish name and the name of the set, ignoring case and accents. */
  query: z.string().trim().max(120).optional(),
  /** Equipment slot, jewelry type or gem type keys. */
  typeKeys: z.array(key).optional(),
  setSlugs: z.array(key).optional(),
  /** Minimum / maximum of the piece's own statistics. Several filters must all hold. */
  statFilters: z.array(statFilter).max(8).optional(),
  statisticKeys: z.array(key).optional(),
  sort: z
    .object({ by: z.enum(["name", "stat"]).default("name"), statisticKey: key.nullish(), direction: z.enum(SORT_DIRECTIONS).default("asc") })
    .refine((o) => o.by !== "stat" || !!o.statisticKey, { message: "sorting by a statistic needs the statistic", path: ["statisticKey"] })
    .optional(),
  includeUnpublished: z.boolean().default(false),
});
export type ItemListParams = z.input<typeof itemListParams>;

// ───────────────────────── Lists ─────────────────────────

export const ninjaListParams = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).optional(),
  /** Each list is OR within itself; different filters are ANDed. */
  ratingKeys: z.array(key).optional(),
  formationKeys: z.array(key).optional(),
  roleKeys: z.array(key).optional(),
  typeKeys: z.array(key).optional(),
  /** "UNASSIGNED" selects ninjas the client has not classified yet. */
  combatClasses: z.array(z.enum([...values(COMBAT_CLASSES), "UNASSIGNED"])).optional(),
  nameContains: z.string().trim().max(120).optional(),
  /** Free search: name, Spanish name and every alias, ignoring case and accents. */
  query: z.string().trim().max(120).optional(),
  /** Minimum / maximum of base statistics. Several filters must all hold. */
  statFilters: z.array(statFilter).max(8).optional(),
  /** Ninjas whose abilities, talents or awakenings have an effect on one of these statistics. */
  effectStatisticKeys: z.array(key).optional(),
  /** Default: newest release first. «stat» and «growth» sort by one base statistic, ninjas without it last. */
  sort: z
    .object({ by: z.enum(["release", "name", "stat", "growth"]).default("release"), statisticKey: key.nullish(), direction: z.enum(SORT_DIRECTIONS).default("desc") })
    .refine((o) => (o.by !== "stat" && o.by !== "growth") || !!o.statisticKey, { message: "sorting by a statistic needs the statistic", path: ["statisticKey"] })
    .optional(),
  releasedFrom: releaseInput.optional(),
  releasedTo: releaseInput.optional(),
  includeUnpublished: z.boolean().default(false),
});
export type NinjaListParams = z.input<typeof ninjaListParams>;
