import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { withClientReplacement } from "../domain/awakenings";
import { createAbilityParser, numbersIn, spanishBaseStatValues, type AbilityNoteCode, type AbilityParser, type Lexicon } from "../domain/ability-text";
import type { AliasStatus, ReviewStatus, StackingRule } from "../domain/constants";
import { normalizeTerm } from "../domain/localize";
import { slugify } from "../domain/slug";
import { upsertNinja, vocabulary } from "./ninjas";
import { recordEvidence, registerAsset, type EvidenceTarget, type SourceAssetInput } from "./provenance";
import type { AwakeningInput, EffectInput, NinjaInput } from "./schemas";
import { upsertStatusEffect } from "./status-effects";

/**
 * Loads the staged ninja profiles (data/reference/profiles/*.json): card data, ability texts,
 * awakenings and the names each ninja goes by.
 *
 * Two steps, so the first can be inspected and tested without a database:
 *  - `planProfiles` is pure. It resolves every source entry through identity-map.json, turns
 *    ability text into effect rows with the parser, and returns what would be written plus a
 *    ledger row per source entry.
 *  - `applyProfilePlan` writes that plan. Idempotent: every record is upserted on a stable key.
 *
 * Rules it keeps
 *  - An entry whose identity is UNRESOLVED never creates or changes a ninja. Its text is kept as
 *    staged evidence only.
 *  - Nothing is filled in: no card means no rating, formation, type or stats; no ability text
 *    means the talent and skill are stored by name only.
 *  - English is the original. Supplied Spanish is stored next to it and never replaces it; where
 *    the two disagree both are kept and the disagreement is flagged.
 *  - An awakening's relation to earlier stages is UNKNOWN unless awakening-rules.json quotes the
 *    source wording that states it.
 */

/** Paths in the staging files are relative to docs/m2-handoff/. Assets are registered under this prefix. Paths that start with `m3-handoff/` are relative to docs/ (the Milestone 3 Supporter package). */
export const HANDOFF_PREFIX = "m2-handoff/";
export const HANDOFF_PREFIX_M3 = "m3-handoff/";
const CHANNEL_FILES = ["vanguards", "assaulters", "supporters", "supporters-m3", "alien-ninjas", "awakening-ninjas"] as const;
/** Handoff documents cited as evidence by vocabulary.json. */
const HANDOFF_DOCUMENTS = ["M2_Part_1_Core_and_Claude_Prompt/04_REVIEW_AND_DELIVERY/COLLECTION_INVENTORY.csv"];

// ───────────────────────── Staging file shapes ─────────────────────────

/** `status_note`: a block that only defines a status the way this ninja uses it (e.g. "Charm: ... by 220%"). */
type Slot = "talent" | "skill" | "normal_skill" | "special_skill" | "talent_awakening" | "skill_awakening" | "status_note";
const BASE_SKILL_SLOTS: Slot[] = ["skill", "normal_skill", "special_skill"];

interface StagedLine {
  text: string;
  sub?: boolean;
  /** Under an «applies one from each» heading: the group of alternatives this line belongs to, and its place in it. */
  choiceGroup?: number;
  choiceOption?: number;
}
interface StagedText {
  asset: string;
  lines: StagedLine[];
  heading?: string;
  name?: string | null;
}
export interface StagedAbility {
  slot: Slot;
  heading: string;
  name: string | null;
  stage: number | null;
  condition: string | null;
  en: StagedText;
  es: StagedText | null;
}
interface CardLabel {
  text: string;
  truncated: boolean;
}
export interface StagedCard {
  asset: string;
  language: string;
  namePlate: string;
  typeLabel: string;
  formationLabel: string;
  rating: string;
  stats: { label: string; value: string; growth: string | null }[];
  talentLabel: CardLabel;
  skillLabel: CardLabel;
  verification: string;
}
export interface StagedEntry {
  sourceId: string;
  nameAsPosted: string;
  cardName?: string;
  releaseRef: string | null;
  card: StagedCard | null;
  cardMissing?: string | null;
  duplicateCardFile?: { asset: string; duplicateOf: string };
  /** Other names the ability text uses for this ninja, after the identity was reviewed. */
  textNames?: string[];
  abilities?: StagedAbility[];
  /** The description box printed on the card, where it was transcribed. */
  description?: string | null;
  sourceNotes: string[];
}
export interface ProfileFile {
  channel: string;
  roleKey: string;
  collectionStatus: "COMPLETE" | "PARTIAL";
  indexAsset?: string;
  entries: StagedEntry[];
}

/** ALIAS_CONFIRMED: a judgement match that the client has since confirmed. */
export type IdentityStatus = "EXACT" | "ALIAS_VERIFIED" | "ALIAS_REVIEWED" | "ALIAS_CONFIRMED" | "NEW" | "UNRESOLVED";
export interface IdentityDecision {
  nameAsPosted: string;
  cardNamePlate: string | null;
  status: IdentityStatus;
  /** Release-list name (or the new record's name). null while UNRESOLVED. */
  ninja: string | null;
  proposed?: string | null;
  evidence: string;
  evidenceEs: string;
  sameNinjaAs?: string;
  textAttribution?: { status: "REVIEW"; note: string; noteEs: string };
  /** The client confirmed that the other names the ability text uses (textNames) are this ninja. */
  textNamesConfirmed?: boolean;
}
export interface IdentityFile {
  entries: Record<string, IdentityDecision>;
}

interface LabelRow {
  key: string;
  name?: string;
  direct: boolean;
  note?: string;
}
export interface CardLabelsFile {
  types: Record<string, LabelRow>;
  formations: Record<string, LabelRow>;
  stats: Record<string, LabelRow>;
}

export interface AwakeningRulesFile {
  rules: { sourceId: string; slot: Slot; stage: number; rule: StackingRule; supersedesStage: number | null; sourceText: string; asset: string }[];
}

interface LexiconRow {
  key: string;
  name?: string;
  nameEs?: string;
  new?: boolean;
  note?: string;
  category?: string;
  valueType?: string;
  terms: string[];
  verbs?: string[];
}
export interface LexiconFile extends Lexicon {
  statistics: LexiconRow[];
  natures: LexiconRow[];
  statuses: LexiconRow[];
}

/** EN/ES differences found by reading. Loaded as review flags; neither text is changed. */
export interface TranslationFlagsFile {
  flags: { sourceId: string; line: string; code: "ES_WORDING_DIFFERS" | "ES_TEXT_CUT"; note: string; noteEs: string }[];
}

