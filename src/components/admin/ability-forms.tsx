import type { AbilityDetail, AwakeningDetail, NinjaDetail } from "@/game/ninjas";
import type { Translate } from "@/i18n";
import { deleteAbilityAction, saveAbilityAction } from "@/app/admin/actions";
import { AdminForm } from "./admin-form";
import { Select, TextArea, TextInput } from "./fields";
import { ReviewBadge } from "@/components/game/review-badge";

type Kind = "skill" | "normal_skill" | "special_skill" | "passive" | "talent" | "talent_awakening" | "skill_awakening";
const KINDS: Kind[] = ["skill", "normal_skill", "special_skill", "passive", "talent", "talent_awakening", "skill_awakening"];

interface Block {
  /** Present when editing. */
  id?: string;
  kind: Kind;
  name: string;
  nameEs: string | null;
  stage: number | null;
  description: string | null;
  descriptionEs: string | null;
  parentId?: string | null;
  reviewStatus?: AbilityDetail["reviewStatus"];
  effectCount?: number;
}

function AbilityForm({ ninjaSlug, block, parents, t }: { ninjaSlug: string; block?: Block; parents: { talents: { value: string; label: string }[]; skills: { value: string; label: string }[] }; t: Translate }) {
  const editing = Boolean(block?.id);
  const prefix = block?.id ?? "new";
  return (
    <AdminForm action={saveAbilityAction} submitLabel={editing ? t("common.save") : t("admin.actions.add")} className="flex flex-col gap-3">
      <input type="hidden" name="ninjaSlug" value={ninjaSlug} />
      {block?.id && <input type="hidden" name="existingId" value={block.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {editing ? (
          <>
            <input type="hidden" name="kind" value={block!.kind} />
            {block!.parentId && <input type="hidden" name="parentId" value={block!.parentId} />}
          </>
        ) : (
          <Select name="kind" label={t("admin.ninja.kindLabel")} options={KINDS.map((k) => ({ value: k, label: t(`admin.ninja.kind.${k}`) }))} value="skill" />
        )}
        <TextInput name="name" label={t("admin.field.name")} value={block?.name} required />
        <TextInput name="nameEs" label={t("admin.field.nameEs")} value={block?.nameEs} />
        <TextInput name="stage" label={t("admin.ninja.stage")} value={block?.stage} inputMode="numeric" maxLength={2} />
        {!editing && (
          <Select
            name="parentId"
            label={t("admin.ninja.parent")}
            empty={t("admin.field.none")}
            options={[
              ...parents.talents.map((o) => ({ value: o.value, label: `${t("admin.ninja.kind.talent")}: ${o.label}` })),
              ...parents.skills.map((o) => ({ value: o.value, label: `${t("admin.ninja.kind.skill")}: ${o.label}` })),
            ]}
          />
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <TextArea name="linesEn" label={t("admin.ninja.linesEn")} value={block?.description} rows={6} />
        <TextArea name="linesEs" label={t("admin.ninja.linesEs")} value={block?.descriptionEs} rows={6} />
      </div>
      {editing && <p className="text-xs text-muted">{t("admin.ninja.editRewrites")}</p>}
      {!editing && <input type="hidden" name="idPrefix" value={prefix} />}
    </AdminForm>
  );
}

const toBlock = (a: AbilityDetail | AwakeningDetail, parentId?: string | null): Block => ({
  id: a.id,
  kind: a.type.key as Kind,
  name: a.name,
  nameEs: a.nameEs,
  stage: a.stage,
  description: a.description,
  descriptionEs: a.descriptionEs,
  parentId,
  reviewStatus: a.reviewStatus,
  effectCount: a.effects.length,
});

/** The ninja's talents, skills and awakenings with an edit form for each, and one form to add another. */
export function AbilityEditor({ ninja, t }: { ninja: NinjaDetail; t: Translate }) {
  const talents = ninja.talentGroups.flatMap((g) => g.options.map((o) => ({ value: o.id, label: o.name })));
  const skills = ninja.abilities.filter((a) => ["skill", "normal_skill", "special_skill"].includes(a.type.key)).map((a) => ({ value: a.id, label: a.name }));
  const parents = { talents, skills };

  const rows: { key: string; heading: string; block: Block; what: "ability" | "talent"; review?: AbilityDetail["reviewStatus"]; readOnly?: boolean }[] = [];
  for (const g of ninja.talentGroups) {
    for (const o of g.options) {
      rows.push({
        key: o.id, heading: `${t("admin.ninja.kind.talent")}: ${o.name}`, what: "talent", review: o.reviewStatus,
        block: { id: o.id, kind: "talent", name: o.name, nameEs: o.nameEs, stage: null, description: o.description, descriptionEs: o.descriptionEs, reviewStatus: o.reviewStatus, effectCount: o.effects.length },
      });
      for (const w of o.awakenings) rows.push({ key: w.id, heading: `${t("admin.ninja.kind.talent_awakening")} ${w.stage ?? ""}: ${w.name}`, what: "ability", review: w.reviewStatus, block: toBlock(w, o.id) });
    }
  }
  for (const a of ninja.abilities) {
    rows.push({ key: a.id, heading: `${t(`admin.ninja.kind.${a.type.key as Kind}` as never) || a.type.name}: ${a.name}`, what: "ability", review: a.reviewStatus, block: toBlock(a), readOnly: a.type.key === "status_note" });
    for (const w of a.awakenings) rows.push({ key: w.id, heading: `${t("admin.ninja.kind.skill_awakening")} ${w.stage ?? ""}: ${w.name}`, what: "ability", review: w.reviewStatus, block: toBlock(w, a.id) });
  }

  return (
    <section className="flex flex-col gap-4" aria-labelledby="abilities">
      <h2 id="abilities" className="text-lg font-semibold">
        {t("admin.ninja.abilities")}
      </h2>
      <p className="text-sm text-muted">{t("admin.ninja.abilitiesHint")}</p>
      <p className="text-xs text-muted">{t("admin.ninja.awakeningRule")}</p>
      {rows.length === 0 && <p className="text-sm text-muted">{t("admin.ninja.none")}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.key} className="rounded-lg border border-border">
            <details>
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 px-3 text-sm font-medium">
                <span className="min-w-0 flex-1 break-words">{r.heading}</span>
                <span className="text-xs text-muted">{t("admin.ninja.lines", { count: r.block.effectCount ?? 0 })}</span>
                {r.review && <ReviewBadge status={r.review} t={t} />}
              </summary>
              <div className="flex flex-col gap-4 border-t border-border p-3">
                {r.readOnly ? <p className="whitespace-pre-line text-sm text-muted">{r.block.description}</p> : <AbilityForm ninjaSlug={ninja.slug} block={r.block} parents={parents} t={t} />}
                <AdminForm action={deleteAbilityAction} submitLabel={t("admin.actions.delete")} variant="ghost" className="flex items-center gap-3">
                  <input type="hidden" name="id" value={r.block.id} />
                  <input type="hidden" name="what" value={r.what} />
                </AdminForm>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <details className="rounded-lg border border-border">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">{t("admin.ninja.addAbility")}</summary>
        <div className="border-t border-border p-3">
          <AbilityForm ninjaSlug={ninja.slug} parents={parents} t={t} />
          {skills.length > 0 && <p className="mt-2 text-xs text-muted">{t("admin.ninja.awakeningRule")}</p>}
        </div>
      </details>
    </section>
  );
}
