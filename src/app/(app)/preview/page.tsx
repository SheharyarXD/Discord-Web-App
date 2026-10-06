import { getT } from "@/i18n/server";
import type { EffectView } from "@/domain/effects";
import type { TalentGroupView } from "@/domain/talents";
import { Card, PageHeader } from "@/components/ui/primitives";
import { EffectList } from "@/components/game/effect-line";
import { TalentGroup } from "@/components/game/talent-group";
import { SetBonusList } from "@/components/game/set-bonus-list";
import { ResponsiveTable } from "@/components/ui/responsive-table";

export const metadata = { title: "Componentes" };

// PLACEHOLDER SAMPLES ONLY — invented labels to exercise the UI. Not game data.
const unconditional: EffectView = {
  id: "s1", statisticName: "Estadística A", value: 30, valueType: "PERCENT", targetName: null,
  durationTurns: null, chancePercent: null, description: null, conditions: [],
};
const conditional: EffectView = {
  id: "s2", statisticName: "Estadística A", value: 30, valueType: "PERCENT", targetName: null,
  durationTurns: 2, chancePercent: 50, description: null,
  conditions: [
    { id: "c1", typeKey: "nature", typeName: "Naturaleza", valueName: "Naturaleza X", operator: "REQUIRES", numericValue: null, note: null, alternativeGroup: 0 },
    { id: "c2", typeKey: "nature", typeName: "Naturaleza", valueName: "Naturaleza Y", operator: "REQUIRES", numericValue: null, note: null, alternativeGroup: 1 },
  ],
};
const flat: EffectView = { ...unconditional, id: "s3", statisticName: "Estadística B", value: 120, valueType: "FLAT" };

const talents: TalentGroupView & { options: (TalentGroupView["options"][number] & { effects?: EffectView[] })[] } = {
  id: "g1", name: null, selectionMode: "ONE_OF", minSelections: 1, maxSelections: 1,
  options: [
    { id: "o1", name: "Talento A (muestra)", description: null, isDefault: true, effects: [flat] },
    { id: "o2", name: "Talento B (muestra)", description: null, isDefault: false, effects: [conditional] },
  ],
};

const rows = [
  { id: "r1", name: "Elemento de muestra 1", type: "Tipo A", value: "+10%" },
  { id: "r2", name: "Elemento de muestra 2", type: "Tipo B", value: "+250" },
];

export default async function PreviewPage() {
  const t = await getT();
  return (
    <>
      <PageHeader title={t("preview.title")} description={t("preview.description")} />
      <p className="mb-6 rounded-lg border border-warn/50 px-3 py-2 text-sm font-semibold text-warn" role="note">
        ⚠ {t("preview.sampleBanner")}
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">{t("preview.unconditionalSample")}</h2>
          <EffectList effects={[unconditional]} t={t} />
          <h2 className="mb-3 mt-6 font-semibold">{t("preview.conditionalSample")}</h2>
          <EffectList effects={[conditional]} t={t} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">{t("preview.talentSample")}</h2>
          <TalentGroup group={talents} t={t} />
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
