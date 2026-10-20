import {
  CONDITION_SCOPES,
  EFFECT_OWNER_FIELDS,
  STRUCTURED_STATUSES,
  VALUE_TYPES,
  type Cleansability,
  type ConditionScope,
  type EffectKind,
  type RateKind,
  type ModifierDirection,
  type Polarity,
  type StatusKind,
  type StructuredStatus,
  type TranslationStatus,
  type ValueType,
} from "./constants";

/** Pure, UI-agnostic view of a condition attached to an effect usage. */
export interface ConditionView {
  id: string;
  scope: ConditionScope;
  typeKey: string;
  typeName: string;
  /** Key of the referenced value/subject (nature key, role key, formation key, ninja slug). */
  valueKey: string | null;
  valueName: string | null;
  operator: "REQUIRES" | "EXCLUDES";
  numericValue: number | null;
  note: string | null;
  alternativeGroup: number;
}

// ───────────────────────── Status dictionary ─────────────────────────

/** Default component of a status definition ("attack +15%"). */
export interface StatusModifierDef {
  statLabel: string;
  statisticKey: string | null;
  statisticName: string | null;
  direction: ModifierDirection;
  /** null = the source gives no number. */
  magnitude: number | null;
  valueType: ValueType;
  /** true = a usage-level override replaces this component's magnitude. */
  overridable: boolean;
  note: string | null;
}

export interface StatusDefinitionView {
  key: string;
  kind: StatusKind;
  name: string;
  nameEs: string | null;
  description: string | null;
  descriptionEs: string | null;
  translationStatus: TranslationStatus;
  polarity: Polarity;
  cleansability: Cleansability;
  cleansabilityNote: string | null;
  overrideDocumented: boolean;
  timingNote: string | null;
  note: string | null;
  categories: { key: string; name: string; nameEs: string | null }[];
  aliases: string[];
  modifiers: StatusModifierDef[];
}

/** Where an effective magnitude came from. */
export type MagnitudeOrigin = "DEFAULT" | "OVERRIDE" | "UNSPECIFIED";

export interface ResolvedModifier extends StatusModifierDef {
  effectiveMagnitude: number | null;
  origin: MagnitudeOrigin;
}

export interface EffectUsageNumbers {
  /** Per-usage strength override, e.g. 20 for "(20%) shatter storm". NOT a chance. */
  magnitudeOverride: number | null;
  durationTurns?: number | null;
  /** Explicit activation chance; null/undefined = none stated. */
  chancePercent?: number | null;
}

export interface ResolvedEffectUsage {
  modifiers: ResolvedModifier[];
  /** Summary over all components. */
  magnitudeOrigin: MagnitudeOrigin | "MIXED";
  durationRounds: number | null;
  chancePercent: number | null;
}

/**
 * Resolves what a status does IN ONE USAGE.
 *
 *   power       ← usage.magnitudeOverride, else the definition's default (per component)
 *   probability ← usage.chancePercent only (never derived from the magnitude)
 *   duration    ← usage.durationTurns only
 *
 * Pure: neither argument is mutated, so overriding one usage can never change the shared
 * definition or any other usage.
 */
export function resolveEffectUsage(
  definition: Pick<StatusDefinitionView, "modifiers">,
  usage: EffectUsageNumbers,
): ResolvedEffectUsage {
  const override = usage.magnitudeOverride;
  const modifiers = definition.modifiers.map((m): ResolvedModifier => {
    if (override !== null && m.overridable) return { ...m, effectiveMagnitude: override, origin: "OVERRIDE" };
    if (m.magnitude === null) return { ...m, effectiveMagnitude: null, origin: "UNSPECIFIED" };
    return { ...m, effectiveMagnitude: m.magnitude, origin: "DEFAULT" };
  });
  const origins = new Set(modifiers.map((m) => m.origin));
  const magnitudeOrigin: ResolvedEffectUsage["magnitudeOrigin"] =
    origins.size === 0 ? (override !== null ? "OVERRIDE" : "UNSPECIFIED") : origins.size === 1 ? [...origins][0]! : "MIXED";
  return {
    modifiers,
    magnitudeOrigin,
    durationRounds: usage.durationTurns ?? null,
    chancePercent: usage.chancePercent ?? null,
  };
}

/** The dictionary status applied by a usage, already resolved for that usage. */
export interface StatusUsageView {
  definition: StatusDefinitionView;
  magnitudeOverride: number | null;
  resolved: ResolvedEffectUsage;
}

// ───────────────────────── Effect usage view ─────────────────────────

