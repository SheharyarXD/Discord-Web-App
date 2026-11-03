import { slugify } from "../domain/slug";
import type { EffectInput } from "./schemas";

/**
 * Reads the transcription files in data/gear-source/transcription (one text file per set, written by reading each source
 * image at full size) and turns them into set versions with pieces, tiers and effects.
 * Nothing is inferred from stat size: a version is named R1/R2 only where the source or the client says so.
 */

export const MAIN_STAT_NOTE = "PRINTED_MAIN_STAT";

export interface ParsedSlot {
  label: string;
  value: string;
  icons: number;
}
export interface ParsedCategory {
  label: string;
  value: string;
  icons: number;
  twoPieceText: string;
  fullSetText: string | null;
}
export interface ParsedCost {
  path: string;
  applies: string;
  stage: string;
  materials: string;
}
export interface ParsedSheet {
  kind: "GEAR" | "JEWEL";
  path: string;
  versionToken: string;
  title: string | null;
  slots: ParsedSlot[];
  bonuses: { pieces: number; text: string }[];
  categories: ParsedCategory[];
  notes: string[];
  reviews: string[];
}
export interface ParsedSet {
  index: number;
  name: string;
  nameOnly: boolean;
  sheets: ParsedSheet[];
  costs: ParsedCost[];
  notes: string[];
  reviews: string[];
  file: string;
}

const sub = (s: string) => s.split("|").map((p) => p.trim());

export function parseTranscription(text: string, file: string): ParsedSet[] {
  const out: ParsedSet[] = [];
  let set: ParsedSet | null = null;
  let sheet: ParsedSheet | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const space = line.indexOf(" ");
    const tag = space < 0 ? line : line.slice(0, space);
    const rest = space < 0 ? "" : line.slice(space + 1);
    if (tag === "NAMEONLY") {
      const [i, name] = sub(rest);
      out.push({ index: Number(i), name: name!, nameOnly: true, sheets: [], costs: [], notes: [], reviews: [], file });
      continue;
    }
    if (tag === "SET") {
      const [i, name] = sub(rest);
      set = { index: Number(i), name: name!, nameOnly: false, sheets: [], costs: [], notes: [], reviews: [], file };
      sheet = null;
      out.push(set);
      continue;
    }
    if (!set) throw new Error(`${file}: "${tag}" before SET`);
    if (tag === "GEAR" || tag === "JEWEL") {
      const [path, version, title] = sub(rest);
      sheet = { kind: tag, path: path!, versionToken: version ?? "-", title: title && title !== "-" ? title : null, slots: [], bonuses: [], categories: [], notes: [], reviews: [] };
      set.sheets.push(sheet);
    } else if (tag === "SLOT") {
      const [label, value, icons] = sub(rest);
      sheet!.slots.push({ label: label!, value: value!, icons: Number(icons ?? 1) });
    } else if (tag === "BONUS") {
      const [pieces, ...body] = sub(rest);
      sheet!.bonuses.push({ pieces: Number(pieces), text: body.join(" | ") });
    } else if (tag === "CAT") {
      const [label, value, icons, two, full] = sub(rest);
      sheet!.categories.push({ label: label!, value: value!, icons: Number(icons ?? 2), twoPieceText: two ?? "", fullSetText: full ?? null });
    } else if (tag === "COST") {
      const [path, applies, stage, materials] = sub(rest);
      set.costs.push({ path: path!, applies: applies!, stage: stage!, materials: materials! });
    } else if (tag === "NOTE") (sheet ?? set).notes.push(rest);
    else if (tag === "REVIEW") (sheet ?? set).reviews.push(rest);
    else throw new Error(`${file}: unknown line type "${tag}"`);
  }
  return out;
}

// ───────────────────────── Versions ─────────────────────────

export type VersionBasis = "PRINTED" | "CLIENT_STATED" | "SEQUENCE" | "OWNER_MAPPING";
export interface Version {
  key: string;
  /** Text after the name for R1, R2, SSR5; the letter for sequence variants; null for the only or base version. */
  label: string | null;
  basis: VersionBasis | null;
}

export function versionOf(token: string): Version {
  if (token === "-" || token === "") return { key: "base", label: null, basis: null };
  if (token === "base") return { key: "base", label: null, basis: "OWNER_MAPPING" };
  const [how, value] = token.split(":");
  if (how === "seq") return { key: `seq-${value!.toLowerCase()}`, label: value!, basis: "SEQUENCE" };
  if (value!.toLowerCase() === "base") return { key: "base", label: null, basis: "PRINTED" };
  return { key: value!.toLowerCase(), label: value!, basis: how === "client" ? "CLIENT_STATED" : "PRINTED" };
}

/** The title shown for a version. English is authoritative; sequence variants say so instead of claiming an upgrade. */
export function versionTitle(name: string, v: { label: string | null; basis: string | null }): string {
  if (!v.label) return name;
  return v.basis === "SEQUENCE" ? `${name} (variant ${v.label})` : `${name} ${v.label}`;
}

