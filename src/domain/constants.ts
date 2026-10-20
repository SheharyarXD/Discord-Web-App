/** Small closed sets stored as strings (SQLite has no enums). Keep in sync with schema comments. */

export const USER_ROLES = { USER: "USER", ADMIN: "ADMIN" } as const;
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const VALUE_TYPES = { FLAT: "FLAT", PERCENT: "PERCENT", MULTIPLIER: "MULTIPLIER" } as const;
export type ValueType = (typeof VALUE_TYPES)[keyof typeof VALUE_TYPES];

export const CONTENT_STATUSES = { DRAFT: "DRAFT", PUBLISHED: "PUBLISHED", ARCHIVED: "ARCHIVED" } as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[keyof typeof CONTENT_STATUSES];

export const SELECTION_MODES = { ONE_OF: "ONE_OF", ALL: "ALL" } as const;
export type SelectionMode = (typeof SELECTION_MODES)[keyof typeof SELECTION_MODES];

export const CONDITION_OPERATORS = { REQUIRES: "REQUIRES", EXCLUDES: "EXCLUDES" } as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[keyof typeof CONDITION_OPERATORS];

/** ACTIVATION = precondition for the effect to apply; TARGET = narrows who receives it. */
export const CONDITION_SCOPES = { ACTIVATION: "ACTIVATION", TARGET: "TARGET" } as const;
export type ConditionScope = (typeof CONDITION_SCOPES)[keyof typeof CONDITION_SCOPES];

export const JEWELRY_BONUS_KINDS = { PIECE_COUNT: "PIECE_COUNT", SPECIFIC_ITEMS: "SPECIFIC_ITEMS" } as const;
export type JewelryBonusKind = (typeof JEWELRY_BONUS_KINDS)[keyof typeof JEWELRY_BONUS_KINDS];

/** Client-assigned label. A ninja holds ONE of these or none — never both. */
export const COMBAT_CLASSES = { TANK: "TANK", DPS: "DPS" } as const;
export type CombatClass = (typeof COMBAT_CLASSES)[keyof typeof COMBAT_CLASSES];

export const REVIEW_STATUSES = {
  CONFIRMED: "CONFIRMED",
  PARTIALLY_CONFIRMED: "PARTIALLY_CONFIRMED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
} as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[keyof typeof REVIEW_STATUSES];

/**
 * MISSING no Spanish text · SOURCE_PROVIDED Spanish text supplied with the reference material,
 * not checked by us · DRAFT our own unverified translation · VERIFIED checked.
 */
export const TRANSLATION_STATUSES = { MISSING: "MISSING", SOURCE_PROVIDED: "SOURCE_PROVIDED", DRAFT: "DRAFT", VERIFIED: "VERIFIED" } as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[keyof typeof TRANSLATION_STATUSES];

export const STATUS_KINDS = { STATUS: "STATUS", TERM: "TERM" } as const;
export type StatusKind = (typeof STATUS_KINDS)[keyof typeof STATUS_KINDS];

export const POLARITIES = { BUFF: "BUFF", DEBUFF: "DEBUFF", NEUTRAL: "NEUTRAL", UNKNOWN: "UNKNOWN" } as const;
export type Polarity = (typeof POLARITIES)[keyof typeof POLARITIES];

export const CLEANSABILITIES = {
  CLEANSABLE: "CLEANSABLE",
  UNCLEANSABLE: "UNCLEANSABLE",
  CONDITIONAL: "CONDITIONAL",
  UNKNOWN: "UNKNOWN",
} as const;
export type Cleansability = (typeof CLEANSABILITIES)[keyof typeof CLEANSABILITIES];

export const MODIFIER_DIRECTIONS = { INCREASE: "INCREASE", DECREASE: "DECREASE" } as const;
export type ModifierDirection = (typeof MODIFIER_DIRECTIONS)[keyof typeof MODIFIER_DIRECTIONS];

export const STRUCTURED_STATUSES = { STRUCTURED: "STRUCTURED", TEXT_ONLY: "TEXT_ONLY", NEEDS_REVIEW: "NEEDS_REVIEW" } as const;
export type StructuredStatus = (typeof STRUCTURED_STATUSES)[keyof typeof STRUCTURED_STATUSES];

/** Whether a source category (role) may be read as a formation. Only APPROVED resolves. */
export const MAPPING_STATUSES = { UNMAPPED: "UNMAPPED", PROPOSED: "PROPOSED", APPROVED: "APPROVED" } as const;
export type MappingStatus = (typeof MAPPING_STATUSES)[keyof typeof MAPPING_STATUSES];

