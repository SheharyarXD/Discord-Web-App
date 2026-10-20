import Link from "next/link";
import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { getGameApi } from "@/server/game-api";
import { hrefWith, rawOne, type RawParams } from "@/server/query-params";
import type { ItemKind } from "@/game/schemas";
import { deleteEquipmentAction, deleteGemAction, deleteJewelryAction, saveEquipmentAction, saveGemAction, saveJewelryAction } from "@/app/admin/actions";
import { buttonClass, EmptyState, PageHeader, Pagination, Tag } from "@/components/ui/primitives";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { SearchBox } from "@/components/game/list-controls";
import { formatEffectValue } from "@/domain/effects";
import { AdminForm } from "./admin-form";
import { DeleteForm } from "./delete-form";
import { Select, StatRows, TextArea, TextInput } from "./fields";

const BASE: Record<ItemKind, string> = { equipment: "/admin/equipment", jewelry: "/admin/jewelry", gem: "/admin/gems" };
const PUBLIC: Record<ItemKind, string> = { equipment: "/equipment", jewelry: "/jewelry", gem: "/gems" };
const NEW_KEY = { equipment: "admin.item.newEquipment", jewelry: "admin.item.newJewelry", gem: "admin.item.newGem" } as const;
const TITLE_KEY = { equipment: "admin.nav.equipment", jewelry: "admin.nav.jewelry", gem: "admin.nav.gems" } as const;

export async function AdminItemList({ kind, searchParams }: { kind: ItemKind; searchParams: Promise<RawParams> }) {
  await requireAdminPage();
  const t = await getT();
  const raw = await searchParams;
  const page = Math.max(1, Number.parseInt(rawOne(raw.page) ?? "1", 10) || 1);
  const api = await getGameApi();
  const result = await api.listItems({ kind, page, query: rawOne(raw.q), includeUnpublished: true });
  const base = BASE[kind];
  return (
    <>
      <PageHeader
        title={t(TITLE_KEY[kind])}
        actions={
          <Link href={`${base}/new`} className={buttonClass("primary")}>
            {t("admin.actions.new")}
          </Link>
        }
      />
      {kind === "gem" && <p className="mb-4 text-sm text-muted">{t("admin.item.gemsHidden")}</p>}
      {rawOne(raw.deleted) && <p role="status" className="mb-4 text-sm text-ok">{t("admin.deleted")}</p>}
      <form action={base} method="get" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <SearchBox value={rawOne(raw.q)} placeholder={t("filters.searchPlaceholder")} label={t("admin.list.search")} />
        </div>
        <button type="submit" className={buttonClass("ghost")}>
          {t("filters.apply")}
        </button>
      </form>
      {result.total === 0 ? (
        <EmptyState title={t("admin.list.empty")} hint={t("catalog.emptyListHint")} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {t("admin.list.count", { count: result.total })} · {t("admin.list.draftHint")}
          </p>
          <ResponsiveTable
            caption={t(TITLE_KEY[kind])}
            rows={result.items}
            rowKey={(i) => i.slug}
            columns={[
              { key: "name", header: t("admin.field.name"), render: (i) => <Link href={`${base}/${i.slug}`} className="font-medium text-accent underline-offset-4 hover:underline">{i.name}</Link> },
              { key: "category", header: t("catalog.category"), render: (i) => i.categoryName ?? <span className="text-muted">{t("common.unknown")}</span> },
              { key: "set", header: t("catalog.set"), render: (i) => i.setName ?? "" },
              { key: "stats", header: t("admin.stats.title"), render: (i) => i.stats.map((s) => `${s.statisticName} ${s.value === null ? "" : formatEffectValue(s.value, s.valueType)}`).join(", ") },
              { key: "status", header: t("admin.status"), render: (i) => <Tag tone={i.status === "PUBLISHED" ? "ok" : "warn"}>{t(`admin.publication.${i.status as "DRAFT"}`)}</Tag> },
            ]}
          />
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            hrefFor={(p) => hrefWith(base, raw, { page: p === 1 ? undefined : String(p) })}
            labels={{ previous: t("common.previous"), next: t("common.next"), status: t("common.pageOf", { page: result.page, pages: result.pageCount }), nav: t("common.pagination") }}
          />
        </>
      )}
    </>
  );
}

