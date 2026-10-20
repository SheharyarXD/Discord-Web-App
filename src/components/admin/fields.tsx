import type { ReactNode } from "react";
import type { Translate } from "@/i18n";
import { inputClass } from "@/components/forms/form-field";

export const textareaClass = "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({ name, label, value, hint, required, maxLength = 300, type = "text", inputMode }: { name: string; label: string; value?: string | number | null; hint?: string; required?: boolean; maxLength?: number; type?: string; inputMode?: "numeric" | "decimal" }) {
  return (
    <Field id={name} label={label} hint={hint}>
      <input id={name} name={name} type={type} defaultValue={value ?? ""} required={required} maxLength={maxLength} inputMode={inputMode} className={inputClass} />
    </Field>
  );
}

export function TextArea({ name, label, value, hint, rows = 4 }: { name: string; label: string; value?: string | null; hint?: string; rows?: number }) {
  return (
    <Field id={name} label={label} hint={hint}>
      <textarea id={name} name={name} rows={rows} defaultValue={value ?? ""} className={textareaClass} />
    </Field>
  );
}

export function Select({ name, label, options, value, empty, hint }: { name: string; label: string; options: { value: string; label: string }[]; value?: string | null; empty?: string; hint?: string }) {
  return (
    <Field id={name} label={label} hint={hint}>
      <select id={name} name={name} defaultValue={value ?? ""} className={inputClass}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export interface ExistingStat {
  statisticKey: string;
  value: number | string | null;
  unit: "PERCENT" | "FLAT" | "MULTIPLIER";
}

/**
 * Rows for a piece's plain statistics («Attack, 12, %») and a couple of free-text effect lines.
 * Read back with statEffects(fd, prefix). Special effects the rows cannot express are not shown here;
 * the save keeps them.
 */
export function StatRows({
  prefix,
  statistics,
  existing = [],
  existingText = [],
  rows = 6,
  textRows = 2,
  t,
}: {
  prefix: string;
  statistics: { value: string; label: string }[];
  existing?: ExistingStat[];
  existingText?: string[];
  rows?: number;
  textRows?: number;
  t: Translate;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm font-medium">{t("admin.stats.title")}</legend>
      <p className="mb-2 text-xs text-muted">{t("admin.stats.hint")}</p>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => {
          const row = existing[i];
          return (
            <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <select aria-label={`${t("admin.stats.statistic")} ${i + 1}`} name={`${prefix}_stat_${i}`} defaultValue={row?.statisticKey ?? ""} className={inputClass}>
                <option value="">{t("admin.stats.statistic")}</option>
                {statistics.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input aria-label={`${t("admin.stats.value")} ${i + 1}`} name={`${prefix}_value_${i}`} inputMode="decimal" placeholder={t("admin.stats.value")} defaultValue={row?.value ?? ""} className={inputClass} />
              <select aria-label={`${t("admin.stats.unit")} ${i + 1}`} name={`${prefix}_unit_${i}`} defaultValue={row?.unit === "FLAT" ? "FLAT" : "PERCENT"} className={inputClass}>
                <option value="PERCENT">{t("admin.stats.percent")}</option>
                <option value="FLAT">{t("admin.stats.flat")}</option>
              </select>
            </div>
          );
        })}
        {Array.from({ length: textRows }, (_, i) => (
          <input key={`t${i}`} aria-label={`${t("admin.stats.text")} ${i + 1}`} name={`${prefix}_text_${i}`} placeholder={t("admin.stats.text")} defaultValue={existingText[i] ?? ""} maxLength={2000} className={inputClass} />
        ))}
      </div>
    </fieldset>
  );
}
