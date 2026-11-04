/**
 * Cumulative set bonuses (rule CONFIRMED by the client): the bonuses of every threshold that is reached ACCUMULATE.
 *   equipment  2 pieces: the 2-piece tier · 4 pieces: 2 + 4 · 6 pieces: 2 + 4 + 6
 *   jewelry    one slot (Force, Chakra, Agility, Power) has its own 2-piece bonus; the complete set (8 pieces) adds the set-wide
 *              8-piece bonus on top of that slot's 2-piece bonus. Slots are never mixed with each other.
 *
 * Only effects that are genuinely additive are summed: structured, numeric, unconditional statistic changes (or immunity chances)
 * with the same statistic, unit, target and direction. Wording-only, conditional, triggered, chance-based, timed or alternative
 * effects stay visible as printed and are never turned into a total. Nothing is invented: a total is a sum of printed values.
 */

export interface AdditiveSource {
  kind: string;
  /** False for effects that exist only as source wording. */
  structured: boolean;
  value: number | null;
  /** FLAT, PERCENT or MULTIPLIER as stored. */
  unit: string | null;
  statKey: string | null;
  statusKey: string | null;
  /** Who receives it: self (default), ally or enemy. */
  side: string | null;
  /** A chance, a duration, a trigger, a condition, a target selection or alternatives make an effect non-additive. */
  conditional: boolean;
}

/**
 * The identity two effects must share to be added: what it changes, in which unit, for whom and in which direction. Null when the
 * effect is not additive. A reduction of the enemy's attack (stored negative, target enemy) is never added to an increase of one's own.
 */
export function additiveKey(e: AdditiveSource): string | null {
  if (!e.structured || e.conditional || e.value === null || e.value === 0 || !e.unit) return null;
  let what: string;
  if (e.kind === "STAT" && e.statKey) what = `stat:${e.statKey}`;
  else if (e.kind === "IMMUNITY" && e.statusKey) what = `immune:${e.statusKey}`;
  else return null;
  const side = e.side === "enemy" ? "enemy" : e.side === "ally" ? "ally" : "self";
  return `${what}|${e.unit}|${side}|${e.value < 0 ? "-" : "+"}`;
}

/** One stored bonus line of a set version. */
export interface BonusLine {
  /** Piece threshold of the bonus it is stored under; null for lines that are not set bonuses (they are never added). */
  pieces: number | null;
  /** Jewelry slot of a 2-piece bonus; null for equipment and for the set-wide bonus. */
  group: string | null;
  key: string | null;
  value: number | null;
  unit: string | null;
  /** Name of what it changes, for the interface. */
  label: string;
  /** The wording as printed. */
  text: string;
}

export interface BonusPart {
  pieces: number;
  group: string | null;
  value: number;
  unit: string;
  text: string;
}

export interface CumulativeTotal {
  key: string;
  label: string;
  unit: string;
  /** Signed sum of the parts. */
  value: number;
  /** The piece count this total is for. */
  pieces: number;
  /** Jewelry slot whose 2-piece bonus is part of the total; null when no slot-specific bonus contributes (equipment, set-wide only). */
  slot: string | null;
  /** The printed bonuses that were added, lowest piece count first. */
  parts: BonusPart[];
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * The totals available with `atPieces` pieces, per additive effect (and per jewelry slot).
 * `slot` limits jewelry to that slot's 2-piece bonuses (the set-wide bonus always counts). Without a slot every slot gets its own total.
 */
export function cumulate(lines: BonusLine[], atPieces: number, slot?: string | null): CumulativeTotal[] {
  const eligible = lines.filter((l): l is BonusLine & { pieces: number; key: string; value: number; unit: string } => l.pieces !== null && l.pieces <= atPieces && l.key !== null && l.value !== null && l.unit !== null);
  const groups = slot ? [slot] : [...new Set(eligible.map((l) => l.group).filter((g): g is string => g !== null))].sort();
  const buckets: (string | null)[] = groups.length > 0 ? groups : [null];
  const out = new Map<string, CumulativeTotal>();
  for (const g of buckets) {
    const mine = eligible.filter((l) => l.group === g || l.group === null);
    const keys = [...new Set(mine.map((l) => l.key))];
    for (const key of keys) {
      const own = mine.filter((l) => l.key === key).sort((a, b) => a.pieces - b.pieces || a.text.localeCompare(b.text));
      const parts: BonusPart[] = own.map((l) => ({ pieces: l.pieces, group: l.group, value: l.value, unit: l.unit, text: l.text }));
      // A slot is named only when its own 2-piece bonus contributes; a total made of the set-wide bonus alone has no slot.
      const named = own.some((l) => l.group !== null) ? g : null;
      const total: CumulativeTotal = { key, label: own[0]!.label, unit: own[0]!.unit, value: round(own.reduce((s, l) => s + l.value, 0)), pieces: atPieces, slot: named, parts };
      out.set(`${key}|${named ?? ""}|${parts.map((p) => `${p.pieces}:${p.value}`).join(",")}`, total);
    }
  }
  return [...out.values()].sort((a, b) => a.label.localeCompare(b.label) || (a.slot ?? "").localeCompare(b.slot ?? ""));
}
