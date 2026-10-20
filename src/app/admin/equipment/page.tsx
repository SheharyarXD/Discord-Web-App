import { AdminItemList } from "@/components/admin/item-admin";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";

export default function Page({ searchParams }: { searchParams: Promise<RawParams> }) {
  return <AdminItemList kind="equipment" searchParams={searchParams} />;
}