export interface ProfileData {
  translationFlags: TranslationFlagsFile;
  files: ProfileFile[];
  identity: IdentityFile;
  labels: CardLabelsFile;
  rules: AwakeningRulesFile;
  lexicon: LexiconFile;
}

/** Reads the staging files. Returns null when the folder has no profiles (nothing to load). */
export function readProfileData(dir: string): ProfileData | null {
  const profiles = path.join(dir, "profiles");
  if (!existsSync(path.join(profiles, "identity-map.json"))) return null;
  const read = <T>(file: string) => JSON.parse(readFileSync(file, "utf8")) as T;
  const flagsFile = path.join(profiles, "translation-flags.json");
  return {
    translationFlags: existsSync(flagsFile) ? read<TranslationFlagsFile>(flagsFile) : { flags: [] },
    files: CHANNEL_FILES.filter((f) => existsSync(path.join(profiles, `${f}.json`))).map((f) => read<ProfileFile>(path.join(profiles, `${f}.json`))),
    identity: read<IdentityFile>(path.join(profiles, "identity-map.json")),
    labels: read<CardLabelsFile>(path.join(profiles, "card-labels.json")),
    rules: read<AwakeningRulesFile>(path.join(profiles, "awakening-rules.json")),
    lexicon: read<LexiconFile>(path.join(dir, "lexicon.json")),
  };
}

// ───────────────────────── Plan (pure) ─────────────────────────

export type EvidenceRef =
  | { kind: "ninja" }
  | { kind: "ability"; typeKey: string; name: string; stage: number | null }
  | { kind: "talent"; name: string }
  | { kind: "none" };

export interface PlannedEvidence {
  key: string;
  assetPath: string;
  section: string;
  field: string;
  sourceText: string;
  reviewStatus: ReviewStatus;
  ambiguityNote: string | null;
  ref: EvidenceRef;
}

export type Completeness = "CARD_AND_TEXT" | "CARD_ONLY" | "TEXT_ONLY" | "NAME_ONLY" | "STAGED_ONLY";

export interface LedgerRow {
  sourceId: string;
  channel: string;
  collectionStatus: string;
  nameAsPosted: string;
  cardNamePlate: string | null;
  identityStatus: IdentityStatus;
  ninja: string | null;
  slug: string | null;
  /** LOADED = written to a ninja · MERGED = same ninja as another entry · STAGED_ONLY = evidence only. */
  action: "LOADED" | "MERGED" | "STAGED_ONLY";
  completeness: Completeness;
  hasCard: boolean;
  rating: string | null;
  formationLabel: string | null;
  typeLabel: string | null;
  baseStats: number;
  abilityBlocks: number;
  enLines: number;
  esLines: number;
  rowsStructured: number;
  rowsNeedsReview: number;
  rowsTextOnly: number;
  spanish: "SUPPLIED" | "PARTIAL" | "NONE";
  /** Where each piece of this entry comes from, relative to docs/m2-handoff (traceability). */
  cardAsset: string | null;
  textAsset: string | null;
  textAssetEs: string | null;
  /** Source records written for this entry (identity, card, ability texts in both languages). */
  evidenceRecords: number;
  flags: string[];
  notes: string[];
}

export interface PlannedNinja {
  name: string;
  slug: string;
  /** NEW in the identity map: a record the release list does not contain. */
  isNew: boolean;
  sourceIds: string[];
  input: NinjaInput;
  evidence: PlannedEvidence[];
}

export interface ProfilePlan {
  ninjas: PlannedNinja[];
  /** Evidence of entries whose identity is unresolved: recorded, attached to nothing. */
  staged: PlannedEvidence[];
  assets: SourceAssetInput[];
  ledger: LedgerRow[];
  typeRows: { key: string; name: string }[];
}

export interface PlanOptions {
  /** Slugs whose release-list line is not fully legible in any capture. */
  partialReleaseSlugs?: ReadonlySet<string>;
}

const asset = (p: string) => (p.startsWith(HANDOFF_PREFIX_M3) || p.startsWith("data/") ? p : HANDOFF_PREFIX + p);
const lettersOnly = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const joinCodes = (...codes: (string | false | null | undefined)[]) => [...new Set(codes.flatMap((c) => (c ? c.split(";") : [])))].join(";") || undefined;
const sameNumbers = (a: string, b: string) => [...numbersIn(a)].sort().join("|") === [...numbersIn(b)].sort().join("|");
const worst = (...statuses: ReviewStatus[]): ReviewStatus =>
  statuses.includes("NEEDS_REVIEW") ? "NEEDS_REVIEW" : statuses.includes("PARTIALLY_CONFIRMED") ? "PARTIALLY_CONFIRMED" : "CONFIRMED";

export interface Block {
  effects: EffectInput[];
  description: string;
  descriptionEs: string | null;
  translationStatus: "SOURCE_PROVIDED" | "MISSING";
  notes: AbilityNoteCode[];
  /** Spanish wording of the reviewed EN/ES differences on this block. */
  flagNotesEs: string[];
  review: ReviewStatus;
  counts: { en: number; es: number; structured: number; needsReview: number; textOnly: number };
}

