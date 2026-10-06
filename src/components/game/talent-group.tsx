import { isExclusiveChoice, type TalentGroupView } from "@/domain/talents";
import type { EffectView } from "@/domain/effects";
import type { Translate } from "@/i18n";
import { EffectList } from "./effect-line";

type OptionWithEffects = TalentGroupView["options"][number] & { effects?: EffectView[] };
type GroupWithEffects = Omit<TalentGroupView, "options"> & { options: OptionWithEffects[] };

/**
 * Talent options. A ONE_OF group is drawn as a radio-style list under an explicit
 * "Elige solo uno" heading — options are alternatives, never all simultaneously active.
 * This is read-only in Milestone 1 (radio marks show the default option, no interaction).
 */
export function TalentGroup({ group, t }: { group: GroupWithEffects; t: Translate }) {
  const exclusive = isExclusiveChoice(group);
  const choiceLabel = exclusive
    ? t("talents.chooseOne")
    : group.selectionMode === "ALL"
      ? t("talents.allApply")
      : group.options.length === 1
        ? t("talents.single")
        : t("talents.chooseN", { min: group.minSelections, max: group.maxSelections });

  return (
    <fieldset className="rounded-xl border border-border p-3 sm:p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-semibold">
        {group.name && <span>{group.name}</span>}
        <span
          className={
            "rounded-full px-2 py-0.5 text-xs " +
            (exclusive ? "bg-accent text-accent-fg" : "border border-border text-muted")
          }
        >
          {choiceLabel}
        </span>
      </legend>
      {exclusive && <p className="mb-2 text-xs text-muted">{t("talents.chooseOneHint")}</p>}

      <ul className="flex flex-col gap-2" role={exclusive ? "radiogroup" : "list"} aria-label={choiceLabel}>
        {group.options.map((option) => (
          <li
            key={option.id}
            role={exclusive ? "radio" : "listitem"}
            aria-checked={exclusive ? option.isDefault : undefined}
            className={
              "rounded-lg border p-3 " + (option.isDefault ? "border-accent bg-accent/10" : "border-border bg-surface")
            }
          >
            <div className="flex items-start gap-3">
              {exclusive && (
                <span
                  aria-hidden
                  className={
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 " +
                    (option.isDefault ? "border-accent" : "border-muted")
                  }
                >
                  {option.isDefault && <span className="size-2.5 rounded-full bg-accent" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{option.name}</span>
                  {exclusive && (
                    <span className="text-xs text-muted">
                      {option.isDefault ? t("talents.defaultOption") : t("talents.alternative")}
                    </span>
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
        ))}
      </ul>
    </fieldset>
  );
}
