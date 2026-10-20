import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { deleteStatusAction, saveStatusAction } from "../../actions";
import { PageHeader } from "@/components/ui/primitives";
import { AdminForm } from "@/components/admin/admin-form";
import { DeleteForm } from "@/components/admin/delete-form";
import { Select, TextArea, TextInput } from "@/components/admin/fields";

export const dynamic = "force-dynamic";

export default async function EditStatus({ params }: { params: Promise<{ key: string }> }) {
  await requireAdminPage();
  const { key } = await params;
  const t = await getT();
  const api = await getGameApi();
  const status = await api.getStatusEffect(key);
  if (!status) notFound();
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/effects" className="text-muted underline underline-offset-4 hover:text-fg">
          ← {t("admin.nav.back")}
        </Link>
      </p>
      <PageHeader title={status.name} description={t("admin.effects.description")} />
      <div className="flex flex-col gap-10">
        <AdminForm action={saveStatusAction} className="flex flex-col gap-4">
          <input type="hidden" name="key" value={status.key} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="name" label={t("admin.field.name")} value={status.name} required />
            <TextInput name="nameEs" label={t("admin.field.nameEs")} value={status.nameEs} />
            <Select name="polarity" label={t("admin.field.polarity")} options={(["BUFF", "DEBUFF", "NEUTRAL", "UNKNOWN"] as const).map((v) => ({ value: v, label: t(`admin.polarity.${v}`) }))} value={status.polarity} />
            <Select name="cleansability" label={t("admin.field.cleansability")} options={(["CLEANSABLE", "UNCLEANSABLE", "CONDITIONAL", "UNKNOWN"] as const).map((v) => ({ value: v, label: t(`admin.cleansability.${v}`) }))} value={status.cleansability} />
          </div>
          <TextArea name="description" label={t("admin.field.description")} value={status.description} rows={3} />
          <TextArea name="descriptionEs" label={t("admin.field.descriptionEs")} value={status.descriptionEs} rows={3} />
          <TextArea name="note" label={t("admin.field.note")} value={status.note} rows={2} />
        </AdminForm>
        <DeleteForm action={deleteStatusAction} confirmWith={status.key} hidden={{ key: status.key }} t={t} />
      </div>
    </>
  );
}
