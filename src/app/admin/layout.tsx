import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { AppHeader } from "@/components/layout/app-header";

/** Server-enforced: anonymous → /login, non-admin → 404. Client role checks are never trusted. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage();
  const t = await getT();
  return (
    <>
      <AppHeader user={user} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row">
        <nav aria-label={t("admin.title")} className="flex gap-2 lg:w-52 lg:flex-col">
          <Link href="/admin" className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-surface-2">
            {t("admin.overview")}
          </Link>
          <Link href="/admin/roles" className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-surface-2">
            {t("admin.roles")}
          </Link>
        </nav>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </>
  );
}