/** Turns the text of one ability into effect rows. Every row keeps the verbatim line it came from. */
export function buildBlock(parser: AbilityParser, a: StagedAbility, flags: TranslationFlagsFile["flags"] = []): Block {
  const es = a.es;
  const flagNotesEs: string[] = [];
  const paired = es !== null && es.lines.length === a.en.lines.length;
  const notes: AbilityNoteCode[] = [];
  if (es && !paired) notes.push("ES_LINE_COUNT_DIFFERS");
  const effects: EffectInput[] = [];
  const counts = { en: a.en.lines.length, es: es?.lines.length ?? 0, structured: 0, needsReview: 0, textOnly: 0 };
  for (const [i, line] of a.en.lines.entries()) {
    const esLine = paired ? es.lines[i]!.text : null;
    const numbersDiffer = esLine !== null && !sameNumbers(line.text, esLine);
    if (numbersDiffer && !notes.includes("ES_NUMBERS_DIFFER")) notes.push("ES_NUMBERS_DIFFER");
    const flagged = es ? flags.filter((f) => f.line === line.text) : [];
    for (const f of flagged) {
      if (!notes.includes(f.code)) notes.push(f.code);
      flagNotesEs.push(f.noteEs);
    }
    const esValues = esLine !== null ? spanishBaseStatValues(esLine) : new Map<string, string>();
    for (const parsed of parser.parseLine(line.text).effects) {
      // Client rule: an attribute the English names without a number takes the number the Spanish explicitly gives it.
      const fill = parsed.kind === "STAT" && parsed.value === null && parsed.valueNote === "INCREASE" && parsed.statisticKey ? esValues.get(parsed.statisticKey) : undefined;
      const row = fill ? { ...parsed, value: fill, valueType: "PERCENT" as const, valueNote: undefined, note: joinCodes(parsed.note, "VALUE_FROM_ES") } : parsed;
      if (row.structuredStatus === "STRUCTURED") counts.structured++;
      else if (row.structuredStatus === "NEEDS_REVIEW") counts.needsReview++;
      else counts.textOnly++;
      effects.push({
        ...row,
        // Lines the source puts in groups of alternatives. Options are labelled by position only: the source names none.
        ...(line.choiceGroup !== undefined && row.choiceGroup === undefined ? { choiceGroup: line.choiceGroup, choiceLabel: `Option ${line.choiceOption ?? 1}` } : {}),
        note: joinCodes(row.note, line.sub && "SUB_ITEM", numbersDiffer && "ES_NUMBERS_DIFFER", ...flagged.map((f) => f.code)),
        sourceLine: i,
        sourceText: line.text,
        descriptionEs: esLine,
        translationStatus: esLine === null ? "MISSING" : "SOURCE_PROVIDED",
      });
    }
  }
  const clean = counts.needsReview === 0 && counts.textOnly === 0 && notes.length === 0;
  return {
    effects,
    description: a.en.lines.map((l) => l.text).join("\n"),
    descriptionEs: es ? es.lines.map((l) => l.text).join("\n") : null,
    translationStatus: es ? "SOURCE_PROVIDED" : "MISSING",
    notes,
    flagNotesEs,
    review: clean ? "CONFIRMED" : "PARTIALLY_CONFIRMED",
    counts,
  };
}

const awakeningName = (a: StagedAbility) => a.name ?? a.heading.replace(/\s*\((?:name not supplied|unnamed)\)\s*$/i, "").trim();
const abilityKey = (a: StagedAbility) => `${a.slot}|${a.stage ?? ""}|${a.name ?? ""}`;
const sameText = (a: StagedAbility, b: StagedAbility) => a.en.lines.map((l) => l.text).join("\n") === b.en.lines.map((l) => l.text).join("\n");

