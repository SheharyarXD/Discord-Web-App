import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { ItemDetailView } from "@/components/game/item-detail-view";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const api = await getGameApi();
  const item = await api.getItemDetail("equipment", slug, { includeUnpublished: user.role === "ADMIN" });
  if (!item) notFound();
  return <ItemDetailView item={item} t={await getT()} listHref="/equipment" />;
}
