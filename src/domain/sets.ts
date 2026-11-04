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
 * Which tiers are in effect at a piece count according to a STORED stacking value. The client has since confirmed that the bonuses of
 * every unlocked threshold accumulate, for all equipment and jewelry sets: the website applies that rule (see `cumulative.ts`) and no
 * longer consults the stored value, which only remains as data. This function adds no numbers.
 */
export function activeTiers<T extends TierRef>(tiers: T[], equippedPieces: number, stacking: TierStacking | string): ActiveTiers<T> {
  const unlocked = unlockedTiers(tiers, equippedPieces);
  if (stacking === TIER_STACKING.CUMULATIVE) return { status: "RESOLVED", tiers: unlocked };
  if (stacking === TIER_STACKING.REPLACES) return { status: "RESOLVED", tiers: unlocked.slice(-1) };
  return { status: "STACKING_UNKNOWN", unlocked };
}
