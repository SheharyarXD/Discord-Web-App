import { getT } from "@/i18n/server";
import { db } from "@/server/db";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { RoleForm } from "./role-form";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  const t = await getT();
  const roles = await db.ninjaRole.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title={t("admin.roles")} description={t("admin.rolesDescription")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">{t("admin.newRole")}</h2>
          <RoleForm />
        </Card>
        <div>
          {roles.length === 0 ? (
            <EmptyState title={t("admin.noRoles")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {roles.map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-surface px-3 py-2.5">
                  <span className="font-medium">{r.name}</span> <span className="text-xs text-muted">({r.key})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
