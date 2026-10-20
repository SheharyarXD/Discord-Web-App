import type { EffectKind, RateKind, ValueType } from "./constants";

/**
 * Turns one line of ability text into structured effect rows.
 *
 * Ground rules
 *  - A clause is structured ONLY when a pattern matches it from the first character to the
 *    last, so no word or number of the source can be dropped or left over. Anything else is
 *    returned as a TEXT row that carries the clause verbatim.
 *  - Four things never share a field: strength (`value` / `magnitudeOverride`), probability
 *    (`chancePercent`, filled only when the source says "chance"), a stated rate
 *    (`rateValue` + `rateKind`) and duration (`durationTurns`).
 *  - Nothing is inferred: a stat named without a number gets no number; a target whose side is
 *    not stated gets no side; "A or B" is never turned into "A and B".
 *
 * Pure: no database, no I/O. The vocabulary comes in as a lexicon.
 */

export interface LexiconEntry {
  key: string;
  terms: string[];
  verbs?: string[];
}
export interface Lexicon {
  statistics: LexiconEntry[];
  statuses: LexiconEntry[];
  natures: LexiconEntry[];
}

export interface ParsedCondition {
  scope: "ACTIVATION" | "TARGET";
  /** nature | formation | trait | battle_mode */
  typeKey: string;
  valueKey?: string;
  formationKey?: string;
  operator: "REQUIRES" | "EXCLUDES";
  alternativeGroup: number;
}

export interface ParsedEffect {
  kind: EffectKind;
  statisticKey?: string;
  /** Signed decimal string (negative = decrease). null = the source names the stat without a number. */
  value?: string | null;
  valueType?: ValueType;
  statusKey?: string;
  /** "(20%)" in front of a status: its strength for this usage. Never a chance. */
  magnitudeOverride?: string;
  rateValue?: string;
  rateKind?: RateKind;
  chancePercent?: string;
  durationTurns?: number;
  targetKey?: "self" | "ally" | "enemy";
  targetText?: string;
  targetCount?: number;
  targetSelector?: string;
  excludesSelf?: boolean;
  triggerText?: string;
  conditions: ParsedCondition[];
  /** Requirement found in the wording but not structured. Its presence keeps the row conditional. */
  conditionText?: string;
  valueNote?: string;
  replacesValue?: string;
  choiceGroup?: number;
  choiceLabel?: string;
  /** Clause text for TEXT rows, item text for immunities, "buffs"/"debuffs" for dispels. */
  description?: string;
  structuredStatus: "STRUCTURED" | "NEEDS_REVIEW" | "TEXT_ONLY";
  /** Review note codes (see EFFECT_NOTES), joined with ";". */
  note?: string;
}

/** What each review note code means. The interface has its own wording for these codes. */
export const EFFECT_NOTES = {
  SIDE_UNKNOWN: "The source does not say whether these are allies or enemies.",
  SIDE_INHERITED: "Ally/enemy is not repeated on this item; it continues the previous item of the same sentence.",
  NO_TARGET: "The source does not name a target in this sentence.",
  AND_OR: "The source says «and/or»: it is not stated whether one or both are applied.",
  BRACKET_SCOPE: "The percentage is written in brackets after this stat; it may also apply to the stats listed before it.",
  ES_NUMBERS_DIFFER: "The numbers in the supplied Spanish text do not match the English original.",
  SUB_ITEM: "Listed in the source as a sub-item of the line above it.",
  ES_WORDING_DIFFERS: "The supplied Spanish text says something different from the English original on this line.",
  VALUE_FROM_ES: "The English leaves this stat without a number; the number comes from the supplied Spanish text (client rule for older ninjas).",
  ES_TEXT_CUT: "The supplied Spanish text of this line is cut off in the source.",
} as const;
export type EffectNoteCode = keyof typeof EFFECT_NOTES;
export const effectNoteCodes = (note: string | null | undefined): EffectNoteCode[] =>
  (note ?? "").split(";").filter((c): c is EffectNoteCode => c in EFFECT_NOTES);

/** Review note codes of a whole ability (talent, skill or awakening), joined with ";" like effect notes. */
export const ABILITY_NOTES = {
  NAME_FROM_CARD: "Only the name is known, read from the ninja card. No ability text was supplied.",
  CARD_LABEL_CUT: "The name is cut off on the ninja card.",
  NAME_NOT_SUPPLIED: "The source text gives this block no name.",
  ES_LINE_COUNT_DIFFERS: "The supplied Spanish text has a different number of lines than the English original, so the lines are not paired.",
  ES_NUMBERS_DIFFER: "At least one line of the supplied Spanish text has different numbers than the English original.",
  ES_WORDING_DIFFERS: "At least one line of the supplied Spanish text says something different from the English original.",
  ES_TEXT_CUT: "A line of the supplied Spanish text is cut off in the source.",
  TEXT_ATTRIBUTION_UNVERIFIED: "The source text is headed with a different name than this ninja.",
  CARD_OTHER_LANGUAGE: "The card is not in English: the card label is kept as printed.",
  SEVERAL_TALENTS: "The source lists several talents; it does not say whether they are alternatives.",
} as const;
export type AbilityNoteCode = keyof typeof ABILITY_NOTES;
export const abilityNoteCodes = (note: string | null | undefined): AbilityNoteCode[] =>
  (note ?? "").split(";").filter((c): c is AbilityNoteCode => c in ABILITY_NOTES);

/** `valueNote` of a stat the source names without a number: only the direction is known. */
export const VALUE_NOTE_INCREASE = "INCREASE";
export const VALUE_NOTE_DECREASE = "DECREASE";

export interface ParsedLine {
  effects: ParsedEffect[];
  /** true when every clause of the line matched a pattern in full. */
  fullyStructured: boolean;
}