export function planProfiles(data: ProfileData, options: PlanOptions = {}): ProfilePlan {
  const parser = createAbilityParser(data.lexicon);
  const partialRelease = options.partialReleaseSlugs ?? new Set<string>();
  const assets = new Map<string, SourceAssetInput>();
  const addAsset = (p: string, description: string, extra: Partial<SourceAssetInput> = {}) => {
    if (!assets.has(p)) assets.set(p, { path: asset(p), category: /\.(png|jpe?g|webp)$/i.test(p) ? "SCREENSHOT" : "DOCUMENT", description, reviewed: true, ...extra });
  };
  for (const doc of HANDOFF_DOCUMENTS) addAsset(doc, "Handoff document: collection inventory.");

  const label = (table: Record<string, LabelRow>, kind: string, text: string, sourceId: string): LabelRow => {
    const row = table[text];
    if (!row) throw new Error(`${sourceId}: card ${kind} label «${text}» is not in card-labels.json`);
    return row;
  };

  // Entries grouped by the ninja they resolve to, in channel order (formation channels first).
  interface Member {
    file: ProfileFile;
    entry: StagedEntry;
    decision: IdentityDecision;
  }
  const groups = new Map<string, Member[]>();
  const staged: PlannedEvidence[] = [];
  const ledger: LedgerRow[] = [];
  const typeRows = new Map<string, { key: string; name: string }>();

  const baseLedger = (m: Member): LedgerRow => {
    const abilities = m.entry.abilities ?? [];
    const withEs = abilities.filter((a) => a.es).length;
    return {
      sourceId: m.entry.sourceId,
      channel: m.file.channel,
      collectionStatus: m.file.collectionStatus,
      nameAsPosted: m.entry.nameAsPosted,
      cardNamePlate: m.entry.card?.namePlate ?? null,
      identityStatus: m.decision.status,
      ninja: m.decision.ninja,
      slug: m.decision.ninja ? slugify(m.decision.ninja) : null,
      action: "LOADED",
      completeness: "NAME_ONLY",
      hasCard: m.entry.card !== null,
      rating: m.entry.card?.rating ?? null,
      formationLabel: m.entry.card?.formationLabel ?? null,
      typeLabel: m.entry.card?.typeLabel ?? null,
      baseStats: m.entry.card?.stats.length ?? 0,
      abilityBlocks: abilities.length,
      enLines: abilities.reduce((n, a) => n + a.en.lines.length, 0),
      esLines: abilities.reduce((n, a) => n + (a.es?.lines.length ?? 0), 0),
      rowsStructured: 0,
      rowsNeedsReview: 0,
      rowsTextOnly: 0,
      spanish: abilities.length === 0 || withEs === 0 ? "NONE" : withEs === abilities.length ? "SUPPLIED" : "PARTIAL",
      cardAsset: m.entry.card?.asset ?? null,
      textAsset: abilities[0]?.en.asset ?? null,
      textAssetEs: abilities.find((a) => a.es)?.es?.asset ?? null,
      evidenceRecords: 0,
      flags: [],
      notes: [...m.entry.sourceNotes],
    };
  };

  for (const file of data.files) {
    if (file.indexAsset) addAsset(file.indexAsset, `Collector index of the ${file.channel} channel.`);
    for (const entry of file.entries) {
      const decision = data.identity.entries[entry.sourceId];
      if (!decision) throw new Error(`${entry.sourceId}: no decision in identity-map.json`);
      const member: Member = { file, entry, decision };
      if (entry.card) {
        const cut = entry.card.talentLabel.truncated || entry.card.skillLabel.truncated;
        addAsset(entry.card.asset, `Ninja card: ${entry.card.namePlate} (${file.channel} channel).`, {
          fullyLegible: !cut,
          notes: cut ? "A name on the card is cut off by the card layout." : null,
        });
      }
      for (const a of entry.abilities ?? []) {
        addAsset(a.en.asset, `Ability text: ${entry.nameAsPosted} (${file.channel} channel).`);
        if (a.es) addAsset(a.es.asset, `Ability text: ${entry.nameAsPosted} (${file.channel} channel).`);
      }

      if (decision.status === "UNRESOLVED" || !decision.ninja) {
        // Kept as evidence only. No ninja is created or changed.
        const row = baseLedger(member);
        row.action = "STAGED_ONLY";
        row.completeness = "STAGED_ONLY";
        row.flags.push("IDENTITY_UNRESOLVED");
        if (decision.proposed) row.notes.push(`Proposed, not applied: ${decision.proposed}`);
        for (const [i, a] of (entry.abilities ?? []).entries()) {
          const block = buildBlock(parser, a);
          row.rowsStructured += block.counts.structured;
          row.rowsNeedsReview += block.counts.needsReview;
          row.rowsTextOnly += block.counts.textOnly;
          staged.push({
            key: `profile:${entry.sourceId}:${a.slot}${a.stage ?? ""}:${i}:en`,
            assetPath: asset(a.en.asset),
            section: `${entry.nameAsPosted} · ${a.heading}`,
            field: "ability text (staged: the identity of this ninja is not resolved)",
            sourceText: block.description,
            reviewStatus: "NEEDS_REVIEW",
            ambiguityNote: decision.evidenceEs,
            ref: { kind: "none" },
          });
        }
        row.evidenceRecords = (entry.abilities ?? []).length;
        ledger.push(row);
        continue;
      }
      const list = groups.get(decision.ninja) ?? [];
      list.push(member);
      groups.set(decision.ninja, list);
    }
  }

  const ninjas: PlannedNinja[] = [];
  for (const [name, members] of groups) {
    const primary = members[0]!;
    const slug = slugify(name);
    const evidence: PlannedEvidence[] = [];
    const rows = new Map(members.map((m) => [m.entry.sourceId, baseLedger(m)]));
    const main = rows.get(primary.entry.sourceId)!;

    // Abilities: the primary entry's, plus anything another channel adds. Identical text is not stored twice.
    const abilities: { a: StagedAbility; from: Member; alsoIn: Member[] }[] = (primary.entry.abilities ?? []).map((a) => ({ a, from: primary, alsoIn: [] }));
    for (const other of members.slice(1)) {
      const row = rows.get(other.entry.sourceId)!;
      row.action = "MERGED";
      row.flags.push("CROSS_CHANNEL_DUPLICATE");
      main.flags.push("CROSS_CHANNEL_DUPLICATE");
      for (const a of other.entry.abilities ?? []) {
        const match = abilities.find((x) => abilityKey(x.a) === abilityKey(a));
        if (!match) abilities.push({ a, from: other, alsoIn: [] });
        else if (sameText(match.a, a)) match.alsoIn.push(other);
        else {
          row.flags.push("CROSS_CHANNEL_TEXT_DIFFERS");
          main.flags.push("CROSS_CHANNEL_TEXT_DIFFERS");
          evidence.push({
            key: `profile:${other.entry.sourceId}:${a.slot}${a.stage ?? ""}:differs`,
            assetPath: asset(a.en.asset),
            section: `${other.entry.nameAsPosted} · ${a.heading}`,
            field: "ability text (differs from the text stored from another channel; not applied)",
            sourceText: a.en.lines.map((l) => l.text).join("\n"),
            reviewStatus: "NEEDS_REVIEW",
            ambiguityNote: "Otro canal trae este mismo bloque con un texto distinto. Se conserva el del canal de formación y este queda para revisión.",
            ref: { kind: "ninja" },
          });
        }
      }
    }

    const card = members.find((m) => m.entry.card)?.entry.card ?? null;
    const attribution = members.find((m) => m.decision.textAttribution)?.decision.textAttribution;
    const input: NinjaInput = { name, roleKey: primary.file.roleKey };
    const cardDescription = members.find((m) => m.entry.description)?.entry.description;
    if (cardDescription) input.description = cardDescription;

    // ── Names ──
    const aliases = new Map<string, NonNullable<NinjaInput["aliases"]>[number]>();
    for (const m of members) {
      // A client-confirmed match is as good as a mechanical one; only an unconfirmed judgement stays REVIEWED.
      const status: AliasStatus = m.decision.status === "ALIAS_REVIEWED" ? "REVIEWED" : "VERIFIED";
      const add = (alias: string, kind: "CARD_NAME" | "SOURCE_NAME", locale: string) => {
        if (normalizeTerm(alias) === normalizeTerm(name)) return;
        aliases.set(`${kind}:${normalizeTerm(alias)}`, { alias, kind, locale, status, note: m.decision.evidenceEs });
      };
      if (m.entry.card) add(m.entry.card.namePlate, "CARD_NAME", m.entry.card.language);
      // Posted under the very name the card prints: one alias, not the same name twice.
      if (!aliases.has(`CARD_NAME:${normalizeTerm(m.entry.nameAsPosted)}`)) add(m.entry.nameAsPosted, "SOURCE_NAME", "en");
      for (const textName of m.entry.textNames ?? []) {
        // The ability text is headed with another spelling of the name; kept as a name to be confirmed, never as a proven equivalence.
        if (normalizeTerm(textName) !== normalizeTerm(name)) {
          const confirmed = m.decision.status === "ALIAS_CONFIRMED" || m.decision.textNamesConfirmed === true;
          aliases.set(`SOURCE_NAME:${normalizeTerm(textName)}`, { alias: textName, kind: "SOURCE_NAME", locale: "en", status: confirmed ? "VERIFIED" : "REVIEWED", note: m.decision.textNamesConfirmed ? "Confirmado por el cliente: este nombre del encabezado es el mismo personaje." : "El encabezado del texto de habilidades usa este nombre; se asoció por el número de orden y el nombre del manifiesto." });
        }
      }
      if (m.decision.status === "ALIAS_REVIEWED") rows.get(m.entry.sourceId)!.flags.push("IDENTITY_REVIEWED");
      if (m.decision.status === "ALIAS_CONFIRMED") rows.get(m.entry.sourceId)!.flags.push("IDENTITY_CONFIRMED_BY_CLIENT");
      const identityAsset = m.entry.card?.asset ?? m.entry.abilities?.[0]?.en.asset ?? m.file.indexAsset;
      if (!identityAsset) throw new Error(`${m.entry.sourceId}: nothing to cite for its identity (no card, no text, no channel index)`);
      evidence.push({
        key: `profile:${m.entry.sourceId}:identity`,
        assetPath: asset(identityAsset),
        section: `${m.file.channel} channel`,
        field: "identity (which ninja this source entry is)",
        sourceText: m.entry.card && m.entry.card.namePlate !== m.entry.nameAsPosted ? `Posted as: ${m.entry.nameAsPosted} | Card name plate: ${m.entry.card.namePlate}` : `Posted as: ${m.entry.nameAsPosted}`,
        reviewStatus: m.decision.status === "ALIAS_REVIEWED" ? "PARTIALLY_CONFIRMED" : "CONFIRMED",
        ambiguityNote: m.decision.status === "EXACT" ? null : m.decision.evidenceEs,
        ref: { kind: "ninja" },
      });
      if (m.entry.duplicateCardFile) {
        addAsset(m.entry.duplicateCardFile.asset, `File supplied as the card of ${m.entry.nameAsPosted}: a copy of another ninja's card.`, {
          duplicateOfPath: asset(m.entry.duplicateCardFile.duplicateOf),
          notes: m.entry.cardMissing ?? null,
        });
      }
      if (!m.entry.card && m.file.channel !== "awakening-ninjas") rows.get(m.entry.sourceId)!.flags.push("CARD_MISSING");
    }
    if (aliases.size) input.aliases = [...aliases.values()];

    // ── Card ──
    let indirect = false;
    if (card) {
      const cardOwner = members.find((m) => m.entry.card === card)!;
      const row = rows.get(cardOwner.entry.sourceId)!;
      const type = label(data.labels.types, "type", card.typeLabel, cardOwner.entry.sourceId);
      const formation = label(data.labels.formations, "formation", card.formationLabel, cardOwner.entry.sourceId);
      typeRows.set(type.key, { key: type.key, name: type.name ?? card.typeLabel });
      input.typeKey = type.key;
      input.formationKey = formation.key;
      input.ratingKey = card.rating;
      const labelNotes: string[] = [];
      for (const l of [type, formation]) if (!l.direct && l.note) labelNotes.push(l.note);
      input.baseStats = card.stats.map((s) => {
        const stat = label(data.labels.stats, "attribute", s.label, cardOwner.entry.sourceId);
        if (!stat.direct && stat.note) labelNotes.push(stat.note);
        if (stat.key === "power") row.flags.push("STAT_LABEL_POWER");
        return { statisticKey: stat.key, sourceLabel: s.label, baseValue: s.value, growthRate: s.growth };
      });
      indirect = labelNotes.length > 0;
      if (card.language !== "en") row.flags.push(`CARD_LANGUAGE_${card.language.toUpperCase()}`);
      if (indirect) row.flags.push("LABEL_MATCHED_BY_POSITION");
      if (card.talentLabel.truncated || card.skillLabel.truncated) row.flags.push("CARD_LABEL_CUT");
      evidence.push({
        key: `profile:${cardOwner.entry.sourceId}:card`,
        assetPath: asset(card.asset),
        section: "ninja card",
        field: "name plate, type, formation, rating, base stats (value + growth rate), talent name, skill name",
        sourceText: [
          `Name: ${card.namePlate}`,
          `Type: ${card.typeLabel}`,
          `Formation: ${card.formationLabel}`,
          `Rating: ${card.rating}`,
          ...card.stats.map((s) => `${s.label}: ${s.value}${s.growth === null ? "" : ` (growth ${s.growth})`}`),
          `Talent: ${card.talentLabel.text}${card.talentLabel.truncated ? " [cut off]" : ""}`,
          `Skill: ${card.skillLabel.text}${card.skillLabel.truncated ? " [cut off]" : ""}`,
        ].join(" | "),
        reviewStatus: indirect ? "PARTIALLY_CONFIRMED" : "CONFIRMED",
        ambiguityNote: [...new Set(labelNotes)].join(" ") || null,
        ref: { kind: "ninja" },
      });
    }

    // ── Abilities ──
    const talents = abilities.filter((x) => x.a.slot === "talent");
    const baseSkills = abilities.filter((x) => BASE_SKILL_SLOTS.includes(x.a.slot));
    const talentAwakenings = abilities.filter((x) => x.a.slot === "talent_awakening");
    const skillAwakenings = abilities.filter((x) => x.a.slot === "skill_awakening");
    const cardNotes = (lbl: CardLabel): AbilityNoteCode[] => [...(lbl.truncated ? (["CARD_LABEL_CUT"] as const) : []), ...(card && card.language !== "en" ? (["CARD_OTHER_LANGUAGE"] as const) : [])];

    const flagsOf = (m: Member) => data.translationFlags.flags.filter((f) => f.sourceId === m.entry.sourceId);
    const recordText = (x: (typeof abilities)[number], block: Block, ref: EvidenceRef, index: number) => {
      const blockReview: ReviewStatus = attribution ? "NEEDS_REVIEW" : "CONFIRMED";
      for (const [n, m] of [x.from, ...x.alsoIn].entries()) {
        const source = n === 0 ? x.a : (m.entry.abilities ?? []).find((b) => abilityKey(b) === abilityKey(x.a))!;
        evidence.push({
          key: `profile:${m.entry.sourceId}:${x.a.slot}${x.a.stage ?? ""}:${index}:en`,
          assetPath: asset(source.en.asset),
          section: `${m.entry.nameAsPosted} · ${source.heading}`,
          field: "ability text (English original)",
          sourceText: block.description,
          reviewStatus: blockReview,
          ambiguityNote: attribution?.noteEs ?? null,
          ref,
        });
      }
      if (x.a.es && block.descriptionEs) {
        evidence.push({
          key: `profile:${x.from.entry.sourceId}:${x.a.slot}${x.a.stage ?? ""}:${index}:es`,
          assetPath: asset(x.a.es.asset),
          section: `${x.from.entry.nameAsPosted} · ${x.a.es.heading ?? x.a.heading}`,
          field: "ability text (supplied Spanish)",
          sourceText: block.descriptionEs,
          reviewStatus: block.notes.some((n) => n.startsWith("ES_")) ? "NEEDS_REVIEW" : blockReview,
          ambiguityNote:
            [
              block.notes.includes("ES_LINE_COUNT_DIFFERS") && "El texto en español tiene un número de líneas distinto al original en inglés. Se conservan los dos.",
              block.notes.includes("ES_NUMBERS_DIFFER") && "Algún número del texto en español no coincide con el original en inglés. Se conservan los dos.",
              ...block.flagNotesEs,
            ]
              .filter(Boolean)
              .join(" ") || null,
          ref,
        });
      }
      const row = rows.get(x.from.entry.sourceId)!;
      row.rowsStructured += block.counts.structured;
      row.rowsNeedsReview += block.counts.needsReview;
      row.rowsTextOnly += block.counts.textOnly;
      for (const n of block.notes) if (!row.flags.includes(n)) row.flags.push(n);
    };

    const textFields = (x: (typeof abilities)[number], block: Block, name: string, extra: AbilityNoteCode[]) => {
      const notes = [...block.notes, ...extra, ...(attribution ? (["TEXT_ATTRIBUTION_UNVERIFIED"] as const) : [])];
      const esName = x.a.es?.name ?? null;
      return {
        name,
        nameEs: esName && esName !== name ? esName : null,
        description: block.description,
        descriptionEs: block.descriptionEs,
        translationStatus: block.translationStatus,
        sourceHeading: x.a.heading,
        note: joinCodes(...notes) ?? null,
        reviewStatus: worst(block.review, attribution ? "NEEDS_REVIEW" : "CONFIRMED", extra.includes("CARD_LABEL_CUT") && !x.a.name ? "NEEDS_REVIEW" : "CONFIRMED"),
        effects: block.effects,
      };
    };

    const stackingOf = (x: (typeof abilities)[number]) =>
      data.rules.rules.find((r) => members.some((m) => m.entry.sourceId === r.sourceId) && r.slot === x.a.slot && r.stage === x.a.stage);
    const toAwakening = (x: (typeof abilities)[number], index: number): AwakeningInput => {
      const block = buildBlock(parser, x.a, flagsOf(x.from));
      const name = awakeningName(x.a);
      const rule = stackingOf(x);
      recordText(x, block, { kind: "ability", typeKey: x.a.slot, name, stage: x.a.stage }, index);
      const row = rows.get(x.from.entry.sourceId)!;
      const flag = rule ? "AWAKENING_RULE_STATED" : "AWAKENING_RULE_UNKNOWN";
      if (!row.flags.includes(flag)) row.flags.push(flag);
      return {
        ...textFields(x, block, name, x.a.name ? [] : ["NAME_NOT_SUPPLIED"]),
        typeKey: x.a.slot,
        stage: x.a.stage,
        conditionText: x.a.condition,
        stackingRule: rule?.rule ?? "UNKNOWN",
        supersedesStage: rule?.supersedesStage ?? null,
        ruleSourceText: rule?.sourceText ?? null,
      };
    };

    const hasText = abilities.length > 0;
    if (hasText || card) {
      // Skills.
      type AbilityInput = NonNullable<NinjaInput["abilities"]>[number];
      const skills: AbilityInput[] = [];
      if (baseSkills.length === 0 && card) {
        const cut = card.skillLabel.truncated;
        skills.push({
          typeKey: "skill",
          name: card.skillLabel.text,
          cardLabel: card.skillLabel.text,
          cardLabelCut: cut,
          note: joinCodes("NAME_FROM_CARD", ...cardNotes(card.skillLabel)) ?? null,
          reviewStatus: cut ? "NEEDS_REVIEW" : "PARTIALLY_CONFIRMED",
          effects: [],
        });
      }
      // The card prints one skill name. With several skills in the text it goes to the one it matches letter for letter (up to a cut).
      const cardSkill = card ? lettersOnly(card.skillLabel.text) : null;
      const labelled =
        baseSkills.length === 1
          ? baseSkills[0]
          : baseSkills.find((x) => cardSkill && x.a.name && (lettersOnly(x.a.name).startsWith(cardSkill) || cardSkill.startsWith(lettersOnly(x.a.name))));
      if (card && baseSkills.length > 1 && !labelled) main.flags.push("CARD_SKILL_LABEL_UNPLACED");
      for (const [i, x] of baseSkills.entries()) {
        const block = buildBlock(parser, x.a, flagsOf(x.from));
        const fromCard = !x.a.name && card !== null && labelled === x;
        const name = x.a.name ?? (fromCard ? card.skillLabel.text : x.a.heading);
        const mine = card !== null && labelled === x;
        recordText(x, block, { kind: "ability", typeKey: x.a.slot, name, stage: x.a.stage }, i);
        skills.push({
          ...textFields(x, block, name, [...(x.a.name ? [] : (["NAME_NOT_SUPPLIED"] as const)), ...(mine ? cardNotes(card.skillLabel) : [])]),
          typeKey: x.a.slot,
          stage: x.a.stage,
          conditionText: x.a.condition,
          cardLabel: mine ? card.skillLabel.text : null,
          cardLabelCut: mine ? card.skillLabel.truncated : false,
        });
      }
      // Blocks that only define a status for this ninja: kept as text, never as effects (a definition is not an effect of the ninja).
      const statusNotes = abilities.filter((x) => x.a.slot === "status_note");
      if (skillAwakenings.length) {
        if (skills.length !== 1) throw new Error(`${primary.entry.sourceId}: ${skillAwakenings.length} skill awakening(s) but ${skills.length} base skills to attach them to`);
        skills[0]!.awakenings = withClientReplacement(skillAwakenings.map(toAwakening));
      }
      for (const [i, x] of statusNotes.entries()) {
        const description = x.a.en.lines.map((l) => l.text).join("\n");
        const es = x.a.es?.lines.map((l) => l.text).join("\n") ?? null;
        evidence.push({
          key: `profile:${x.from.entry.sourceId}:status_note:${i}:en`,
          assetPath: asset(x.a.en.asset),
          section: `${x.from.entry.nameAsPosted} · ${x.a.heading}`,
          field: "status definition as this ninja's text gives it (English original)",
          sourceText: description,
          reviewStatus: "CONFIRMED",
          ambiguityNote: null,
          ref: { kind: "ninja" },
        });
        if (es && x.a.es) {
          evidence.push({
            key: `profile:${x.from.entry.sourceId}:status_note:${i}:es`,
            assetPath: asset(x.a.es.asset),
            section: `${x.from.entry.nameAsPosted} · ${x.a.es.heading}`,
            field: "status definition (supplied Spanish)",
            sourceText: es,
            reviewStatus: "CONFIRMED",
            ambiguityNote: null,
            ref: { kind: "ninja" },
          });
        }
        skills.push({
          typeKey: "status_note",
          name: x.a.name ?? x.a.heading,
          description,
          descriptionEs: es,
          translationStatus: es ? "SOURCE_PROVIDED" : "MISSING",
          sourceHeading: x.a.heading,
          reviewStatus: "CONFIRMED",
          effects: [],
        });
      }
      if (skills.length) input.abilities = skills;

      // Talents.
      type OptionInput = NonNullable<NinjaInput["talentGroups"]>[number]["options"][number];
      const options: OptionInput[] = [];
      if (talents.length === 0 && card) {
        const cut = card.talentLabel.truncated;
        options.push({
          name: card.talentLabel.text,
          cardLabel: card.talentLabel.text,
          cardLabelCut: cut,
          note: joinCodes("NAME_FROM_CARD", ...cardNotes(card.talentLabel)) ?? null,
          reviewStatus: cut ? "NEEDS_REVIEW" : "PARTIALLY_CONFIRMED",
          effects: [],
        });
      }
      for (const [i, x] of talents.entries()) {
        const block = buildBlock(parser, x.a, flagsOf(x.from));
        const mine = card !== null && talents.length === 1;
        const name = x.a.name ?? (mine ? card.talentLabel.text : x.a.heading);
        recordText(x, block, { kind: "talent", name }, i);
        options.push({
          ...textFields(x, block, name, [
            ...(x.a.name ? [] : (["NAME_NOT_SUPPLIED"] as const)),
            ...(mine ? cardNotes(card.talentLabel) : []),
            ...(talents.length > 1 ? (["SEVERAL_TALENTS"] as const) : []),
          ]),
          cardLabel: mine ? card.talentLabel.text : null,
          cardLabelCut: mine ? card.talentLabel.truncated : false,
        });
      }
      if (talentAwakenings.length) {
        if (options.length !== 1) throw new Error(`${primary.entry.sourceId}: ${talentAwakenings.length} talent awakening(s) but ${options.length} talents to attach them to`);
        options[0]!.awakenings = withClientReplacement(talentAwakenings.map(toAwakening));
      }
      if (options.length) {
        input.talentGroups = [
          {
            selectionMode: "ONE_OF",
            reviewStatus: options.length > 1 ? "NEEDS_REVIEW" : (options[0]!.reviewStatus ?? "NEEDS_REVIEW"),
            note: options.length > 1 ? "SEVERAL_TALENTS" : null,
            options,
          },
        ];
      }
    }

    // ── Ledger and review state ──
    const completeness: Completeness = card && hasText ? "CARD_AND_TEXT" : card ? "CARD_ONLY" : hasText ? "TEXT_ONLY" : "NAME_ONLY";
    for (const m of members) {
      const row = rows.get(m.entry.sourceId)!;
      row.completeness = completeness;
      const own = (m.entry.abilities ?? []).length > 0;
      if (!own && m.file.channel !== "awakening-ninjas") row.flags.push("NO_ABILITY_TEXT");
      if (own && row.spanish !== "SUPPLIED") row.flags.push(row.spanish === "NONE" ? "NO_SPANISH" : "SPANISH_PARTIAL");
      if (m.decision.textAttribution) row.flags.push("TEXT_ATTRIBUTION_UNVERIFIED");
      row.flags = [...new Set(row.flags)];
      ledger.push(row);
    }
    for (const m of members) rows.get(m.entry.sourceId)!.evidenceRecords = evidence.filter((e) => e.key.startsWith(`profile:${m.entry.sourceId}:`)).length;
    const reviewed = members.some((m) => m.decision.status === "ALIAS_REVIEWED");
    input.reviewStatus = reviewed || indirect || !card || partialRelease.has(slug) ? "PARTIALLY_CONFIRMED" : "CONFIRMED";

    ninjas.push({ name, slug, isNew: members.every((m) => m.decision.status === "NEW"), sourceIds: members.map((m) => m.entry.sourceId), input, evidence });
  }

  // Ledger in source order.
  const order = new Map(data.files.flatMap((f) => f.entries.map((e) => e.sourceId)).map((id, i) => [id, i]));
  ledger.sort((a, b) => order.get(a.sourceId)! - order.get(b.sourceId)!);
  return { ninjas, staged, assets: [...assets.values()], ledger, typeRows: [...typeRows.values()] };
}

