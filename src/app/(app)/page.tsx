import Link from "next/link";
import { getT } from "@/i18n/server";
import { getContentCounts } from "@/server/queries/overview";
import { Card, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/ninjas", key: "ninjas" },
  { href: "/equipment", key: "equipment" },
  { href: "/jewelry", key: "jewelry" },
  { href: "/gems", key: "gems" },
  { href: "/sets", key: "sets" },
] as const;

export default async function HomePage() {
  const t = await getT();
  const counts = await getContentCounts();
  return (
    <>
      <PageHeader title={t("home.title")} description={t("home.intro")} />
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{t("home.sectionsTitle")}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ href, key }) => (
          <li key={key}>
            <Link href={href} className="block h-full">
              <Card className="h-full transition-colors hover:border-accent">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{t(`sections.${key}.title`)}</h3>
                  <span className="text-2xl font-bold tabular-nums text-accent">{counts[key]}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{t(`sections.${key}.description`)}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
