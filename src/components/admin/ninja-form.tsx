import type { NinjaDetail } from "@/game/ninjas";
import type { Translate } from "@/i18n";
import { saveNinjaAction } from "@/app/admin/actions";
import { AdminForm } from "./admin-form";
import { Select, TextArea, TextInput } from "./fields";

export interface NinjaFormChoices {
  ratings: { key: string; name: string }[];
  allFormations: { key: string; name: string }[];
  types: { key: string; name: string }[];
  roles: { key: string; name: string }[];
  baseStatistics: { key: string; name: string }[];
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

/** Core data of one ninja: names, card data, base statistics, aliases, publication state. Abilities are edited below it. */
export function NinjaForm({ ninja, choices, t }: { ninja?: NinjaDetail; choices: NinjaFormChoices; t: Translate }) {
  const isNew = !ninja;
  const stat = (key: string) => ninja?.baseStats.find((s) => s.statisticKey === key);
  const aliasOf = (kind: string) =>
    (ninja?.aliases ?? [])
      .filter((a) => a.kind === kind)
      .map((a) => a.alias)
      .join("\n");
  return (
    <AdminForm action={saveNinjaAction} className="flex flex-col gap-8">
      {isNew ? <input type="hidden" name="isNew" value="true" /> : <input type="hidden" name="slug" value={ninja.slug} />}

      <section className="flex flex-col gap-4" aria-labelledby="basics">
        <h2 id="basics" className="text-lg font-semibold">
          {t("admin.ninja.basics")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput name="name" label={t("admin.field.name")} value={ninja?.name} required />
          <TextInput name="nameEs" label={t("admin.field.nameEs")} value={ninja?.nameEs} />
          {isNew ? (
            <TextInput name="slug" label={t("admin.field.slug")} hint={t("admin.ninja.slugHint")} />
          ) : (
            <div className="flex min-w-0 flex-col gap-1.5">
              <p className="text-sm font-medium">{t("admin.field.slug")}</p>
              <p className="break-all font-mono text-sm">{ninja.slug}</p>
              <p className="text-xs text-muted">{t("admin.ninja.slugHint")}</p>
            </div>
          )}
        </div>
        <TextArea name="description" label={t("admin.field.description")} value={ninja?.description} rows={3} />
        <TextArea name="descriptionEs" label={t("admin.field.descriptionEs")} value={ninja?.descriptionEs} rows={3} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select name="ratingKey" label={t("admin.field.rating")} empty={t("admin.field.none")} options={choices.ratings.map((r) => ({ value: r.key, label: r.name }))} value={ninja?.rating?.key} />
          <Select name="formationKey" label={t("admin.field.formation")} empty={t("admin.field.none")} options={choices.allFormations.map((f) => ({ value: f.key, label: f.name }))} value={ninja?.formation?.origin === "DIRECT" ? ninja.formation.key : undefined} />
          <Select name="typeKey" label={t("admin.field.type")} empty={t("admin.field.none")} options={choices.types.map((x) => ({ value: x.key, label: x.name }))} value={ninja?.type?.key} />
          <Select name="roleKey" label={t("admin.field.role")} empty={t("admin.field.none")} options={choices.roles.map((x) => ({ value: x.key, label: x.name }))} value={ninja?.role?.key} />
          <Select
            name="combatClass"
            label={t("admin.field.combatClass")}
            hint={t("admin.ninja.classHint")}
            empty={t("admin.field.none")}
            options={[{ value: "TANK", label: t("filters.classValue.TANK") }, { value: "DPS", label: t("filters.classValue.DPS") }]}
            value={ninja?.clientCombatClass}
          />
          <TextInput name="releaseYear" label={t("admin.field.releaseYear")} value={ninja?.release?.year} inputMode="numeric" maxLength={4} />
          <Select name="releaseMonth" label={t("admin.field.releaseMonth")} empty={t("admin.field.none")} options={MONTHS} value={ninja?.release ? String(ninja.release.month) : undefined} />
          <Select name="status" label={t("admin.field.publication")} options={(["DRAFT", "PUBLISHED", "ARCHIVED"] as const).map((v) => ({ value: v, label: t(`admin.publication.${v}`) }))} value={ninja?.status ?? "DRAFT"} />
          <Select name="reviewStatus" label={t("admin.field.review")} options={(["CONFIRMED", "PARTIALLY_CONFIRMED", "NEEDS_REVIEW"] as const).map((v) => ({ value: v, label: t(`admin.review.${v}`) }))} value={ninja?.reviewStatus ?? "NEEDS_REVIEW"} />
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="names">
        <h2 id="names" className="text-lg font-semibold">
          {t("admin.ninja.names")}
        </h2>
        <p className="text-sm text-muted">{t("admin.ninja.namesHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea name="cardNames" label={t("admin.field.cardNames")} value={aliasOf("CARD_NAME")} rows={3} />
          <TextArea name="otherNames" label={t("admin.field.otherNames")} value={aliasOf("SOURCE_NAME")} rows={3} />
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="stats">
        <h2 id="stats" className="text-lg font-semibold">
          {t("admin.ninja.baseStats")}
        </h2>
        <p className="text-sm text-muted">{t("admin.ninja.baseStatsHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {choices.baseStatistics.map((s) => {
            const current = stat(s.key);
            return (
              <fieldset key={s.key} className="rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-medium">{s.name}</legend>
                <input type="hidden" name={`label_${s.key}`} value={current?.sourceLabel ?? s.name} />
                <div className="grid grid-cols-2 gap-2">
                  <TextInput name={`base_${s.key}`} label={t("admin.ninja.baseValue")} value={current?.baseValue} inputMode="decimal" />
                  <TextInput name={`growth_${s.key}`} label={t("admin.ninja.growth")} value={current?.growthRate} inputMode="decimal" />
                </div>
                {current && current.sourceLabel !== s.name && <p className="mt-1 text-xs text-muted">{current.sourceLabel}</p>}
              </fieldset>
            );
          })}
        </div>
      </section>
    </AdminForm>
  );
}