// ───────────────────────── Apply ─────────────────────────

/** Registers the handoff assets the plan cites. Originals before the files that duplicate them. */
export async function registerProfileAssets(db: PrismaClient, plan: ProfilePlan): Promise<void> {
  const ordered = [...plan.assets].sort((a, b) => Number(Boolean(a.duplicateOfPath)) - Number(Boolean(b.duplicateOfPath)));
  for (const a of ordered) await registerAsset(db, a);
}

/** Vocabulary the ability texts use: stat terms, natures, statuses the guide does not define, condition values. */
export async function ensureProfileVocabulary(db: PrismaClient, data: ProfileData, plan: ProfilePlan): Promise<void> {
  for (const [i, s] of data.lexicon.statistics.entries()) {
    let row = await db.statistic.findUnique({ where: { key: s.key }, select: { id: true, name: true } });
    if (s.new) {
      row = await vocabulary.statistic(db, {
        key: s.key,
        name: s.name ?? s.key,
        category: s.category ?? "combat",
        defaultValueType: s.valueType ?? "PERCENT",
        note: s.note ?? null,
        reviewStatus: s.note ? "NEEDS_REVIEW" : "CONFIRMED",
        sortOrder: 200 + i,
        nameEs: s.nameEs ?? null,
        translationStatus: s.nameEs ? "VERIFIED" : "MISSING",
      });
    }
    if (!row) throw new Error(`lexicon.json: statistic "${s.key}" is neither in the vocabulary nor marked new`);
    for (const term of s.terms) {
      const normalized = normalizeTerm(term);
      if (normalized === normalizeTerm(row.name)) continue;
      await db.statisticAlias.upsert({
        where: { statisticId_normalized: { statisticId: row.id, normalized } },
        update: { alias: term },
        create: { statisticId: row.id, alias: term, normalized },
      });
    }
  }
  for (const [sortOrder, n] of data.lexicon.natures.entries()) await vocabulary.nature(db, { key: n.key, name: n.name ?? n.key, sortOrder });
  for (const [typeKey, values] of [
    ["trait", [["jinchuriki", "Jinchuriki"]]],
    ["battle_mode", [["pve", "PvE"], ["pvp", "PvP"]]],
  ] as const) {
    const type = await db.conditionType.findUniqueOrThrow({ where: { key: typeKey }, select: { id: true } });
    for (const [sortOrder, [key, name]] of values.entries()) {
      await db.conditionValue.upsert({
        where: { conditionTypeId_key: { conditionTypeId: type.id, key } },
        update: { name },
        create: { conditionTypeId: type.id, key, name, sortOrder },
      });
    }
  }
  for (const [i, s] of data.lexicon.statuses.entries()) {
    if (!s.new) {
      const known = await db.statusEffect.findUnique({ where: { key: s.key }, select: { id: true } });
      if (!known) throw new Error(`lexicon.json: status "${s.key}" is neither in the status guide nor marked new`);
      continue;
    }
    const name = s.name ?? s.key;
    await upsertStatusEffect(db, {
      key: s.key,
      name,
      kind: "STATUS",
      // Named in ability texts only: the status guide gives no definition, so none is written.
      aliases: s.terms.filter((t) => normalizeTerm(t) !== normalizeTerm(name)),
      note: s.note ?? null,
      structuredStatus: "NEEDS_REVIEW",
      reviewStatus: "NEEDS_REVIEW",
      sortOrder: 1000 + i,
    });
  }
  for (const t of plan.typeRows) await vocabulary.ninjaType(db, t);
}

