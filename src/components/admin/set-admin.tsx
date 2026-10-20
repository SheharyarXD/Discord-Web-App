import Link from "next/link";
import { notFound } from "next/navigation";
import { formatEffectValue } from "@/domain/effects";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { deleteSetAction, deleteTierAction, saveSetAction, saveTierAction } from "@/app/admin/actions";
import { buttonClass, PageHeader, Tag } from "@/components/ui/primitives";
import { AdminForm } from "./admin-form";
import { DeleteForm } from "./delete-form";
import { Select, StatRows, TextArea, TextInput } from "./fields";

export async function AdminSetEditor({ kind, slug, created }: { kind: "equipment" | "jewelry"; slug?: string; created?: boolean }) {
  await requireAdminPage();
  const t = await getT();
  const api = await getGameApi();
  const [choices, detail] = await Promise.all([api.listItemChoices(), slug ? (kind === "equipment" ? api.getEquipmentSet(slug) : api.getJewelrySet(slug)) : Promise.resolve(null)]);
  if (slug && !detail) notFound();
  const isNew = !detail;
  const tiers = detail ? (kind === "equipment" ? (detail as Awaited<ReturnType<typeof api.getEquipmentSet>>)!.tiers : (detail as Awaited<ReturnType<typeof api.getJewelrySet>>)!.bonuses) : [];
  const jewelry = kind === "jewelry" && detail ? (detail as NonNullable<Awaited<ReturnType<typeof api.getJewelrySet>>>) : null;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/sets" className="text-muted underline underline-offset-4 hover:text-fg">
          ← {t("admin.nav.back")}
        </Link>
      </p>
      <PageHeader
        title={detail ? detail.name : t(kind === "equipment" ? "admin.set.newEquipment" : "admin.set.newJewelry")}
        actions={
          detail ? (
            <Link href={`/sets/${kind}/${detail.slug}`} className={buttonClass("ghost")}>
              {t("admin.actions.view")}
            </Link>
          ) : undefined
        }
      />
      {created && <p role="status" className="mb-4 text-sm text-ok">{t("admin.created")}</p>}
      <div className="flex flex-col gap-10">
        <AdminForm action={saveSetAction} className="flex flex-col gap-4">
          <input type="hidden" name="kind" value={kind} />
          {isNew ? <input type="hidden" name="isNew" value="true" /> : <input type="hidden" name="slug" value={detail.slug} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="name" label={t("admin.field.name")} value={detail?.name} required />
            <TextInput name="nameEs" label={t("admin.field.nameEs")} value={detail?.nameEs} />
            {isNew && <TextInput name="slug" label={t("admin.field.slug")} hint={t("admin.ninja.slugHint")} />}
            <Select name="tierStacking" label={t("admin.field.stacking")} options={(["UNKNOWN", "CUMULATIVE", "REPLACES"] as const).map((v) => ({ value: v, label: t(`admin.stacking.${v}`) }))} value={detail?.tierStacking ?? "UNKNOWN"} />
            <Select name="reviewStatus" label={t("admin.field.review")} options={(["CONFIRMED", "PARTIALLY_CONFIRMED", "NEEDS_REVIEW"] as const).map((v) => ({ value: v, label: t(`admin.review.${v}`) }))} value={detail?.reviewStatus ?? "NEEDS_REVIEW"} />
            {kind === "jewelry" && <Select name="structureStatus" label={t("admin.field.structure")} options={(["UNCONFIRMED", "CONFIRMED"] as const).map((v) => ({ value: v, label: t(`admin.structure.${v}`) }))} value={jewelry?.structureStatus ?? "UNCONFIRMED"} />}
          </div>
          <TextArea name="description" label={t("admin.field.description")} value={detail?.description} rows={3} />
          {!isNew && <p className="text-xs text-muted">{t("admin.set.basicsOnly")}</p>}
        </AdminForm>

        {detail && (
          <section className="flex flex-col gap-4" aria-labelledby="tiers">
            <h2 id="tiers" className="text-lg font-semibold">
              {t("admin.set.tiers")}
            </h2>
            <p className="text-sm text-muted">{t("admin.set.tiersHint")}</p>
            {jewelry && jewelry.bonuses.some((b) => b.requirementKind !== "PIECE_COUNT" || b.groupKey) && <p className="text-xs text-warn">{t("admin.set.complexTiers")}</p>}
            <ul className="flex flex-col gap-2">
              {tiers.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
                  <Tag>{b.requiredPieces !== null ? t("sets.pieces", { count: b.requiredPieces }) : t("sets.specificItems")}</Tag>
                  <span className="min-w-0 flex-1 break-words text-muted">
                    {b.effects.map((e) => `${e.statisticName ?? e.description ?? ""} ${e.value === null ? "" : formatEffectValue(e.value, e.valueType)}`.trim()).join(", ")}
                  </span>
                  <AdminForm action={deleteTierAction} submitLabel={t("admin.set.removeTier")} variant="ghost" className="flex items-center gap-2">
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="id" value={b.id} />
                  </AdminForm>
                </li>
              ))}
            </ul>
            <details className="rounded-lg border border-border">
              <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">{t("admin.set.addTier")}</summary>
              <div className="border-t border-border p-3">
                <AdminForm action={saveTierAction} className="flex flex-col gap-4">
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="slug" value={detail.slug} />
                  <TextInput name="requiredPieces" label={t("admin.set.tierPieces")} inputMode="numeric" maxLength={2} required />
                  <TextInput name="description" label={t("admin.field.description")} />
                  <StatRows prefix="tier" statistics={choices.statistics} t={t} />
                </AdminForm>
              </div>
            </details>
          </section>
        )}

        {detail && (
          <section aria-labelledby="pieces">
            <h2 id="pieces" className="mb-3 text-lg font-semibold">
              {t("admin.set.pieces")} ({detail.items.length})
            </h2>
            <ul className="flex flex-wrap gap-2">
              {detail.items.map((i) => (
                <li key={i.id}>
                  <Link href={`/admin/${kind}/${i.slug}`} className={buttonClass("ghost")}>
                    {i.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {detail && <DeleteForm action={deleteSetAction} confirmWith={detail.slug} hidden={{ slug: detail.slug, kind }} t={t} />}
      </div>
    </>
  );
}
