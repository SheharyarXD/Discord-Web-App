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

export const JEWELRY_BONUS_KINDS = { PIECE_COUNT: "PIECE_COUNT", SPECIFIC_ITEMS: "SPECIFIC_ITEMS" } as const;
export type JewelryBonusKind = (typeof JEWELRY_BONUS_KINDS)[keyof typeof JEWELRY_BONUS_KINDS];

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

export const SESSION_COOKIE = "fc_session";
export const DEFAULT_SESSION_DAYS = 14;
export const MIN_PASSWORD_LENGTH = 10;
