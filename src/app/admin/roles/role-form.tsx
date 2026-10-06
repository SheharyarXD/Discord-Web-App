"use client";

import { useActionState } from "react";
import { useT } from "@/i18n/client";
import { Button } from "@/components/ui/primitives";
import { FormField, inputClass } from "@/components/forms/form-field";
import { initialFormState, type FormState } from "@/components/forms/form-state";
import { createRoleAction } from "./actions";

export function RoleForm() {
  const t = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(createRoleAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormField label={t("admin.roleName")} htmlFor="name" error={state.fieldErrors?.name && t(state.fieldErrors.name)}>
        <input id="name" name="name" required maxLength={80} className={inputClass} />
      </FormField>
      <FormField label={t("admin.roleKey")} htmlFor="key" error={state.fieldErrors?.key && t(state.fieldErrors.key)}>
        <input id="key" name="key" maxLength={60} className={inputClass} />
      </FormField>
      {state.message && (
        <p role="status" className={state.status === "error" ? "text-sm text-danger" : "text-sm text-ok"}>
          {t(state.message)}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
