import Link from "next/link";
import { getT } from "@/i18n/server";
import { buttonClass } from "@/components/ui/primitives";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("common.notFound")}</h1>
        <p className="mb-6 mt-1 text-sm text-muted">{t("common.notFoundHint")}</p>
        <Link href="/" className={buttonClass()}>
          {t("nav.home")}
        </Link>
      </div>
    </main>
  );
}