export interface EffectView {
  id: string;
  statisticName: string | null;
  statisticKey: string | null;
  value: number | null;
  valueType: ValueType;
  targetName: string | null;
  durationTurns: number | null;
  chancePercent: number | null;
  description: string | null;
  /** ACTIVATION-scope conditions only. */
  conditions: ConditionView[];
  /** TARGET-scope conditions: who receives the effect. */
  targetFilters: ConditionView[];
  targetText: string | null;
  triggerText: string | null;
  /** Unstructured requirement wording. Its presence alone makes the effect conditional. */
  conditionText: string | null;
  structuredStatus: StructuredStatus;
  sourceText: string | null;
  status: StatusUsageView | null;
  kind: EffectKind;
  /** A rate stated by the source. Never a probability unless rateKind is APPLICATION. */
  rateValue: number | null;
  rateKind: RateKind | null;
  replacesValue: number | null;
  valueNote: string | null;
  targetCount: number | null;
  targetSelector: string | null;
  excludesSelf: boolean;
  /** Rows sharing a choiceGroup are alternatives: ONE of them applies. */
  choiceGroup: number | null;
  choiceLabel: string | null;
  /** Position of the source line inside its ability; rows parsed from one line share it. */
  sourceLine: number | null;
  note: string | null;
  descriptionEs: string | null;
  translationStatus: TranslationStatus;
}

/** Fills the M2 fields with neutral defaults; used by fixtures and mappers. */
export function makeEffectView(
  base: Pick<EffectView, "id"> & Partial<EffectView>,
): EffectView {
  return {
    statisticName: null,
    statisticKey: null,
    value: null,
    valueType: VALUE_TYPES.FLAT,
    targetName: null,
    durationTurns: null,
    chancePercent: null,
    description: null,
    conditions: [],
    targetFilters: [],
    targetText: null,
    triggerText: null,
    conditionText: null,
    structuredStatus: STRUCTURED_STATUSES.STRUCTURED,
    sourceText: null,
    status: null,
    kind: "STAT",
    rateValue: null,
    rateKind: null,
    replacesValue: null,
    valueNote: null,
    targetCount: null,
    targetSelector: null,
    excludesSelf: false,
    choiceGroup: null,
    choiceLabel: null,
    sourceLine: null,
    note: null,
    descriptionEs: null,
    translationStatus: "MISSING",
    ...base,
  };
}

/**
 *   UNCONDITIONAL          nothing restricts activation
 *   CONDITIONAL            structured activation conditions exist
 *   CONDITIONAL_UNRESOLVED a requirement is known only as text
 *   TRIGGERED              applies only when something happens ("after being attacked")
 *   NEEDS_REVIEW           the structure is unverified — must NOT be shown as "always active"
 *   TEXT_ONLY              kept as source wording only — nothing is claimed about when it applies
 */
export type ConditionState = "UNCONDITIONAL" | "CONDITIONAL" | "CONDITIONAL_UNRESOLVED" | "TRIGGERED" | "NEEDS_REVIEW" | "TEXT_ONLY";

type Conditionality = Pick<EffectView, "conditions"> & Partial<Pick<EffectView, "conditionText" | "structuredStatus" | "triggerText">>;

export function effectConditionState(effect: Conditionality): ConditionState {
  if (effect.conditions.length > 0) return "CONDITIONAL";
  if (effect.conditionText) return "CONDITIONAL_UNRESOLVED";
  if (effect.structuredStatus === STRUCTURED_STATUSES.TEXT_ONLY) return "TEXT_ONLY";
  if (effect.structuredStatus === STRUCTURED_STATUSES.NEEDS_REVIEW) return "NEEDS_REVIEW";
  if (effect.triggerText) return "TRIGGERED";
  return "UNCONDITIONAL";
}

/** An effect is conditional unless it is positively known to be unconditional. */
export function isConditional(effect: Conditionality): boolean {
  return effectConditionState(effect) !== "UNCONDITIONAL";
}

/** Splits condition rows by scope. */
export function splitConditions(all: ConditionView[]): { activation: ConditionView[]; target: ConditionView[] } {
  return {
    activation: all.filter((c) => c.scope === CONDITION_SCOPES.ACTIVATION),
    target: all.filter((c) => c.scope === CONDITION_SCOPES.TARGET),
  };
}

/** Throws unless exactly one owner column is set. */
export function assertSingleEffectOwner(owners: Partial<Record<(typeof EFFECT_OWNER_FIELDS)[number], string | null>>): void {
  const set = EFFECT_OWNER_FIELDS.filter((f) => owners[f]);
  if (set.length !== 1) {
    throw new Error(`Effect must have exactly one owner, got ${set.length}: [${set.join(", ")}]`);
  }
}

/**
 * Formats a value with its type: 30 PERCENT → "30%", 12 FLAT → "12", 1.5 MULTIPLIER → "×1.5".
 * Sign is explicit for additive types ("+30%"), which is how stat lines read.
 */