/** Whether a higher set tier adds to or replaces lower ones. UNKNOWN forbids any total. */
export const TIER_STACKING = { UNKNOWN: "UNKNOWN", CUMULATIVE: "CUMULATIVE", REPLACES: "REPLACES" } as const;
export type TierStacking = (typeof TIER_STACKING)[keyof typeof TIER_STACKING];

export const SET_STRUCTURE_STATUSES = { UNCONFIRMED: "UNCONFIRMED", CONFIRMED: "CONFIRMED" } as const;
export type SetStructureStatus = (typeof SET_STRUCTURE_STATUSES)[keyof typeof SET_STRUCTURE_STATUSES];

export const SOURCE_CATEGORIES = { SCREENSHOT: "SCREENSHOT", CLIENT_MESSAGE: "CLIENT_MESSAGE", DOCUMENT: "DOCUMENT" } as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[keyof typeof SOURCE_CATEGORIES];

export const EFFECT_OWNER_FIELDS = [
  "abilityId",
  "talentOptionId",
  "equipmentId",
  "equipmentSetBonusId",
  "jewelryId",
  "jewelrySetBonusId",
  "gemId",
] as const;
export type EffectOwnerField = (typeof EFFECT_OWNER_FIELDS)[number];

/** What an effect row is. */
export const EFFECT_KINDS = {
  ATTACK: "ATTACK",
  STAT: "STAT",
  STATUS: "STATUS",
  IMMUNITY: "IMMUNITY",
  FURY: "FURY",
  HEAL: "HEAL",
  DISPEL: "DISPEL",
  TEXT: "TEXT",
} as const;
export type EffectKind = (typeof EFFECT_KINDS)[keyof typeof EFFECT_KINDS];

/**
 * What a "rate" in the source means. Only APPLICATION is about how often something lands, and
 * even that is kept apart from `chancePercent`, which is filled only when the source says "chance".
 */
export const RATE_KINDS = { GROWTH: "GROWTH", INTENSITY: "INTENSITY", APPLICATION: "APPLICATION" } as const;
export type RateKind = (typeof RATE_KINDS)[keyof typeof RATE_KINDS];

/** How an awakening combines with earlier stages. Anything but an explicit source statement is UNKNOWN. */
export const STACKING_RULES = {
  NOT_APPLICABLE: "NOT_APPLICABLE",
  UNKNOWN: "UNKNOWN",
  CUMULATIVE: "CUMULATIVE",
  REPLACES_PRIOR: "REPLACES_PRIOR",
  CANCELS_PRIOR: "CANCELS_PRIOR",
  UPGRADES_BASE: "UPGRADES_BASE",
} as const;
export type StackingRule = (typeof STACKING_RULES)[keyof typeof STACKING_RULES];

export const TARGET_SELECTORS = {
  RANDOM: "RANDOM",
  HIGHEST_HP: "HIGHEST_HP",
  LOWEST_HP: "LOWEST_HP",
  HIGHEST_AVOID_INJURY: "HIGHEST_AVOID_INJURY",
  HIGHEST_CONTROL_RESISTANCE: "HIGHEST_CONTROL_RESISTANCE",
  ATTACKER: "ATTACKER",
} as const;
export type TargetSelector = (typeof TARGET_SELECTORS)[keyof typeof TARGET_SELECTORS];

export const ALIAS_KINDS = { CARD_NAME: "CARD_NAME", SOURCE_NAME: "SOURCE_NAME" } as const;
export type AliasKind = (typeof ALIAS_KINDS)[keyof typeof ALIAS_KINDS];
export const ALIAS_STATUSES = { VERIFIED: "VERIFIED", REVIEWED: "REVIEWED" } as const;
export type AliasStatus = (typeof ALIAS_STATUSES)[keyof typeof ALIAS_STATUSES];

/** Whether two formation rows are the same position under two names. Only APPROVED is acted on. */
export const EQUIVALENCE_STATUSES = { NONE: "NONE", PROPOSED: "PROPOSED", APPROVED: "APPROVED" } as const;
export type EquivalenceStatus = (typeof EQUIVALENCE_STATUSES)[keyof typeof EQUIVALENCE_STATUSES];

/** Ability slots (AbilityType keys) used by the reference data. */
export const ABILITY_SLOTS = {
  SKILL: "skill",
  NORMAL_SKILL: "normal_skill",
  SPECIAL_SKILL: "special_skill",
  TALENT_AWAKENING: "talent_awakening",
  SKILL_AWAKENING: "skill_awakening",
} as const;

export const SESSION_COOKIE = "fc_session";
export const DEFAULT_SESSION_DAYS = 14;
export const MIN_PASSWORD_LENGTH = 10;

/** List reads are always bounded. */
export const DEFAULT_PAGE_SIZE = 48;
export const MAX_PAGE_SIZE = 100;

export const MIN_MONTH = 1;
export const MAX_MONTH = 12;
