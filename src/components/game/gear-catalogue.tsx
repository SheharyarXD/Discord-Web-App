import Link from "next/link";
import type { Translate } from "@/i18n";
import { getT } from "@/i18n/server";
import { getGameApi } from "@/server/game-api";
import { requireUser } from "@/server/auth/guards";
import { effectModeOf, effectTerms, hrefWith, parseGearParams, rawAll, rawOne, sortEffectOf, type RawParams } from "@/server/query-params";
import type { GearSetSummary } from "@/game/gear";
import { Card, EmptyState, PageHeader, Pagination, Tag } from "@/components/ui/primitives";
import { EffectRankBlock, EffectRankNote, FullSetBlock } from "./effect-rank";
import { CheckGroup, countActive, EffectSearch, RadioGroup, FilterPanel, RangeRows, ResultSummary, SearchBox, SelectBox } from "./list-controls";

const number = new Intl.NumberFormat("es", { maximumFractionDigits: 2 });

/** The title with its version. Sequence variants say they are variants; nothing claims an upgrade the source does not state. */
export function gearTitle(s: { name: string; versionLabel: string | null; versionBasis: string | null }, t: Translate): string {
  if (!s.versionLabel) return s.name;
  return s.versionBasis === "SEQUENCE" ? `${s.name} (${t("gear.variantTitle", { label: s.versionLabel })})` : `${s.name} ${s.versionLabel}`;
}

export function basisNote(basis: string | null, t: Translate): string | null {
  if (basis === "SEQUENCE") return t("gear.unlabeled");
  if (basis === "PRINTED") return t("gear.labelPrinted");
  if (basis === "CLIENT_STATED") return t("gear.labelClient");
  if (basis === "OWNER_MAPPING") return t("gear.labelOwner");
  return null;
}

/**
 * The equipment and jewelry catalogue: one card per set VERSION, with search, version, tier, printed-statistic and effect
 * filters (the effects with Match Any / Match All), sorting and paging. The state lives in the address.
 * `fixedKind` shows only one category and keeps it when the filters are cleared.
 */
