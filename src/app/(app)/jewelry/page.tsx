import { ItemListPage } from "@/components/game/item-list-page";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";
export const metadata = { title: "Joyería" };

export default function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <ItemListPage kind="jewelry" searchParams={searchParams} />;
}