interface Target {
  targetKey?: "self" | "ally" | "enemy";
  text: string;
  count?: number;
  selector?: string;
  excludesSelf?: boolean;
  conditions: ParsedCondition[];
  sideUnknown?: boolean;
  /** The side was not written on this target; it continues the previous item of the same sentence. */
  sideInherited?: boolean;
}

const NUM = "(\\d+(?:\\.\\d+)?)";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

const FORMATIONS: [RegExp, string][] = [
  [/^vanguards?$/i, "vanguard"],
  [/^assaulters?$/i, "assaulter"],
  [/^supporters?$/i, "support"],
];
const formationKey = (word: string) => FORMATIONS.find(([re]) => re.test(word))?.[1];

const TRIGGER =
  /^(after being attacked|after being hit|when attacked|upon death|after death|once per battle|for every \d+% (?:self )?hp loss|initiating skill)\b,?\s*/i;

const THIRD_PERSON: Record<string, string> = {
  deal: "deals",
  dispel: "dispels",
  restore: "restores",
  recover: "restores",
  enter: "enters",
  make: "makes",
  apply: "applies",
  decrease: "decreases",
  increase: "increases",
  heal: "heals",
};

function textRow(clause: string): ParsedEffect {
  return { kind: "TEXT", description: clause, conditions: [], structuredStatus: "TEXT_ONLY" };
}

