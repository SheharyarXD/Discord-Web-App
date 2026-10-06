"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/auth/actions";
import { useT } from "@/i18n/client";
import { Button } from "@/components/ui/primitives";
import { FormField, inputClass } from "@/components/forms/form-field";

export function LoginForm() {
  const t = useT();
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormField label={t("auth.email")} htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className={inputClass} />
      </FormField>
      <FormField label={t("auth.password")} htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </FormField>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {t(state.error === "invalidInput" ? "auth.invalidInput" : "auth.invalidCredentials")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("auth.submitting") : t("auth.submit")}
      </Button>
    </form>
  );
}
