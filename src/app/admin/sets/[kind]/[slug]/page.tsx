import { notFound } from "next/navigation";
import { AdminSetEditor } from "@/components/admin/set-admin";
import type { RawParams } from "@/server/query-params";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ kind: string; slug: string }>; searchParams: Promise<RawParams> }) {
  const { kind, slug } = await params;
  if (kind !== "equipment" && kind !== "jewelry") notFound();
  return <AdminSetEditor kind={kind} slug={slug} created={Boolean((await searchParams).created)} />;
}