export interface ProfileApplyResult {
  created: string[];
  updated: string[];
  evidenceRecords: number;
  stagedRecords: number;
}

export async function applyProfilePlan(db: PrismaClient, plan: ProfilePlan): Promise<ProfileApplyResult> {
  const created: string[] = [];
  const updated: string[] = [];
  let evidenceRecords = 0;
  for (const n of plan.ninjas) {
    const existing = await db.ninja.findUnique({ where: { slug: n.slug }, select: { id: true } });
    // A release-list ninja must already exist: the profile never invents one under a mistyped name.
    if (!existing && !n.isNew) throw new Error(`${n.sourceIds.join(", ")}: "${n.name}" is not a ninja of the release list`);
    const { id } = await upsertNinja(db, { ...n.input, ...(existing ? {} : { status: "PUBLISHED" }) }, { prune: true });
    (existing ? updated : created).push(n.name);

    const abilities = await db.ability.findMany({ where: { ninjaId: id }, select: { id: true, name: true, stage: true, abilityType: { select: { key: true } } } });
    const options = await db.talentOption.findMany({ where: { group: { ninjaId: id } }, select: { id: true, name: true } });
    for (const e of n.evidence) {
      let target: EvidenceTarget | undefined;
      const ref = e.ref;
      if (ref.kind === "ninja") target = { ninjaId: id };
      else if (ref.kind === "ability") {
        const row = abilities.find((a) => a.abilityType.key === ref.typeKey && a.name === ref.name && a.stage === ref.stage);
        if (!row) throw new Error(`${e.key}: stored ability not found (${ref.typeKey} ${ref.name})`);
        target = { abilityId: row.id };
      } else if (ref.kind === "talent") {
        const row = options.find((o) => o.name === ref.name);
        if (!row) throw new Error(`${e.key}: stored talent not found (${ref.name})`);
        target = { talentOptionId: row.id };
      }
      await recordEvidence(db, { key: e.key, assetPath: e.assetPath, section: e.section, field: e.field, sourceText: e.sourceText, reviewStatus: e.reviewStatus, ambiguityNote: e.ambiguityNote }, target);
      evidenceRecords++;
    }
  }
  for (const e of plan.staged) {
    await recordEvidence(db, { key: e.key, assetPath: e.assetPath, section: e.section, field: e.field, sourceText: e.sourceText, reviewStatus: e.reviewStatus, ambiguityNote: e.ambiguityNote });
  }
  return { created, updated, evidenceRecords, stagedRecords: plan.staged.length };
}