export function createAbilityParser(lexicon: Lexicon) {
  const index = (entries: LexiconEntry[], field: "terms" | "verbs") => {
    const map = new Map<string, string>();
    for (const e of entries) for (const t of e[field] ?? []) map.set(t.toLowerCase(), e.key);
    const source = [...map.keys()].sort((a, b) => b.length - a.length).map(esc).join("|");
    return { map, source: source || "(?!)" };
  };
  const stats = index(lexicon.statistics, "terms");
  const statuses = index(lexicon.statuses, "terms");
  const verbs = index(lexicon.statuses, "verbs");
  const natures = index(lexicon.natures, "terms");

  const STAT = `(${stats.source})`;
  const statKey = (s: string) => stats.map.get(s.toLowerCase());
  const isNature = (s: string) => natures.map.has(s.toLowerCase());

  // ───────────────────────── targets ─────────────────────────

  function parseTarget(raw: string, inheritSide?: "ally" | "enemy"): Target | null {
    const text = squash(raw);
    let p = text.replace(/'s\b/g, "").replace(/'/g, "").toLowerCase();
    let excludesSelf = false;
    const ex = /^(.*?)\s*(?:\(except self\)|except self)$/.exec(p);
    if (ex) {
      p = ex[1]!.trim();
      excludesSelf = true;
    }
    p = p.replace(/^the /, "");
    const base = { text, conditions: [] as ParsedCondition[], ...(excludesSelf ? { excludesSelf } : {}) };

    if (/^(self|own|caster)$/.test(p)) return excludesSelf ? null : { ...base, targetKey: "self" };
    if (/^(all )?allies$/.test(p)) return { ...base, targetKey: "ally" };
    if (excludesSelf) return null; // "(except self)" is only understood on allies
    if (/^(all )?(enemies|enemy)$/.test(p)) return { ...base, targetKey: "enemy" };

    let m = /^(\d+|one|two|three) random (allies|ally|enemies|enemy)$/.exec(p);
    if (m) {
      const count = { one: 1, two: 2, three: 3 }[m[1]!] ?? Number(m[1]);
      return { ...base, targetKey: m[2]!.startsWith("all") ? "ally" : "enemy", count, selector: "RANDOM" };
    }

    m = /^(highest|lowest) (hp|avoid injury|control resistance) (enemy|ally)$/.exec(p) as RegExpExecArray | null;
    if (!m) {
      const alt = /^(enemy|ally) with (highest|lowest) hp$/.exec(p.replace(/ the /g, " "));
      if (alt) m = [alt[0], alt[2]!, "hp", alt[1]!] as unknown as RegExpExecArray;
    }
    if (m) {
      const selector = `${m[1]!.toUpperCase()}_${m[2]!.toUpperCase().replace(/ /g, "_")}`;
      return { ...base, targetKey: m[3] === "ally" ? "ally" : "enemy", count: 1, selector };
    }
    if (p === "attacker") return { ...base, targetKey: "enemy", count: 1, selector: "ATTACKER" };
    if (p === "jinchuriki allies") {
      return { ...base, targetKey: "ally", conditions: [{ scope: "ACTIVATION", typeKey: "trait", valueKey: "jinchuriki", operator: "REQUIRES", alternativeGroup: 0 }] };
    }

    // nature-gated: "water and earth chakra allies", "thunder chakra nature allies", "wind chakra enemies"
    m = /^(.+?)(?: chakra)?(?: nature)? (allies|enemies)$/.exec(p);
    if (m) {
      const parts = m[1]!.split(/\s*(?:,|\band\b|\/)\s*/).filter(Boolean);
      if (parts.length > 0 && parts.every(isNature)) {
        return {
          ...base,
          targetKey: m[2] === "allies" ? "ally" : "enemy",
          conditions: parts.map((n, i) => ({ scope: "ACTIVATION", typeKey: "nature", valueKey: natures.map.get(n)!, operator: "REQUIRES", alternativeGroup: i })),
        };
      }
    }

    // formation lists, with or without a side: "ally assaulters and supporters", "enemy vanguard", "supporters"
    m = /^(?:(ally|allied|enemy) )?(.+)$/.exec(p);
    if (m) {
      const parts = m[2]!.split(/\s*(?:,|\band\b|\/)\s*/).filter(Boolean).map((w) => w.replace(/^(ally|enemy) /, ""));
      const keys = parts.map(formationKey);
      if (parts.length > 0 && keys.every(Boolean)) {
        const side = m[1] ? (m[1] === "enemy" ? "enemy" : "ally") : inheritSide;
        return {
          ...base,
          ...(side ? { targetKey: side } : { sideUnknown: true }),
          ...(!m[1] && side ? { sideInherited: true } : {}),
          conditions: keys.map((k, i) => ({ scope: "TARGET", typeKey: "formation", formationKey: k!, operator: "REQUIRES", alternativeGroup: i })),
        };
      }
    }
    return null;
  }

  function withTarget(effect: ParsedEffect, t: Target | undefined): ParsedEffect {
    if (!t) return effect;
    const out: ParsedEffect = { ...effect, targetText: t.text, conditions: [...effect.conditions, ...t.conditions] };
    if (t.targetKey) out.targetKey = t.targetKey;
    if (t.count !== undefined) out.targetCount = t.count;
    if (t.selector) out.targetSelector = t.selector;
    if (t.excludesSelf) out.excludesSelf = true;
    if (t.sideUnknown) {
      out.structuredStatus = "NEEDS_REVIEW";
      out.note = joinNote(out.note, "SIDE_UNKNOWN");
    }
    if (t.sideInherited) out.note = joinNote(out.note, "SIDE_INHERITED");
    return out;
  }
  const joinNote = (a: string | undefined, b: string) => (a ? `${a};${b}` : b);

  // ───────────────────────── statuses ─────────────────────────

  interface StatusItem {
    statusKey: string;
    magnitudeOverride?: string;
    durationTurns?: number;
  }
  const STATUS_ITEM = new RegExp(`^(?:\\(${NUM}%\\) )?(${statuses.source})(?: state)?(?: for (\\d+) rounds?)?$`, "i");

  /** "A", "A for 2 rounds", "A and B for 2 rounds" (shared), "A for 1 round and B for 2 rounds". */
  function parseStatusList(text: string): StatusItem[] | null {
    const parts = text.split(/\s*,\s*(?:and\s+)?|\s+and\s+/).filter(Boolean);
    const items: StatusItem[] = [];
    for (const part of parts) {
      const m = STATUS_ITEM.exec(part.trim());
      if (!m) return null;
      const item: StatusItem = { statusKey: statuses.map.get(m[2]!.toLowerCase())! };
      if (m[1]) item.magnitudeOverride = m[1];
      if (m[3]) item.durationTurns = Number(m[3]);
      items.push(item);
    }
    // A duration that closes a list is recorded on every item before it that has none.
    for (let i = items.length - 2; i >= 0; i--) {
      if (items[i]!.durationTurns === undefined && items[i + 1]!.durationTurns !== undefined) items[i]!.durationTurns = items[i + 1]!.durationTurns;
    }
    return items.length ? items : null;
  }

  function statusRows(items: StatusItem[], target: Target | undefined, extra: Partial<ParsedEffect> = {}): ParsedEffect[] {
    return items.map((it) =>
      withTarget(
        {
          kind: "STATUS",
          statusKey: it.statusKey,
          ...(it.magnitudeOverride ? { magnitudeOverride: it.magnitudeOverride } : {}),
          ...(it.durationTurns !== undefined ? { durationTurns: it.durationTurns } : {}),
          conditions: [],
          structuredStatus: "STRUCTURED",
          ...extra,
        },
        target,
      ),
    );
  }

  /** "silence and stun", "shock and/or accupoint" — verbs or status names. */
  function parseVerbList(text: string): { keys: string[]; andOr: boolean } | null {
    const andOr = /\band\/or\b/i.test(text);
    const parts = text.split(/\s+and\/or\s+|\s+and\s+|\s*,\s*(?:and\s+)?/i).filter(Boolean);
    const keys: string[] = [];
    for (const part of parts) {
      const w = part.trim().toLowerCase();
      const key = verbs.map.get(w) ?? statuses.map.get(w);
      if (!key) return null;
      keys.push(key);
    }
    return keys.length ? { keys, andOr } : null;
  }

  /** Splits "silence and stun enemies" into its status list and its target. */
  function splitVerbsAndTarget(rest: string): { keys: string[]; andOr: boolean; target?: Target } | null {
    for (let i = rest.indexOf(" "); i !== -1; i = rest.indexOf(" ", i + 1)) {
      const list = parseVerbList(rest.slice(0, i));
      if (!list) continue;
      const target = parseTarget(rest.slice(i + 1));
      if (target) return { ...list, target };
    }
    const alone = parseVerbList(rest);
    return alone ? { ...alone } : null;
  }

  function parseStatus(clause: string): ParsedEffect[] | null {
    let m: RegExpExecArray | null;
    const noTarget = "NO_TARGET";

    // "60% rate to freeze and 60% rate to chaos enemies for 2 rounds"
    m = new RegExp(`^${NUM}% rate to (.+?) and ${NUM}% rate to (.+?)(?: for (\\d+) rounds?)?$`, "i").exec(clause);
    if (m) {
      const first = parseVerbList(m[2]!);
      const second = splitVerbsAndTarget(m[4]!);
      if (first && second?.target && !first.andOr && !second.andOr) {
        const dur = m[5] ? { durationTurns: Number(m[5]) } : {};
        const row = (statusKey: string, rate: string) =>
          withTarget({ kind: "STATUS", statusKey, rateValue: rate, rateKind: "APPLICATION", ...dur, conditions: [], structuredStatus: "STRUCTURED" }, second.target);
        return [...first.keys.map((k) => row(k, m![1]!)), ...second.keys.map((k) => row(k, m![3]!))];
      }
    }

    // "80% rate to silence and stun enemies for 2 rounds" · "90% rate to inflict curse fixation and tsukuyomi for 2 rounds" · "High rate to stun enemies"
    m = new RegExp(`^(?:${NUM}% rate to|(high rate) to) (?:inflict )?(.+?)(?: for (\\d+) rounds?)?$`, "i").exec(clause);
    if (m) {
      const parsed = splitVerbsAndTarget(m[3]!);
      if (parsed) {
        return parsed.keys.map((statusKey) => {
          let row: ParsedEffect = { kind: "STATUS", statusKey, rateKind: "APPLICATION", conditions: [], structuredStatus: "STRUCTURED" };
          if (m![1]) row.rateValue = m![1];
          else {
            delete row.rateKind;
            row.valueNote = m![2]!.toLowerCase();
          }
          if (m![4]) row.durationTurns = Number(m![4]);
          row = withTarget(row, parsed.target);
          if (!parsed.target) {
            row.structuredStatus = "NEEDS_REVIEW";
            row.note = joinNote(row.note, noTarget);
          }
          if (parsed.andOr) {
            row.structuredStatus = "NEEDS_REVIEW";
            row.note = joinNote(row.note, "AND_OR");
          }
          return row;
        });
      }
    }

    // "Applies split, scorching flame, and burst with 120% rate to enemies for 2 rounds" · "Applies burn with 50% rate to enemies for 2 rounds"
    m = new RegExp(`^applies (.+?) with ${NUM}% rate(?: to (.+?))?(?: for (\\d+) rounds?)?$`, "i").exec(clause);
    if (m) {
      const list = parseStatusList(m[1]!);
      const target = m[3] ? parseTarget(m[3]) : undefined;
      if (list && list.every((i) => !i.magnitudeOverride && i.durationTurns === undefined) && target !== null) {
        const rows = statusRows(list, target ?? undefined, { rateValue: m[2]!, rateKind: "INTENSITY", ...(m[4] ? { durationTurns: Number(m[4]) } : {}) });
        return target ? rows : rows.map((r) => ({ ...r, structuredStatus: "NEEDS_REVIEW" as const, note: joinNote(r.note, noTarget) }));
      }
    }
    // "Applies vein damage to enemy supporters with 100% rate for 2 rounds"
    m = new RegExp(`^applies (.+?) to (.+?) with ${NUM}% rate(?: for (\\d+) rounds?)?$`, "i").exec(clause);
    if (m) {
      const list = parseStatusList(m[1]!);
      const target = parseTarget(m[2]!);
      if (list && target && list.every((i) => !i.magnitudeOverride && i.durationTurns === undefined)) {
        return statusRows(list, target, { rateValue: m[3]!, rateKind: "INTENSITY", ...(m[4] ? { durationTurns: Number(m[4]) } : {}) });
      }
    }
    // "Poisons enemies with 70% rate for 1 round"
    m = new RegExp(`^(\\w+) (.+?) with ${NUM}% rate(?: for (\\d+) rounds?)?$`, "i").exec(clause);
    if (m && verbs.map.has(m[1]!.toLowerCase())) {
      const target = parseTarget(m[2]!);
      if (target) {
        return statusRows([{ statusKey: verbs.map.get(m[1]!.toLowerCase())! }], target, { rateValue: m[3]!, rateKind: "INTENSITY", ...(m[4] ? { durationTurns: Number(m[4]) } : {}) });
      }
    }
    // "Paralyzes enemies for 2 rounds"
    m = /^(\w+) (.+?)(?: for (\d+) rounds?)?$/i.exec(clause);
    if (m && verbs.map.has(m[1]!.toLowerCase()) && /s$/i.test(m[1]!)) {
      const target = parseTarget(m[2]!);
      if (target) return statusRows([{ statusKey: verbs.map.get(m[1]!.toLowerCase())!, ...(m[3] ? { durationTurns: Number(m[3]) } : {}) }], target);
    }

    // "Applies weakened state to thunder and wind chakra enemies for 2 rounds" · "apply shatter storm to self for 2 rounds"
    m = /^applies (.+?) to (.+?)(?: for (\d+) rounds?)?$/i.exec(clause);
    if (m) {
      const list = parseStatusList(m[1]!);
      const target = parseTarget(m[2]!);
      if (list && target && list.every((i) => i.durationTurns === undefined)) {
        return statusRows(list, target, m[3] ? { durationTurns: Number(m[3]) } : {});
      }
    }
    // "Applies painful will for 3 rounds" (no target named)
    m = /^applies (.+)$/i.exec(clause);
    if (m) {
      const list = parseStatusList(m[1]!);
      if (list) return statusRows(list, undefined).map((r) => ({ ...r, structuredStatus: "NEEDS_REVIEW" as const, note: noTarget }));
    }
    // "Enters control immune state for 2 rounds" (the ninja itself)
    m = /^enters (.+)$/i.exec(clause);
    if (m) {
      const list = parseStatusList(m[1]!);
      if (list) return statusRows(list, { targetKey: "self", text: "self", conditions: [] });
    }
    // "2 random enemies enter (30%) corrosion state for 2 rounds" · "Makes 2 random allies enter (10%) bond state for 2 rounds" · "allies gain fury shield for 2 rounds"
    m = /^(?:makes )?(.+?) (?:enters?|gains?) (.+)$/i.exec(clause);
    if (m) {
      const target = parseTarget(m[1]!);
      const list = parseStatusList(m[2]!);
      if (target && list) return statusRows(list, target);
    }
    // "Grants allies super dodge for 1 round"
    m = /^grants (.+)$/i.exec(clause);
    if (m) {
      const rest = m[1]!;
      for (let i = rest.indexOf(" "); i !== -1; i = rest.indexOf(" ", i + 1)) {
        const target = parseTarget(rest.slice(0, i));
        const list = target && parseStatusList(rest.slice(i + 1));
        if (target && list) return statusRows(list, target);
      }
    }
    return null;
  }

  /** "silence enemies for 2 rounds" — the verb form used after "N% chance to". */
  function parseBareStatus(clause: string): ParsedEffect[] | null {
    const m = /^(.+?)(?: for (\d+) rounds?)?$/i.exec(clause);
    const parsed = m && splitVerbsAndTarget(m[1]!);
    if (!m || !parsed?.target || parsed.andOr) return null;
    return statusRows(parsed.keys.map((statusKey) => ({ statusKey, ...(m[2] ? { durationTurns: Number(m[2]) } : {}) })), parsed.target);
  }

  // ───────────────────────── simple clauses ─────────────────────────

  function parseAttack(clause: string): ParsedEffect[] | null {
    let m = new RegExp(`^attacks (.+?) with ${NUM}% growth rate$`, "i").exec(clause);
    if (!m) {
      const alt = new RegExp(`^deals an additional ${NUM}% growth rate attack to (.+)$`, "i").exec(clause);
      if (alt) m = [alt[0], alt[2]!, alt[1]!] as unknown as RegExpExecArray;
    }
    if (!m) return null;
    const target = parseTarget(m[1]!);
    if (!target) return null;
    return [withTarget({ kind: "ATTACK", rateValue: m[2]!, rateKind: "GROWTH", conditions: [], structuredStatus: "STRUCTURED" }, target)];
  }

  /** "Deals 50% penetration damage to all enemies" — the glossary mechanic at a stated intensity. */
  function parsePenetration(clause: string): ParsedEffect[] | null {
    const m = new RegExp(`^deals ${NUM}% (physical |strategy )?penetration damage to (.+)$`, "i").exec(clause);
    if (!m || !statuses.map.has("penetration damage")) return null;
    const target = parseTarget(m[3]!);
    if (!target) return null;
    const row: ParsedEffect = { kind: "STATUS", statusKey: statuses.map.get("penetration damage")!, rateValue: m[1]!, rateKind: "INTENSITY", conditions: [], structuredStatus: "STRUCTURED" };
    if (m[2]) row.valueNote = m[2].trim().toLowerCase();
    return [withTarget(row, target)];
  }

  function parseHeal(clause: string): ParsedEffect[] | null {
    const m = new RegExp(`^heals (.+?) with ${NUM}% rate$`, "i").exec(clause) ?? new RegExp(`^restores (.+?) hp with ${NUM}% rate$`, "i").exec(clause);
    if (!m) return null;
    const target = parseTarget(m[1]!);
    if (!target) return null;
    return [withTarget({ kind: "HEAL", rateValue: m[2]!, rateKind: "INTENSITY", conditions: [], structuredStatus: "STRUCTURED" }, target)];
  }

  const furyRow = (value: string, target: Target): ParsedEffect =>
    withTarget({ kind: "FURY", statisticKey: "fury", value, valueType: "FLAT", conditions: [], structuredStatus: "STRUCTURED" }, target);
  const SELF: Target = { targetKey: "self", text: "self", conditions: [] };

  function parseFury(clause: string): ParsedEffect[] | null {
    let m = new RegExp(`^restores ${NUM} (?:self fury|fury for self)(?:, ${NUM} for allies)?$`, "i").exec(clause);
    if (m) {
      const rows = [furyRow(m[1]!, SELF)];
      if (m[2]) rows.push(furyRow(m[2], { targetKey: "ally", text: "allies", conditions: [] }));
      return rows;
    }
    m = new RegExp(`^restores (.+?) fury by ${NUM}( \\(except self\\))?$`, "i").exec(clause);
    if (m) {
      const target = parseTarget(m[1]! + (m[3] ?? ""));
      if (target) return [furyRow(m[2]!, target)];
    }
    return null;
  }

  function parseDispel(clause: string): ParsedEffect[] | null {
    let m = /^dispels (.+?) (buffs|debuffs)$/i.exec(clause);
    if (!m) {
      const alt = /^dispels (buffs|debuffs) from (.+)$/i.exec(clause);
      if (alt) m = [alt[0], alt[2]!, alt[1]!] as unknown as RegExpExecArray;
    }
    if (!m) return null;
    const target = parseTarget(m[1]!);
    if (!target) return null;
    return [withTarget({ kind: "DISPEL", description: m[2]!.toLowerCase(), conditions: [], structuredStatus: "STRUCTURED" }, target)];
  }

  function immunityRows(list: string, target: Target, durationTurns?: number): ParsedEffect[] {
    return list
      .split(/\s*,\s*(?:and\s+)?|\s+and\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((item) => {
        const row: ParsedEffect = { kind: "IMMUNITY", conditions: [], structuredStatus: "STRUCTURED" };
        const statusKey = statuses.map.get(item.toLowerCase());
        const numbered = new RegExp(`^${NUM}% (.+)$`).exec(item);
        if (statusKey) row.statusKey = statusKey;
        else if (numbered) {
          row.value = numbered[1]!;
          row.valueType = "PERCENT";
          row.description = numbered[2]!;
        } else row.description = item;
        if (durationTurns !== undefined) row.durationTurns = durationTurns;
        return withTarget(row, target);
      });
  }

  function parseImmunity(clause: string): ParsedEffect[] | null {
    let m = /^(?:immune(?: to)?|gains immunity to) (.+)$/i.exec(clause);
    if (m) return immunityRows(m[1]!, SELF);
    m = /^makes (.+?) immune to (.+?)(?: for (\d+) rounds?)?$/i.exec(clause);
    if (m) {
      const target = parseTarget(m[1]!);
      if (target) return immunityRows(m[2]!, target, m[3] ? Number(m[3]) : undefined);
    }
    return null;
  }

  // ───────────────────────── stat modifiers ─────────────────────────

  const ITEM_PREFIX = new RegExp(`^${NUM}% (?:self )?${STAT}(?: \\((can exceed cap)\\))?$`, "i");
  const ITEM_SUFFIX = new RegExp(`^${STAT} \\(${NUM}%\\)$`, "i");
  const ITEM_BY = new RegExp(`^${STAT} by (?:${NUM}(%| points)?|(a certain percentage))(?: \\(([^)]+)\\))?$`, "i");
  const ITEM_BARE = new RegExp(`^${STAT}$`, "i");
  const STARTS_ITEM = new RegExp(`^(?:${NUM}% )?${STAT}(?: |$)`, "i");

  function parseStatGroup(clause: string, inherit?: Target): ParsedEffect[] | null {
    const head = /^(increases|decreases|reduces)\s+(.+)$/i.exec(clause);
    if (!head) return null;
    const sign = /^increases$/i.test(head[1]!) ? "" : "-";
    let body = head[2]!.replace(/\([^)]*\)/g, (paren) => paren.replace(/,/g, "\u0001").replace(/ and /g, " \u0002 "));
    const unmask = (t: string) => t.replace(/\u0001/g, ",").replace(/ \u0002 /g, " and ");
    let durationTurns: number | undefined;
    const dur = /\s+for (\d+) rounds?$/i.exec(body);
    if (dur) {
      durationTurns = Number(dur[1]);
      body = body.slice(0, dur.index);
    }
    const stamp = (e: ParsedEffect): ParsedEffect => (durationTurns === undefined ? e : { ...e, durationTurns });
    const statRow = (key: string, value: string | null, unit: ValueType | undefined, target: Target | undefined): ParsedEffect => {
      const row: ParsedEffect = { kind: key === "fury" ? "FURY" : "STAT", statisticKey: key, value: value === null ? null : sign + value, conditions: [], structuredStatus: "STRUCTURED" };
      if (unit) row.valueType = unit;
      // No number in the source: the direction is all that is known, so it is kept as a code.
      if (value === null) row.valueNote = sign ? VALUE_NOTE_DECREASE : VALUE_NOTE_INCREASE;
      return stamp(withTarget(row, target));
    };

    // "Increases self speed from 83% → 86%" (or "speed 88% → 92%") — an awakening restating a base number.
    let m = new RegExp(`^(.+?) ${STAT}(?: from)? ${NUM}% → ${NUM}%$`, "i").exec(body);
    if (m) {
      const target = parseTarget(m[1]!);
      if (target) return [{ ...statRow(statKey(m[2]!)!, m[4]!, "PERCENT", target), replacesValue: sign + m[3]! }];
    }
    // "Increases final damage reduction for ally assaulters and supporters by 30%" · "… control resistance of ally supporters' by 30%"
    m = new RegExp(`^${STAT} (?:for|of) (.+?) by ${NUM}%$`, "i").exec(body);
    if (m) {
      const target = parseTarget(m[2]!);
      if (target) return [statRow(statKey(m[1]!)!, m[3]!, "PERCENT", target)];
    }

    const out: ParsedEffect[] = [];
    const parsedTargets = new Map<ParsedEffect, Target | undefined>();
    let current: Target | undefined = inherit;
    let fragments: string[] = [];
    for (const chunk of body.split(/\s*,\s*(?:and\s+)?/)) {
      const pending: ParsedEffect[] = [];
      let prefixValue: string | undefined;
      for (const rawSub of chunk.split(/\s+and\s+/)) {
        let rest = rawSub.trim();
        if (!rest) return null;
        let targetStr: string | undefined;
        const apo = rest.lastIndexOf("'");
        if (apo >= 0) {
          let end = apo + 1;
          if (rest[end] === "s" && (end + 1 === rest.length || rest[end + 1] === " ")) end++;
          targetStr = rest.slice(0, end);
          rest = rest.slice(end).trim();
          const exc = /^\(except self\)\s*/i.exec(rest);
          if (exc) {
            targetStr += " (except self)";
            rest = rest.slice(exc[0].length);
          }
        } else {
          // no possessive: "self hp by 60%", "enemy vanguard defenses by 50%"
          for (let i = rest.indexOf(" "); i !== -1; i = rest.indexOf(" ", i + 1)) {
            if (STARTS_ITEM.test(rest.slice(i + 1)) && parseTarget(rest.slice(0, i))) {
              targetStr = rest.slice(0, i);
              rest = rest.slice(i + 1);
              break;
            }
          }
        }
        if (targetStr === undefined && (isNature(rest) || /^(?:(?:ally|allied|enemy) )?(?:vanguards?|assaulters?|supporters?)$/i.test(rest))) {
          fragments.push(rest); // "thunder" of "thunder and fire chakra allies'", "ally vanguard" of "ally vanguard and assaulters'"
          continue;
        }
        if (targetStr !== undefined && rest === "") {
          fragments.push(targetStr); // "ally assaulters'" of "ally assaulters' and supporters' …"
          continue;
        }
        if (targetStr !== undefined) {
          const side: "ally" | "enemy" | undefined = current?.targetKey === "ally" || current?.targetKey === "enemy" ? current.targetKey : undefined;
          const target = parseTarget([...fragments, targetStr].join(" and "), side);
          fragments = [];
          if (!target) return null;
          current = target;
        } else if (fragments.length > 0) return null;

        let im: RegExpExecArray | null;
        if ((im = ITEM_PREFIX.exec(rest))) {
          prefixValue = im[1]!;
          const row = statRow(statKey(im[2]!)!, im[1]!, "PERCENT", current);
          out.push(...pending.splice(0), im[3] ? { ...row, valueNote: im[3].toLowerCase() } : row);
        } else if ((im = ITEM_SUFFIX.exec(rest))) {
          const row = statRow(statKey(im[1]!)!, im[2]!, "PERCENT", current);
          // Stats named before it without a number keep their place in front of it.
          out.push(...pending.splice(0), { ...row, structuredStatus: "NEEDS_REVIEW", note: joinNote(row.note, "BRACKET_SCOPE") });
        } else if ((im = ITEM_BY.exec(rest))) {
          const key = statKey(im[1]!)!;
          const value = im[2] ?? null;
          const unit: ValueType | undefined = im[2] ? (im[3] === "%" ? "PERCENT" : "FLAT") : undefined;
          const rider = im[5] ? unmask(im[5]).trim() : undefined;
          let rows: ParsedEffect[] = [...pending.splice(0).map((p) => statRow(p.statisticKey!, value, unit, parsedTargets.get(p))), statRow(key, value, unit, current)];
          if (im[4]) rows = rows.map((r) => ({ ...r, valueNote: im![4]!.toLowerCase() }));
          if (rider) {
            const pve = new RegExp(`^${NUM}% chance to trigger in PvE, ${NUM}% in PvP$`, "i").exec(rider);
            if (/^(both )?can exceed cap$/i.test(rider)) rows = rows.map((r) => ({ ...r, valueNote: rider.toLowerCase() }));
            else if (/^not effective in PvE$/i.test(rider)) rows = rows.map((r) => ({ ...r, conditions: [...r.conditions, battleMode("pve", "EXCLUDES")] }));
            else if (pve) {
              rows = rows.flatMap((r) => [
                { ...r, chancePercent: pve[1]!, conditions: [...r.conditions, battleMode("pve", "REQUIRES")] },
                { ...r, chancePercent: pve[2]!, conditions: [...r.conditions, battleMode("pvp", "REQUIRES")] },
              ]);
            } else return null;
          }
          out.push(...rows);
        } else if ((im = ITEM_BARE.exec(rest))) {
          const row = statRow(statKey(im[1]!)!, prefixValue ?? null, prefixValue ? "PERCENT" : undefined, current);
          if (prefixValue) out.push(row);
          else {
            pending.push(row);
            parsedTargets.set(row, current);
          }
        } else return null;
      }
      out.push(...pending); // named without a number in the source → no number
    }
    if (fragments.length > 0 || out.length === 0) return null;
    return out;
  }
  const battleMode = (mode: "pve" | "pvp", operator: "REQUIRES" | "EXCLUDES"): ParsedCondition => ({ scope: "ACTIVATION", typeKey: "battle_mode", valueKey: mode, operator, alternativeGroup: 0 });

  function parseBornWith(clause: string): ParsedEffect[] | null {
    const m = new RegExp(`^born with ${NUM}% ${STAT}(?: \\(([^)]+)\\))?$`, "i").exec(clause);
    if (!m) return null;
    const row: ParsedEffect = { kind: "STAT", statisticKey: statKey(m[2]!)!, value: m[1]!, valueType: "PERCENT", targetKey: "self", targetText: "self", conditions: [], structuredStatus: "STRUCTURED" };
    const rider = m[3]?.trim();
    if (!rider) return [row];
    if (/^can exceed cap$/i.test(rider)) return [{ ...row, valueNote: rider.toLowerCase() }];
    if (/^not effective in PvE$/i.test(rider)) return [{ ...row, conditions: [battleMode("pve", "EXCLUDES")] }];
    return null;
  }

  // ───────────────────────── clause & line ─────────────────────────

  /** "enemy vanguard/assaulters/supporters with 380/330/300%" → one clause per pair. */
  function expandSlashes(clause: string): string[] | null {
    const values = new RegExp(`\\b(\\d+(?:\\.\\d+)?(?:/\\d+(?:\\.\\d+)?)+)%`).exec(clause);
    if (!values) return null;
    const nums = values[1]!.split("/");
    const names = /\b([a-z]+(?:\/[a-z]+)+)\b/i.exec(clause);
    if (!names) return null;
    const words = names[1]!.split("/");
    if (words.length !== nums.length) return null;
    if (!words.every((w) => formationKey(w)) && !words.every(isNature)) return null;
    return words.map((w, i) => clause.replace(names[1]!, w).replace(values[1]! + "%", nums[i]! + "%"));
  }

  function parseClause(clause: string, inherit?: Target): ParsedEffect[] | null {
    const expanded = expandSlashes(clause);
    if (expanded) {
      const all = expanded.map((c) => parseClause(c, inherit));
      return all.every(Boolean) ? all.flatMap((r) => r!) : null;
    }
    const chance = new RegExp(`^(?:has )?${NUM}% chance to (.+)$`, "i").exec(clause);
    if (chance) {
      const inner = chance[2]!.replace(/^(self )?(\w+)/i, (whole, self: string | undefined, verb: string) => {
        const third = THIRD_PERSON[verb.toLowerCase()];
        return third ? (self ? `self ${third}` : third) : whole;
      });
      const rows = parseClause(inner) ?? parseBareStatus(inner);
      if (!rows || !rows.every((r) => r.kind !== "TEXT" && !r.chancePercent)) return null;
      // A probability cannot pass 100%. "110% chance to chaos" is kept as the application rate the source prints, never capped.
      if (Number(chance[1]) > 100) return rows.every((r) => r.kind === "STATUS" && r.rateValue === undefined) ? rows.map((r) => ({ ...r, rateValue: chance[1]!, rateKind: "APPLICATION" as const })) : null;
      return rows.map((r) => ({ ...r, chancePercent: chance[1]! }));
    }
    return (
      parseAttack(clause) ??
      parsePenetration(clause) ??
      parseHeal(clause) ??
      parseFury(clause) ??
      parseDispel(clause) ??
      parseImmunity(clause) ??
      parseBornWith(clause) ??
      parseStatGroup(clause, inherit) ??
      parseStatus(clause)
    );
  }

  const CLAUSE_START =
    String.raw`(?:(?:increases|decreases|reduces|applies|dispels|heals|restores|deals|enters|makes|grants|self enters)\b|has \d+(?:\.\d+)?% chance|\d+(?:\.\d+)?% (?:chance|rate) to\b|(?:all )?allies (?:gain|enter)\b|(?:ally|enemy) \w+ (?:gain|enter)s?\b|\d+ random (?:allies|enemies|ally|enemy) enters?\b)`;
  const SPLIT = new RegExp(`(?:,\\s*and\\s+|\\s+and\\s+|,\\s+)(?=${CLAUSE_START})`, "i");
  const RATE_HEAD = new RegExp(`^${NUM}% rate to [a-z ]+$`, "i");
  const RATE_NEXT = new RegExp(`^${NUM}% rate to `, "i");

  /** Splits a sentence into clauses. "60% rate to freeze and 60% rate to chaos enemies" stays whole. */
  function splitClauses(text: string): string[] {
    const parts = text.split(SPLIT).map(squash).filter(Boolean);
    const out: string[] = [];
    for (const part of parts) {
      const prev = out[out.length - 1];
      if (prev && RATE_HEAD.test(prev) && RATE_NEXT.test(part)) out[out.length - 1] = `${prev} and ${part}`;
      else out.push(part);
    }
    return out;
  }
  const BUT = /,\s+but\s+(?=(?:decreases|increases)\b)/i;

  const GATING: RegExp[] = [
    new RegExp(`\\b(?:${natures.source})(?:(?:,|/| and|, and) (?:${natures.source}))*(?: chakra)?(?: nature)? (?:allies|enemies|ally|enemy)\\b`, "gi"),
    /\b(?:male|female)\b(?: (?:allies|enemies|ally|enemy|ninjas?|targets?))?/gi,
    /\bjinchuriki(?: allies| enemies)?\b/gi,
    /\b(?:not effective in |in )?Pv[EP]\b/gi,
  ];

  /** Requirement wording that the structured fields of a row do not already carry. */
  function unstructuredGating(text: string, row: ParsedEffect): string | undefined {
    const found = GATING.flatMap((re) => text.match(re) ?? []);
    if (found.length === 0) return undefined;
    if (row.conditions.some((c) => c.scope === "ACTIVATION")) return undefined;
    return [...new Set(found.map((f) => f.trim()))].join("; ");
  }

  function parseSentence(sentence: string): { rows: ParsedEffect[]; structured: boolean } {
    let rest = sentence;
    let triggerText: string | undefined;
    const trig = TRIGGER.exec(rest);
    const tail = /\s+(when attacked)$/i.exec(rest);
    if (trig) {
      triggerText = trig[1]!;
      rest = rest.slice(trig[0].length);
    } else if (tail) {
      triggerText = tail[1]!;
      rest = rest.slice(0, tail.index);
    }
    const rows: ParsedEffect[] = [];
    let structured = true;
    let first: Target | undefined;
    for (const [i, segment] of rest.split(BUT).entries()) {
      for (const clause of splitClauses(segment)) {
        const parsed = parseClause(clause, i > 0 ? first : undefined) ?? [textRow(clause)];
        if (parsed.some((r) => r.kind === "TEXT")) structured = false;
        if (!first && parsed[0]?.targetKey) first = { targetKey: parsed[0].targetKey, text: parsed[0].targetText ?? "", conditions: [] };
        for (const row of parsed) {
          const gating = unstructuredGating(clause, row);
          rows.push({ ...row, ...(triggerText ? { triggerText } : {}), ...(gating ? { conditionText: gating } : {}) });
        }
      }
    }
    return { rows, structured };
  }

  /** Parses one source line (a bullet of an ability). */
  function parseLine(line: string): ParsedLine {
    const text = squash(line).replace(/\.$/, "");
    if (!text) return { effects: [], fullyStructured: true };

    // "1) Deva Path — …, OR Animal Path — …": alternatives of which one applies.
    const choice = /^(\d+)\)\s+(.+)$/.exec(text);
    if (choice && /,?\s+OR\s+/.test(choice[2]!)) {
      const effects: ParsedEffect[] = [];
      let structured = true;
      for (const option of choice[2]!.split(/,?\s+OR\s+/)) {
        const m = /^(.+?)\s+—\s+(.+)$/.exec(option.trim());
        const label = m ? m[1]!.trim() : undefined;
        const parsed = parseSentence(m ? m[2]! : option.trim());
        if (!parsed.structured) structured = false;
        for (const row of parsed.rows) effects.push({ ...row, choiceGroup: Number(choice[1]), ...(label ? { choiceLabel: label } : {}) });
      }
      return { effects, fullyStructured: structured };
    }

    const effects: ParsedEffect[] = [];
    let fullyStructured = true;
    for (const sentence of text.split(/\.\s+(?=[A-Z])/)) {
      const parsed = parseSentence(sentence.replace(/\.$/, ""));
      if (!parsed.structured) fullyStructured = false;
      effects.push(...parsed.rows);
    }
    return { effects, fullyStructured };
  }

  return { parseLine, parseTarget };
}

