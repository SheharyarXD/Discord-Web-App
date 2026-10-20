import { effectNoteCodes, VALUE_NOTE_DECREASE, VALUE_NOTE_INCREASE } from "@/domain/ability-text";
import { TARGET_SELECTORS, type TargetSelector } from "@/domain/constants";
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
  TRIGGERED: "effects.triggered",
  NEEDS_REVIEW: "effects.needsReview",
  TEXT_ONLY: "effects.textOnly",
};

const percent = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });
const isSelector = (s: string | null): s is TargetSelector => s !== null && s in TARGET_SELECTORS;

/** What the row does: the part that differs by kind of effect. */
function What({ effect, t }: { effect: EffectView; t: Translate }) {
  const resolved = effect.status?.resolved;
  const valueNote =
    effect.valueNote === VALUE_NOTE_INCREASE
      ? t("effects.increaseNoValue")
      : effect.valueNote === VALUE_NOTE_DECREASE
        ? t("effects.decreaseNoValue")
        : effect.valueNote
          ? `«${effect.valueNote}»`
          : null;
  const label = (key: "ATTACK" | "HEAL" | "DISPEL" | "IMMUNITY") => <span className="text-sm font-medium">{t(`effects.kind.${key}`)}</span>;

  return (
    <>
      {effect.kind === "ATTACK" && label("ATTACK")}
      {effect.kind === "HEAL" && label("HEAL")}
      {effect.kind === "IMMUNITY" && label("IMMUNITY")}
      {effect.kind === "DISPEL" && (
        <span className="text-sm">
          {label("DISPEL")} {effect.description === "buffs" || effect.description === "debuffs" ? t(`effects.dispel.${effect.description}`) : effect.description}
        </span>
      )}

      {effect.statisticName && <StatBadge name={effect.statisticName} value={effect.value} valueType={effect.valueType} />}
      {effect.replacesValue !== null && <span className="text-xs text-muted">{t("effects.was", { value: formatEffectValue(effect.replacesValue, effect.valueType) })}</span>}

      {effect.status && (
        <span className="text-sm">
          {effect.kind !== "IMMUNITY" && `${t("effects.applies")} `}
          <StatusTerm usage={effect.status} />
        </span>
      )}
      {effect.kind !== "IMMUNITY" &&
        resolved?.modifiers.map((m, i) => <StatBadge key={`${m.statLabel}-${i}`} name={m.statLabel} value={signedMagnitude(m)} valueType={m.valueType} />)}

      {effect.kind === "IMMUNITY" && !effect.status && !effect.statisticName && (
        <span className="text-sm">
          {effect.value !== null && <span className="font-semibold tabular-nums">{percent.format(effect.value)}% </span>}
          {effect.description && <span lang="en">«{effect.description}»</span>}
        </span>
      )}
      {effect.kind === "TEXT" && effect.description && (
        <span className="text-sm italic" lang="en">
          «{effect.description}»
        </span>
      )}

      {effect.rateValue !== null && effect.rateKind && (
        <span className="rounded-md bg-surface-2 px-2.5 py-1 text-sm" title={effect.rateKind === "GROWTH" ? undefined : t("effects.rateHint")}>
          {t(`effects.rate.${effect.rateKind}`, { value: percent.format(effect.rateValue) })}
        </span>
      )}
      {valueNote && <span className="text-xs text-muted">{valueNote}</span>}
    </>
  );
}

/**
 * Renders one effect USAGE. These are always shown apart from each other: its strength (value,
 * or the status' numbers resolved for this usage), a stated rate, its chance (only when the
 * source says "chance"), its duration and who receives it.
 *
 * "Siempre activo" appears only when the effect is positively known to be unconditional;
 * anything conditional, triggered, text-only or unreviewed is labelled as such.
 */
