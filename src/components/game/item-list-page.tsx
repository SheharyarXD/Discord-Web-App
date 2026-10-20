import { notFound } from "next/navigation";
import { FEATURES } from "@/config/features";
import { formatEffectValue } from "@/domain/effects";
import { getT } from "@/i18n/server";
import { getGameApi } from "@/server/game-api";
import { requireUser } from "@/server/auth/guards";
import { hrefWith, parseItemParams, rawAll, rawOne, type RawParams } from "@/server/query-params";
import type { ItemKind } from "@/game/schemas";
import { EmptyState, PageHeader, Pagination, Tag } from "@/components/ui/primitives";
import { ItemCard } from "./item-card";
import { CheckGroup, countActive, FilterPanel, RangeRows, ResultSummary, SearchBox, SelectBox } from "./list-controls";

const number = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

/** The list of equipment, jewelry or gems: search, category / set / statistic-range filters and statistic sorting. */
export async function ItemListPage({ kind, searchParams }: { kind: ItemKind; searchParams: Promise<RawParams> }) {
  if (kind === "gem" && !FEATURES.gems) notFound(); // hidden while the Gems section is off
  await requireUser();
  const t = await getT();
  const raw = await searchParams;
  const api = await getGameApi();
  const base = kind === "gem" ? "/gems" : `/${kind}`;
  const params = parseItemParams(kind, raw);
  const [facets, result] = await Promise.all([api.listItemFacets(kind), api.listItems(params)]);
  const statName = (key: string) => facets.statistics.find((s) => s.key === key)?.name ?? key;
  const sectionKey = kind === "gem" ? "gems" : kind;
  const active = countActive(raw);
  const sortOptions = [
    { value: "name:asc", label: t("filters.sort.nameAsc") },
    { value: "name:desc", label: t("filters.sort.nameDesc") },
    ...facets.statistics.flatMap((s) => [
      { value: `stat:desc:${s.key}`, label: t("filters.sort.statDesc", { stat: s.name }) },
      { value: `stat:asc:${s.key}`, label: t("filters.sort.statAsc", { stat: s.name }) },
    ]),
  ];

  return (
    <>
      <PageHeader title={t(`sections.${sectionKey}.title`)} description={t(`sections.${sectionKey}.description`)} />
      <FilterPanel action={base} count={active} t={t} clearHref={base}>
        <SearchBox value={rawOne(raw.q)} placeholder={t("filters.searchPlaceholder")} label={t("filters.search")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CheckGroup name="type" legend={t("filters.category")} options={facets.categories.map((c) => ({ value: c.key, label: c.name }))} selected={rawAll(raw.type)} />
          <CheckGroup name="set" legend={t("filters.set")} options={facets.sets.map((s) => ({ value: s.slug, label: s.name }))} selected={rawAll(raw.set)} />
        </div>
        <RangeRows statistics={facets.statistics.map((s) => ({ value: s.key, label: s.name }))} selected={params.statFilters ?? []} t={t} />
        <SelectBox name="sort" label={t("filters.sortBy")} empty={t("filters.sortDefault")} options={sortOptions} value={rawOne(raw.sort)} />
      </FilterPanel>

      {result.total === 0 ? (
        active > 0 ? (
          <EmptyState title={t("filters.noResults")} hint={t("filters.noResultsHint")} />
        ) : (
          <EmptyState title={t("catalog.emptyList")} hint={t("catalog.emptyListHint")} />
        )
      ) : (
        <>
          <ResultSummary total={t("filters.results", { count: result.total })}>
            <span>{t("catalog.listHint")}</span>
            {params.sort?.by === "stat" && <span>{t("filters.sortNote")}</span>}
          </ResultSummary>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {result.items.map((i) => (
              <li key={i.slug}>
                <ItemCard
                  href={`${base}/${i.slug}`}
                  title={i.nameEs ?? i.name}
                  subtitle={[i.categoryName, i.setName].filter(Boolean).join(" · ") || null}
                  footer={
                    <span className="flex flex-col gap-1.5">
                      {i.stats.length > 0 && (
                        <span className="flex flex-wrap gap-1.5">
                          {i.stats.slice(0, 3).map((s, n) => (
                            <Tag key={`${s.statisticKey}-${n}`} tone="muted">
                              {s.statisticName} {s.value === null ? "" : formatEffectValue(s.value, s.valueType)}
                            </Tag>
                          ))}
                        </span>
                      )}
                      {i.status !== "PUBLISHED" && <Tag tone="warn">{t("catalog.draft")}</Tag>}
                      {i.sortStat && (
                        <span className="text-xs text-muted" data-sort-stat>
                          {i.sortStat.value === null ? t("filters.withoutStat", { stat: statName(i.sortStat.key) }) : `${statName(i.sortStat.key)}: ${number.format(i.sortStat.value)}`}
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
            hrefFor={(page) => hrefWith(base, raw, { page: page === 1 ? undefined : String(page) })}
            labels={{ previous: t("common.previous"), next: t("common.next"), status: t("common.pageOf", { page: result.page, pages: result.pageCount }), nav: t("common.pagination") }}
          />
        </>
      )}
    </>
  );
}
