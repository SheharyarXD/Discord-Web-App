"use client";

import { useActionState, type ReactNode } from "react";
import { useT } from "@/i18n/client";
import { Button } from "@/components/ui/primitives";
import { initialFormState, type FormState } from "@/components/forms/form-state";

/**
 * Shell of every administrator form: runs the server action, shows the typed result and the pending state.
 * The fields are ordinary server-rendered inputs passed as children.
 */
export function AdminForm({
  action,
  children,
  submitLabel,
  variant = "primary",
  className = "flex flex-col gap-4",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel?: string;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, initialFormState);
  return (
    <form action={formAction} className={className} noValidate>
      {children}
      {state.message && (
        <div role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "text-sm text-danger" : "text-sm text-ok"} data-form-result={state.status}>
          <p>{t(state.message)}</p>
          {state.detail && <p className="mt-1 break-words text-xs text-muted">{state.detail}</p>}
        </div>
      )}
      <div>
        <Button type="submit" variant={variant} disabled={pending}>
          {pending ? t("common.saving") : (submitLabel ?? t("common.save"))}
        </Button>
      </div>
    </form>
  );
}
