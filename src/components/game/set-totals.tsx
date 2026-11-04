import type { Translate } from "@/i18n";
import { setTotals, type BonusView } from "@/domain/set-totals";
import { Tag } from "@/components/ui/primitives";
import { BreakdownList, formatUse } from "./effect-rank";

const SLOTS = ["force", "chakra", "agility", "power"] as const;

/**
 * «Total acumulado»: the bonuses of every unlocked threshold are added (confirmed by the client), per threshold the set has.
 * Each total lists the printed bonuses it is made of («Desglose por piezas»). Jewelry keeps each slot apart and the complete set
 * adds the 8-piece bonus to the slot's 2-piece bonus. The same rule produces the totals on the result cards.
 */
export function SetTotals({ bonuses, t, groupNames }: { bonuses: BonusView[]; t: Translate; groupNames?: Record<string, string> }) {
  const { thresholds, nonAdditive } = setTotals(bonuses);
  const slotName = (key: string) => ((SLOTS as readonly string[]).includes(key) ? t(`gear.slot.${key as (typeof SLOTS)[number]}`) : (groupNames?.[key] ?? key));
  const shown = thresholds.filter((x) => x.totals.length > 0);
  return (
    <div className="flex flex-col gap-3" data-set-totals>
      <p className="text-xs text-muted">{t("sets.totalNote")}</p>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{t("sets.totalNone")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((th) => (
            <li key={th.pieces} className="rounded-xl border border-border p-3" data-total-threshold={th.pieces}>
              <p className="mb-2 text-sm font-semibold">
                <span className="rounded-md bg-surface-2 px-2 py-0.5">{t("sets.totalWith", { count: th.pieces })}</span>
              </p>
              <ul className="flex flex-col gap-3 text-sm">
                {th.totals.map((x) => (
                  <li key={`${x.key}|${x.slot ?? ""}`} data-set-total data-total-key={x.key} data-total-pieces={x.pieces} data-total-value={x.value} data-total-slot={x.slot ?? ""} data-total-parts={x.parts.length}>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{x.label}</span>
                      {x.slot && <Tag tone="muted">{slotName(x.slot)}</Tag>}
                      <span className="text-lg font-bold text-accent">{formatUse(x)}</span>
                    </p>
                    <div className="text-xs">
                      <BreakdownList total={x} t={t} statName={slotName} />
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {nonAdditive > 0 && <p className="text-xs text-muted">{t("sets.totalNonAdditive")}</p>}
    </div>
  );
}
