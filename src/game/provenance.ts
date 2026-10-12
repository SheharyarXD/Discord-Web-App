import { z } from "zod";
import { REVIEW_STATUSES, SOURCE_CATEGORIES } from "../domain/constants";
import { parseInput, UnknownReferenceError, type Db } from "./db";

const values = <T extends Record<string, string>>(o: T) => Object.values(o) as [T[keyof T], ...T[keyof T][]];

const assetInput = z.object({
  /** Path inside the read-only reference folder, or an id for a client message. */
  path: z.string().trim().min(1).max(500),
  category: z.enum(values(SOURCE_CATEGORIES)),
  description: z.string().max(2000).nullish(),
  /** Only when genuinely known. A screenshot's capture time is NOT a game release date. */
  capturedAt: z.date().nullish(),
  capturedNote: z.string().max(500).nullish(),
  reviewed: z.boolean().default(false),
  fullyLegible: z.boolean().nullish(),
  duplicateOfPath: z.string().nullish(),
  notes: z.string().max(4000).nullish(),
});
export type SourceAssetInput = z.input<typeof assetInput>;

/** Registers (or updates) one supplied reference asset. Idempotent on `path`. */
export async function registerAsset(db: Db, input: SourceAssetInput): Promise<{ id: string }> {
  const data = parseInput(assetInput, input, "source asset");
  let duplicateOfId: string | null = null;
  if (data.duplicateOfPath) {
    const original = await db.sourceAsset.findUnique({ where: { path: data.duplicateOfPath }, select: { id: true } });
    if (!original) throw new UnknownReferenceError("source asset", data.duplicateOfPath);
    duplicateOfId = original.id;
  }
  const row = {
    category: data.category,
    description: data.description ?? null,
    capturedAt: data.capturedAt ?? null,
    capturedNote: data.capturedNote ?? null,
    reviewed: data.reviewed,
    fullyLegible: data.fullyLegible ?? null,
    duplicateOfId,
    notes: data.notes ?? null,
  };
  return db.sourceAsset.upsert({ where: { path: data.path }, update: row, create: { path: data.path, ...row }, select: { id: true } });
}

const TARGET_FIELDS = [
  "ninjaId",
  "abilityId",
  "talentOptionId",
  "statusEffectId",
  "effectId",
  "statisticId",
  "formationId",
  "roleId",
  "equipmentId",
  "equipmentSetId",
  "jewelryId",
  "jewelrySetId",
  "gemId",
] as const;
export type EvidenceTarget = { [K in (typeof TARGET_FIELDS)[number]]: { [P in K]: string } }[(typeof TARGET_FIELDS)[number]];

const evidenceInput = z.object({
  /** Stable key: re-recording the same evidence updates it instead of duplicating it. */
  key: z.string().trim().min(1).max(300),
  assetPath: z.string().trim().min(1),
  section: z.string().max(300).nullish(),
  field: z.string().max(300).nullish(),
  sourceText: z.string().max(8000).nullish(),
  reviewStatus: z.enum(values(REVIEW_STATUSES)),
  ambiguityNote: z.string().max(4000).nullish(),
});
export type EvidenceInput = z.input<typeof evidenceInput>;

/**
 * Records one appearance of evidence in an asset, about at most one entity.
 * Without a target it is STAGED evidence: kept, reviewable, and attached to nothing — which is
 * the right state for wording whose owner is not known yet.
 */
export async function recordEvidence(db: Db, input: EvidenceInput, target?: EvidenceTarget): Promise<{ id: string }> {
  const data = parseInput(evidenceInput, input, "source record");
  const asset = await db.sourceAsset.findUnique({ where: { path: data.assetPath }, select: { id: true } });
  if (!asset) throw new UnknownReferenceError("source asset", data.assetPath);

  const targets = Object.fromEntries(TARGET_FIELDS.map((f) => [f, null])) as Record<(typeof TARGET_FIELDS)[number], string | null>;
  Object.assign(targets, target);
  const row = {
    assetId: asset.id,
    section: data.section ?? null,
    field: data.field ?? null,
    sourceText: data.sourceText ?? null,
    reviewStatus: data.reviewStatus,
    ambiguityNote: data.ambiguityNote ?? null,
    ...targets,
  };
  return db.sourceRecord.upsert({ where: { key: data.key }, update: row, create: { key: data.key, ...row }, select: { id: true } });
}
