import Image from "next/image";
import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Acceso" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const t = await getT();
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-surface p-6 sm:p-8">
        <Image src="/logo.png" alt={t("app.logoAlt")} width={180} height={98} priority className="mx-auto mb-4 h-20 w-auto" />
        <h1 className="text-center text-xl font-bold">{t("auth.login")}</h1>
        <p className="mb-6 mt-1 text-center text-sm text-muted">{t("auth.privateNotice")}</p>
        <LoginForm />
      </div>
    </main>
  );
}