/** Create (slug === undefined) or edit one piece. Plain statistics are rows; special effects the rows cannot express are kept. */
export async function AdminItemEditor({ kind, slug, created }: { kind: ItemKind; slug?: string; created?: boolean }) {
  await requireAdminPage();
  const t = await getT();
  const api = await getGameApi();
  const [choices, item] = await Promise.all([api.listItemChoices(), slug ? api.getItemDetail(kind, slug, { includeUnpublished: true }) : Promise.resolve(null)]);
  if (slug && !item) notFound();
  const isNew = !item;
  const base = BASE[kind];
  const plain = (item?.effects ?? []).filter((e) => e.statisticName && e.kind === "STAT" && !e.status && e.conditions.length === 0 && e.targetFilters.length === 0);
  const texts = (item?.effects ?? []).filter((e) => e.kind === "TEXT" && e.description && e.conditions.length === 0).map((e) => e.description!);
  const special = (item?.effects.length ?? 0) - plain.length - texts.length;
  const statOptions = choices.statistics;
  const categories = kind === "equipment" ? choices.slots : kind === "jewelry" ? choices.jewelryTypes : choices.gemTypes;
  const sets = kind === "equipment" ? choices.equipmentSets : kind === "jewelry" ? choices.jewelrySets.map((s) => ({ value: s.value, label: s.label })) : [];
  const groups = kind === "jewelry" ? choices.jewelrySets.flatMap((s) => s.groups.map((g) => ({ value: g.value, label: `${s.label}: ${g.label}` }))) : [];
  const action = kind === "equipment" ? saveEquipmentAction : kind === "jewelry" ? saveJewelryAction : saveGemAction;
  const deleteAction = kind === "equipment" ? deleteEquipmentAction : kind === "jewelry" ? deleteJewelryAction : deleteGemAction;

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={base} className="text-muted underline underline-offset-4 hover:text-fg">
          ← {t("admin.nav.back")}
        </Link>
      </p>
      <PageHeader
        title={item ? item.name : t(NEW_KEY[kind])}
        actions={
          item ? (
            <Link href={`${PUBLIC[kind]}/${item.slug}`} className={buttonClass("ghost")}>
              {t("admin.actions.view")}
            </Link>
          ) : undefined
        }
      />
      {created && <p role="status" className="mb-4 text-sm text-ok">{t("admin.created")}</p>}
      <div className="flex flex-col gap-10">
        <AdminForm action={action} className="flex flex-col gap-6">
          {isNew ? <input type="hidden" name="isNew" value="true" /> : <input type="hidden" name="slug" value={item.slug} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="name" label={t("admin.field.name")} value={item?.name} required />
            {kind !== "gem" && <TextInput name="nameEs" label={t("admin.field.nameEs")} value={item?.nameEs} />}
            {isNew && <TextInput name="slug" label={t("admin.field.slug")} hint={t("admin.ninja.slugHint")} />}
            <Select name="typeKey" label={kind === "equipment" ? t("admin.field.slot") : t("admin.field.type")} empty={t("admin.field.none")} options={categories} value={item?.categoryKey} />
            {kind !== "gem" && <Select name="setSlug" label={t("admin.field.set")} empty={t("admin.field.none")} options={sets} value={item?.set?.detail.slug} />}
            {kind === "jewelry" && <Select name="groupKey" label={t("admin.field.group")} empty={t("admin.field.none")} options={groups.map((g) => ({ value: g.value, label: g.label }))} />}
            {kind === "gem" && <TextInput name="level" label={t("admin.item.gemLevel")} value={item?.level} inputMode="numeric" maxLength={3} />}
            <Select name="status" label={t("admin.field.publication")} options={(["DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((v) => ({ value: v, label: t(`admin.publication.${v}`) }))} value={item?.status ?? "DRAFT"} />
            {kind !== "gem" && <Select name="reviewStatus" label={t("admin.field.review")} options={(["CONFIRMED", "PARTIALLY_CONFIRMED", "NEEDS_REVIEW"] as const).map((v) => ({ value: v, label: t(`admin.review.${v}`) }))} value={item?.reviewStatus ?? "NEEDS_REVIEW"} />}
          </div>
          <TextArea name="description" label={t("admin.field.description")} value={item?.description} rows={3} />
          {kind !== "gem" && <TextArea name="descriptionEs" label={t("admin.field.descriptionEs")} value={item?.descriptionEs} rows={3} />}
          <StatRows
            prefix="effects"
            statistics={statOptions}
            existing={plain.map((e) => ({ statisticKey: e.statisticKey ?? "", value: e.value, unit: e.valueType }))}
            existingText={texts}
            t={t}
          />
          {special > 0 && <p className="text-xs text-muted">{t("admin.stats.keptSpecial", { count: special })}</p>}
        </AdminForm>
        {item && <DeleteForm action={deleteAction} confirmWith={item.slug} hidden={{ slug: item.slug }} t={t} />}
      </div>
    </>
  );
}
