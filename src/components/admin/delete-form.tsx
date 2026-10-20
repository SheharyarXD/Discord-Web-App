import type { FormState } from "@/components/forms/form-state";
import type { Translate } from "@/i18n";
import { AdminForm } from "./admin-form";
import { Field } from "./fields";
import { inputClass } from "@/components/forms/form-field";

/**
 * Deleting needs a second step: the administrator types the identifier. The server checks it again, so a
 * forged request without it is refused too.
 */
export function DeleteForm({
  action,
  confirmWith,
  hidden,
  t,
  label,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** What must be typed to confirm. */
  confirmWith: string;
  hidden: Record<string, string>;
  t: Translate;
  label?: string;
}) {
  return (
    <details className="rounded-[var(--radius-card)] border border-danger/40 p-4" data-delete-form>
      <summary className="cursor-pointer text-sm font-semibold text-danger">{label ?? t("admin.delete.title")}</summary>
      <p className="mt-2 text-sm text-muted">{t("admin.delete.warning")}</p>
      <AdminForm action={action} submitLabel={t("admin.delete.confirmButton")} variant="ghost" className="mt-3 flex flex-col gap-3">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Field id={`confirm-${confirmWith}`} label={t("admin.delete.confirm", { slug: confirmWith })}>
          <input id={`confirm-${confirmWith}`} name="confirm" autoComplete="off" className={inputClass} />
        </Field>
      </AdminForm>
    </details>
  );
}
