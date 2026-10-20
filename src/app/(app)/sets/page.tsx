import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { rawAll, rawOne, type RawParams } from "@/server/query-params";
import { normalizeTerm } from "@/domain/localize";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui/primitives";
import { CheckGroup, FilterPanel, SearchBox } from "@/components/game/list-controls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conjuntos" };

/** The stored sets with search and a kind filter. Thresholds are shown exactly as stored; no totals are computed. */
export default async function SetsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  await requireUser();
  const t = await getT();
  const raw = await searchParams;
  const q = rawOne(raw.q);
  const kinds = rawAll(raw.kind).filter((k) => k === "equipment" || k === "jewelry");
  const api = await getGameApi();
  const all = await api.listSets();
  const needle = q ? normalizeTerm(q) : "";
  const sets = all.filter((s) => (kinds.length === 0 || kinds.includes(s.kind)) && (!needle || normalizeTerm(`${s.name} ${s.nameEs ?? ""}`).includes(needle)));
  const active = (q ? 1 : 0) + (kinds.length ? 1 : 0);
  return (
    <>
      <PageHeader title={t("sections.sets.title")} description={t("sections.sets.description")} />
      <FilterPanel action="/sets" count={active} t={t} clearHref="/sets">
        <SearchBox value={q} placeholder={t("filters.searchPlaceholder")} label={t("filters.search")} />
        <CheckGroup name="kind" legend={t("filters.category")} options={[{ value: "equipment", label: t("sets.equipmentSet") }, { value: "jewelry", label: t("sets.jewelrySet") }]} selected={kinds} />
      </FilterPanel>
      {sets.length === 0 ? (
        <EmptyState title={active ? t("filters.noResults") : t("catalog.emptySets")} hint={active ? t("filters.noResultsHint") : t("catalog.emptyListHint")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <li key={`${s.kind}-${s.slug}`}>
              <Card className="h-full">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">{s.kind === "equipment" ? t("sets.equipmentSet") : t("sets.jewelrySet")}</p>
                <h2 className="mt-1 font-semibold">
                  <Link href={`/sets/${s.kind}/${s.slug}`} className="underline-offset-4 hover:text-accent hover:underline">
                    {s.nameEs ?? s.name}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-muted">{t("sets.pieces", { count: s.pieceCount })}</p>
                {s.thresholds.length > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {t("sets.tiers")}:
                    {s.thresholds.map((n) => (
                      <Tag key={n}>{t("sets.pieces", { count: n })}</Tag>
                    ))}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
