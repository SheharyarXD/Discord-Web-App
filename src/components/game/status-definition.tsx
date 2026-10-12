import { formatEffectValue, signedMagnitude, type ResolvedEffectUsage, type StatusDefinitionView } from "@/domain/effects";
import { localize } from "@/domain/localize";
import type { Translate } from "@/i18n";
import { Tag } from "@/components/ui/primitives";

/** Independent classification facets of a status, each as its own labelled tag. */
export function StatusFacets({ definition, t }: { definition: StatusDefinitionView; t: Translate }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {definition.kind === "TERM" ? (
        <Tag>{t("glossary.kindTerm")}</Tag>
      ) : (
        <>
          <Tag tone={definition.polarity === "BUFF" ? "ok" : definition.polarity === "DEBUFF" ? "danger" : "muted"}>
            {t(`glossary.polarity.${definition.polarity}`)}
          </Tag>
          <Tag tone="muted">{t(`glossary.cleansability.${definition.cleansability}`)}</Tag>
        </>
      )}
      {definition.categories.map((c) => (
        <Tag key={c.key} tone="info">
          {c.nameEs ?? c.name}
        </Tag>
      ))}
    </span>
  );
}

/**
 * What a status does. With `resolved` it shows the numbers of ONE usage and says, per
 * component, whether the number is that usage's own or the dictionary default — a tooltip
 * built from this can never show an unconditional copy of the default by mistake.
 */
export function StatusDefinitionBody({
  definition,
  resolved,
  t,
}: {
  definition: StatusDefinitionView;
  resolved?: ResolvedEffectUsage;
  t: Translate;
}) {
  const description = localize(definition.description, definition.descriptionEs, definition.translationStatus);
  const components = resolved?.modifiers ?? definition.modifiers.map((m) => ({ ...m, effectiveMagnitude: m.magnitude, origin: m.magnitude === null ? ("UNSPECIFIED" as const) : ("DEFAULT" as const) }));

  return (
    <span className="flex flex-col gap-2">
      <StatusFacets definition={definition} t={t} />
      {description.text ? (
        <span className="block text-sm">
          {description.text}
          {description.isSourceFallback && (
            <span className="ml-2 whitespace-nowrap text-xs text-muted" title={t("translation.sourceText")}>
              · {t("translation.sourceTextShort")}
            </span>
          )}
          {description.isDraft && <span className="ml-2 text-xs text-warn">· {t("translation.draft")}</span>}
        </span>
      ) : (
        <span className="block text-sm text-muted">{t("glossary.noDefinition")}</span>
      )}

      {components.length > 0 && (
        <span className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {resolved ? t("effects.effects") : t("glossary.defaults")}
          </span>
          {components.map((m, i) => {
            const value = signedMagnitude(m);
            return (
              <span key={`${m.statLabel}-${i}`} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-muted">{m.statLabel}</span>
                <span className="font-semibold tabular-nums">
                  {value === null ? t("effects.noMagnitude") : formatEffectValue(value, m.valueType)}
                </span>
                {resolved && m.origin === "OVERRIDE" && (
                  <span className="text-xs text-accent">
                    {t("effects.originOverride")}
                    {m.magnitude !== null &&
                      ` (${t("effects.replacesDefault", { value: formatEffectValue(signedMagnitude({ effectiveMagnitude: m.magnitude, direction: m.direction }), m.valueType) })})`}
                  </span>
                )}
                {resolved && m.origin === "DEFAULT" && <span className="text-xs text-muted">{t("effects.originDefault")}</span>}
                {m.origin === "UNSPECIFIED" && <span className="text-xs text-muted">{t("effects.originUnspecified")}</span>}
                {m.note && <span className="text-xs text-muted">({m.note})</span>}
              </span>
            );
          })}
        </span>
      )}

      {resolved && (resolved.durationRounds !== null || resolved.chancePercent !== null) && (
        <span className="flex flex-wrap gap-x-3 text-xs text-muted">
          {resolved.durationRounds !== null && <span>{t("effects.rounds", { turns: resolved.durationRounds })}</span>}
          {resolved.chancePercent !== null && <span>{t("effects.chance", { percent: resolved.chancePercent })}</span>}
        </span>
      )}
      {!resolved && definition.overrideDocumented && <span className="block text-xs text-accent">{t("glossary.overrideDocumented")}</span>}
      {definition.timingNote && (
        <span className="block text-xs text-muted">
          {t("glossary.timing")}: {definition.timingNote}
        </span>
      )}
      {definition.cleansabilityNote && (
        <span className="block text-xs text-muted">
          {t("glossary.exception")}: {definition.cleansabilityNote}
        </span>
      )}
    </span>
  );
}
