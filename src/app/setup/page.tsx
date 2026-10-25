import Image from "next/image";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { setupAvailable } from "@/server/auth/first-admin";
import { db } from "@/server/db";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Configuración inicial", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The first-administrator page. It answers 404 unless the private setup token is right and no account exists yet. */
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!(await setupAvailable(db, process.env.SETUP_TOKEN, token))) notFound();
  const t = await getT();
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-surface p-6 sm:p-8">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={180} height={98} priority className="mx-auto mb-4 h-20 w-auto" />
        <h1 className="text-center text-xl font-bold">{t("setup.title")}</h1>
        <p className="mb-6 mt-1 text-center text-sm text-muted">{t("setup.intro")}</p>
        <SetupForm token={token!} />
      </div>
    </main>
  );
}
