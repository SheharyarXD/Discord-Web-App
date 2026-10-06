import { EFFECT_OWNER_FIELDS, VALUE_TYPES, type ValueType } from "./constants";

/** Pure, UI-agnostic view of an effect and its conditions. */
export interface ConditionView {
  id: string;
  typeKey: string;
  typeName: string;
  valueName: string | null;
  operator: "REQUIRES" | "EXCLUDES";
  numericValue: number | null;
  note: string | null;
  alternativeGroup: number;
}

export interface EffectView {
  id: string;
  statisticName: string | null;
  value: number | null;
  valueType: ValueType;
  targetName: string | null;
  durationTurns: number | null;
  chancePercent: number | null;
  description: string | null;
  conditions: ConditionView[];
}

/** An effect is conditional as soon as it carries at least one condition. */
export function isConditional(effect: Pick<EffectView, "conditions">): boolean {
  return effect.conditions.length > 0;
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
