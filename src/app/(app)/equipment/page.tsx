import { GearCatalogue } from "@/components/game/gear-catalogue";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipamiento" };

/** Equipment sets with their versions, printed statistics and 2/4/6 piece bonuses. Individual pieces: /equipment/pieces. */
export default function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <GearCatalogue searchParams={searchParams} base="/equipment" fixedKind="equipment" />;
}
