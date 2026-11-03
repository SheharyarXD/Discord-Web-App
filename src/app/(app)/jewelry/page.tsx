import { GearCatalogue } from "@/components/game/gear-catalogue";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";
export const metadata = { title: "Joyería" };

/** Jewelry sets with their versions, four categories, 2-piece and 8-piece effects. Individual pieces: /jewelry/pieces. */
export default function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <GearCatalogue searchParams={searchParams} base="/jewelry" fixedKind="jewelry" />;
}