// ───────────────────────── Effects ─────────────────────────

const STAT_BY_LABEL: Record<string, string[]> = {
  agility: ["agility"],
  force: ["force"],
  chakra: ["chakra"],
  power: ["power"],
  hp: ["hp"],
  attack: ["attack"],
  "damage rate": ["damage-rate"],
  "damager rate": ["damage-rate"],
  "avoid injury rate": ["avoid-injury"],
  "avoid-injury rate": ["avoid-injury"],
  "punch rate": ["punch-rate"],
  "aid rate": ["aid-rate"],
  "hit rate": ["hit-rate"],
  "dodge rate": ["dodge-rate"],
  "final dmg": ["final-damage"],
  "final damage increase": ["final-damage"],
  "final dmg reduction": ["final-damage-reduction"],
  "final damage reduction": ["final-damage-reduction"],
  "damage taken reduction": ["damage-taken-reduction"],
  "bonus damage after attack": ["bonus-damage-after-attack"],
  "bonus damage after atk": ["bonus-damage-after-attack"],
  "damage after attack": ["bonus-damage-after-attack"],
  "cc resistance": ["cc-resistance"],
  "cc resist": ["cc-resistance"],
  "crit damage": ["crit-damage"],
  "crit dmg": ["crit-damage"],
  "increase crit. damage": ["crit-damage"],
  "increases crit. damage": ["crit-damage"],
  "crit rate": ["crit-rate"],
  "physical attack": ["physical-attack"],
  "strategy attack": ["strategy-attack"],
  "s. attack": ["s-attack"],
  "s attack rate": ["s-attack"],
  defense: ["defenses"],
  "strat/phys defense": ["strategy-defense", "physical-defense"],
  "phys/strat defense": ["strategy-defense", "physical-defense"],
  "phy/str. def": ["strategy-defense", "physical-defense"],
  "strategy/physical def": ["strategy-defense", "physical-defense"],
  "strategy defense": ["strategy-defense"],
  "physical defense": ["physical-defense"],
  "strat def": ["strategy-defense"],
  "phys def": ["physical-defense"],
  "strat/phys defense and": [],
};
/** The statistic is raised or lowered on the ENEMY. The source prints "+N%"; the stored value carries the direction. */
const ENEMY_DOWN: Record<string, string[]> = {
  "weaken enemy's atk": ["attack"],
  "weaken enemy atk": ["attack"],
  "weaken enemies atk": ["attack"],
  "weaken enemy attack": ["attack"],
  "weaken atk": ["attack"],
  "weaken enemy's def": ["defenses"],
  "weaken enemy def": ["defenses"],
  "weaken enemies def": ["defenses"],
  "decrease enemy cc rate": ["control-rate"],
  "decrease enemy cc success rate": ["control-rate"],
  "decrease enemy cc": ["control-rate"],
  "decrease the success rate of enemy's control skills": ["control-rate"],
  "decrease the success rate of enemy control skills": ["control-rate"],
  "reduce cc rate": ["control-rate"],
  "decrease the success rate of enemies' control skills by": ["control-rate"],
  "reduce enemy def": ["defenses"],
  "decrease cc rate": ["control-rate"],
  "reduce enemy cc success rate": ["control-rate"],
};
const OWN_UP_CONTROL = ["increase cc rate", "cc rate", "increase the success rate of control skills", "increase success rate of control skills", "increase the success rate of cc", "increase success rate of cc", "control skill success rate", "control success rate"];
const IMMUNITY_STATUS: Record<string, string> = { "immune seal": "seal", "immune disable": "disable", "immune imprison": "imprison", "immune to disable": "disable" };
/** Printed spellings that are probably typos; they are stored as printed and flagged. */
const TYPO_NOTES: Record<string, string> = { "damager rate": "printed as «Damager Rate»", "weekend enemies' atk": "printed as «Weekend enemies' ATK» (probably «Weaken»); stored as text only" };

export interface ClauseEffect extends EffectInput {
  /** Review flag carried to the ledger: the clause is kept as source text only. */
  textOnly: boolean;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const STAT_ENTRY = /^[A-Za-z][A-Za-z .'\-\/]*\s*\+?\s*\d[\d.]*\s*%?$/;
const triggerStart = /^(after|when|for every|deals?|puts?|makes?|restore|recover|has)\b/i;

/** Splits a printed bonus text into its clauses: one per line break and per comma that starts a new "Name +N" entry. */
export function splitClauses(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\s+\/\/\s+/)) {
    const l = clean(line);
    if (!l) continue;
    // A line in brackets continues the clause before it (for example "(cannot be dispelled)").
    if (/^\(.*\)$/.test(l) && out.length) {
      out[out.length - 1] += ` ${l}`;
      continue;
    }
    if (triggerStart.test(l)) {
      out.push(l.replace(/,\s*$/, ""));
      continue;
    }
    // A comma separates two clauses only when the piece after it is itself a "Name +N" entry.
    let current = "";
    for (const piece of l.split(/,\s*/)) {
      const p = piece.trim();
      if (!p) continue;
      if (current && STAT_ENTRY.test(current) && (STAT_ENTRY.test(p) || /^[A-Z]/.test(p))) {
        out.push(current);
        current = p;
      } else current = current ? `${current}, ${p}` : p;
    }
    if (current) out.push(current);
  }
  return out;
}

