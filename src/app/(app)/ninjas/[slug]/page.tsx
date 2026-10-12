import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { formatReleasePeriod } from "@/domain/ninja";
import { getT } from "@/i18n/server";
import { requireUser } from "@/server/auth/guards";
import { getNinjaBySlug } from "@/server/queries/ninjas";
import { Card, PageHeader, Tag } from "@/components/ui/primitives";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { EffectList } from "@/components/game/effect-line";
import { Localized } from "@/components/game/localized";
import { ReviewBadge } from "@/components/game/review-badge";
import { TalentGroup } from "@/components/game/talent-group";
import { selectTalentAction } from "./actions";

export const dynamic = "force-dynamic";

function Fact({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

const number = new Intl.NumberFormat("es", { maximumFractionDigits: 4 });

/** Read-only view of what is stored for one ninja. Fields without data say so; nothing is filled in. */
export default async function NinjaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const ninja = await getNinjaBySlug(slug, user.id);
  if (!ninja) notFound();
  const t = await getT();
  const unknown = <span className="text-muted">{t("common.unknown")}</span>;
  const sparse = ninja.baseStats.length === 0 && ninja.abilities.length === 0 && ninja.talentGroups.length === 0 && !ninja.rating && !ninja.formation;

  return (
    <>
      <PageHeader title={ninja.nameEs ?? ninja.name} actions={<ReviewBadge status={ninja.reviewStatus} t={t} />} />
      {ninja.description && (
        <p className="-mt-3 mb-6 max-w-2xl text-sm italic text-muted">
          <Localized source={ninja.description} spanish={ninja.descriptionEs} status={ninja.translationStatus} t={t} />
        </p>
      )}
      {sparse && <p className="mb-6 rounded-lg border border-border px-3 py-2 text-sm text-muted">{t("ninja.sparse")}</p>}

      <section className="mb-8" aria-labelledby="profile">
        <h2 id="profile" className="mb-3 text-lg font-semibold">
          {t("ninja.profile")}
        </h2>
        <Card>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label={t("ninja.release")}>{ninja.release ? formatReleasePeriod(ninja.release) : <span className="text-muted">{t("ninja.releaseUnknown")}</span>}</Fact>
            <Fact label={t("ninja.rating")}>{ninja.rating ? <Tag tone="warn">{ninja.rating.name}</Tag> : unknown}</Fact>
            <Fact label={t("ninja.type")}>{ninja.type ? (ninja.type.nameEs ?? ninja.type.name) : unknown}</Fact>
            <Fact
              label={t("ninja.formation")}
              hint={ninja.formation?.origin === "APPROVED_MAPPING" ? t("ninja.formationFromMapping") : undefined}
            >
              {ninja.formation ? (
                <>
                  {ninja.formation.nameEs ?? ninja.formation.name}
                  {ninja.formation.nameEs && <span className="text-muted"> ({ninja.formation.name})</span>}
                </>
              ) : (
                <span className="text-muted">{t("ninja.formationUnknown")}</span>
              )}
            </Fact>
            <Fact label={t("ninja.primaryStat")} hint={ninja.primaryStat ? t("ninja.primaryStatHint") : undefined}>
              {ninja.primaryStat ? ninja.primaryStat.name : unknown}
            </Fact>
            <Fact label={t("ninja.combatClass")} hint={t("ninja.combatClassHint")}>
              {ninja.clientCombatClass ? (
                <Tag>{t(`ninja.combatClassValue.${ninja.clientCombatClass}`)}</Tag>
              ) : (
                <span className="text-muted">{t("ninja.combatClassUnassigned")}</span>
              )}
            </Fact>
            <Fact
              label={t("ninja.sourceCategory")}
              hint={
                ninja.role
                  ? ninja.role.mappingStatus === "PROPOSED" && ninja.role.proposedFormationName
                    ? t("ninja.mappingProposed", { formation: ninja.role.proposedFormationName })
                    : t("ninja.sourceCategoryHint")
                  : undefined
              }
            >
              {ninja.role ? ninja.role.name : unknown}
            </Fact>
            <Fact label={t("ninja.natures")}>
              {ninja.natures.length > 0 ? ninja.natures.map((n) => n.name).join(", ") : <span className="text-muted">{t("ninja.noNatures")}</span>}
            </Fact>
          </dl>
        </Card>
      </section>

      <section className="mb-8" aria-labelledby="base-stats">
        <h2 id="base-stats" className="mb-3 text-lg font-semibold">
          {t("ninja.baseStats")}
        </h2>
        {ninja.baseStats.length === 0 ? (
          <p className="text-sm text-muted">{t("ninja.noBaseStats")}</p>
        ) : (
          <Card>
            <ResponsiveTable
              caption={t("ninja.baseStats")}
              rows={ninja.baseStats}
              rowKey={(s) => s.statisticKey}
              columns={[
                {
                  key: "stat",
                  header: t("ninja.stat"),
                  render: (s) => (
                    <>
                      <span className="font-medium">{s.sourceLabel}</span>
                      {s.isPrimary && <span className="ml-2 text-xs text-accent">★ {t("ninja.primaryMark")}</span>}
                    </>
                  ),
                },
                { key: "base", header: t("ninja.baseValue"), render: (s) => <span className="tabular-nums">{number.format(Number(s.baseValue))}</span> },
                {
                  key: "growth",
                  header: t("ninja.growthRate"),
                  render: (s) => (s.growthRate === null ? unknown : <span className="tabular-nums">{number.format(Number(s.growthRate))}</span>),
                },
              ]}
            />
          </Card>
        )}
      </section>

      <section className="mb-8" aria-labelledby="abilities">
        <h2 id="abilities" className="mb-3 text-lg font-semibold">
          {t("ninja.abilities")}
        </h2>
        {ninja.abilities.length === 0 ? (
          <p className="text-sm text-muted">{t("ninja.noAbilities")}</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {ninja.abilities.map((a) => (
              <Card key={a.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                    {a.type.name}
                    {a.stage !== null && ` · ${t("ninja.stage", { stage: a.stage })}`}
                  </p>
                  <ReviewBadge status={a.reviewStatus} t={t} />
                </div>
                <h3 className="mt-1 font-semibold">{a.nameEs ?? a.name}</h3>
                {a.description ? (
                  <p className="mt-1 text-sm text-muted">
                    <Localized source={a.description} spanish={a.descriptionEs} status={a.translationStatus} t={t} />
                  </p>
                ) : (
                  a.effects.length === 0 && <p className="mt-1 text-sm text-muted">{t("ninja.nameOnly")}</p>
                )}
                {a.triggerText && (
                  <p className="mt-1 text-xs text-muted">
                    {t("ninja.trigger")}: {a.triggerText}
                  </p>
                )}
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

      <section className="mb-8" aria-labelledby="talents">
        <h2 id="talents" className="mb-3 text-lg font-semibold">
          {t("ninja.talents")}
        </h2>
        {ninja.talentGroups.length === 0 ? (
          <p className="text-sm text-muted">{t("ninja.noTalents")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {ninja.talentGroups.map((g) => (
              <TalentGroup
                key={g.id}
                group={g}
                selectedOptionIds={g.selectedOptionIds}
                selectAction={selectTalentAction}
                hiddenFields={{ slug: ninja.slug }}
                pendingReview={g.reviewStatus !== "CONFIRMED"}
                t={t}
              />
            ))}
          </div>
        )}
      </section>

      {ninja.sources.length > 0 && (
        <details className="rounded-[var(--radius-card)] border border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {t("ninja.sources")} ({ninja.sources.length})
          </summary>
          <p className="mt-2 text-xs text-muted">{t("ninja.sourcesHint")}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {ninja.sources.map((s, i) => (
              <li key={i} className="border-t border-border/60 pt-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <ReviewBadge status={s.reviewStatus} t={t} />
                  <span className="break-all text-muted">{s.assetPath.split("/").pop()}</span>
                </div>
                {s.sourceText && <q className="mt-1 block">{s.sourceText}</q>}
                {s.ambiguityNote && <p className="mt-1 text-warn">{s.ambiguityNote}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
