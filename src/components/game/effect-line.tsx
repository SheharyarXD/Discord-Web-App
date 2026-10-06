import { groupConditions, isConditional, type EffectView } from "@/domain/effects";
import type { Translate } from "@/i18n";
import { ConditionBadge } from "./condition-badge";
import { StatBadge } from "./stat-badge";

/**
 * Renders one effect. Unconditional effects show an explicit "Siempre activo" marker;
 * conditional ones show their requirements (OR-alternatives separated by "o") so a
 * conditional effect can never be mistaken for an unconditional one.
 */
export function EffectLine({ effect, t }: { effect: EffectView; t: Translate }) {
  const conditional = isConditional(effect);
  const groups = groupConditions(effect.conditions);

  return (
    <li
      data-conditional={conditional}
      className={
        "rounded-lg border p-3 " + (conditional ? "border-warn/40 bg-warn/5" : "border-border bg-surface")
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        {effect.statisticName && (
          <StatBadge name={effect.statisticName} value={effect.value} valueType={effect.valueType} />
        )}
        {effect.description && <span className="text-sm">{effect.description}</span>}
        <span className="ml-auto text-xs text-muted">
          {conditional ? t("effects.conditional") : t("effects.unconditional")}
        </span>
      </div>

      {(effect.targetName || effect.durationTurns !== null || effect.chancePercent !== null) && (
        <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted">
          {effect.targetName && (
            <span>
              {t("effects.target")}: {effect.targetName}
            </span>
          )}
          {effect.durationTurns !== null && <span>{t("effects.duration", { turns: effect.durationTurns })}</span>}
          {effect.chancePercent !== null && <span>{t("effects.chance", { percent: effect.chancePercent })}</span>}
        </p>
      )}

      {conditional && (
        <div className="mt-2 flex flex-col gap-1.5">
          {groups.map((group, i) => (
            <div key={group[0]?.alternativeGroup ?? i} className="flex flex-col gap-1.5">
              {i > 0 && <span className="text-xs font-semibold uppercase text-muted">{t("effects.anyOf")}</span>}
              <div className="flex flex-wrap gap-1.5">
                {group.map((c) => (
                  <ConditionBadge key={c.id} condition={c} t={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}

export function EffectList({ effects, t }: { effects: EffectView[]; t: Translate }) {
  if (effects.length === 0) return <p className="text-sm text-muted">{t("effects.noEffects")}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {effects.map((e) => (
        <EffectLine key={e.id} effect={e} t={t} />
      ))}
    </ul>
  );
}
