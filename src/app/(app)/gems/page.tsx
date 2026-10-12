import { notFound } from "next/navigation";
import { FEATURES } from "@/config/features";
import { SectionPlaceholder } from "@/components/layout/section-placeholder";

/** Hidden while the Gems feature is off; the gem tables and their data are untouched. */
export default function Page() {
  if (!FEATURES.gems) notFound();
  return <SectionPlaceholder section="gems" />;
}
