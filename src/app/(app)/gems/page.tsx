import { ItemListPage } from "@/components/game/item-list-page";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";

/** Hidden (404) while the Gems feature is off; the gem tables and their data are untouched. */
export default function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <ItemListPage kind="gem" searchParams={searchParams} />;
}