export function EffectLine({ effect, t, showSource = true }: { effect: EffectView; t: Translate; showSource?: boolean }) {
  const state = effectConditionState(effect);
  const restricted = state !== "UNCONDITIONAL";
  const groups = groupConditions(effect.conditions);
  const resolved = effect.status?.resolved;
  const overridden = resolved?.modifiers.some((m) => m.origin === "OVERRIDE") ?? false;
  const ownStrength = effect.status?.magnitudeOverride ?? null;
  const notes = effectNoteCodes(effect.note);
  const who = [
    effect.targetName,
    effect.targetCount !== null && !effect.targetSelector ? String(effect.targetCount) : null,
    isSelector(effect.targetSelector) ? `${effect.targetCount !== null && effect.targetCount > 1 ? `${effect.targetCount} ` : ""}${t(`effects.selector.${effect.targetSelector}`)}` : effect.targetSelector,
    effect.excludesSelf ? t("effects.exceptSelf") : null,
  ].filter(Boolean);
  const hasTarget = who.length > 0 || effect.targetFilters.length > 0 || Boolean(effect.targetText);

  return (
    <li
      data-conditional={restricted}
      data-condition-state={state}
      data-effect-kind={effect.kind}
      className={"relative rounded-lg border p-3 " + (restricted ? "border-warn/40 bg-warn/5" : "border-border bg-surface")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <What effect={effect} t={t} />
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
      {!overridden && ownStrength !== null && (
        <p className="mt-1.5 text-xs text-accent" data-own-strength>
          {t("effects.ownStrength", { value: percent.format(ownStrength) })}
        </p>
      )}

      {(hasTarget || effect.durationTurns !== null || effect.chancePercent !== null || effect.triggerText) && (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {hasTarget && (
            <span>
              {t("effects.target")}: {who.join(" · ")}
              {effect.targetFilters.length > 0 && (
                <>
                  {who.length > 0 ? " · " : ""}
                  {t("effects.onlyFor")} {effect.targetFilters.map((f) => `${f.typeName} «${f.valueName ?? f.note ?? "?"}»`).join(` ${t("effects.anyOf")} `)}
                </>
              )}
              {effect.targetText && <span lang="en"> · «{effect.targetText}»</span>}
            </span>
          )}
          {effect.durationTurns !== null && <span>{t("effects.rounds", { turns: effect.durationTurns })}</span>}
          {effect.chancePercent !== null && <span data-chance>{t("effects.chance", { percent: effect.chancePercent })}</span>}
          {effect.triggerText && (
            <span>
              {t("effects.trigger")}: <span lang="en">«{effect.triggerText}»</span>
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

      {notes.map((code) => (
        <p key={code} className="mt-1.5 text-xs text-warn">
          <span aria-hidden>⚠ </span>
          {t(`effects.note.${code}`)}
        </p>
      ))}

      {showSource && effect.sourceText && (
        <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted">
          {t("effects.originalText")}: <q lang="en">{effect.sourceText}</q>
        </p>
      )}
    </li>
  );
}

function LineText({ first, t }: { first: EffectView; t: Translate }) {
  const spanish = first.translationStatus !== "MISSING" ? first.descriptionEs : null;
  if (first.sourceLine === null) return null;
  return spanish ? (
    <>
      <p className="text-sm">{spanish}</p>
      <p className="text-xs text-muted">
        {t("effects.lineOriginal")}: <q lang="en">{first.sourceText}</q>
      </p>
    </>
  ) : (
    <p className="text-sm">
      <span lang="en">{first.sourceText}</span>
      <span className="ml-2 whitespace-nowrap text-xs text-muted">· {t("translation.sourceTextShort")}</span>
    </p>
  );
}

type Item = { kind: "line"; key: string; rows: EffectView[] } | { kind: "choice"; key: string; group: number; rows: EffectView[] };

/** Rows in source order: plain lines, and one box per group of alternatives (which may span several source lines). */
function toItems(effects: EffectView[]): Item[] {
  const items: Item[] = [];
  const lineAt = new Map<string, Extract<Item, { kind: "line" }>>();
  const groupAt = new Map<number, Extract<Item, { kind: "choice" }>>();
  for (const e of effects) {
    if (e.choiceGroup !== null) {
      let item = groupAt.get(e.choiceGroup);
      if (!item) {
        item = { kind: "choice", key: `choice-${e.choiceGroup}`, group: e.choiceGroup, rows: [] };
        groupAt.set(e.choiceGroup, item);
        items.push(item);
      }
      item.rows.push(e);
      continue;
    }
    const key = e.sourceLine === null ? `single:${e.id}` : `line:${e.sourceLine}`;
    let item = lineAt.get(key);
    if (!item) {
      item = { kind: "line", key, rows: [] };
      lineAt.set(key, item);
      items.push(item);
    }
    item.rows.push(e);
  }
  return items;
}

/** One box of alternatives. Nothing in it is chosen by default and the options are never added together. */
function ChoiceBox({ group, rows, t }: { group: number; rows: EffectView[]; t: Translate }) {
  const options = new Map<string, EffectView[]>();
  for (const e of rows) options.set(e.choiceLabel ?? "", [...(options.get(e.choiceLabel ?? "") ?? []), e]);
  const oneLine = new Set(rows.map((r) => r.sourceLine)).size === 1;
  return (
    <div data-choice-group={group} className="rounded-lg border border-accent/50 p-2">
      <p className="mb-2 text-xs font-semibold text-accent">{t("effects.oneOf")}</p>
      {oneLine && (
        <div className="mb-2 flex flex-col gap-1">
          <LineText first={rows[0]!} t={t} />
        </div>
      )}
      <div className="flex flex-col gap-2">
        {[...options.entries()].map(([label, list], i) => (
          <div key={label || i} className="rounded-md border border-border/70 p-2">
            {label && (
              <p className="mb-1 text-sm font-semibold" lang={/^Option \d+$/.test(label) ? undefined : "en"}>
                {/^Option (\d+)$/.test(label) ? t("effects.option", { n: label.replace("Option ", "") }) : label}
              </p>
            )}
            {oneLine ? (
              <ul className="flex flex-col gap-2">
                {list.map((e) => (
                  <EffectLine key={e.id} effect={e} t={t} showSource={false} />
                ))}
              </ul>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map((e) => (
                  <div key={e.id} className="flex flex-col gap-2">
                    <LineText first={e} t={t} />
                    <ul>
                      <EffectLine effect={e} t={t} showSource={false} />
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Effects of one owner, grouped by the source line they were read from. Each line shows the
 * supplied Spanish text when there is one, always next to the English original. Alternatives
 * are boxed together so they never read as a sum.
 */
export function EffectList({ effects, t }: { effects: EffectView[]; t: Translate }) {
  if (effects.length === 0) return <p className="text-sm text-muted">{t("effects.noEffects")}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {toItems(effects).map((item) => {
        if (item.kind === "choice") {
          return (
            <li key={item.key}>
              <ChoiceBox group={item.group} rows={item.rows} t={t} />
            </li>
          );
        }
        const first = item.rows[0]!;
        if (first.sourceLine === null) return <EffectLine key={first.id} effect={first} t={t} />;
        return (
          <li key={item.key} data-source-line={first.sourceLine} className="flex flex-col gap-2 border-l-2 border-border pl-3">
            <LineText first={first} t={t} />
            <ul className="flex flex-col gap-2">
              {item.rows.map((e) => (
                <EffectLine key={e.id} effect={e} t={t} showSource={false} />
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
