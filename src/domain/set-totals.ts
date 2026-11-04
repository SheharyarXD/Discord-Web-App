import type { EffectView } from "./effects";
import { additiveKey, cumulate, type BonusLine, type CumulativeTotal } from "./cumulative";

/** A stored set bonus as the detail page has it: its threshold, its jewelry slot (2-piece bonus) and its effects. */
export interface BonusView {
  requiredPieces: number | null;
  /** Jewelry slot key of a 2-piece bonus; null for equipment and for the set-wide bonus. */
  groupKey?: string | null;
  effects: EffectView[];
}

const sideOf = (targetName: string | null): string => (targetName && /enem/i.test(targetName) ? "enemy" : targetName && /^ali|ally/i.test(targetName) ? "ally" : "self");

/**
 * The lines of a set version for the cumulative rule: the same lines, with the same additive identity, as the search index builds from
 * the database, so a result card and the detail page always agree. Anything with a chance, a duration, a trigger, a condition,
 * alternatives or only source wording is not additive (key null) and is listed as printed.
 */
export function bonusLines(bonuses: BonusView[]): { lines: BonusLine[]; nonAdditive: number } {
  const lines: BonusLine[] = [];
  let nonAdditive = 0;
  for (const b of bonuses) {
    if (b.requiredPieces === null) continue;
    for (const e of b.effects) {
      const conditional = Boolean(e.chancePercent !== null || e.durationTurns !== null || e.triggerText || e.conditionText || e.choiceGroup !== null || e.targetSelector || e.targetCount !== null || e.conditions.length > 0 || e.targetFilters.length > 0);
      const statusKey = e.status?.definition.key ?? null;
      const key = additiveKey({ kind: e.kind, structured: e.structuredStatus === "STRUCTURED", value: e.value, unit: e.valueType, statKey: e.statisticKey, statusKey, side: sideOf(e.targetName), conditional });
      if (key === null) nonAdditive++;
      lines.push({ pieces: b.requiredPieces, group: b.groupKey ?? null, key, value: e.value, unit: e.valueType, label: e.statisticName ?? e.status?.definition.nameEs ?? e.status?.definition.name ?? "", text: e.sourceText ?? e.descriptionEs ?? e.description ?? "" });
    }
  }
  return { lines, nonAdditive };
}

export interface ThresholdTotals {
  pieces: number;
  totals: CumulativeTotal[];
}

/** The totals available at every threshold the set has (2, 4, 6 for equipment; 2 and 8 for jewelry), lowest first. */
export function setTotals(bonuses: BonusView[]): { thresholds: ThresholdTotals[]; nonAdditive: number } {
  const { lines, nonAdditive } = bonusLines(bonuses);
  const pieces = [...new Set(bonuses.map((b) => b.requiredPieces).filter((n): n is number => n !== null))].sort((a, b) => a - b);
  return { thresholds: pieces.map((n) => ({ pieces: n, totals: cumulate(lines, n) })), nonAdditive };
}
