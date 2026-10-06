import type { ReactNode } from "react";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/guards";
import { AppHeader } from "@/components/layout/app-header";

/** Everything under (app) requires an authenticated, active user — checked on the server. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const t = await getT();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        {t("nav.skipToContent")}
      </a>
      <AppHeader user={user} />
      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </>
  );
}
