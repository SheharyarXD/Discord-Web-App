import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { PageHeader, Tag } from "@/components/ui/primitives";
import { AdminForm } from "@/components/admin/admin-form";
import { Field, Select, TextInput } from "@/components/admin/fields";
import { inputClass } from "@/components/forms/form-field";
import { createUserAction, deleteUserAction, resetPasswordAction, updateUserAction } from "../actions";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

/** Account management: who may log in, as what, and password resets. Passwords are never shown. */
export default async function AdminUsers() {
  const me = await requireAdminPage();
  const t = await getT();
  const api = await getGameApi();
  const users = await api.listUsers();
  const roleOptions = [{ value: "USER", label: t("admin.users.roleUser") }, { value: "ADMIN", label: t("admin.users.roleAdmin") }];
  return (
    <>
      <PageHeader title={t("admin.users.title")} description={t("admin.users.description")} />
      <section className="mb-10" aria-labelledby="create">
        <h2 id="create" className="mb-3 text-lg font-semibold">
          {t("admin.users.create")}
        </h2>
        <AdminForm action={createUserAction} submitLabel={t("admin.users.create")} className="grid gap-4 sm:grid-cols-2">
          <TextInput name="email" label={t("admin.users.email")} type="email" required maxLength={200} />
          <TextInput name="name" label={t("admin.users.name")} maxLength={120} />
          <Select name="role" label={t("admin.users.role")} options={roleOptions} value="USER" />
          <Field id="password" label={t("admin.users.password")} hint={t("admin.users.passwordHint")}>
            <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={inputClass} />
          </Field>
        </AdminForm>
      </section>

      <ul className="flex flex-col gap-3" data-user-list>
        {users.map((u) => (
          <li key={u.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4" data-user-email={u.email}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 break-all font-semibold">{u.email}</span>
              {u.id === me.id && <span className="text-xs text-muted">{t("admin.users.you")}</span>}
              <Tag tone={u.role === "ADMIN" ? "info" : "muted"}>{u.role === "ADMIN" ? t("admin.users.roleAdmin") : t("admin.users.roleUser")}</Tag>
              <Tag tone={u.isActive ? "ok" : "danger"}>{u.isActive ? t("admin.users.active") : t("admin.users.inactive")}</Tag>
            </div>
            <p className="mt-1 text-xs text-muted">
              {u.name ? `${u.name} · ` : ""}
              {t("admin.users.lastLogin")}: {u.lastLoginAt ? date.format(u.lastLoginAt) : t("admin.users.never")}
            </p>
            <details className="mt-3">
              <summary className="min-h-9 cursor-pointer text-sm font-semibold">{t("admin.actions.edit")}</summary>
              <div className="mt-3 grid gap-4 lg:grid-cols-3">
                <AdminForm action={updateUserAction} submitLabel={t("admin.users.changeRole")} variant="ghost">
                  <input type="hidden" name="id" value={u.id} />
                  <Select name="role" label={t("admin.users.role")} options={roleOptions} value={u.role} />
                </AdminForm>
                <AdminForm action={updateUserAction} submitLabel={u.isActive ? t("admin.users.deactivate") : t("admin.users.activate")} variant="ghost">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="isActive" value={u.isActive ? "false" : "true"} />
                </AdminForm>
                <AdminForm action={resetPasswordAction} submitLabel={t("admin.users.reset")} variant="ghost">
                  <input type="hidden" name="id" value={u.id} />
                  <Field id={`pw-${u.id}`} label={t("admin.users.newPassword")} hint={t("admin.users.passwordHint")}>
                    <input id={`pw-${u.id}`} name="password" type="password" autoComplete="new-password" minLength={10} className={inputClass} />
                  </Field>
                </AdminForm>
              </div>
              {u.id !== me.id && (
                <AdminForm action={deleteUserAction} submitLabel={t("admin.delete.confirmButton")} variant="ghost" className="mt-4 flex flex-col gap-3">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="email" value={u.email} />
                  <Field id={`del-${u.id}`} label={t("admin.users.deleteConfirm")}>
                    <input id={`del-${u.id}`} name="confirm" autoComplete="off" className={inputClass} />
                  </Field>
                </AdminForm>
              )}
            </details>
          </li>
        ))}
      </ul>
    </>
  );
}
