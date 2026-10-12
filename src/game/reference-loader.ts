import { readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { seedVocabulary } from "../../prisma/vocabulary";
import type { ReviewStatus } from "../domain/constants";
import { isValidReleasePeriod, releasePeriodKey } from "../domain/ninja";
import { slugify } from "../domain/slug";
import { upsertNinja, vocabulary } from "./ninjas";
import { recordEvidence, registerAsset } from "./provenance";
import type { StatusEffectInput } from "./schemas";
import { ensureStatusCategory, upsertStatusEffect } from "./status-effects";

/**
 * Loads the STAGED reference data (data/reference/*.json) into the database.
 *
 *  - Operator-run only (`npm run db:ingest`). It reads local files that a person transcribed
 *    from the supplied screenshots; it never contacts Discord or any other network service.
 *  - Idempotent: every record is upserted on a stable key, so it can be re-run after a correction.
 *  - Non-destructive: nothing is truncated and no child record is pruned.
 *  - Sparse on purpose: a ninja known only from the release list gets a name and a release
 *    period and nothing else.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Evidence {
  asset: string;
  section?: string;
  sourceText?: string;
  reviewStatus: ReviewStatus;
}

interface SourcesFile {
  assets: {
    path: string;
    category: "SCREENSHOT" | "CLIENT_MESSAGE" | "DOCUMENT";
    section: string;
    description: string;
    capturedNote?: string;
    fullyLegible: boolean;
    duplicateOf?: string;
    remainingQuestions: string;
    notes: string;
  }[];
}

interface VocabularyFile {
  ratings: { evidence: Evidence; rows: string[] };
  baseStatistics: { evidence: Evidence; rows: { key: string; name: string }[] };
  guideStatistics: { rows: { key: string; name: string; note?: string }[] };
  formations: {
    evidenceEs: Evidence;
    evidenceRule: Evidence;
    rows: { key: string; name: string; nameEs: string; positionNote: string; primaryStatisticKey: string; maxPerTeam: number }[];
  };
  roles: {
    rows: { key: string; name: string; mappedFormationKey: string; mappingStatus: "PROPOSED" | "APPROVED" | "UNMAPPED"; mappingNote: string; evidence: Evidence }[];
  };
  statusCategories: { rows: { key: string; name: string; nameEs: string }[] };
}

type GlossaryEntry = Partial<StatusEffectInput> & {
  name: string;
  sourceText?: string;
  ambiguityNote?: string;
  /** Listed again under another heading: adds evidence, never a second definition. */
  mergeOnly?: boolean;
};
interface GlossaryFile {
  sections: { asset: string; heading: string; defaults: Partial<StatusEffectInput>; entries: GlossaryEntry[] }[];
}

export interface ReleaseFile {
  captures: { asset: string; fullFrom: number; fullTo: number; partial: number[]; note: string }[];
  entries: [year: number, month: number, name: string][];
}

interface CardsFile {
  cards: {
    name: string;
    asset: string;
    reviewStatus: ReviewStatus;
    roleKey: string;
    roleEvidence: string;
    formationKey: string;
    ratingKey: string;
    type: { key: string; name: string };
    description: string;
    baseStats: { statisticKey: string; sourceLabel: string; baseValue: string; growthRate: string }[];
    skill: { name: string };
    talent: { name: string };
    talentNote: string;
    skillNote: string;
    cardSourceText: string;
  }[];
}

export interface StagedEvidenceFile {
  items: {
    key: string;
    asset: string;
    alsoIn: string[];
    kind: string;
    ownerName: string | null;
    abilityName: string | null;
    statusKey: string | null;
    rawText: string;
    defaultStatModifierPercent: number | null;
    usageOverridePercent: number | null;
    applicationChancePercent: number | null;
    durationRounds: number | null;
    targetOriginal: string | null;
    requiredNature: string | null;
    otherConditions: string | null;
    reviewStatus: ReviewStatus;
    ambiguityNote: string;
  }[];
}

export function readReferenceFile<T>(dir: string, name: string): T {
  return JSON.parse(readFileSync(path.join(dir, name), "utf8")) as T;
}

const assetName = (assetPath: string) => path.posix.basename(assetPath);

// ───────────────────────── Release list analysis (pure) ─────────────────────────

export interface ReleaseEntry {
  order: number;
  name: string;
  slug: string;
  year: number;
  month: number;
  /** Captures showing this line in full. */
  fullIn: string[];
  /** Captures showing this line only partly. */
  partialIn: string[];
}

