import type { StatusDefinitionView } from "@/domain/effects";
import { getT } from "@/i18n/server";
import type { Translate } from "@/i18n";
import { listGlossary } from "@/server/queries/glossary";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { StatusDefinitionBody } from "@/components/game/status-definition";

export const dynamic = "force-dynamic";
export const metadata = { title: "Efectos" };

function Entry({ entry, t }: { entry: StatusDefinitionView; t: Translate }) {
  return (
    <li id={entry.key} className="scroll-mt-20">
      <Card className="h-full">
        <h3 className="font-semibold">{entry.nameEs ?? entry.name}</h3>
        {entry.aliases.length > 0 && (
          <p className="mb-2 mt-0.5 text-xs text-muted">
            {t("glossary.aliases")}: {entry.aliases.join(" · ")}
          </p>
        )}
        <div className="mt-2">
          <StatusDefinitionBody definition={entry} t={t} />
        </div>
        {entry.note && (
          <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted">
            {t("glossary.note")}: {entry.note}
          </p>
        )}
      </Card>
    </li>
  );
}

/**
 * Read-only glossary of statuses and terms. Each entry shows its independent facets
 * (buff/debuff, cleansable or not, categories) and its DEFAULT numbers; a ninja's own
 * numbers are shown where that ninja uses the status.
 */
export default async function EffectsPage() {
  const t = await getT();
  const entries = await listGlossary();
  const statuses = entries.filter((e) => e.kind === "STATUS");
  const terms = entries.filter((e) => e.kind === "TERM");

  return (
    <>
      <PageHeader title={t("sections.effects.title")} description={t("sections.effects.description")} />
      {entries.length === 0 ? (
        <EmptyState title={t("glossary.empty")} hint={t("common.emptyHint")} />
      ) : (
        <>
          <p className="mb-6 text-sm text-muted">{t("glossary.count", { count: entries.length })}</p>
          {terms.length > 0 && (
            <section className="mb-8" aria-labelledby="terms">
              <h2 id="terms" className="mb-3 text-lg font-semibold">
                {t("glossary.terms")}
              </h2>
              <ul className="grid gap-3 lg:grid-cols-3">
                {terms.map((e) => (
                  <Entry key={e.key} entry={e} t={t} />
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="statuses">
            <h2 id="statuses" className="mb-3 text-lg font-semibold">
              {t("glossary.statuses")}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {statuses.map((e) => (
                <Entry key={e.key} entry={e} t={t} />
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
