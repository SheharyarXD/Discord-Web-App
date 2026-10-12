import { TIER_STACKING, type TierStacking } from "./constants";

export interface TierRef {
  id: string;
  requiredPieces: number;
}

/** Tiers whose threshold is reached, lowest first. Says nothing about how they combine. */
export function unlockedTiers<T extends TierRef>(tiers: T[], equippedPieces: number): T[] {
  return tiers.filter((t) => t.requiredPieces <= equippedPieces).sort((a, b) => a.requiredPieces - b.requiredPieces);
}

export type ActiveTiers<T> =
  | { status: "RESOLVED"; tiers: T[] }
  /** Stacking is unconfirmed: the unlocked tiers are listed, but which of them count is unknown. */
  | { status: "STACKING_UNKNOWN"; unlocked: T[] };

/**
 * Which tiers are in effect at a piece count. It never adds numbers together: whether a
 * 6-piece bonus stacks with the 4-piece one is a game rule that must be confirmed per set.
 */
export function activeTiers<T extends TierRef>(tiers: T[], equippedPieces: number, stacking: TierStacking | string): ActiveTiers<T> {
  const unlocked = unlockedTiers(tiers, equippedPieces);
  if (stacking === TIER_STACKING.CUMULATIVE) return { status: "RESOLVED", tiers: unlocked };
  if (stacking === TIER_STACKING.REPLACES) return { status: "RESOLVED", tiers: unlocked.slice(-1) };
  return { status: "STACKING_UNKNOWN", unlocked };
}
