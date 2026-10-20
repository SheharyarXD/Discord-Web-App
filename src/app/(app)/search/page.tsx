import Link from "next/link";
import { FEATURES } from "@/config/features";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { rawOne, type RawParams } from "@/server/query-params";
import { buttonClass, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { SearchBox } from "@/components/game/list-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Búsqueda" };

/** One search box over ninjas (names and aliases), items, sets and effects. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  await requireUser();
  const t = await getT();
  const q = rawOne((await searchParams).q) ?? "";
  const api = await getGameApi();
  const found = q ? await api.searchAll(q, { includeGems: FEATURES.gems }) : null;
  const groups = found
    ? [
        { key: "ninjas", title: t("search.ninjas"), rows: found.ninjas.map((n) => ({ href: `/ninjas/${n.slug}`, label: n.nameEs ?? n.name, note: n.matchedAlias ? t("search.aliasNote", { alias: n.matchedAlias }) : null })) },
        { key: "equipment", title: t("search.equipment"), rows: found.equipment.map((n) => ({ href: `/equipment/${n.slug}`, label: n.nameEs ?? n.name, note: null })) },
        { key: "jewelry", title: t("search.jewelry"), rows: found.jewelry.map((n) => ({ href: `/jewelry/${n.slug}`, label: n.nameEs ?? n.name, note: null })) },
        { key: "gems", title: t("search.gems"), rows: found.gems.map((n) => ({ href: `/gems/${n.slug}`, label: n.name, note: null })) },
        { key: "sets", title: t("search.sets"), rows: found.sets.map((n) => ({ href: `/sets/${n.kind}/${n.slug}`, label: n.nameEs ?? n.name, note: null })) },
        { key: "statuses", title: t("search.statuses"), rows: found.statuses.map((n) => ({ href: `/effects#${n.key}`, label: n.nameEs ?? n.name, note: null })) },
      ].filter((g) => g.rows.length > 0)
    : [];
  return (
    <>
      <PageHeader title={t("search.title")} description={t("search.description")} />
      <form action="/search" method="get" className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <SearchBox value={q} placeholder={t("search.placeholder")} label={t("filters.search")} />
        </div>
        <button type="submit" className={buttonClass("primary")}>
          {t("search.submit")}
        </button>
      </form>
      {!q ? (
        <EmptyState title={t("search.prompt")} />
      ) : groups.length === 0 ? (
        <EmptyState title={t("search.none", { query: q })} hint={t("filters.noResultsHint")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2" data-search-results>
          {groups.map((g) => (
            <Card key={g.key}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">
                {g.title} ({g.rows.length})
              </h2>
              <ul className="flex flex-col gap-1.5">
                {g.rows.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className="underline-offset-4 hover:text-accent hover:underline">
                      {r.label}
                    </Link>
                    {r.note && <span className="ml-2 text-xs text-muted">({r.note})</span>}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
