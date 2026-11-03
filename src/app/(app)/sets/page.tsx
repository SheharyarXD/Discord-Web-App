import { GearCatalogue } from "@/components/game/gear-catalogue";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conjuntos" };

/** Both categories together: every equipment and jewelry set version, with the shared filters. */
export default function SetsPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <GearCatalogue searchParams={searchParams} base="/sets" />;
}
