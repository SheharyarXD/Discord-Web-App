import { formatReleasePeriod } from "@/domain/ninja";
import { getT } from "@/i18n/server";
import { listNinjas } from "@/server/queries/ninjas";
import { EmptyState, PageHeader, Pagination, Tag } from "@/components/ui/primitives";
import { ItemCard } from "@/components/game/item-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ninjas" };

/** Read-only list, newest first, one bounded page at a time. Search and filters arrive in Milestone 3. */
export default async function NinjasPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const t = await getT();
  const requested = Number.parseInt((await searchParams).page ?? "1", 10);
  const result = await listNinjas({ page: Number.isInteger(requested) && requested > 0 ? requested : 1 });

  return (
    <>
      <PageHeader title={t("sections.ninjas.title")} description={t("sections.ninjas.description")} />
      {result.total === 0 ? (
        <EmptyState title={t("common.empty")} hint={t("common.emptyHint")} />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            {t("ninja.total", { count: result.total })} · {t("ninja.listHint")}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {result.items.map((n) => (
              <li key={n.id}>
                <ItemCard
                  href={`/ninjas/${n.slug}`}
                  title={n.nameEs ?? n.name}
                  subtitle={n.release ? formatReleasePeriod(n.release) : t("ninja.releaseUnknown")}
                  imageUrl={n.imageUrl}
                  footer={
                    (n.rating || n.formation || n.clientCombatClass) && (
                      <span className="flex flex-wrap gap-1.5">
                        {n.rating && <Tag tone="warn">{n.rating.name}</Tag>}
                        {n.formation && <Tag tone="info">{n.formation.nameEs ?? n.formation.name}</Tag>}
                        {n.clientCombatClass && <Tag>{t(`ninja.combatClassValue.${n.clientCombatClass}`)}</Tag>}
                      </span>
                    )
                  }
                />
              </li>
            ))}
          </ul>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(page) => (page === 1 ? "/ninjas" : `/ninjas?page=${page}`)}
            labels={{
              previous: t("common.previous"),
              next: t("common.next"),
              status: t("common.pageOf", { page: result.page, pages: result.pageCount }),
              nav: t("common.pagination"),
            }}
          />
        </>
      )}
    </>
  );
}
