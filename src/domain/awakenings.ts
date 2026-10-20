import { STACKING_RULES, type StackingRule } from "./constants";

/** An awakening stage of a talent or a skill. */
export interface AwakeningRef {
  id: string;
  /** Stage number given by the source; null when it gives none. */
  stage: number | null;
  rule: StackingRule;
  /** The earlier stage this one replaces or cancels, when the source names it. */
  supersedesId: string | null;
}

export interface AwakeningResolution {
  /** Stages whose effects are in force. */
  active: string[];
  /** Stages switched off by a later one. Their effects are NOT in force. */
  superseded: { id: string; byId: string; how: "REPLACED" | "CANCELLED" }[];
  /** Unlocked stages whose relation to the others the source does not state. */
  unknown: string[];
  /** Stages that restate specific base numbers instead of adding new ones. */
  upgrades: string[];
}

/**
 * Which awakening stages are in force once `unlockedStage` is reached.
 *
 *  - A stage that REPLACES or CANCELS an earlier one removes it: the two are never both active.
 *  - A stage whose rule is UNKNOWN is reported under `unknown` and left out of `active`, so no
 *    caller can add its numbers to anything by mistake.
 *  - Nothing here adds values together. Combining numbers is a later, separate decision.
 */
export function resolveAwakenings(stages: AwakeningRef[], unlockedStage: number): AwakeningResolution {
  const unlocked = stages.filter((s) => (s.stage ?? 1) <= unlockedStage);
  const ids = new Set(unlocked.map((s) => s.id));
  const superseded: AwakeningResolution["superseded"] = [];
  for (const s of unlocked) {
    if (!s.supersedesId || !ids.has(s.supersedesId)) continue;
    if (s.rule === STACKING_RULES.REPLACES_PRIOR) superseded.push({ id: s.supersedesId, byId: s.id, how: "REPLACED" });
    if (s.rule === STACKING_RULES.CANCELS_PRIOR) superseded.push({ id: s.supersedesId, byId: s.id, how: "CANCELLED" });
  }
  const off = new Set(superseded.map((s) => s.id));
  const live = unlocked.filter((s) => !off.has(s.id));
  return {
    active: live.filter((s) => s.rule !== STACKING_RULES.UNKNOWN).map((s) => s.id),
    superseded,
    unknown: live.filter((s) => s.rule === STACKING_RULES.UNKNOWN).map((s) => s.id),
    upgrades: live.filter((s) => s.rule === STACKING_RULES.UPGRADES_BASE).map((s) => s.id),
  };
}

/** true when the stages can be shown as one combined list. False while any rule is unknown. */
export function canCombineStages(stages: Pick<AwakeningRef, "rule">[]): boolean {
  return stages.every((s) => s.rule !== STACKING_RULES.UNKNOWN);
}
