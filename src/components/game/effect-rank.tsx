import type { Translate } from "@/i18n";
import { describeMeasure, type EffectRank, type EffectValueUse } from "@/game/effect-search";
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

const where = (u: EffectValueUse, t: Translate, statName: (key: string) => string) =>
  [u.pieces ? t("gear.evidencePieces", { count: u.pieces }) : null, u.group ? statName(u.group) : null].filter(Boolean).join(" · ");

/**
 * The printed values that decided the position of one result, each at its own tier or category. They are never added together:
 * whether tiers accumulate is not confirmed. A result that cannot be compared says why instead of showing an invented value.
 */
export function EffectRankBlock({ rank, effect, t, statName }: { rank: EffectRank; effect: string; t: Translate; statName: (key: string) => string }) {
  if (rank.status === "ranked" || rank.status === "other-measure") {
    return (
      <div className="mt-3 border-t border-border pt-2 text-xs" data-effect-rank data-rank-status={rank.status} data-rank-value={rank.best?.value} data-rank-magnitude={rank.magnitude ?? undefined}>
        <p className="font-semibold">{t("gear.rankTitle", { effect })}</p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {rank.uses.map((u, i) => (
            <li key={i}>
              <Tag tone={u === rank.best ? "info" : "muted"} title={u.text}>
                {where(u, t, statName) || t("gear.evidenceNoTier")}: {formatUse(u)}
              </Tag>
            </li>
          ))}
        </ul>
        {rank.status === "other-measure" && rank.measure && <p className="mt-1.5 text-warn">{t("gear.rankOther", { measure: measureWords(rank.measure, t) })}</p>}
        {rank.uses.length > 1 && <p className="mt-1.5 text-muted">{t("gear.rankNoSum")}</p>}
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
