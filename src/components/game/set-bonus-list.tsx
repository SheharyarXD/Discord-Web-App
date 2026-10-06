import type { EffectView } from "@/domain/effects";
import type { Translate } from "@/i18n";
import { EffectList } from "./effect-line";

export interface SetBonusView {
  id: string;
  /** Piece threshold, or null when the bonus is defined by specific items. */
  requiredPieces: number | null;
  /** Names of specific required items (jewelry SPECIFIC_ITEMS bonuses). */
  requiredItemNames?: string[];
  description: string | null;
  effects: EffectView[];
}

/** Set bonuses for any threshold (2/4/6 or otherwise) and for item-specific requirements. */
export function SetBonusList({ bonuses, t }: { bonuses: SetBonusView[]; t: Translate }) {
  if (bonuses.length === 0) return <p className="text-sm text-muted">{t("sets.noBonuses")}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {bonuses.map((b) => (
        <li key={b.id} className="rounded-xl border border-border p-3">
          <p className="mb-2 text-sm font-semibold">
            {b.requiredPieces !== null ? (
              <span className="rounded-md bg-surface-2 px-2 py-0.5">{t("sets.pieces", { count: b.requiredPieces })}</span>
            ) : (
              <span className="rounded-md bg-surface-2 px-2 py-0.5">
                {t("sets.specificItems")}: {b.requiredItemNames?.join(", ")}
              </span>
            )}
          </p>
          {b.description && <p className="mb-2 text-sm text-muted">{b.description}</p>}
          <EffectList effects={b.effects} t={t} />
        </li>
      ))}
    </ul>
  );
}