export type AbilityParser = ReturnType<typeof createAbilityParser>;

const ES_BASE_STATS: Record<string, string> = { fuerza: "force", agilidad: "agility", hp: "hp", vida: "hp", chakra: "chakra" };

/**
 * Numbers the Spanish text explicitly gives to base attributes («la fuerza y la agilidad propias en 15%»).
 * Used only to fill an attribute the English names WITHOUT a number. Anything else in the line is left alone,
 * and a number that conflicts with an English one is never replaced.
 */
export function spanishBaseStatValues(esLine: string): Map<string, string> {
  const out = new Map<string, string>();
  const word = "(?:fuerza|agilidad|hp|vida|chakra)";
  const re = new RegExp(`((?:(?:la|el)\\s+)?${word}(?:\\s*(?:,|y|e)\\s*(?:(?:la|el)\\s+)?${word})*)\\s+(?:propi[oa]s?\\s+)?en\\s+(?:un\\s+)?(\\d+(?:[.,]\\d+)?)\\s?%`, "gi");
  for (const m of esLine.matchAll(re)) {
    for (const w of m[1]!.toLowerCase().match(new RegExp(word, "g")) ?? []) out.set(ES_BASE_STATS[w]!, m[2]!.replace(",", "."));
  }
  return out;
}

/** Every number written in a text, in order — used to check that two versions of a line agree. */
export function numbersIn(text: string): string[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));
}
