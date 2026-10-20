import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { AppHeader } from "@/components/layout/app-header";

/** Server-enforced: anonymous → /login, non-admin → 404. Client role checks are never trusted. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdminPage();
  const t = await getT();
  const links = [
    { href: "/admin", label: t("admin.overview") },
    { href: "/admin/ninjas", label: t("admin.nav.ninjas") },
    { href: "/admin/equipment", label: t("admin.nav.equipment") },
    { href: "/admin/jewelry", label: t("admin.nav.jewelry") },
    { href: "/admin/gems", label: t("admin.nav.gems") },
    { href: "/admin/sets", label: t("admin.nav.sets") },
    { href: "/admin/effects", label: t("admin.nav.effects") },
    { href: "/admin/roles", label: t("admin.roles") },
    { href: "/admin/users", label: t("admin.nav.users") },
  ];
  return (
    <>
      <AppHeader user={user} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row">
        <nav aria-label={t("admin.title")} className="flex flex-wrap gap-1 lg:w-52 lg:shrink-0 lg:flex-col" data-admin-nav>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-surface-2">
              {l.label}
            </Link>
          ))}
        </nav>
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </>
  );
}
