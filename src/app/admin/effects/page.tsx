import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { normalizeTerm } from "@/domain/localize";
import { rawOne, type RawParams } from "@/server/query-params";
import { buttonClass, EmptyState, PageHeader, Tag } from "@/components/ui/primitives";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { SearchBox } from "@/components/game/list-controls";

export const dynamic = "force-dynamic";

export default async function AdminEffects({ searchParams }: { searchParams: Promise<RawParams> }) {
  await requireAdminPage();
  const t = await getT();
  const raw = await searchParams;
  const api = await getGameApi();
  const needle = rawOne(raw.q) ? normalizeTerm(rawOne(raw.q)!) : "";
  const all = await api.listStatusEffects();
  const rows = all.filter((s) => !needle || normalizeTerm(`${s.name} ${s.nameEs ?? ""} ${s.aliases.join(" ")}`).includes(needle));
  return (
    <>
      <PageHeader title={t("admin.effects.title")} description={t("admin.effects.description")} />
      {rawOne(raw.deleted) && <p role="status" className="mb-4 text-sm text-ok">{t("admin.deleted")}</p>}
      <form action="/admin/effects" method="get" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <SearchBox value={rawOne(raw.q)} placeholder={t("filters.searchPlaceholder")} label={t("admin.list.search")} />
        </div>
        <button type="submit" className={buttonClass("ghost")}>
          {t("filters.apply")}
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title={t("admin.list.empty")} />
      ) : (
        <ResponsiveTable
          caption={t("admin.effects.title")}
          rows={rows}
          rowKey={(s) => s.key}
          columns={[
            { key: "name", header: t("admin.field.name"), render: (s) => <Link href={`/admin/effects/${s.key}`} className="font-medium text-accent underline-offset-4 hover:underline">{s.name}</Link> },
            { key: "es", header: t("admin.field.nameEs"), render: (s) => s.nameEs ?? "" },
            { key: "polarity", header: t("admin.field.polarity"), render: (s) => (s.kind === "TERM" ? t("glossary.kindTerm") : <Tag tone="muted">{t(`admin.polarity.${s.polarity}`)}</Tag>) },
          ]}
        />
      )}
    </>
  );
}
