import {
  effectConditionState,
  formatEffectValue,
  groupConditions,
  signedMagnitude,
  type ConditionState,
  type EffectView,
} from "@/domain/effects";
import type { MessageKey, Translate } from "@/i18n";
import { ConditionBadge } from "./condition-badge";
import { StatBadge } from "./stat-badge";
import { StatusTerm } from "./status-term";

const STATE_LABEL: Record<ConditionState, MessageKey> = {
  UNCONDITIONAL: "effects.unconditional",
  CONDITIONAL: "effects.conditional",
  CONDITIONAL_UNRESOLVED: "effects.conditional",
  NEEDS_REVIEW: "effects.needsReview",
};

/**
 * Renders one effect USAGE. Four things are always shown apart from each other:
 * its strength (value, or the status' numbers resolved for this usage), its chance (only when
 * one is stated), its duration and who receives it.
 *
 * "Siempre activo" appears only when the effect is positively known to be unconditional;
 * anything conditional, text-only or unreviewed is labelled as such and never passes as always-on.
 */
export function EffectLine({ effect, t }: { effect: EffectView; t: Translate }) {
  const state = effectConditionState(effect);
  const restricted = state !== "UNCONDITIONAL";
  const groups = groupConditions(effect.conditions);
  const resolved = effect.status?.resolved;
  const overridden = resolved?.modifiers.some((m) => m.origin === "OVERRIDE") ?? false;

  return (
    <li
      data-conditional={restricted}
      data-condition-state={state}
      className={"relative rounded-lg border p-3 " + (restricted ? "border-warn/40 bg-warn/5" : "border-border bg-surface")}
    >
      <div className="flex flex-wrap items-center gap-2">
        {effect.statisticName && <StatBadge name={effect.statisticName} value={effect.value} valueType={effect.valueType} />}
        {effect.status && (
          <span className="text-sm">
            {t("effects.applies")} <StatusTerm usage={effect.status} />
          </span>
        )}
        {resolved?.modifiers.map((m, i) => (
          <StatBadge key={`${m.statLabel}-${i}`} name={m.statLabel} value={signedMagnitude(m)} valueType={m.valueType} />
        ))}
        {effect.description && <span className="text-sm">{effect.description}</span>}
        <span className="ml-auto text-xs text-muted">
          {restricted && <span aria-hidden>🔒 </span>}
          {t(STATE_LABEL[state])}
        </span>
      </div>

      {overridden && resolved && (
        <p className="mt-1.5 text-xs text-accent">
          {t("effects.originOverride")}
          {resolved.modifiers[0]?.magnitude != null &&
            ` · ${t("effects.replacesDefault", {
              value: formatEffectValue(
                signedMagnitude({ effectiveMagnitude: resolved.modifiers[0].magnitude, direction: resolved.modifiers[0].direction }),
                resolved.modifiers[0].valueType,
              ),
            })}`}
        </p>
      )}

      {(effect.targetName || effect.targetFilters.length > 0 || effect.durationTurns !== null || effect.chancePercent !== null || effect.triggerText) && (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {(effect.targetName || effect.targetFilters.length > 0) && (
            <span>
              {t("effects.target")}: {effect.targetName}
              {effect.targetFilters.length > 0 && (
                <>
                  {effect.targetName ? " · " : ""}
                  {t("effects.onlyFor")} {effect.targetFilters.map((f) => `${f.typeName} «${f.valueName ?? f.note ?? "?"}»`).join(", ")}
                </>
              )}
            </span>
          )}
          {effect.durationTurns !== null && <span>{t("effects.rounds", { turns: effect.durationTurns })}</span>}
          {effect.chancePercent !== null && <span>{t("effects.chance", { percent: effect.chancePercent })}</span>}
          {effect.triggerText && (
            <span>
              {t("effects.trigger")}: {effect.triggerText}
            </span>
          )}
        </p>
      )}

      {(groups.length > 0 || effect.conditionText) && (
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
          {effect.conditionText && (
            <p className="text-xs text-warn">
              <span aria-hidden>🔒 </span>
              <span className="font-semibold">{t("effects.conditionUnresolved")}:</span> {effect.conditionText}
            </p>
          )}
        </div>
      )}

      {effect.sourceText && (
        <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted">
          {t("effects.originalText")}: <q>{effect.sourceText}</q>
        </p>
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