// ───────────────────────── Summary ─────────────────────────

export interface ProfileSummary {
  sourceEntries: number;
  distinctNinjas: number;
  byChannel: Record<string, { entries: number; cards: number; withText: number; collectionStatus: string }>;
  byIdentity: Record<string, number>;
  byCompleteness: Record<string, number>;
  unresolved: string[];
  reviewedAliases: string[];
  confirmedAliases: string[];
  text: { abilityBlocks: number; enLines: number; esLines: number; rows: number; structured: number; needsReview: number; textOnly: number };
  spanishConflicts: string[];
}

export function summarizePlan(plan: ProfilePlan): ProfileSummary {
  const count = (keys: string[]) => keys.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {});
  const byChannel: ProfileSummary["byChannel"] = {};
  for (const r of plan.ledger) {
    const c = (byChannel[r.channel] ??= { entries: 0, cards: 0, withText: 0, collectionStatus: r.collectionStatus });
    c.entries++;
    if (r.hasCard) c.cards++;
    if (r.abilityBlocks > 0) c.withText++;
  }
  // One completeness value per ninja (its entries share it); staged entries count on their own.
  const perNinja = new Map<string, string>();
  for (const r of plan.ledger) perNinja.set(r.slug ?? `staged:${r.sourceId}`, r.completeness);
  const sum = (f: (r: LedgerRow) => number) => plan.ledger.filter((r) => r.action !== "MERGED").reduce((n, r) => n + f(r), 0);
  const structured = sum((r) => r.rowsStructured);
  const needsReview = sum((r) => r.rowsNeedsReview);
  const textOnly = sum((r) => r.rowsTextOnly);
  return {
    sourceEntries: plan.ledger.length,
    distinctNinjas: plan.ninjas.length,
    byChannel,
    byIdentity: count(plan.ledger.map((r) => r.identityStatus)),
    byCompleteness: count([...perNinja.values()]),
    unresolved: plan.ledger.filter((r) => r.action === "STAGED_ONLY").map((r) => r.nameAsPosted),
    reviewedAliases: plan.ledger.filter((r) => r.identityStatus === "ALIAS_REVIEWED").map((r) => `${r.nameAsPosted} → ${r.ninja}`),
    confirmedAliases: plan.ledger.filter((r) => r.identityStatus === "ALIAS_CONFIRMED").map((r) => `${r.nameAsPosted} → ${r.ninja}`),
    text: {
      abilityBlocks: plan.ledger.reduce((n, r) => n + r.abilityBlocks, 0),
      enLines: plan.ledger.reduce((n, r) => n + r.enLines, 0),
      esLines: plan.ledger.reduce((n, r) => n + r.esLines, 0),
      rows: structured + needsReview + textOnly,
      structured,
      needsReview,
      textOnly,
    },
    spanishConflicts: plan.ledger.filter((r) => r.flags.some((f) => f.startsWith("ES_"))).map((r) => `${r.nameAsPosted}: ${r.flags.filter((f) => f.startsWith("ES_")).join(", ")}`),
  };
}
