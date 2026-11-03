import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEffectValue } from "@/domain/effects";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { Card, PageHeader, Tag } from "@/components/ui/primitives";
import { ReviewBadge } from "@/components/game/review-badge";
import { SetTiers } from "@/components/game/item-detail-view";
import { basisNote, gearTitle } from "@/components/game/gear-catalogue";

export const dynamic = "force-dynamic";

/** One equipment or jewelry set: its pieces and its tiers exactly as stored (no totals). */
export default async function SetDetailPage({ params }: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await params;
  if (kind !== "equipment" && kind !== "jewelry") notFound();
  await requireUser();
  const t = await getT();
  const api = await getGameApi();
  const detail = kind === "equipment" ? await api.getEquipmentSet(slug) : await api.getJewelrySet(slug);
  if (!detail) notFound();
  const info = await api.getGearVersionInfo(kind, slug);
  const heading = info ? gearTitle({ name: info.family?.name ?? detail.name, versionLabel: info.versionLabel, versionBasis: info.versionBasis }, t) : (detail.nameEs ?? detail.name);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={`/${kind}`} className="text-muted underline underline-offset-4 hover:text-fg">
          ← {t("catalog.back")}
        </Link>
      </p>
      <PageHeader title={heading} actions={<ReviewBadge status={detail.reviewStatus} t={t} />} />
      <p className="-mt-3 mb-6 text-xs font-semibold uppercase tracking-wider text-accent">{kind === "equipment" ? t("sets.equipmentSet") : t("sets.jewelrySet")}</p>
      {info && (
        <div className="mb-6 flex max-w-3xl flex-col gap-2 text-sm text-muted" data-gear-version>
          {basisNote(info.versionBasis, t) && <p>{basisNote(info.versionBasis, t)}</p>}
          {info.family?.sourceTitle && <p>{t("gear.sourceTitle", { title: info.family.sourceTitle })}</p>}
          {detail.reviewStatus !== "CONFIRMED" && (
            <p className="text-warn">
              <span aria-hidden>⚠ </span>
              {t("gear.needsReview")}
            </p>
          )}
        </div>
      )}
      {detail.description && <p className="mb-6 max-w-2xl text-sm italic text-muted">{detail.description}</p>}

      <section className="mb-8" aria-labelledby="tiers">
        <h2 id="tiers" className="mb-3 text-lg font-semibold">
          {t("sets.tiers")}
        </h2>
        <SetTiers kind={kind} detail={detail} t={t} />
      </section>

      {info && info.siblings.length > 0 && (
        <section className="mb-8" aria-labelledby="siblings">
          <h2 id="siblings" className="mb-3 text-lg font-semibold">
            {t("gear.otherVersions")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {info.siblings.map((x) => (
              <li key={`${x.kind}-${x.slug}`}>
                <Link href={`/sets/${x.kind}/${x.slug}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-border px-3 py-1 text-sm hover:border-accent">
                  <span className="text-xs uppercase text-accent">{x.kind === "equipment" ? t("gear.kindEquipment") : t("gear.kindJewelry")}</span>
                  {gearTitle({ name: info.family?.name ?? detail.name, versionLabel: x.versionLabel, versionBasis: x.versionBasis }, t)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {info && info.family && info.family.upgradeCosts.length > 0 && (
        <section className="mb-8" aria-labelledby="costs">
          <h2 id="costs" className="mb-1 text-lg font-semibold">
            {t("gear.costs")}
          </h2>
          <p className="mb-3 text-xs text-muted">{t("gear.costsNote")}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {info.family.upgradeCosts.map((c, i) => (
              <li key={i} className="rounded-lg border border-border p-3 text-sm">
                <span className="font-semibold">{c.stage}</span> <span className="text-xs text-muted">({c.applies})</span>
                <br />
                <span className="text-muted">{c.materials}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8" aria-labelledby="pieces">
        <h2 id="pieces" className="mb-3 text-lg font-semibold">
          {t("catalog.setPieces")} ({detail.items.length})
        </h2>
        {detail.items.length === 0 ? (
          <p className="text-sm text-muted">{t("catalog.emptyList")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {detail.items.map((i) => (
              <li key={i.id}>
                <Card className="h-full">
                  <Link href={`/${kind}/${i.slug}`} className="font-semibold text-accent underline-offset-4 hover:underline">
                    {i.nameEs ?? i.name}
                  </Link>
                  {i.categoryName && <p className="text-sm text-muted">{i.categoryName}</p>}
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {i.effects
                      .filter((e) => e.statisticName)
                      .map((e) => (
                        <Tag key={e.id} tone="muted">
                          {e.statisticName} {e.value === null ? "" : formatEffectValue(e.value, e.valueType)}
                        </Tag>
                      ))}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      {info && info.sources.length > 0 && (
        <section className="mb-8" aria-labelledby="sources">
          <h2 id="sources" className="mb-1 text-lg font-semibold">
            {t("gear.sources")}
          </h2>
          <p className="mb-2 text-xs text-muted">{t("gear.sourcePrivate")}</p>
          <ul className="text-sm text-muted">
            {info.sources.map((x) => (
              <li key={x.path}>{x.path.replace("gear-source/sources/", "")}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
