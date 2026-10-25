import { STACKING_RULES, type StackingRule } from "./constants";

/** The client's general rule (confirmed for Milestone 4): each new awakening replaces the previous one; their effects are not added. */
export const CLIENT_AWAKENING_RULE_TEXT = "Client decision (25 October 2026): each new awakening replaces the previous awakening of the same talent or skill; the effects of the stages are not added together.";

/**
 * Applies the client's general rule to the stages of ONE talent or skill. A stage with no rule of its own
 * and an earlier numbered stage replaces that earlier stage. Stages that carry an explicit rule (from the
 * source or from a specific client decision) are never touched, and nothing is guessed for an unnumbered stage.
 */
export function withClientReplacement<T extends { stage?: number | null; stackingRule?: StackingRule; supersedesStage?: number | null; ruleSourceText?: string | null }>(list: T[]): T[] {
  return list.map((w) => {
    if (w.stage == null || (w.stackingRule ?? "UNKNOWN") !== "UNKNOWN") return w;
    const earlier = list.map((x) => x.stage).filter((n): n is number => n != null && n < w.stage!);
    if (earlier.length === 0) return w;
    return { ...w, stackingRule: STACKING_RULES.REPLACES_PRIOR, supersedesStage: Math.max(...earlier), ruleSourceText: CLIENT_AWAKENING_RULE_TEXT };
  });
}

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
