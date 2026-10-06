import Image from "next/image";
import Link from "next/link";
import { getT } from "@/i18n/server";
import { logoutAction } from "@/server/auth/actions";
import type { SessionUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { Button } from "@/components/ui/primitives";
import { MainNav } from "./main-nav";

export async function AppHeader({ user }: { user: SessionUser }) {
  const t = await getT();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={t("app.name")}>
          <Image src="/logo.png" alt={t("app.logoAlt")} width={72} height={39} priority className="h-8 w-auto" />
          <span className="hidden text-sm font-bold tracking-wide sm:inline">{t("app.name")}</span>
        </Link>
        <div className="flex flex-1 items-center justify-end gap-2 lg:justify-between lg:pl-4">
          <MainNav showAdmin={can(user, "admin:access")} />
          <div className="flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-xs text-muted md:inline" title={user.email}>
              {user.email}
            </span>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost">
                {t("auth.logout")}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
