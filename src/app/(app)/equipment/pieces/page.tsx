import { ItemListPage } from "@/components/game/item-list-page";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";
export const metadata = { title: "Piezas de equipamiento" };

/** The individual equipment pieces (one per printed slot). The set catalogue is the main Equipamiento page. */
export default function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <ItemListPage kind="equipment" searchParams={searchParams} basePath="/equipment/pieces" />;
}
