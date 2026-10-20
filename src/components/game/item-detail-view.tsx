import Link from "next/link";
import type { ItemDetail } from "@/game/catalog";
import type { EquipmentSetDetail, JewelrySetDetail } from "@/game/items";
import { formatEffectValue } from "@/domain/effects";
import type { Translate } from "@/i18n";
import { Card, PageHeader, Tag } from "@/components/ui/primitives";
import { EffectList } from "./effect-line";
import { Localized } from "./localized";
import { ReviewBadge } from "./review-badge";
import { SetBonusList } from "./set-bonus-list";

/** Everything stored about one equipment piece, jewelry piece or gem. The set's tiers are shown apart from the piece's own statistics. */
export function ItemDetailView({ item, t, listHref }: { item: ItemDetail; t: Translate; listHref: string }) {
  const set = item.set;
  const setBase = set ? (set.kind === "equipment" ? "equipment" : "jewelry") : null;
  return (
    <>
      <p className="mb-2 text-sm">
        <Link href={listHref} className="text-muted underline underline-offset-4 hover:text-fg">
          ← {t("catalog.back")}
        </Link>
      </p>
      <PageHeader title={item.nameEs ?? item.name} actions={item.reviewStatus ? <ReviewBadge status={item.reviewStatus} t={t} /> : undefined} />
      {item.description && (
        <p className="-mt-3 mb-6 max-w-2xl text-sm italic text-muted">
          <Localized source={item.description} spanish={item.descriptionEs} status={item.descriptionEs ? "SOURCE_PROVIDED" : "MISSING"} t={t} />
        </p>
      )}

      <section className="mb-8" aria-labelledby="profile">
        <h2 id="profile" className="mb-3 text-lg font-semibold">
          {t("ninja.profile")}
        </h2>
        <Card>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("catalog.category")}</dt>
              <dd className="mt-0.5 text-sm">{item.categoryName ?? <span className="text-muted">{t("common.unknown")}</span>}</dd>
            </div>
            {item.level !== null && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("catalog.level", { level: "" }).trim()}</dt>
                <dd className="mt-0.5 text-sm">{item.level}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("catalog.set")}</dt>
              <dd className="mt-0.5 text-sm">
                {set ? (
                  <Link href={`/sets/${setBase}/${set.detail.slug}`} className="text-accent underline underline-offset-4">
                    {set.detail.nameEs ?? set.detail.name}
                  </Link>
                ) : (
                  <span className="text-muted">{t("catalog.noSet")}</span>
                )}
              </dd>
            </div>
            {item.status !== "PUBLISHED" && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("admin.status")}</dt>
                <dd className="mt-0.5">
                  <Tag tone="warn">{t("catalog.draft")}</Tag>
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </section>

      <section className="mb-8" aria-labelledby="own-stats">
        <h2 id="own-stats" className="mb-3 text-lg font-semibold">
          {t("catalog.ownStats")}
        </h2>
        {item.effects.length === 0 ? <p className="text-sm text-muted">{t("catalog.noStats")}</p> : <EffectList effects={item.effects} t={t} />}
      </section>

      {set && (
        <section className="mb-8" aria-labelledby="set-bonuses">
          <h2 id="set-bonuses" className="mb-1 text-lg font-semibold">
            {t("catalog.setBonuses")}: {set.detail.nameEs ?? set.detail.name}
          </h2>
          <p className="mb-3 text-xs text-muted">{t("catalog.setNote")}</p>
          <SetTiers kind={set.kind} detail={set.detail} t={t} />
        </section>
      )}

      {item.sources.length > 0 && (
        <details className="rounded-[var(--radius-card)] border border-border p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            {t("ninja.sources")} ({item.sources.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {item.sources.map((s, i) => (
              <li key={i} className="border-t border-border/60 pt-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <ReviewBadge status={s.reviewStatus} t={t} />
                  <span className="break-all text-muted">{s.assetPath.split("/").pop()}</span>
                </div>
                {s.sourceText && <q className="mt-1 block whitespace-pre-line">{s.sourceText}</q>}
                {s.ambiguityNote && <p className="mt-1 text-warn">{s.ambiguityNote}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** The tiers of a set exactly as stored. Nothing is summed: while stacking is unknown, a notice says so. */
export function SetTiers({ kind, detail, t }: { kind: "equipment" | "jewelry"; detail: EquipmentSetDetail | JewelrySetDetail; t: Translate }) {
  const tiers = kind === "equipment" ? (detail as EquipmentSetDetail).tiers : (detail as JewelrySetDetail).bonuses;
  return (
    <div className="flex flex-col gap-3">
      {detail.tierStacking === "UNKNOWN" && tiers.length > 1 && (
        <p className="text-xs text-warn" data-stacking-unknown>
          <span aria-hidden>⚠ </span>
          {t("sets.stackingUnknown")}
        </p>
      )}
      {kind === "jewelry" && (detail as JewelrySetDetail).structureStatus === "UNCONFIRMED" && (
        <p className="text-xs text-warn">
          <span aria-hidden>⚠ </span>
          {t("catalog.structureUnconfirmed")}
        </p>
      )}
      <SetBonusList
        t={t}
        bonuses={tiers.map((b) => ({
          id: b.id,
          requiredPieces: b.requiredPieces ?? null,
          requiredItemNames: "requiredItemNames" in b ? b.requiredItemNames : undefined,
          description: b.description ?? (("groupName" in b && b.groupName) ? t("catalog.requiresGroup", { group: b.groupName }) : null),
          effects: b.effects,
        }))}
      />
    </div>
  );
}

export { formatEffectValue };
