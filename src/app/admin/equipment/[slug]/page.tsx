import { AdminItemEditor } from "@/components/admin/item-admin";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> }) {
  const { slug } = await params;
  return <AdminItemEditor kind="equipment" slug={slug} created={Boolean((await searchParams).created)} />;
}