export interface ReleaseAnalysis {
  entries: ReleaseEntry[];
  /** Same slug listed more than once — never inserted twice; needs a human decision. */
  duplicateSlugs: { slug: string; names: string[] }[];
  invalid: string[];
  /** Calendar months between the first and last entry with no entry. */
  gapMonths: string[];
  /** Months holding more than one entry (ordering then relies on the source position). */
  sharedMonths: string[];
  /** Consecutive captures that share no fully legible line, so their join is not cross-checked. */
  uncheckedBoundaries: { afterAsset: string; beforeAsset: string; afterOrder: number }[];
  /** Entries no capture shows in full. */
  neverFullyLegible: number[];
  first: string | null;
  last: string | null;
}

/** Turns the staged release file into checked entries plus an explicit gap/ambiguity report. */
export function analyzeReleaseList(file: ReleaseFile): ReleaseAnalysis {
  const invalid: string[] = [];
  const entries: ReleaseEntry[] = file.entries.map(([year, month, name], i) => {
    const order = i + 1;
    if (!isValidReleasePeriod({ year, month }) || !name.trim() || !slugify(name)) invalid.push(`line ${order}: ${name}`);
    return {
      order,
      name,
      slug: slugify(name),
      year,
      month,
      fullIn: file.captures.filter((c) => order >= c.fullFrom && order <= c.fullTo).map((c) => c.asset),
      partialIn: file.captures.filter((c) => c.partial.includes(order)).map((c) => c.asset),
    };
  });

  const bySlug = new Map<string, string[]>();
  for (const e of entries) bySlug.set(e.slug, [...(bySlug.get(e.slug) ?? []), e.name]);
  const duplicateSlugs = [...bySlug].filter(([, names]) => names.length > 1).map(([slug, names]) => ({ slug, names }));

  const periods = entries.map((e) => e.year * 12 + (e.month - 1));
  const counts = new Map<number, number>();
  for (const p of periods) counts.set(p, (counts.get(p) ?? 0) + 1);
  const toKey = (p: number) => releasePeriodKey({ year: Math.floor(p / 12), month: (p % 12) + 1 });
  const gapMonths: string[] = [];
  if (periods.length) {
    for (let p = Math.min(...periods); p <= Math.max(...periods); p++) if (!counts.has(p)) gapMonths.push(toKey(p));
  }

  const ordered = [...file.captures].sort((a, b) => a.fullFrom - b.fullFrom);
  const uncheckedBoundaries: ReleaseAnalysis["uncheckedBoundaries"] = [];
  let coveredTo = 0;
  let coveredBy = "";
  for (const c of ordered) {
    if (coveredTo && c.fullFrom > coveredTo) uncheckedBoundaries.push({ afterAsset: coveredBy, beforeAsset: c.asset, afterOrder: coveredTo });
    if (c.fullTo > coveredTo) {
      coveredTo = c.fullTo;
      coveredBy = c.asset;
    }
  }

  const sorted = [...periods].sort((a, b) => a - b);
  return {
    entries,
    duplicateSlugs,
    invalid,
    gapMonths,
    sharedMonths: [...counts].filter(([, n]) => n > 1).map(([p]) => toKey(p)),
    uncheckedBoundaries,
    neverFullyLegible: entries.filter((e) => e.fullIn.length === 0).map((e) => e.order),
    first: sorted.length ? toKey(sorted[0]!) : null,
    last: sorted.length ? toKey(sorted[sorted.length - 1]!) : null,
  };
}

// ───────────────────────── Loader ─────────────────────────

export interface ReferenceInventory {
  assets: { registered: number; screenshots: number; duplicates: number };
  release: {
    staged: number;
    ninjasCreated: number;
    ninjasUpdated: number;
    releaseChanged: string[];
    skippedDuplicates: string[];
    first: string | null;
    last: string | null;
    gapMonths: string[];
    sharedMonths: string[];
    uncheckedBoundaries: ReleaseAnalysis["uncheckedBoundaries"];
    evidenceRecords: number;
  };
  cards: { ingested: string[] };
  glossary: { entries: number; terms: number; statuses: number; withStructuredModifiers: number; partiallyConfirmed: string[]; evidenceRecords: number };
  vocabulary: { ratings: number; formations: number; roles: number; statistics: number; statusCategories: number };
  staged: { withoutRecords: string[] };
  equipment: { sets: number; pieces: number };
  jewelry: { sets: number; pieces: number };
  totals: Record<string, number>;
}

