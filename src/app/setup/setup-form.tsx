"use client";

import { useActionState } from "react";
import { setupAction, type SetupState } from "@/server/auth/setup-action";
import { useT } from "@/i18n/client";
import { Button } from "@/components/ui/primitives";
import { FormField, inputClass } from "@/components/forms/form-field";

export function SetupForm({ token }: { token: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<SetupState, FormData>(setupAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormField label={t("auth.email")} htmlFor="email">
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className={inputClass} />
      </FormField>
      <FormField label={t("setup.password")} htmlFor="password">
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} className={inputClass} />
        <p className="text-xs text-muted">{t("setup.passwordHint")}</p>
      </FormField>
      <FormField label={t("setup.confirm")} htmlFor="confirm">
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} className={inputClass} />
      </FormField>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {t(`setup.error.${state.error}` as "setup.error.invalidInput")}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t("setup.submitting") : t("setup.submit")}
      </Button>
    </form>
  );
}
