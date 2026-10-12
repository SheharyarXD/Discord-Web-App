import { isExclusiveChoice, type TalentGroupView } from "@/domain/talents";
import type { EffectView } from "@/domain/effects";
import type { Translate } from "@/i18n";
import { EffectList } from "./effect-line";

type OptionWithEffects = TalentGroupView["options"][number] & { effects?: EffectView[] };
type GroupWithEffects = Omit<TalentGroupView, "options"> & { options: OptionWithEffects[] };

/**
 * Talent options. A ONE_OF group is drawn as a radio-style list under an explicit
 * "Elige solo uno" heading — options are alternatives, never all simultaneously active.
 *
 * Only `selectedOptionIds` (the VIEWER's own stored pick) marks an option as chosen. Nothing is
 * selected by default: the canonical ninja record offers options, it does not pick one.
 * With `selectAction` each option gets a button so the viewer can store their pick.
 */
export function TalentGroup({
  group,
  selectedOptionIds = [],
  selectAction,
  hiddenFields,
  pendingReview = false,
  t,
}: {
  group: GroupWithEffects;
  selectedOptionIds?: readonly string[];
  selectAction?: (formData: FormData) => Promise<void>;
  /** Extra hidden inputs posted with a pick (e.g. the page to refresh). */
  hiddenFields?: Record<string, string>;
  pendingReview?: boolean;
  t: Translate;
}) {
  const exclusive = isExclusiveChoice(group);
  const selected = new Set(selectedOptionIds);
  const choiceLabel = exclusive
    ? t("talents.chooseOne")
    : group.selectionMode === "ALL"
      ? t("talents.allApply")
      : group.options.length === 1
        ? t("talents.single")
        : t("talents.chooseN", { min: group.minSelections, max: group.maxSelections });
  const hidden = Object.entries({ ...hiddenFields, groupId: group.id });

  return (
    <fieldset className="rounded-xl border border-border p-3 sm:p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        {group.name && <span>{group.name}</span>}
        <span className={"rounded-full px-2 py-0.5 text-xs " + (exclusive ? "bg-accent text-accent-fg" : "border border-border text-muted")}>
          {choiceLabel}
        </span>
      </legend>
      {exclusive && <p className="mb-2 text-xs text-muted">{t("talents.chooseOneHint")}</p>}
      {pendingReview && (
        <p className="mb-2 text-xs text-warn">
          <span aria-hidden>⚠ </span>
          {t("talents.rulesPending")}
        </p>
      )}

      <ul className="flex flex-col gap-2" role={exclusive ? "radiogroup" : "list"} aria-label={choiceLabel}>
        {group.options.map((option) => {
          const isSelected = selected.has(option.id);
          return (
            <li
              key={option.id}
              role={exclusive ? "radio" : "listitem"}
              aria-checked={exclusive ? isSelected : undefined}
              data-selected={isSelected}
              className={"rounded-lg border p-3 " + (isSelected ? "border-accent bg-accent/10" : "border-border bg-surface")}
            >
              <div className="flex items-start gap-3">
                {exclusive && (
                  <span
                    aria-hidden
                    className={"mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 " + (isSelected ? "border-accent" : "border-muted")}
                  >
                    {isSelected && <span className="size-2.5 rounded-full bg-accent" />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{option.name}</span>
                    {exclusive && (
                      <span className={"text-xs " + (isSelected ? "font-semibold text-accent" : "text-muted")}>
                        {isSelected ? t("talents.yourChoice") : selected.size > 0 ? t("talents.notSelected") : t("talents.alternative")}
                      </span>
                    )}
                    {exclusive && selectAction && !isSelected && (
                      <form action={selectAction} className="ml-auto">
                        {hidden.map(([name, value]) => (
                          <input key={name} type="hidden" name={name} value={value} />
                        ))}
                        <input type="hidden" name="optionId" value={option.id} />
                        <button type="submit" className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-surface-2">
                          {t("talents.choose")}
                        </button>
                      </form>
                    )}
                  </div>
                  {option.description && <p className="mt-1 text-sm text-muted">{option.description}</p>}
                  {option.effects && option.effects.length > 0 && (
                    <div className="mt-2">
                      <EffectList effects={option.effects} t={t} />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {exclusive && selectAction && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
          <span>{selected.size === 0 ? t("talents.noneSelected") : t("talents.selectionPrivate")}</span>
          {selected.size > 0 && (
            <form action={selectAction}>
              {hidden.map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <button type="submit" className="min-h-9 rounded-lg px-2 font-semibold underline underline-offset-4 hover:text-fg">
                {t("talents.clear")}
              </button>
            </form>
          )}
        </div>
      )}
    </fieldset>
  );
}
