import { ItemListPage } from "@/components/game/item-list-page";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";
export const metadata = { title: "Piezas de joyería" };

/** The individual jewelry pieces (one per printed category). The set catalogue is the main Joyería page. */
export default function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <ItemListPage kind="jewelry" searchParams={searchParams} basePath="/jewelry/pieces" />;
}