export async function GearCatalogue({ searchParams, base, fixedKind }: { searchParams: Promise<RawParams>; base: string; fixedKind?: "equipment" | "jewelry" }) {
  await requireUser();
  const t = await getT();
  const raw = await searchParams;
  const api = await getGameApi();
  const parsed = parseGearParams(raw);
  const params = fixedKind ? { ...parsed, kinds: [fixedKind] } : parsed;
  const kindsForSuggestions = fixedKind ? [fixedKind] : (params.kinds?.length ? params.kinds : (["equipment", "jewelry"] as const));
  const [facets, result, suggestionsEq, suggestionsJw] = await Promise.all([
    api.gearFacets(),
    api.listGearSets(params),
    kindsForSuggestions.includes("equipment") ? api.listEffectSuggestions("equipment") : Promise.resolve([]),
    kindsForSuggestions.includes("jewelry") ? api.listEffectSuggestions("jewelry") : Promise.resolve([]),
  ]);
  const suggestions = [...new Set([...suggestionsEq, ...suggestionsJw].map((s) => s.value))];
  const fxTerms = effectTerms(raw);
  const mode = effectModeOf(raw);
  const ignore = ["page", "sort", "fxm", "fxs", ...(fixedKind ? ["kind"] : [])];
  const sortTerm = sortEffectOf(raw) ?? fxTerms[0];
  const byEffect = params.sort?.by === "effect";
  const active = countActive(raw, ignore);
  const sortValue = rawOne(raw.sort) ?? "";
  const SLOT_KEYS = ["force", "chakra", "agility", "power"] as const;
  // A jewelry category is shown by its Spanish slot name; any other key keeps its stored name.
  const statName = (key: string) => ((SLOT_KEYS as readonly string[]).includes(key) ? t(`gear.slot.${key as (typeof SLOT_KEYS)[number]}`) : (facets.statistics.find((s) => s.key === key)?.name ?? key));
  const slot = params.slot;
  const tierOptions = fixedKind === "equipment" ? [2, 4, 6] : fixedKind === "jewelry" ? [2, 8] : facets.tiers;
  const sortOptions = [
    { value: "name:asc", label: t("gear.sortNameAsc") },
    { value: "name:desc", label: t("gear.sortNameDesc") },
    ...(fxTerms.length > 0 ? [{ value: "fx:desc", label: t("gear.sortFxDesc") }, { value: "fx:asc", label: t("gear.sortFxAsc") }] : []),
    ...facets.statistics.flatMap((s) => [
      { value: `stat:desc:${s.key}`, label: t("gear.sortStatDesc", { stat: s.name }) },
      { value: `stat:asc:${s.key}`, label: t("gear.sortStatAsc", { stat: s.name }) },
    ]),
  ];
  const clearHref = mode === "all" ? `${base}?fxm=all` : base;

  return (
    <>
      <PageHeader title={fixedKind === "equipment" ? t("gear.kindEquipment") : fixedKind === "jewelry" ? t("gear.kindJewelry") : t("gear.title")} description={t("gear.description")} />
      <FilterPanel action={base} count={active} t={t} clearHref={clearHref}>
        <SearchBox value={rawOne(raw.q)} placeholder={t("filters.searchPlaceholder")} label={t("filters.search")} />
        {!fixedKind && <CheckGroup name="kind" legend={t("gear.category")} options={[{ value: "equipment", label: t("gear.kindEquipment") }, { value: "jewelry", label: t("gear.kindJewelry") }]} selected={rawAll(raw.kind)} />}
        <EffectSearch terms={fxTerms} suggestions={suggestions} mode={mode} sortTerm={sortTerm} removeHref={(term) => hrefWith(base, raw, { fx: fxTerms.filter((x) => x !== term), page: undefined })} t={t} />
        <CheckGroup
          name="version"
          legend={t("gear.version")}
          options={[
            { value: "base", label: t("gear.versionBase") },
            { value: "labelled", label: t("gear.versionLabelled") },
            { value: "variant", label: t("gear.versionVariant") },
          ]}
          selected={rawAll(raw.version)}
        />
        {fixedKind === "jewelry" && (
          <RadioGroup name="slot" legend={t("gear.slotTitle")} hint={t("gear.slotHint")} allLabel={t("gear.slotAll")} options={SLOT_KEYS.map((k) => ({ value: k, label: t(`gear.slot.${k}`) }))} selected={slot} />
        )}
        <CheckGroup name="tier" legend={t("gear.tierFilter")} options={tierOptions.map((n) => ({ value: String(n), label: t("gear.tierPieces", { count: n }) }))} selected={rawAll(raw.tier)} />
        {(fxTerms.length > 0 || rawAll(raw.tier).length > 0) && <p className="-mt-3 text-xs text-muted">{t("gear.tierHint")}</p>}
        <RangeRows statistics={facets.statistics.map((s) => ({ value: s.key, label: s.name }))} selected={params.statFilters ?? []} t={t} />
        <p className="-mt-3 text-xs text-muted">{t("gear.statHint")}</p>
        <SelectBox name="sort" label={t("filters.sortBy")} empty={t("filters.sortDefault")} options={sortOptions} value={sortValue} />
        {fixedKind && <input type="hidden" name="kind" value={fixedKind} />}
      </FilterPanel>

      {result.total === 0 ? (
        <EmptyState
          title={fxTerms.length > 0 ? t("gear.noResultsEffects", { mode: t(mode === "all" ? "gear.noResultsEffectsAll" : "gear.noResultsEffectsAny"), terms: fxTerms.join("», «") }) : t("gear.noResults")}
          hint={t("filters.noResultsHint")}
        />
      ) : (
        <>
          {byEffect && sortTerm && <EffectRankNote effect={sortTerm} direction={params.sort?.direction === "asc" ? "asc" : "desc"} t={t} />}
          <ResultSummary total={t("filters.results", { count: result.total })}>
            {fxTerms.length > 0 && <span>{t("gear.evidenceNote")}</span>}
          </ResultSummary>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-gear-results>
            {result.items.map((s) => (
              <li key={`${s.kind}-${s.slug}`}>
                <GearCard s={s} t={t} statName={statName} rankEffect={fxTerms.length > 0 ? sortTerm : undefined} />
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
      <p className="mt-6 text-sm text-muted">
        {t("gear.nameOnlyNote")}{" "}
        <Link href={fixedKind === "jewelry" ? "/jewelry/pieces" : "/equipment/pieces"} className="underline underline-offset-4 hover:text-fg">
          {t("gear.viewPieces")}
        </Link>
      </p>
    </>
  );
}

function GearCard({ s, t, statName, rankEffect }: { s: GearSetSummary; t: Translate; statName: (key: string) => string; rankEffect?: string }) {
  const stats = s.stats.slice(0, 6);
  return (
    <Card className="h-full" >
      <div data-gear-card data-kind={s.kind} data-version={s.versionKey ?? ""}>
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
          {s.kind === "equipment" ? t("gear.kindEquipment") : t("gear.kindJewelry")}
          {s.versionLabel && <Tag tone={s.versionBasis === "SEQUENCE" ? "muted" : "info"}>{s.versionBasis === "SEQUENCE" ? t("gear.variantTitle", { label: s.versionLabel }) : s.versionLabel}</Tag>}
        </p>
        <h2 className="mt-1 font-semibold">
          <Link href={`/sets/${s.kind}/${s.slug}`} className="underline-offset-4 hover:text-accent hover:underline">
            {gearTitle(s, t)}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-muted">{s.pieceCount === 0 ? t("gear.noOwnStats") : s.kind === "equipment" ? t("gear.pieces", { count: s.pieceCount }) : t("gear.categories", { count: s.pieceCount })}</p>
        {s.thresholds.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {s.thresholds.map((n) => (
              <Tag key={n}>{t("gear.tierPieces", { count: n })}</Tag>
            ))}
          </p>
        )}
        {stats.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5 text-xs" aria-label={t("gear.mainStats")}>
            {stats.map((x) => (
              <Tag key={`${x.key}-${x.value}`} tone="muted">
                {x.name} {number.format(Number(x.value))}
              </Tag>
            ))}
          </p>
        )}
        {s.evidence.length > 0 && (
          <div className="mt-3 border-t border-border pt-2 text-xs" data-effect-evidence>
            <p className="mb-1 font-semibold">{t("sets.individual")}</p>
            <ul className="flex flex-col gap-1">
              {s.evidence.slice(0, 6).map((e, i) => (
                <li key={i}>
                  <span className="font-semibold">{e.pieces ? t("gear.evidencePieces", { count: e.pieces }) : t("gear.evidenceNoTier")}</span>
                  {e.group ? ` · ${statName(e.group)}` : ""}: <span className="text-muted">{e.text.length > 140 ? `${e.text.slice(0, 140)}…` : e.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {rankEffect && s.rank && <EffectRankBlock rank={s.rank} effect={rankEffect} t={t} statName={statName} />}
        {rankEffect && s.fullSet && <FullSetBlock info={s.fullSet} effect={rankEffect} t={t} statName={statName} />}
        {s.reviewStatus !== "CONFIRMED" && <p className="mt-2 text-xs text-warn"><span aria-hidden>⚠ </span>{t("gear.needsReview")}</p>}
      </div>
    </Card>
  );
}
