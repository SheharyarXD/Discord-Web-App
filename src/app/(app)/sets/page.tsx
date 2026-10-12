import { getT } from "@/i18n/server";
import { listSets } from "@/server/queries/sets";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conjuntos" };

/** Read-only list of the stored sets. Thresholds are shown exactly as stored; no totals are computed. */
export default async function SetsPage() {
  const t = await getT();
  const sets = await listSets();
  return (
    <>
      <PageHeader title={t("sections.sets.title")} description={t("sections.sets.description")} />
      {sets.length === 0 ? (
        <EmptyState title={t("common.empty")} hint={t("common.noSourceYet")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <li key={`${s.kind}-${s.slug}`}>
              <Card className="h-full">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  {s.kind === "equipment" ? t("sets.equipmentSet") : t("sets.jewelrySet")}
                </p>
                <h2 className="mt-1 font-semibold">{s.nameEs ?? s.name}</h2>
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
