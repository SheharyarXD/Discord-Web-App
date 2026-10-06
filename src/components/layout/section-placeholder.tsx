import { getT } from "@/i18n/server";
import { EmptyState, PageHeader } from "@/components/ui/primitives";

type SectionKey = "equipment" | "jewelry" | "gems" | "sets" | "search";

/** Route shell for sections whose real functionality arrives in Milestone 2. */
export async function SectionPlaceholder({ section }: { section: SectionKey }) {
  const t = await getT();
  return (
    <>
      <PageHeader title={t(`sections.${section}.title`)} description={t(`sections.${section}.description`)} />
      <EmptyState title={t("common.comingSoon")} hint={t("common.emptyHint")} />
    </>
  );
}
