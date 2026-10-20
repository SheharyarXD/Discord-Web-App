import Link from "next/link";
import { formatReleasePeriod } from "@/domain/ninja";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { hrefWith, rawOne, type RawParams } from "@/server/query-params";
import { buttonClass, EmptyState, PageHeader, Pagination, Tag } from "@/components/ui/primitives";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { SearchBox } from "@/components/game/list-controls";

export const dynamic = "force-dynamic";

export default async function AdminNinjas({ searchParams }: { searchParams: Promise<RawParams> }) {
  await requireAdminPage();
  const t = await getT();
  const raw = await searchParams;
  const page = Math.max(1, Number.parseInt(rawOne(raw.page) ?? "1", 10) || 1);
  const api = await getGameApi();
  const result = await api.listNinjas({ page, query: rawOne(raw.q), includeUnpublished: true, sort: { by: "name", direction: "asc" } });
  return (
    <>
      <PageHeader
        title={t("admin.nav.ninjas")}
        actions={
          <Link href="/admin/ninjas/new" className={buttonClass("primary")}>
            {t("admin.actions.new")}
          </Link>
        }
      />
      {rawOne(raw.deleted) && <p role="status" className="mb-4 text-sm text-ok">{t("admin.deleted")}</p>}
      <form action="/admin/ninjas" method="get" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <SearchBox value={rawOne(raw.q)} placeholder={t("filters.searchPlaceholder")} label={t("admin.list.search")} />
        </div>
        <button type="submit" className={buttonClass("ghost")}>
          {t("filters.apply")}
        </button>
      </form>
      {result.total === 0 ? (
        <EmptyState title={t("admin.list.empty")} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {t("admin.list.count", { count: result.total })} · {t("admin.list.draftHint")}
          </p>
          <ResponsiveTable
            caption={t("admin.nav.ninjas")}
            rows={result.items}
            rowKey={(n) => n.slug}
            columns={[
              { key: "name", header: t("admin.field.name"), render: (n) => <Link href={`/admin/ninjas/${n.slug}`} className="font-medium text-accent underline-offset-4 hover:underline">{n.name}</Link> },
              { key: "release", header: t("ninja.release"), render: (n) => (n.release ? formatReleasePeriod(n.release) : <span className="text-muted">{t("common.unknown")}</span>) },
              { key: "rating", header: t("admin.field.rating"), render: (n) => n.rating?.name ?? <span className="text-muted">{t("common.unknown")}</span> },
              { key: "status", header: t("admin.status"), render: (n) => <Tag tone="muted">{t("admin.review.CONFIRMED") && n.reviewStatus ? t(`admin.review.${n.reviewStatus}`) : ""}</Tag> },
            ]}
          />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(p) => hrefWith("/admin/ninjas", raw, { page: p === 1 ? undefined : String(p) })}
            labels={{ previous: t("common.previous"), next: t("common.next"), status: t("common.pageOf", { page: result.page, pages: result.pageCount }), nav: t("common.pagination") }}
          />
        </>
      )}
    </>
  );
}