export function formatEffectValue(value: number | null, valueType: ValueType, locale = "es"): string {
  if (value === null) return "";
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  if (valueType === VALUE_TYPES.MULTIPLIER) return `×${nf.format(value)}`;
  const sign = value > 0 ? "+" : "";
  const body = nf.format(value);
  return valueType === VALUE_TYPES.PERCENT ? `${sign}${body}%` : `${sign}${body}`;
}

/** Signed magnitude of a status component for display (DECREASE → negative). */
export function signedMagnitude(m: Pick<ResolvedModifier, "effectiveMagnitude" | "direction">): number | null {
  if (m.effectiveMagnitude === null) return null;
  return m.direction === "DECREASE" ? -Math.abs(m.effectiveMagnitude) : Math.abs(m.effectiveMagnitude);
}

/** Groups conditions into OR-alternatives, each an AND-list. */
export function groupConditions(conditions: ConditionView[]): ConditionView[][] {
  const groups = new Map<number, ConditionView[]>();
  for (const c of conditions) {
    const list = groups.get(c.alternativeGroup) ?? [];
    list.push(c);
    groups.set(c.alternativeGroup, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, list]) => list);
}

// ───────────────────────── Condition evaluation (three-valued) ─────────────────────────

export type Tri = "MET" | "NOT_MET" | "UNKNOWN";

/**
 * What is known about the subject. A key that is ABSENT means "not known" and can only ever
 * yield UNKNOWN — missing data never makes a conditional effect count as active.
 * Keys are condition type keys ("nature", "role", "formation", "ninja", "gender", ...).
 */
export type ActivationContext = Readonly<Record<string, readonly string[] | undefined>>;

function evaluateOne(condition: ConditionView, ctx: ActivationContext): Tri {
  const known = ctx[condition.typeKey];
  // Thresholds and free-text qualifiers are not machine-checkable here.
  if (known === undefined || condition.valueKey === null || condition.numericValue !== null) return "UNKNOWN";
  const has = known.includes(condition.valueKey);
  return (condition.operator === "EXCLUDES" ? !has : has) ? "MET" : "NOT_MET";
}

const and = (values: Tri[]): Tri =>
  values.includes("NOT_MET") ? "NOT_MET" : values.includes("UNKNOWN") ? "UNKNOWN" : "MET";
const or = (values: Tri[]): Tri =>
  values.includes("MET") ? "MET" : values.includes("UNKNOWN") ? "UNKNOWN" : "NOT_MET";

/** Whether an effect's ACTIVATION conditions hold for the given context. */
export function evaluateActivation(effect: Conditionality, ctx: ActivationContext = {}): Tri {
  const structured: Tri =
    effect.conditions.length === 0
      ? "MET"
      : or(groupConditions(effect.conditions).map((group) => and(group.map((c) => evaluateOne(c, ctx)))));
  const unresolved =
    Boolean(effect.conditionText) ||
    Boolean(effect.triggerText) ||
    effect.structuredStatus === STRUCTURED_STATUSES.NEEDS_REVIEW ||
    effect.structuredStatus === STRUCTURED_STATUSES.TEXT_ONLY;
  return unresolved ? and([structured, "UNKNOWN"]) : structured;
}

// ───────────────────────── Alternatives & source lines ─────────────────────────

export interface ChoiceGroupView<E> {
  group: number;
  /** Options of which ONE applies. The source does not always say how the option is picked. */
  options: { label: string | null; effects: E[] }[];
}

/**
 * Separates effects that always belong to the ability from alternatives ("A — … OR B — …").
 * Groups are independent of each other; inside a group the options are never combined.
 */
export function splitChoices<E extends Pick<EffectView, "choiceGroup" | "choiceLabel">>(effects: E[]): { fixed: E[]; choices: ChoiceGroupView<E>[] } {
  const fixed: E[] = [];
  const groups = new Map<number, Map<string, E[]>>();
  for (const e of effects) {
    if (e.choiceGroup === null) {
      fixed.push(e);
      continue;
    }
    const options = groups.get(e.choiceGroup) ?? new Map<string, E[]>();
    const key = e.choiceLabel ?? "";
    options.set(key, [...(options.get(key) ?? []), e]);
    groups.set(e.choiceGroup, options);
  }
  const choices = [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([group, options]) => ({ group, options: [...options.entries()].map(([label, list]) => ({ label: label || null, effects: list })) }));
  return { fixed, choices };
}

/** Groups rows by the source line they were read from, keeping the order of the source. */
export function groupBySourceLine<E extends Pick<EffectView, "sourceLine" | "id">>(effects: E[]): E[][] {
  const lines = new Map<string, E[]>();
  for (const e of effects) {
    const key = e.sourceLine === null ? `single:${e.id}` : `line:${e.sourceLine}`;
    lines.set(key, [...(lines.get(key) ?? []), e]);
  }
  return [...lines.values()];
}
