import { notFound } from "next/navigation";
import { getT } from "@/i18n/server";
import { getNinjaBySlug } from "@/server/queries/ninjas";
import { Card, PageHeader } from "@/components/ui/primitives";
import { EffectList } from "@/components/game/effect-line";
import { TalentGroup } from "@/components/game/talent-group";

export const dynamic = "force-dynamic";

export default async function NinjaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ninja = await getNinjaBySlug(slug);
  if (!ninja) notFound();
  const t = await getT();

  return (
    <>
      <PageHeader title={ninja.name} description={ninja.description ?? undefined} />
      <p className="mb-6 text-sm text-muted">
        {t("ninja.role")}: <span className="font-semibold text-fg">{ninja.role?.name ?? t("ninja.noRole")}</span>
      </p>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">{t("ninja.abilities")}</h2>
        {ninja.abilities.length === 0 ? (
          <p className="text-sm text-muted">{t("ninja.noAbilities")}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {ninja.abilities.map((a) => (
              <Card key={a.id}>
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">{a.abilityType.name}</p>
                <h3 className="font-semibold">{a.name}</h3>
                {a.description && <p className="mt-1 text-sm text-muted">{a.description}</p>}
                {a.effects.length > 0 && (
                  <div className="mt-3">
                    <EffectList effects={a.effects} t={t} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t("ninja.talents")}</h2>
        {ninja.talentGroups.length === 0 ? (
          <p className="text-sm text-muted">{t("ninja.noTalents")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {ninja.talentGroups.map((g) => (
              <TalentGroup key={g.id} group={g} t={t} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