export function parseClause(clause: string): ClauseEffect[] {
  const text = clean(clause);
  const m = /^(.+?)\s*\+?\s*(\d[\d.]*)\s*(%?)$/.exec(text);
  if (m && !text.includes("−")) {
    const key = m[1]!.toLowerCase().replace(/\s+/g, " ").replace(/\s*\+$/, "").trim();
    const value = m[2]!;
    const percent = m[3] === "%";
    const valueType = percent ? "PERCENT" : "FLAT";
    const note = TYPO_NOTES[key] ?? null;
    if (STAT_BY_LABEL[key]?.length) {
      // A flat value on a rate that the source prints without a percent sign is not guessed.
      if (!percent && !["agility", "force", "chakra", "power", "hp"].includes(key)) return [text$(text)];
      return STAT_BY_LABEL[key]!.map((statisticKey) => ({ kind: "STAT" as const, statisticKey, value, valueType, targetKey: "self", sourceText: text, structuredStatus: "STRUCTURED" as const, note, textOnly: false }));
    }
    if (ENEMY_DOWN[key] && percent) {
      return ENEMY_DOWN[key]!.map((statisticKey) => ({ kind: "STAT" as const, statisticKey, value: `-${value}`, valueType: "PERCENT", targetKey: "enemy", sourceText: text, structuredStatus: "STRUCTURED" as const, note: `printed «+${value}%», stored as a reduction of the enemy statistic`, textOnly: false }));
    }
    if (OWN_UP_CONTROL.includes(key) && percent) {
      return [{ kind: "STAT", statisticKey: "control-rate", value, valueType: "PERCENT", targetKey: "self", sourceText: text, structuredStatus: "STRUCTURED", note: null, textOnly: false }];
    }
    if (IMMUNITY_STATUS[key] && percent) {
      return [{ kind: "IMMUNITY", statusKey: IMMUNITY_STATUS[key], value, valueType: "PERCENT", targetKey: "self", sourceText: text, structuredStatus: "STRUCTURED", note: null, textOnly: false }];
    }
    if (/^immune( to)? (weaken def|weaken state|s\. ?block)$/.test(key) && percent) {
      return [{ kind: "IMMUNITY", description: key.replace(/^immune( to)? /, ""), value, valueType: "PERCENT", targetKey: "self", sourceText: text, structuredStatus: "STRUCTURED", note: null, textOnly: false }];
    }
  }
  return [text$(text)];
}

/** A clause kept as the source wording. It is searched as text and flagged for review in the ledger. */
function text$(text: string): ClauseEffect {
  const trigger = triggerStart.test(text) ? text.split(/,\s*/)[0]! : null;
  const side = sideOf(text);
  return {
    kind: "TEXT",
    sourceText: text,
    description: null,
    structuredStatus: "TEXT_ONLY",
    triggerText: trigger,
    targetKey: side,
    note: TYPO_NOTES[text.split(/\s+\+/)[0]!.toLowerCase()] ?? null,
    textOnly: true,
  } as ClauseEffect;
}

function sideOf(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(enem(y|ies)|attacker)\b/.test(t)) return "enemy";
  if (/\b(ally|allies|allied|all allies|vanguard|assaulter|support)/.test(t) && !/\benem/.test(t)) return "ally";
  if (/\b(self|own|himself)\b/.test(t)) return "self";
  return null;
}

/** Effects of one printed bonus text. Row order follows the print. */
export function effectsOfBonus(text: string): ClauseEffect[] {
  return splitClauses(text).flatMap((c) => parseClause(c));
}

// ───────────────────────── Slots and categories ─────────────────────────

export const SLOT_KEY: Record<string, string> = {
  "Physical Attack": "physical-attack",
  "Physical Defense": "physical-defense",
  "Strategy Attack": "strategy-attack",
  "Strategy Defense": "strategy-defense",
  Speed: "speed",
  Power: "power",
};
export const CATEGORY_KEY: Record<string, string> = { Force: "force", Chakra: "chakra", Agility: "agility", Power: "power" };

export const mainStat = (statisticKey: string, value: string): EffectInput => ({
  kind: "STAT",
  statisticKey,
  value,
  valueType: "FLAT",
  targetKey: "self",
  sourceText: undefined,
  structuredStatus: "STRUCTURED",
  note: MAIN_STAT_NOTE,
});

export const familySlug = (name: string) => slugify(name);
export const setSlug = (family: string, v: { key: string }) => (v.key === "base" ? family : `${family}-${v.key}`);
