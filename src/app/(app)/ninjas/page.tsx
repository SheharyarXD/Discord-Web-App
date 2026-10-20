import { formatReleasePeriod } from "@/domain/ninja";
import { getT } from "@/i18n/server";
import { getGameApi } from "@/server/game-api";
import { requireUser } from "@/server/auth/guards";
import { hrefWith, parseNinjaParams, rawAll, rawOne, type RawParams } from "@/server/query-params";
import { EmptyState, PageHeader, Pagination, Tag } from "@/components/ui/primitives";
import { ItemCard } from "@/components/game/item-card";
import { CheckGroup, countActive, FilterPanel, RangeRows, ResultSummary, SearchBox, SelectBox } from "@/components/game/list-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ninjas" };

const number = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

/**
 * Ninja list with search, filters (rank, formation, type, category, class, statistic ranges, effects)
 * and sorting by release or by a base statistic. The state of the search is in the address.
 */
export default async function NinjasPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  await requireUser();
  const t = await getT();
  const raw = await searchParams;
  const api = await getGameApi();
  const params = parseNinjaParams(raw);
  const [facets, result] = await Promise.all([api.listNinjaFacets(), api.listNinjas(params)]);
  const statName = (key: string | null | undefined) => facets.statistics.find((s) => s.key === key)?.name ?? key ?? "";
  const sortValue = rawOne(raw.sort) ?? "";
  const active = countActive(raw);
  const sortOptions = [
    { value: "release:desc", label: t("filters.sort.releaseDesc") },
    { value: "release:asc", label: t("filters.sort.releaseAsc") },
    { value: "name:asc", label: t("filters.sort.nameAsc") },
    { value: "name:desc", label: t("filters.sort.nameDesc") },
    ...facets.statistics.flatMap((s) => [
      { value: `stat:desc:${s.key}`, label: t("filters.sort.statDesc", { stat: s.name }) },
      { value: `stat:asc:${s.key}`, label: t("filters.sort.statAsc", { stat: s.name }) },
      { value: `growth:desc:${s.key}`, label: t("filters.sort.growthDesc", { stat: s.name }) },
      { value: `growth:asc:${s.key}`, label: t("filters.sort.growthAsc", { stat: s.name }) },
    ]),
  ];
  const sortedByStat = params.sort && (params.sort.by === "stat" || params.sort.by === "growth");

  return (
    <>
      <PageHeader title={t("sections.ninjas.title")} description={t("sections.ninjas.description")} />
      <FilterPanel action="/ninjas" count={active} t={t} clearHref="/ninjas">
        <SearchBox value={rawOne(raw.q)} placeholder={t("filters.searchPlaceholder")} label={t("filters.search")} />
        <CheckGroup name="rating" legend={t("filters.rating")} options={facets.ratings.map((r) => ({ value: r.key, label: r.name }))} selected={rawAll(raw.rating)} />
        <CheckGroup
          name="formation"
          legend={t("filters.formation")}
          options={facets.formations.map((f) => ({ value: f.key, label: f.name, hint: f.cardLabel ? t("filters.cardLabel", { label: f.cardLabel }) : undefined }))}
          selected={rawAll(raw.formation)}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectBox name="type" label={t("filters.type")} empty={t("filters.sortDefault")} options={facets.types.map((x) => ({ value: x.key, label: x.name }))} value={rawOne(raw.type)} />
          <SelectBox name="role" label={t("filters.role")} empty={t("filters.sortDefault")} options={facets.roles.map((x) => ({ value: x.key, label: x.name }))} value={rawOne(raw.role)} />
          <SelectBox
            name="class"
            label={t("filters.combatClass")}
            empty={t("filters.sortDefault")}
            options={(["TANK", "DPS", "UNASSIGNED"] as const).map((c) => ({ value: c, label: t(`filters.classValue.${c}`) }))}
            value={rawOne(raw.class)}
          />
        </div>
        <RangeRows statistics={facets.statistics.map((s) => ({ value: s.key, label: s.name }))} selected={params.statFilters ?? []} t={t} />
        <SelectBox name="effect" label={t("filters.effectStat")} empty={t("filters.sortDefault")} options={facets.statistics.map((s) => ({ value: s.key, label: s.name }))} value={rawOne(raw.effect)} />
        <SelectBox name="sort" label={t("filters.sortBy")} empty={t("filters.sortDefault")} options={sortOptions} value={sortValue} />
      </FilterPanel>

      {result.total === 0 ? (
        <EmptyState title={t("filters.noResults")} hint={active > 0 ? t("filters.noResultsHint") : t("common.emptyHint")} />
      ) : (
        <>
          <ResultSummary total={t("filters.results", { count: result.total })}>
            {!params.sort && <span>{t("ninja.listHint")}</span>}
            {sortedByStat && <span>{t("filters.sortNote")}</span>}
          </ResultSummary>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {result.items.map((n) => (
              <li key={n.id}>
                <ItemCard
                  href={`/ninjas/${n.slug}`}
                  title={n.nameEs ?? n.name}
                  subtitle={n.release ? formatReleasePeriod(n.release) : (n.role?.name ?? t("ninja.releaseUnknown"))}
                  imageUrl={n.imageUrl}
                  footer={
                    <span className="flex flex-col gap-1.5">
                      <span className="flex flex-wrap gap-1.5">
                        {n.rating && <Tag tone="warn">{n.rating.name}</Tag>}
                        {n.formation && (
                          <Tag tone="info" title={n.formation.sameAs ? t("filters.cardLabel", { label: n.formation.name }) : undefined}>
                            {n.formation.sameAs ? (n.formation.sameAs.nameEs ?? n.formation.sameAs.name) : (n.formation.nameEs ?? n.formation.name)}
                          </Tag>
                        )}
                        {n.clientCombatClass && <Tag>{t(`ninja.combatClassValue.${n.clientCombatClass}`)}</Tag>}
                      </span>
                      {n.sortStat && (
                        <span className="text-xs text-muted" data-sort-stat>
                          {n.sortStat.value === null
                            ? t("filters.withoutStat", { stat: statName(n.sortStat.key) })
                            : `${statName(n.sortStat.key)}: ${number.format(Number(n.sortStat.value))}${n.sortStat.growth !== null ? ` · ${t("filters.growth", { value: number.format(Number(n.sortStat.growth)) })}` : ""}`}
                        </span>
                      )}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(page) => hrefWith("/ninjas", raw, { page: page === 1 ? undefined : String(page) })}
            labels={{ previous: t("common.previous"), next: t("common.next"), status: t("common.pageOf", { page: result.page, pages: result.pageCount }), nav: t("common.pagination") }}
          />
        </>
      )}
    </>
  );
}
