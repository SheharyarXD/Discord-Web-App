import Link from "next/link";
import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import { inputClass } from "@/components/forms/form-field";
import { buttonClass } from "@/components/ui/primitives";

/**
 * Building blocks of the search and filter forms. They are plain GET forms: the state of a search
 * lives in the address, so it can be bookmarked, shared with another approved user and reloaded.
 */

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export function FilterPanel({ action, count, t, children, clearHref }: { action: string; count: number; t: Translate; children: ReactNode; clearHref: string }) {
  return (
    <details open={count > 0 ? true : undefined} className="mb-6 rounded-[var(--radius-card)] border border-border bg-surface p-4 lg:open:block" data-filter-panel>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
        <span>
          {t("filters.title")}
          {count > 0 && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-fg">{count}</span>}
        </span>
        <span aria-hidden className="text-muted">
          ▾
        </span>
      </summary>
      <form action={action} method="get" className="mt-4 flex flex-col gap-5">
        {children}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={buttonClass("primary")}>
            {t("filters.apply")}
          </button>
          {count > 0 && (
            <Link href={clearHref} className={buttonClass("ghost")}>
              {t("filters.clear")}
            </Link>
          )}
        </div>
      </form>
    </details>
  );
}

export function SearchBox({ name = "q", value, placeholder, label }: { name?: string; value?: string; placeholder: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input id={name} type="search" name={name} defaultValue={value} placeholder={placeholder} maxLength={120} className={inputClass} />
    </div>
  );
}

/**
 * «Buscar por efecto»: a text field with suggestions. Terms already chosen are chips with a link that removes
 * them and hidden fields that keep them when the form is sent again; a newly typed term is added to them.
 */
export function EffectSearch({ terms, suggestions, removeHref, t }: { terms: string[]; suggestions: string[]; removeHref: (term: string) => string; t: Translate }) {
  return (
    <div className="flex flex-col gap-1.5" data-effect-search>
      <label htmlFor="fx" className="text-sm font-medium">
        {t("filters.effectSearch")}
      </label>
      {terms.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("filters.effectChips")}>
          {terms.map((term) => (
            <li key={term} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-accent bg-accent/10 py-0.5 pl-3 pr-1 text-sm">
              <input type="hidden" name="fx" value={term} />
              <span>{term}</span>
              <Link href={removeHref(term)} aria-label={t("filters.effectChipRemove", { term })} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-accent/20">
                <span aria-hidden>×</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <input id="fx" type="search" name="fx" list="fx-suggestions" autoComplete="off" maxLength={80} placeholder={terms.length ? t("filters.effectSearchAdd") : t("filters.effectSearchPlaceholder")} className={inputClass} aria-describedby="fx-hint" />
      <datalist id="fx-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <p id="fx-hint" className="text-xs text-muted">
        {t("filters.effectSearchHint")}
      </p>
    </div>
  );
}

export function CheckGroup({ name, legend, options, selected }: { name: string; legend: string; options: Option[]; selected: string[] }) {
  if (options.length === 0) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/10">
            <input type="checkbox" name={name} value={o.value} defaultChecked={selected.includes(o.value)} className="size-4 accent-[var(--color-accent)]" />
            <span>{o.label}</span>
            {o.hint && <span className="text-xs text-muted">({o.hint})</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function SelectBox({ name, label, options, value, empty }: { name: string; label: string; options: Option[]; value?: string; empty: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <select id={name} name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">{empty}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** One «statistic, minimum, maximum» row. Up to three rows are offered, all of which must hold. */
export function RangeRows({ statistics, selected, t, rows = 2 }: { statistics: Option[]; selected: { statisticKey: string; min?: string | number | null; max?: string | number | null }[]; t: Translate; rows?: number }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium">{t("filters.statistic")}</legend>
      <p className="mb-2 text-xs text-muted">{t("filters.rangeHint")}</p>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => {
          const n = i + 1;
          const row = selected[i];
          return (
            <div key={n} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <select aria-label={`${t("filters.statistic")} ${n}`} name={`stat${n}`} defaultValue={row?.statisticKey ?? ""} className={inputClass}>
                <option value="">{t("filters.statistic")}</option>
                {statistics.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input aria-label={`${t("filters.min")} ${n}`} name={`min${n}`} inputMode="decimal" placeholder={t("filters.min")} defaultValue={row?.min ?? undefined} className={inputClass} />
              <input aria-label={`${t("filters.max")} ${n}`} name={`max${n}`} inputMode="decimal" placeholder={t("filters.max")} defaultValue={row?.max ?? undefined} className={inputClass} />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ResultSummary({ total, children }: { total: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted" aria-live="polite" data-result-count>
      <span>{total}</span>
      {children}
    </div>
  );
}

/** The number of filters that are switched on, for the panel's badge. */
export function countActive(p: Record<string, string | string[] | undefined>, ignore: string[] = ["page", "sort"]): number {
  return Object.entries(p).filter(([k, v]) => !ignore.includes(k) && (Array.isArray(v) ? v.some(Boolean) : Boolean(v))).length;
}