export async function loadReferenceData(db: PrismaClient, dir = path.resolve("data/reference")): Promise<ReferenceInventory> {
  const sources = readReferenceFile<SourcesFile>(dir, "sources.json");
  const vocab = readReferenceFile<VocabularyFile>(dir, "vocabulary.json");
  const glossary = readReferenceFile<GlossaryFile>(dir, "status-glossary.json");
  const release = readReferenceFile<ReleaseFile>(dir, "release-order.json");
  const cards = readReferenceFile<CardsFile>(dir, "ninja-cards.json");
  const staged = readReferenceFile<StagedEvidenceFile>(dir, "staged-evidence.json");

  // 1. Structural vocabulary (kinds of ability / condition / target) and status facets.
  await seedVocabulary(db);
  for (const [sortOrder, c] of vocab.statusCategories.rows.entries()) await ensureStatusCategory(db, { ...c, sortOrder });

  // 2. Assets, originals before the captures that duplicate them.
  const assets = [...sources.assets].sort((a, b) => Number(Boolean(a.duplicateOf)) - Number(Boolean(b.duplicateOf)));
  for (const a of assets) {
    await registerAsset(db, {
      path: a.path,
      category: a.category,
      description: a.description,
      capturedNote: a.capturedNote,
      reviewed: true,
      fullyLegible: a.fullyLegible,
      duplicateOfPath: a.duplicateOf,
      notes: [a.notes, a.remainingQuestions && `Open question: ${a.remainingQuestions}`].filter(Boolean).join(" ") || null,
    });
  }
  const evidence = (key: string, e: Evidence, field: string, target?: Parameters<typeof recordEvidence>[2]) =>
    recordEvidence(db, { key, assetPath: e.asset, section: e.section, field, sourceText: e.sourceText, reviewStatus: e.reviewStatus }, target);

  // 3. Statistics, formations, source categories, ratings.
  for (const [sortOrder, s] of vocab.baseStatistics.rows.entries()) {
    const row = await vocabulary.statistic(db, { ...s, category: "base", defaultValueType: "FLAT", sortOrder });
    await evidence(`stat:${s.key}`, { ...vocab.baseStatistics.evidence, sourceText: s.name }, "name", { statisticId: row.id });
  }
  for (const [i, s] of vocab.guideStatistics.rows.entries()) {
    await vocabulary.statistic(db, { ...s, category: "combat", defaultValueType: "PERCENT", sortOrder: 100 + i });
  }
  for (const [sortOrder, f] of vocab.formations.rows.entries()) {
    const row = await vocabulary.formation(db, { ...f, translationStatus: "VERIFIED", sortOrder });
    await evidence(`formation:${f.key}:name-es`, vocab.formations.evidenceEs, "nameEs", { formationId: row.id });
    await evidence(`formation:${f.key}:rule`, vocab.formations.evidenceRule, "positionNote, primaryStatistic, maxPerTeam", { formationId: row.id });
  }
  for (const [sortOrder, r] of vocab.roles.rows.entries()) {
    const existing = await db.ninjaRole.findUnique({ where: { key: r.key }, select: { mappingStatus: true } });
    // A mapping the client has already APPROVED is never downgraded back to a proposal by a re-run.
    const approved = existing?.mappingStatus === "APPROVED";
    const row = await vocabulary.role(db, { ...r, mappingStatus: approved ? "APPROVED" : r.mappingStatus, sortOrder });
    await evidence(`role:${r.key}`, r.evidence, "name", { roleId: row.id });
  }
  for (const [sortOrder, key] of vocab.ratings.rows.entries()) await vocabulary.rating(db, { key, name: key, sortOrder });
  await evidence("vocab:ratings", vocab.ratings.evidence, "rating vocabulary");

  // 4. Status dictionary.
  let glossaryEvidence = 0;
  let sortOrder = 0;
  const partiallyConfirmed: string[] = [];
  const entryKey = (e: GlossaryEntry) => e.key ?? slugify(e.name);
  for (const section of glossary.sections) {
    for (const entry of section.entries) {
      if (entry.mergeOnly) continue;
      const merged: GlossaryEntry = { ...section.defaults, ...entry, key: entryKey(entry), sortOrder: sortOrder++ };
      // Evidence-only fields are not part of the definition.
      delete merged.sourceText;
      delete merged.ambiguityNote;
      await upsertStatusEffect(db, merged);
      if (merged.reviewStatus !== "CONFIRMED") partiallyConfirmed.push(entry.name);
    }
  }
  for (const section of glossary.sections) {
    for (const entry of section.entries) {
      const status = await db.statusEffect.findUniqueOrThrow({ where: { key: entryKey(entry) }, select: { id: true } });
      await recordEvidence(
        db,
        {
          key: `glossary:${assetName(section.asset)}:${slugify(section.heading)}:${entryKey(entry)}`,
          assetPath: section.asset,
          section: section.heading,
          field: entry.description ? "name, classification, definition" : "name, classification",
          sourceText: entry.sourceText ?? (entry.description ? `${entry.name}: ${entry.description}` : entry.name),
          reviewStatus: entry.reviewStatus ?? section.defaults.reviewStatus ?? "NEEDS_REVIEW",
          ambiguityNote: entry.ambiguityNote,
        },
        { statusEffectId: status.id },
      );
      glossaryEvidence++;
    }
  }

  // 5. Release list → sparse ninjas.
  const analysis = analyzeReleaseList(release);
  if (analysis.invalid.length) throw new Error(`release-order.json has invalid lines: ${analysis.invalid.join("; ")}`);
  const ambiguous = new Set(analysis.duplicateSlugs.map((d) => d.slug));
  let ninjasCreated = 0;
  let ninjasUpdated = 0;
  let releaseEvidence = 0;
  const releaseChanged: string[] = [];
  for (const e of analysis.entries) {
    if (ambiguous.has(e.slug)) continue; // flagged below, never guessed
    const existing = await db.ninja.findUnique({ where: { slug: e.slug }, select: { releaseYear: true, releaseMonth: true } });
    if (existing && existing.releaseYear !== null && (existing.releaseYear !== e.year || existing.releaseMonth !== e.month)) {
      releaseChanged.push(`${e.name}: ${existing.releaseYear}-${existing.releaseMonth} → ${e.year}-${e.month}`);
    }
    const legible = e.fullIn.length > 0;
    const { id, created } = await upsertNinja(
      db,
      {
        name: e.name,
        release: { year: e.year, month: e.month },
        releaseOrder: e.order,
        // Publication and review state are only set on first insert; later edits are respected.
        ...(existing ? {} : { status: "PUBLISHED", reviewStatus: legible ? "CONFIRMED" : "PARTIALLY_CONFIRMED" }),
      },
      { prune: false },
    );
    if (created) ninjasCreated++;
    else ninjasUpdated++;
    const line = `${e.name} (${MONTHS[e.month - 1]} ${e.year})`;
    for (const [assets, reviewStatus] of [
      [e.fullIn, "CONFIRMED"],
      [e.partialIn, "PARTIALLY_CONFIRMED"],
    ] as const) {
      for (const asset of assets) {
        await recordEvidence(
          db,
          {
            key: `release:${assetName(asset)}:${e.slug}`,
            assetPath: `03_REFERENCE_IMAGES/${asset}`,
            section: `release-order list, line ${e.order}`,
            field: "name, releaseYear, releaseMonth, releaseOrder",
            sourceText: line,
            reviewStatus,
            ambiguityNote: reviewStatus === "CONFIRMED" ? null : "La línea está cortada en esta captura; se lee completa en otra.",
          },
          { ninjaId: id },
        );
        releaseEvidence++;
      }
    }
  }

  // 6. Ninja cards.
  const ingestedCards: string[] = [];
  for (const card of cards.cards) {
    await vocabulary.ninjaType(db, card.type);
    const { id } = await upsertNinja(
      db,
      {
        name: card.name,
        description: card.description,
        roleKey: card.roleKey,
        formationKey: card.formationKey,
        ratingKey: card.ratingKey,
        typeKey: card.type.key,
        reviewStatus: card.reviewStatus,
        baseStats: card.baseStats,
        abilities: [{ typeKey: "skill", name: card.skill.name, reviewStatus: "PARTIALLY_CONFIRMED" }],
        talentGroups: [{ reviewStatus: "NEEDS_REVIEW", note: card.talentNote, options: [{ name: card.talent.name }] }],
      },
      { prune: false },
    );
    const base = `card:${assetName(card.asset)}:${slugify(card.name)}`;
    await recordEvidence(
      db,
      {
        key: base,
        assetPath: card.asset,
        section: "ninja card",
        field: "type, formation, rating, description, baseStats (value + growth rate)",
        sourceText: card.cardSourceText,
        reviewStatus: card.reviewStatus,
      },
      { ninjaId: id },
    );
    await recordEvidence(
      db,
      { key: `${base}:role`, assetPath: card.asset, section: "thread header", field: "role (source category)", sourceText: card.roleEvidence, reviewStatus: card.reviewStatus },
      { ninjaId: id },
    );
    const ability = await db.ability.findFirstOrThrow({ where: { ninjaId: id, name: card.skill.name }, select: { id: true } });
    await recordEvidence(
      db,
      {
        key: `${base}:skill`,
        assetPath: card.asset,
        section: "ninja card",
        field: "name",
        sourceText: `Skill: ${card.skill.name}`,
        reviewStatus: "PARTIALLY_CONFIRMED",
        ambiguityNote: card.skillNote,
      },
      { abilityId: ability.id },
    );
    const option = await db.talentOption.findFirstOrThrow({ where: { group: { ninjaId: id }, name: card.talent.name }, select: { id: true } });
    await recordEvidence(
      db,
      {
        key: `${base}:talent`,
        assetPath: card.asset,
        section: "ninja card",
        field: "name",
        sourceText: `Talent: ${card.talent.name}`,
        reviewStatus: "PARTIALLY_CONFIRMED",
        ambiguityNote: card.talentNote,
      },
      { talentOptionId: option.id },
    );
    ingestedCards.push(card.name);
  }

  // 7. Staged evidence: recorded, attached to a ninja when its owner is known, never turned into game records.
  for (const item of staged.items) {
    const owner = item.ownerName ? await db.ninja.findUnique({ where: { slug: slugify(item.ownerName) }, select: { id: true } }) : null;
    for (const [i, asset] of [item.asset, ...item.alsoIn].entries()) {
      await recordEvidence(
        db,
        {
          key: i === 0 ? item.key : `${item.key}:${assetName(asset)}`,
          assetPath: asset,
          section: item.kind,
          field: `${item.kind} (staged, not turned into a record)`,
          sourceText: item.rawText,
          reviewStatus: item.reviewStatus,
          ambiguityNote: item.ambiguityNote,
        },
        owner ? { ninjaId: owner.id } : undefined,
      );
    }
  }

  const [ninjas, baseStats, abilities, talentOptions, statusEffects, effects, sourceRecords, equipmentSets, equipment, jewelrySets, jewelry, gems, terms, structured] =
    await Promise.all([
      db.ninja.count(),
      db.ninjaBaseStat.count(),
      db.ability.count(),
      db.talentOption.count(),
      db.statusEffect.count(),
      db.effect.count(),
      db.sourceRecord.count(),
      db.equipmentSet.count(),
      db.equipment.count(),
      db.jewelrySet.count(),
      db.jewelry.count(),
      db.gem.count(),
      db.statusEffect.count({ where: { kind: "TERM" } }),
      db.statusEffect.count({ where: { modifiers: { some: {} } } }),
    ]);

  return {
    assets: {
      registered: sources.assets.length,
      screenshots: sources.assets.filter((a) => a.category === "SCREENSHOT").length,
      duplicates: sources.assets.filter((a) => a.duplicateOf).length,
    },
    release: {
      staged: analysis.entries.length,
      ninjasCreated,
      ninjasUpdated,
      releaseChanged,
      skippedDuplicates: analysis.duplicateSlugs.map((d) => `${d.slug}: ${d.names.join(" / ")}`),
      first: analysis.first,
      last: analysis.last,
      gapMonths: analysis.gapMonths,
      sharedMonths: analysis.sharedMonths,
      uncheckedBoundaries: analysis.uncheckedBoundaries,
      evidenceRecords: releaseEvidence,
    },
    cards: { ingested: ingestedCards },
    glossary: {
      entries: statusEffects,
      terms,
      statuses: statusEffects - terms,
      withStructuredModifiers: structured,
      partiallyConfirmed,
      evidenceRecords: glossaryEvidence,
    },
    vocabulary: {
      ratings: vocab.ratings.rows.length,
      formations: vocab.formations.rows.length,
      roles: vocab.roles.rows.length,
      statistics: vocab.baseStatistics.rows.length + vocab.guideStatistics.rows.length,
      statusCategories: vocab.statusCategories.rows.length,
    },
    staged: { withoutRecords: staged.items.map((i) => `${i.kind}: ${i.rawText}`) },
    equipment: { sets: equipmentSets, pieces: equipment },
    jewelry: { sets: jewelrySets, pieces: jewelry },
    totals: { ninjas, baseStats, abilities, talentOptions, statusEffects, effectUsages: effects, sourceRecords, gems },
  };
}
