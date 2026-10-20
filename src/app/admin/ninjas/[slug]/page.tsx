import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { buttonClass, PageHeader } from "@/components/ui/primitives";
import { AbilityEditor } from "@/components/admin/ability-forms";
import { DeleteForm } from "@/components/admin/delete-form";
import { NinjaForm } from "@/components/admin/ninja-form";
import { deleteNinjaAction } from "../../actions";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";

export default async function EditNinja({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> }) {
  await requireAdminPage();
  const { slug } = await params;
  const created = (await searchParams).created;
  const t = await getT();
  const api = await getGameApi();
  const ninja = await api.getNinja(slug);
  if (!ninja) notFound();
  const [facets, base] = await Promise.all([api.listNinjaFacets(), api.listStatistics("base")]);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/ninjas" className="text-muted underline underline-offset-4 hover:text-fg">
          ← {t("admin.nav.back")}
        </Link>
      </p>
      <PageHeader
        title={ninja.name}
        actions={
          <Link href={`/ninjas/${ninja.slug}`} className={buttonClass("ghost")}>
            {t("admin.actions.view")}
          </Link>
        }
      />
      {created && <p role="status" className="mb-4 text-sm text-ok">{t("admin.ninja.created")}</p>}
      <div className="flex flex-col gap-10">
        <NinjaForm ninja={ninja} choices={{ ratings: facets.ratings, allFormations: facets.allFormations, types: facets.types, roles: facets.roles, baseStatistics: base.map((s) => ({ key: s.key, name: s.name })) }} t={t} />
        <AbilityEditor ninja={ninja} t={t} />
        <DeleteForm action={deleteNinjaAction} confirmWith={ninja.slug} hidden={{ slug: ninja.slug }} t={t} />
      </div>
    </>
  );
}
