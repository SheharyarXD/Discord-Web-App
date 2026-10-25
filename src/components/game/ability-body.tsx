import { abilityNoteCodes } from "@/domain/ability-text";
import { resolveAwakenings } from "@/domain/awakenings";
import type { ReviewStatus, StackingRule } from "@/domain/constants";
import type { EffectView } from "@/domain/effects";
import type { Translate } from "@/i18n";
import { EffectList } from "./effect-line";
import { ReviewBadge } from "./review-badge";

export interface AbilityBodyData {
  name: string;
  cardLabel: string | null;
  cardLabelCut: boolean;
  note: string | null;
  description: string | null;
  descriptionEs: string | null;
  effects: EffectView[];
  conditionText?: string | null;
}

export interface AwakeningData extends AbilityBodyData {
  id: string;
  stage: number | null;
  reviewStatus: ReviewStatus;
  stackingRule: StackingRule;
  supersedesId: string | null;
  ruleSourceText: string | null;
}

/**
 * What is stored for one talent, skill or awakening below its name: the name on the card when it
 * differs, review notes, and the effects line by line. Nothing is shown that the source does not give.
 */
export function AbilityBody({ ability, t, emptyHint = true }: { ability: AbilityBodyData; t: Translate; emptyHint?: boolean }) {
  const notes = abilityNoteCodes(ability.note);
  const unpaired = notes.includes("ES_LINE_COUNT_DIFFERS") && ability.descriptionEs;
  return (
    <div className="flex flex-col gap-2">
      {ability.cardLabel && ability.cardLabel !== ability.name && (
        <p className="text-xs text-muted">{t(ability.cardLabelCut ? "ability.onCardCut" : "ability.onCard", { label: ability.cardLabel })}</p>
      )}
      {ability.conditionText && (
        <p className="text-xs text-warn">
          <span aria-hidden>🔒 </span>
          <span className="font-semibold">{t("ability.condition")}:</span> <span lang="en">«{ability.conditionText}»</span>
        </p>
      )}
      {notes.map((code) => (
        <p key={code} className="text-xs text-warn">
          <span aria-hidden>⚠ </span>
          {t(`ability.note.${code}`)}
        </p>
      ))}
      {unpaired && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-muted">{t("ability.esUnpaired")}</summary>
          <p className="mt-1 whitespace-pre-line">{ability.descriptionEs}</p>
        </details>
      )}
      {ability.effects.length > 0 ? (
        <EffectList effects={ability.effects} t={t} />
      ) : ability.description ? (
        <p className="whitespace-pre-line text-sm text-muted">{ability.description}</p>
      ) : (
        emptyHint && <p className="text-sm text-muted">{t("ability.noText")}</p>
      )}
    </div>
  );
}

/**
 * Awakening stages of one talent or skill, each in its own block. A stage that the source says
 * replaces or cancels an earlier one says so on both; where the source says nothing, that is stated
 * too, so stages are never read as a running total.
 */
export function AwakeningList({ awakenings, t }: { awakenings: AwakeningData[]; t: Translate }) {
  if (awakenings.length === 0) return null;
  const stageOf = new Map(awakenings.map((a) => [a.id, a.stage]));
  const { superseded } = resolveAwakenings(
    awakenings.map((a) => ({ id: a.id, stage: a.stage, rule: a.stackingRule, supersedesId: a.supersedesId })),
    Number.MAX_SAFE_INTEGER,
  );
  return (
    <div className="mt-4 flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t("awakening.title")}</p>
      {awakenings.map((a) => {
        const replaced = superseded.find((s) => s.id === a.id);
        const priorStage = a.supersedesId ? stageOf.get(a.supersedesId) : null;
        const rule = a.stackingRule === "NOT_APPLICABLE" ? null : t(`awakening.rule.${a.stackingRule}`, { stage: priorStage ?? "?" });
        return (
          <section key={a.id} data-awakening-stage={a.stage ?? ""} data-stacking-rule={a.stackingRule} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">
                {a.stage !== null && <span className="text-accent">{t("awakening.stage", { stage: a.stage })} · </span>}
                {a.name}
              </h4>
              <ReviewBadge status={a.reviewStatus} t={t} />
            </div>
            {rule && (
              <p className={"mt-1 text-xs " + (a.stackingRule === "UNKNOWN" ? "text-warn" : "text-accent")}>
                {a.stackingRule === "UNKNOWN" && <span aria-hidden>⚠ </span>}
                {rule}
                {a.ruleSourceText && (
                  <span className="text-muted">
                    {" "}
                    {a.ruleSourceText.startsWith("Client decision") ? t("awakening.clientRule") : <>{t("awakening.ruleSource")}: <q lang="en">{a.ruleSourceText}</q></>}
                  </span>
                )}
              </p>
            )}
            {replaced && (
              <p className="mt-1 text-xs text-warn" data-superseded>
                <span aria-hidden>⊘ </span>
                {t("awakening.supersededBy", { stage: stageOf.get(replaced.byId) ?? "?" })}
              </p>
            )}
            <div className="mt-2">
              <AbilityBody ability={a} t={t} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
