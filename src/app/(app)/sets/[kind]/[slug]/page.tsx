import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEffectValue } from "@/domain/effects";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { Card, PageHeader, Tag } from "@/components/ui/primitives";
import { ReviewBadge } from "@/components/game/review-badge";
import { SetTiers } from "@/components/game/item-detail-view";

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
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/sets" className="text-muted underline underline-offset-4 hover:text-fg">
          ← {t("catalog.back")}
        </Link>
      </p>
      <PageHeader title={detail.nameEs ?? detail.name} actions={<ReviewBadge status={detail.reviewStatus} t={t} />} />
      <p className="-mt-3 mb-6 text-xs font-semibold uppercase tracking-wider text-accent">{kind === "equipment" ? t("sets.equipmentSet") : t("sets.jewelrySet")}</p>
      {detail.description && <p className="mb-6 max-w-2xl text-sm italic text-muted">{detail.description}</p>}

      <section className="mb-8" aria-labelledby="tiers">
        <h2 id="tiers" className="mb-3 text-lg font-semibold">
          {t("sets.tiers")}
        </h2>
        <SetTiers kind={kind} detail={detail} t={t} />
      </section>

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
    </>
  );
}
