import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import type { RawParams } from "@/server/query-params";
import { rawOne } from "@/server/query-params";
import { buttonClass, EmptyState, PageHeader, Tag } from "@/components/ui/primitives";
import { ResponsiveTable } from "@/components/ui/responsive-table";

export const dynamic = "force-dynamic";

export default async function AdminSets({ searchParams }: { searchParams: Promise<RawParams> }) {
  await requireAdminPage();
  const t = await getT();
  const raw = await searchParams;
  const api = await getGameApi();
  const sets = await api.listSets();
  return (
    <>
      <PageHeader
        title={t("admin.nav.sets")}
        actions={
          <span className="flex flex-wrap gap-2">
            <Link href="/admin/sets/new?kind=equipment" className={buttonClass("primary")}>
              {t("admin.set.newEquipment")}
            </Link>
            <Link href="/admin/sets/new?kind=jewelry" className={buttonClass("ghost")}>
              {t("admin.set.newJewelry")}
            </Link>
          </span>
        }
      />
      {rawOne(raw.deleted) && <p role="status" className="mb-4 text-sm text-ok">{t("admin.deleted")}</p>}
      {sets.length === 0 ? (
        <EmptyState title={t("catalog.emptySets")} hint={t("catalog.emptyListHint")} />
      ) : (
        <ResponsiveTable
          caption={t("admin.nav.sets")}
          rows={sets}
          rowKey={(s) => `${s.kind}-${s.slug}`}
          columns={[
            { key: "name", header: t("admin.field.name"), render: (s) => <Link href={`/admin/sets/${s.kind}/${s.slug}`} className="font-medium text-accent underline-offset-4 hover:underline">{s.name}</Link> },
            { key: "kind", header: t("admin.field.type"), render: (s) => (s.kind === "equipment" ? t("sets.equipmentSet") : t("sets.jewelrySet")) },
            { key: "pieces", header: t("admin.set.pieces"), render: (s) => s.pieceCount },
            { key: "tiers", header: t("sets.tiers"), render: (s) => (s.thresholds.length ? s.thresholds.map((n) => <Tag key={n}>{n}</Tag>) : "") },
          ]}
        />
      )}
    </>
  );
}
