import { getT } from "@/i18n/server";
import { listNinjas } from "@/server/queries/ninjas";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { ItemCard } from "@/components/game/item-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ninjas" };

export default async function NinjasPage() {
  const t = await getT();
  const ninjas = await listNinjas();
  return (
    <>
      <PageHeader title={t("sections.ninjas.title")} description={t("sections.ninjas.description")} />
      {ninjas.length === 0 ? (
        <EmptyState title={t("common.empty")} hint={t("common.emptyHint")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ninjas.map((n) => (
            <li key={n.id}>
              <ItemCard href={`/ninjas/${n.slug}`} title={n.name} subtitle={n.role?.name ?? t("ninja.noRole")} imageUrl={n.imageUrl} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
