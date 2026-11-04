import type { Translate } from "@/i18n";
import { describeMeasure, type EffectRank, type EffectTotal, type EffectValueUse, type FullSetInfo } from "@/game/effect-search";
import { Tag } from "@/components/ui/primitives";

const number = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

/** «+40%», «-20%», «+25.000»: the stored value with its sign, in its unit. */
export function formatUse(u: { value: number; unit: string }): string {
  const sign = u.value > 0 ? "+" : u.value < 0 ? "-" : "";
  const n = number.format(Math.abs(u.value));
  return `${sign}${n}${u.unit === "PERCENT" ? "%" : u.unit === "MULTIPLIER" ? "×" : ""}`;
}

function measureWords(measure: string, t: Translate): string {
  const { direction, unit } = describeMeasure(measure);
  const dir = t(`gear.measureDirection.${direction}` as never) as string;
  const u = t(`gear.measureUnit.${unit}` as never) as string;
  return `${dir}, ${u}`;
}

const where = (u: { pieces: number | null; group: string | null }, t: Translate, statName: (key: string) => string) =>
  [u.pieces ? t("gear.evidencePieces", { count: u.pieces }) : null, u.group ? statName(u.group) : null].filter(Boolean).join(" · ");

/** «2 piezas», or «2 piezas · Agilidad» for the 2-piece bonus of a jewelry slot. */
const piecesLabel = (u: { pieces: number | null; group: string | null }, t: Translate, statName: (key: string) => string) =>
  [u.pieces ? t("gear.tierPieces", { count: u.pieces }) : t("gear.evidenceNoTier"), u.group ? statName(u.group) : null].filter(Boolean).join(" · ");

/** «Total acumulado con 6 piezas», with the jewelry slot when one 2-piece bonus is part of it. */
export const totalLabel = (total: Pick<EffectTotal, "pieces" | "slot">, t: Translate, statName: (key: string) => string) =>
  [t("gear.totalWith", { count: total.pieces ?? 0 }), total.slot ? statName(total.slot) : null].filter(Boolean).join(" · ");

/** The printed bonuses that were added, each at its own piece count, and their sum. */
export function BreakdownList({ total, t, statName }: { total: Pick<EffectTotal, "parts" | "value" | "unit">; t: Translate; statName: (key: string) => string }) {
  return (
    <div data-breakdown>
      <p className="mt-1.5 text-muted">{t("sets.breakdown")}</p>
      <ul className="mt-1 flex flex-wrap items-center gap-1.5">
        {total.parts.map((u, i) => (
          <li key={i} className="inline-flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-muted">+</span>}
            <Tag tone="info" title={u.text}>
              {piecesLabel(u, t, statName)}: {formatUse(u)}
            </Tag>
          </li>
        ))}
        {total.parts.length > 1 && (
          <li className="font-semibold">
            <span aria-hidden>= </span>
            {formatUse(total)}
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * The value that decided the position of one result. Set bonuses accumulate (confirmed): the TOTAL available with the selected piece
 * count (or the complete set) is shown large, with the breakdown of printed bonuses it adds. A result that cannot be compared says why
 * instead of showing an invented value. Ninjas have no piece counts, so they show the printed value as it is.
 */
export function EffectRankBlock({ rank, effect, t, statName }: { rank: EffectRank; effect: string; t: Translate; statName: (key: string) => string }) {
  if ((rank.status === "ranked" || rank.status === "other-measure") && rank.total) {
    const total = rank.total;
    const gear = total.pieces !== null;
    return (
      <div className="mt-3 border-t border-border pt-2 text-xs" data-effect-rank data-rank-status={rank.status} data-rank-value={total.value} data-rank-magnitude={rank.magnitude ?? undefined} data-rank-parts={total.parts.length}>
        <p className="font-semibold">{t("gear.rankTitle", { effect })}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2" data-match-value>
          <span className="text-muted">{gear ? totalLabel(total, t, statName) : where(total.parts[0]!, t, statName) || t("gear.evidenceNoTier")}:</span>
          <span className="text-2xl font-bold leading-none text-accent">{formatUse(total)}</span>
        </p>
        {gear ? (
          <BreakdownList total={total} t={t} statName={statName} />
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {rank.uses.map((u: EffectValueUse, i: number) => (
              <li key={i}>
                <Tag tone="muted" title={u.text}>
                  {where(u, t, statName) || t("gear.evidenceNoTier")}: {formatUse(u)}
                </Tag>
              </li>
            ))}
          </ul>
        )}
        {rank.status === "other-measure" && rank.measure && <p className="mt-1.5 text-warn">{t("gear.rankOther", { measure: measureWords(rank.measure, t) })}</p>}
      </div>
    );
  }
  return (
    <p className="mt-3 border-t border-border pt-2 text-xs text-muted" data-effect-rank data-rank-status={rank.status}>
      {t(rank.status === "text-only" ? "gear.rankText" : rank.status === "no-value" ? "gear.rankNoValue" : "gear.rankNoMatch")}
    </p>
  );
}

/** One short note above the results that says what the order means. */
export function EffectRankNote({ effect, direction, t }: { effect: string; direction: "asc" | "desc"; t: Translate }) {
  return (
    <div className="mb-4 rounded-lg border border-border p-3 text-xs text-muted" data-effect-rank-note>
      <p className="font-semibold text-fg">{t(direction === "desc" ? "gear.rankNoteDesc" : "gear.rankNoteAsc", { effect })}</p>
      <p className="mt-1">{t("gear.rankRule")}</p>
    </div>
  );
}

/**
 * Under a jewelry result that has a set-wide bonus: the 8-piece bonus of the SAME version, as printed. With fewer pieces selected, when
 * the same additive effect is printed there, the total with the complete set is shown (the slot's 2-piece bonus plus the 8-piece one)
 * and a note says it is higher. The 8-piece bonus needs all eight pieces, not only the two used for this search.
 */
export function FullSetBlock({ info, effect, t, statName }: { info: FullSetInfo; effect: string; t: Translate; statName: (key: string) => string }) {
  const c = info.comparison;
  return (
    <div className="mt-3 border-t border-border pt-2 text-xs" data-full-set data-full-set-status={c.status}>
      <p className="font-semibold">{t("gear.fullTitle")}</p>
      <p className="mt-0.5 text-muted">{t("gear.fullNeeds")}</p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {info.effects.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
      {c.status === "stronger" && c.matching && c.fullSet && (
        <div className="mt-2 rounded-lg border border-border p-2" data-full-set-compare>
          <p>
            <span className="font-semibold">{totalLabel(c.matching, t, statName)}:</span> {effect} {formatUse(c.matching)}
          </p>
          <p>
            <span className="font-semibold">{totalLabel(c.fullSet, t, statName)}:</span> {effect} {formatUse(c.fullSet)}
          </p>
          <BreakdownList total={c.fullSet} t={t} statName={statName} />
          <p className="mt-1.5 font-semibold text-accent" data-full-set-stronger>
            {t("gear.fullStronger")}
          </p>
        </div>
      )}
      {c.status === "included" && <p className="mt-1.5 text-muted">{t("gear.fullIncluded")}</p>}
      {c.status === "unrelated" && <p className="mt-1.5 text-muted">{t("gear.fullUnrelated")}</p>}
    </div>
  );
}
