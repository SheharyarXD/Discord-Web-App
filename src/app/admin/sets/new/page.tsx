import { AdminSetEditor } from "@/components/admin/set-admin";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  const kind = (await searchParams).kind === "jewelry" ? "jewelry" : "equipment";
  return <AdminSetEditor kind={kind} />;
}
