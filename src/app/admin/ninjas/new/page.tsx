import Link from "next/link";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { PageHeader } from "@/components/ui/primitives";
import { NinjaForm } from "@/components/admin/ninja-form";

export const dynamic = "force-dynamic";

export default async function NewNinja() {
  await requireAdminPage();
  const t = await getT();
  const api = await getGameApi();
  const [facets, base] = await Promise.all([api.listNinjaFacets(), api.listStatistics("base")]);
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/ninjas" className="text-muted underline underline-offset-4 hover:text-fg">
          ← {t("admin.nav.back")}
        </Link>
      </p>
      <PageHeader title={t("admin.ninja.newTitle")} />
      <NinjaForm choices={{ ratings: facets.ratings, allFormations: facets.allFormations, types: facets.types, roles: facets.roles, baseStatistics: base.map((s) => ({ key: s.key, name: s.name })) }} t={t} />
    </>
  );
}
