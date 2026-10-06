import { getT } from "@/i18n/server";
import { Card, PageHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const t = await getT();
  return (
    <>
      <PageHeader title={t("admin.title")} description={t("admin.description")} />
      <Card>
        <p className="text-sm text-muted">{t("admin.crudNote")}</p>
      </Card>
    </>
  );
}
