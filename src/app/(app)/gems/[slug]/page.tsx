import { notFound } from "next/navigation";
import { FEATURES } from "@/config/features";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { ItemDetailView } from "@/components/game/item-detail-view";

export const dynamic = "force-dynamic";

/** Hidden (404) while the Gems feature is off. */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (!FEATURES.gems) notFound();
  const { slug } = await params;
  const user = await requireUser();
  const api = await getGameApi();
  const item = await api.getItemDetail("gem", slug, { includeUnpublished: user.role === "ADMIN" });
  if (!item) notFound();
  return <ItemDetailView item={item} t={await getT()} listHref="/gems" />;
}
