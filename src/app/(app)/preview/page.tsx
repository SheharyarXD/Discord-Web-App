import { makeEffectView, resolveEffectUsage, type ConditionView, type EffectView, type StatusDefinitionView } from "@/domain/effects";
import type { TalentGroupView } from "@/domain/talents";
import { getStatusEffect } from "@/game/status-effects";
import { getT } from "@/i18n/server";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { Card, PageHeader } from "@/components/ui/primitives";
import { EffectList } from "@/components/game/effect-line";
import { TalentGroup } from "@/components/game/talent-group";
import { SetBonusList } from "@/components/game/set-bonus-list";
import { ResponsiveTable } from "@/components/ui/responsive-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Componentes" };

// PLACEHOLDER SAMPLES ONLY — invented labels to exercise the UI. Not game data.
const nature = (id: string, valueName: string, alternativeGroup: number): ConditionView => ({
  id, scope: "ACTIVATION", typeKey: "nature", typeName: "Naturaleza", valueKey: id, valueName,
  operator: "REQUIRES", numericValue: null, note: null, alternativeGroup,
});
const unconditional = makeEffectView({ id: "s1", statisticName: "Estadística A", value: 30, valueType: "PERCENT" });
const conditional = makeEffectView({
  id: "s2", statisticName: "Estadística A", value: 30, valueType: "PERCENT", durationTurns: 2, chancePercent: 50,
  conditions: [nature("c1", "Naturaleza X", 0), nature("c2", "Naturaleza Y", 1)],
});
const flat = makeEffectView({ id: "s3", statisticName: "Estadística B", value: 120, valueType: "FLAT" });
const unreviewed = makeEffectView({
  id: "s4", statisticName: "Estadística A", value: 10, valueType: "PERCENT", structuredStatus: "NEEDS_REVIEW",
  conditionText: "Texto de condición de muestra, todavía sin estructurar.",
});

const talents: TalentGroupView & { options: (TalentGroupView["options"][number] & { effects?: EffectView[] })[] } = {
  id: "g1", name: null, selectionMode: "ONE_OF", minSelections: 1, maxSelections: 1,
  options: [
    { id: "o1", name: "Talento A (muestra)", description: null, isDefault: false, effects: [flat] },
    { id: "o2", name: "Talento B (muestra)", description: null, isDefault: false, effects: [conditional] },
  ],
};

const rows = [
  { id: "r1", name: "Elemento de muestra 1", type: "Tipo A", value: "+10%" },
  { id: "r2", name: "Elemento de muestra 2", type: "Tipo B", value: "+250" },
];

/** The same dictionary status in two usages: one without an override, one with "(20%)". */
function overrideSamples(definition: StatusDefinitionView): { plain: EffectView; custom: EffectView } {
  const usage = (id: string, magnitudeOverride: number | null) =>
    makeEffectView({
      id,
      durationTurns: 2,
      status: { definition, magnitudeOverride, resolved: resolveEffectUsage(definition, { magnitudeOverride, durationTurns: 2 }) },
    });
  return { plain: usage("o-default", null), custom: usage("o-override", 20) };
}

export default async function PreviewPage() {
  await requireAdminPage();
  const t = await getT();
  const shatterStorm = await getStatusEffect(db, "shatter-storm");
  const override = shatterStorm && overrideSamples(shatterStorm);

  return (
    <>
      <PageHeader title={t("preview.title")} description={t("preview.description")} />
      <p className="mb-6 rounded-lg border border-warn/50 px-3 py-2 text-sm font-semibold text-warn" role="note">
        ⚠ {t("preview.sampleBanner")}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {override && (
          <Card className="lg:col-span-2">
            <h2 className="font-semibold">{t("preview.overrideSample")}</h2>
            <p className="mb-4 mt-1 text-xs text-muted">{t("preview.overrideNote")}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm text-muted">{t("preview.overrideDefault")}</h3>
                <EffectList effects={[override.plain]} t={t} />
              </div>
              <div>
                <h3 className="mb-2 text-sm text-muted">{t("preview.overrideCustom")}</h3>
                <EffectList effects={[override.custom]} t={t} />
              </div>
            </div>
          </Card>
        )}
        <Card>
          <h2 className="mb-3 font-semibold">{t("preview.unconditionalSample")}</h2>
          <EffectList effects={[unconditional]} t={t} />
          <h2 className="mb-3 mt-6 font-semibold">{t("preview.conditionalSample")}</h2>
          <EffectList effects={[conditional]} t={t} />
          <h2 className="mb-3 mt-6 font-semibold">{t("preview.reviewSample")}</h2>
          <EffectList effects={[unreviewed]} t={t} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">{t("preview.talentSample")}</h2>
          <TalentGroup group={talents} selectedOptionIds={["o1"]} t={t} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">{t("preview.setSample")}</h2>
          <SetBonusList
            t={t}
            bonuses={[
              { id: "b1", requiredPieces: 2, description: null, effects: [flat] },
              { id: "b2", requiredPieces: 4, description: null, effects: [conditional] },
              { id: "b3", requiredPieces: 6, description: null, effects: [unconditional] },
            ]}
          />
          <p className="mt-3 text-xs text-muted">{t("sets.stackingUnknown")}</p>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">{t("preview.tableSample")}</h2>
          <ResponsiveTable
            caption={t("preview.tableSample")}
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              { key: "name", header: t("table.name"), render: (r) => r.name },
              { key: "type", header: t("table.type"), render: (r) => r.type },
              { key: "value", header: t("table.value"), render: (r) => r.value },
            ]}
          />
        </Card>
      </div>
    </>
  );
}
