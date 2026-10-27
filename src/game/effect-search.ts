import { normalizeTerm } from "../domain/localize";
import type { Db } from "./db";

/**
 * Search by effect («aturdir», «inmunidad a sellar», «aumento de velocidad», «restaurar furia»...).
 *
 * The question answered is: «which ninjas have a stored ability, talent option or awakening that contains this
 * effect?». It does not say the effect is active together with every other one: awakenings replace each other
 * and talents/choices are exclusive, which the ninja page shows. Structured effects are classified by their
 * fields (kind, status, statistic, sign, target); effects that only exist as source wording (TEXT_ONLY) are
 * classified from that wording, and a phrase no vocabulary entry knows is searched in the wording itself.
 * Applying a status, being immune to it, raising and lowering a statistic are different concepts and are never mixed.
 */

type Side = "self" | "ally" | "enemy";

export interface EffectSuggestion {
  /** Spanish text shown in the suggestions; typing it back resolves to exactly this concept. */
  value: string;
}

interface IndexedEffect {
  ninjaId: string;
  concepts: Set<string>;
  side: Side | null;
  kind: string;
  /** Accent-free lower-case source wording (English and Spanish). */
  text: string;
}

interface EffectIndex {
  effects: IndexedEffect[];
  statuses: { key: string; names: string[] }[];
  statistics: { key: string; names: string[] }[];
  /** Concepts that exist in the data, for the suggestions. */
  present: Set<string>;
}

const n = normalizeTerm;

/** Spanish terms per status key (accent-free). English names, aliases and the lexicon terms are added from the data. */
const STATUS_ES: Record<string, { label: string; terms: string[] }> = {
  stun: { label: "Aturdir", terms: ["aturdir", "aturdimiento", "aturdido", "aturde"] },
  seal: { label: "Sellar", terms: ["sellar", "sellado", "sello"] },
  silence: { label: "Silenciar", terms: ["silenciar", "silencio"] },
  freeze: { label: "Congelar", terms: ["congelar", "congelacion", "congelado"] },
  imprison: { label: "Aprisionar", terms: ["aprisionar", "prision", "encarcelar"] },
  petrify: { label: "Petrificar", terms: ["petrificar", "petrificacion"] },
  paralysis: { label: "Paralizar", terms: ["paralizar", "paralisis"] },
  blind: { label: "Cegar", terms: ["cegar", "ceguera"] },
  charm: { label: "Encantar", terms: ["encantar", "encanto", "hechizar"] },
  chaos: { label: "Caos", terms: ["caos"] },
  poison: { label: "Envenenar", terms: ["envenenar", "veneno", "envenenamiento"] },
  bleed: { label: "Sangrado", terms: ["sangrado", "sangrar"] },
  curse: { label: "Maldecir", terms: ["maldecir", "maldicion"] },
  "death-seed": { label: "Semilla de muerte", terms: ["semilla de muerte", "semilla de la muerte"] },
  "weakened-state": { label: "Estado debilitado", terms: ["debilitado", "estado debilitado", "debilitar"] },
  expel: { label: "Expulsar", terms: ["expulsar", "expulsion"] },
  disable: { label: "Deshabilitar", terms: ["deshabilitar"] },
  "super-dodge": { label: "Super evasión", terms: ["super evasion", "superevasion", "super esquiva", "superesquiva", "superesquive"] },
  "s-super-dodge": { label: "S-super evasión", terms: ["s-super evasion", "s-superesquive", "superesquiva s"] },
  acupoint: { label: "Punto de acupuntura", terms: ["punto de acupuntura", "puntos de acupuntura"] },
  acupuncture: { label: "Acupuntura", terms: ["acupuntura"] },
  burst: { label: "Explosión", terms: ["explosion"] },
  "armor-break": { label: "Ruptura de armadura", terms: ["ruptura de armadura"] },
  "shielding-state": { label: "Escudo", terms: ["escudo", "estado de escudo"] },
  "superarmor-state": { label: "Superarmadura", terms: ["superarmadura"] },
  acceleration: { label: "Aceleración", terms: ["aceleracion"] },
  "forbid-fury": { label: "Prohibir furia", terms: ["prohibir furia", "prohibir la furia"] },
  "heal-forbid-state": { label: "Prohibición de curación", terms: ["prohibicion de curacion"] },
  "heal-reduction-state": { label: "Reducción de curación", terms: ["reduccion de curacion"] },
  "fury-reduction": { label: "Reducción de furia", terms: ["reduccion de furia"] },
  incinerate: { label: "Incinerar", terms: ["incinerar", "quemar", "quemadura"] },
  "wind-bound": { label: "Atadura de viento", terms: ["atadura de viento"] },
  "poisonous-wind": { label: "Viento venenoso", terms: ["viento venenoso"] },
  "upwind-headwind-state": { label: "Viento ascendente", terms: ["viento ascendente", "viento en contra", "viento a favor"] },
  "fury-shield": { label: "Escudo de furia", terms: ["escudo de furia"] },
  "control-immune-state": { label: "Inmunidad al control", terms: ["inmunidad al control"] },
  "dispirited-state": { label: "Estado desanimado", terms: ["desanimado"] },
  "bond-state": { label: "Estado de vínculo", terms: ["vinculo"] },
  "corrosion-state": { label: "Corrosión", terms: ["corrosion"] },
  "pyroblast-state": { label: "Piroexplosión", terms: ["piroexplosion"] },
  split: { label: "División", terms: ["division", "dividido"] },
  unification: { label: "Unificación", terms: ["unificacion"] },
  "power-loss": { label: "Pérdida de poder", terms: ["perdida de poder"] },
  "vein-damage": { label: "Daño de venas", terms: ["dano de venas", "dano por venas"] },
  "painful-will": { label: "Voluntad dolorosa", terms: ["voluntad dolorosa"] },
  safeguard: { label: "Salvaguardar", terms: ["salvaguardar"] },
  "curse-fixation": { label: "Fijar maldición", terms: ["fijar maldicion"] },
  "penetration-damage": { label: "Daño penetrante", terms: ["dano penetrante"] },
};

/** Spanish terms per statistic key (accent-free). English names and the key are added from the data. */
const STAT_ES: Record<string, { label: string; terms: string[] }> = {
  attack: { label: "ataque", terms: ["ataque"] },
  defenses: { label: "defensas", terms: ["defensas", "defensa"] },
  speed: { label: "velocidad", terms: ["velocidad"] },
  hp: { label: "vida", terms: ["vida", "salud", "pv"] },
  "healing-rate": { label: "tasa de curación", terms: ["tasa de curacion"] },
  "cc-resistance": { label: "resistencia al control", terms: ["resistencia al control", "resistencia cc", "control resistance"] },
  "control-resistance": { label: "resistencia al control", terms: ["resistencia al control", "control resistance"] },
  "control-rate": { label: "tasa de control", terms: ["tasa de control"] },
  "crit-rate": { label: "tasa de crítico", terms: ["tasa de critico", "tasa critica", "probabilidad critica"] },
  "crit-damage": { label: "daño crítico", terms: ["dano critico"] },
  "crit-resistance": { label: "resistencia crítica", terms: ["resistencia critica"] },
  "dodge-rate": { label: "tasa de evasión", terms: ["tasa de evasion", "evasion", "esquiva"] },
  "hit-rate": { label: "tasa de acierto", terms: ["tasa de acierto", "punteria"] },
  "block-rate": { label: "tasa de bloqueo", terms: ["tasa de bloqueo", "bloqueo"] },
  block: { label: "bloqueo", terms: ["bloqueo", "block"] },
  "damage-rate": { label: "tasa de daño", terms: ["tasa de dano"] },
  "aid-rate": { label: "tasa de ayuda", terms: ["tasa de ayuda"] },
  "counter-rate": { label: "tasa de contraataque", terms: ["tasa de contraataque", "contraataque"] },
  "physical-defense": { label: "defensa física", terms: ["defensa fisica"] },
  "strategy-defense": { label: "defensa de estrategia", terms: ["defensa de estrategia"] },
  "strategy-attack": { label: "ataque de estrategia", terms: ["ataque de estrategia"] },
  "ignore-defense": { label: "ignorar defensa", terms: ["ignorar defensa", "ignora defensa", "ignorar defensas"] },
  "final-damage": { label: "daño final", terms: ["dano final"] },
  "final-damage-dealt": { label: "daño final infligido", terms: ["dano final infligido"] },
  "penetration-damage-stat": { label: "daño penetrante", terms: ["dano penetrante"] },
  force: { label: "fuerza", terms: ["fuerza"] },
  agility: { label: "agilidad", terms: ["agilidad"] },
  chakra: { label: "chakra", terms: ["chakra"] },
  power: { label: "constitución", terms: ["constitucion", "poder"] },
};

const SIDE_WORDS: [Side, RegExp][] = [
  ["enemy", /\b(enemig\w*|enemy|enemies|rival\w*|atacante)\b/g],
  ["ally", /\b(aliad\w*|ally|allies|equipo)\b/g],
  ["self", /\b(propi\w*|self|uno mismo|si mismo)\b/g],
];
const IMMUNITY_WORDS = /\b(inmun\w*|immun\w*)\b/g;
const UP_WORDS = /\b(aumento|aumentar|aumenta|subir|sube|incremento|incrementar|increase\w*|boost|mejora\w*|mas|restaurar|restaura\w*|restoration|restore\w*|recuperar|recupera\w*|ganar|gain\w*)\b/g;
const DOWN_WORDS = /\b(reduccion|reducir|reduce\w*|reduction|disminuir|disminucion|disminuye\w*|decrease\w*|bajar|baja|menos|drain\w*|drenar|drenaje|quitar furia)\b/g;
const REMOVE_WORDS = /\b(eliminar|eliminacion|elimina\w*|remover|remocion|removal|remove\w*|quitar|dispel\w*|disipar|disipa\w*|dispersar|purificar|purifica\w*|limpiar|cleanse\w*)\b/g;
const FILLER = /\b(de|del|la|las|los|el|a|al|en|por|of|to|the|efecto|efectos|effect|effects|con)\b/g;

const NEGATION = /(?:\b(?:cannot|can't|cant|not|no|without|sin|never|nunca)\b|\bimmun\w*|\binmun\w*|\bresist\w*)\s*(?:\w+\s+){0,3}$/;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const strip = (s: string, re: RegExp) => clean(s.replace(re, " "));
const wordIn = (hay: string, needle: string) => needle.length > 0 && new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay);

/** True when `term` occurs in `text` outside a negation or immunity phrase («cannot be stunned», «immune to stun»). */
function occursAffirmatively(text: string, term: RegExp): boolean {
  const g = new RegExp(term.source, "g");
  for (let m = g.exec(text); m; m = g.exec(text)) {
    if (!NEGATION.test(text.slice(Math.max(0, m.index - 40), m.index))) return true;
  }
  return false;
}

function sideOfText(text: string): Side | null {
  if (/\b(enem(y|ies|igos?)|attacker|atacante)\b/.test(text)) return "enemy";
  if (/\b(ally|allies|aliad\w*)\b/.test(text)) return "ally";
  if (/\b(self|propi\w*)\b/.test(text)) return "self";
  return null;
}

const FIXED_PHRASES: { id: string; label: string; terms: string[] }[] = [
  { id: "heal", label: "Curación", terms: ["curacion", "curar", "curas", "sanar", "heal", "heals", "healing", "recovery", "recuperacion de vida"] },
  { id: "fury-up", label: "Restaurar furia", terms: ["restaurar furia", "restauracion de furia", "fury restoration", "restore fury", "restores fury", "ganar furia", "gain fury", "recuperar furia"] },
  { id: "fury-down", label: "Reducir furia", terms: ["reducir furia", "reduccion de furia del enemigo", "fury reduction", "decrease fury", "drenar furia", "drain fury"] },
  { id: "dispel-debuffs", label: "Eliminar debuffs", terms: ["eliminar debuffs", "eliminar debuff", "debuff removal", "remove debuffs", "dispel debuffs", "purificar", "limpiar debuffs", "cleanse", "debuffs", "debuff"] },
  { id: "dispel-buffs", label: "Disipar buffs enemigos", terms: ["disipar buffs", "disipar beneficios", "dispel buffs", "remove buffs", "eliminar buffs", "eliminar beneficios", "buffs", "buff", "beneficios"] },
  { id: "damage-reduction", label: "Reducción de daño", terms: ["reduccion de dano", "reducir dano", "damage reduction", "reduce damage", "dano recibido", "damage received"] },
];

const DAMAGE_REDUCTION_CONCEPTS = ["up:final-damage-reduction", "down:final-damage-received", "down:total-damage-received"];

function classify(
  e: { kind: string; value: number | null; description: string | null; statKey: string | null; statusKey: string | null; text: string; textOnly: boolean },
  statusNames: Map<string, RegExp>,
  statNames: Map<string, RegExp>,
): Set<string> {
  const c = new Set<string>();
  const { kind, value, statKey, statusKey } = e;
  if (kind === "HEAL") c.add("heal");
  if (kind === "FURY" && value !== null) c.add(value >= 0 ? "fury-up" : "fury-down");
  if (kind === "DISPEL") c.add(n(e.description ?? "").startsWith("debuff") ? "dispel-debuffs" : n(e.description ?? "").startsWith("buff") ? "dispel-buffs" : "dispel-other");
  if (kind === "IMMUNITY") {
    c.add("immune:*");
    if (statusKey) c.add(`immune:${statusKey}`);
    else if (e.description) c.add(`immune-text`);
  }
  if (kind === "STATUS" && statusKey) c.add(`status:${statusKey}`);
  if (kind === "STAT" && statusKey && !statKey) c.add(`status:${statusKey}`);
  if (kind === "STAT" && statKey) {
    if (value !== null && value !== 0) c.add(`${value > 0 ? "up" : "down"}:${statKey}`);
    else c.add(`any:${statKey}`);
  }
  if (kind === "TEXT" || e.textOnly) {
    // Source wording only: classify it by the same vocabulary, ignoring negated and immunity phrases.
    const t = e.text;
    if (/\b(heals?|healing|cura)\b/.test(t) && occursAffirmatively(t, /\b(heals?|healing|cura)\b/)) c.add("heal");
    if (/\bdispel\w*\b[^.]*\bdebuffs?\b|\bremov\w*\b[^.]*\bdebuffs?\b|\bcleans\w*\b/.test(t)) c.add("dispel-debuffs");
    if (/\bdispel\w*\b[^.]*\bbuffs?\b/.test(t) && !/\bdispel\w*\b[^.]*\bdebuffs?\b/.test(t)) c.add("dispel-buffs");
    if (/\b(restores?|gains?|recover\w*)\b[^.]*\bfury\b/.test(t)) c.add("fury-up");
    if (/\b(decreas\w*|reduc\w*|drain\w*)\b[^.]*\bfury\b/.test(t)) c.add("fury-down");
    for (const [key, re] of statusNames) {
      if (occursAffirmatively(t, re)) c.add(/\b(immun\w*|inmun\w*)\b/.test(t) && !occursAffirmatively(t, re) ? `immune:${key}` : `status:${key}`);
      else if (re.test(t) && /\b(immun\w*|inmun\w*)\b/.test(t)) c.add(`immune:${key}`);
    }
    for (const [key, re] of statNames) {
      const m = new RegExp(`\\b(increas\\w*|boost\\w*|raise\\w*|restor\\w*)\\b[^.]*${re.source}|${re.source}[^.]*\\b(increas\\w*)`).test(t);
      const d = new RegExp(`\\b(decreas\\w*|reduc\\w*|lower\\w*)\\b[^.]*${re.source}|${re.source}[^.]*\\b(decreas\\w*|reduc\\w*)`).test(t);
      if (m) c.add(`up:${key}`);
      if (d) c.add(`down:${key}`);
    }
  }
  return c;
}

const cache = new WeakMap<object, { at: number; index: Promise<EffectIndex> }>();
const TTL_MS = process.env.NODE_ENV === "test" || process.env.VITEST ? 0 : 30_000;

async function buildIndex(db: Db): Promise<EffectIndex> {
  const [rows, statuses, statistics] = await Promise.all([
    db.effect.findMany({
      select: {
        kind: true,
        value: true,
        description: true,
        sourceText: true,
        descriptionEs: true,
        structuredStatus: true,
        target: { select: { key: true } },
        statistic: { select: { key: true } },
        statusEffect: { select: { key: true } },
        ability: { select: { ninjaId: true } },
        talentOption: { select: { group: { select: { ninjaId: true } } } },
      },
    }),
    db.statusEffect.findMany({ select: { key: true, name: true, nameEs: true, aliases: { select: { alias: true } } } }),
    db.statistic.findMany({ select: { key: true, name: true, nameEs: true } }),
  ]);
  const statusDefs = statuses.map((s) => ({
    key: s.key,
    names: [...new Set([n(s.name), ...(s.nameEs ? [n(s.nameEs)] : []), ...s.aliases.map((a) => n(a.alias)), ...(STATUS_ES[s.key]?.terms ?? [])])].filter((x) => x.length >= 3),
  }));
  const statDefs = statistics.map((s) => ({
    key: s.key,
    names: [...new Set([n(s.name), ...(s.nameEs ? [n(s.nameEs)] : []), s.key.replace(/-/g, " "), ...(STAT_ES[s.key]?.terms ?? [])])].filter((x) => x.length >= 3),
  }));
  // Only the English wording of source text is pattern-matched; the Spanish text is searched as typed.
  const statusRe = new Map<string, RegExp>();
  for (const s of statuses) {
    const names = [n(s.name).replace(/\s*\(.*\)/, ""), ...s.aliases.map((a) => n(a.alias))].filter((x) => x.length >= 4 && /^[a-z -]+$/.test(x));
    if (names.length) statusRe.set(s.key, new RegExp(`\\b(?:${names.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?:s|d|ed|ned|ing)?\\b`));
  }
  const statRe = new Map<string, RegExp>();
  for (const s of statistics) {
    const en = n(s.name);
    if (/^[a-z ]+$/.test(en) && en.length >= 4) statRe.set(s.key, new RegExp(`\\b${en.replace(/ /g, "\\s+")}\\b`));
  }

  const effects: IndexedEffect[] = [];
  const present = new Set<string>();
  for (const r of rows) {
    const ninjaId = r.ability?.ninjaId ?? r.talentOption?.group.ninjaId;
    if (!ninjaId) continue;
    const text = n([r.sourceText, r.descriptionEs, r.description].filter(Boolean).join(" . "));
    const textOnly = r.structuredStatus === "TEXT_ONLY" || r.kind === "TEXT";
    const concepts = classify(
      { kind: r.kind, value: r.value === null ? null : Number(r.value.toString()), description: r.description, statKey: r.statistic?.key ?? null, statusKey: r.statusEffect?.key ?? null, text, textOnly },
      statusRe,
      statRe,
    );
    const side = (r.target?.key as Side | undefined) && ["self", "ally", "enemy"].includes(r.target!.key) ? (r.target!.key as Side) : sideOfText(text);
    for (const k of concepts) present.add(k);
    effects.push({ ninjaId, concepts, side, kind: r.kind, text });
  }
  return { effects, statuses: statusDefs, statistics: statDefs, present };
}

async function indexOf(db: Db): Promise<EffectIndex> {
  const hit = cache.get(db);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.index;
  const index = buildIndex(db);
  cache.set(db, { at: Date.now(), index });
  index.catch(() => cache.delete(db));
  return index;
}

interface Resolved {
  /** Concepts to match (any). */
  concepts: string[];
  side: Side | null;
  /** Raw wording to look for when no vocabulary entry matched. */
  text: string | null;
  immunity: boolean;
}

function resolve(index: EffectIndex, term: string): Resolved {
  let q = n(term).replace(/[^a-z0-9\-\s']/g, " ");
  q = clean(q);
  let side: Side | null = null;
  for (const [s, re] of SIDE_WORDS) {
    if (re.test(q)) {
      side = side ?? s;
      q = strip(q, re);
    }
    re.lastIndex = 0;
  }
  const immunity = new RegExp(IMMUNITY_WORDS.source).test(q);
  q = strip(q, IMMUNITY_WORDS);

  // 1. Whole phrases of the fixed concepts (longest first), checked before direction words are removed.
  const concepts = new Set<string>();
  const whole = clean(q.replace(FILLER, " "));
  if (!immunity) {
    const tidy = (x: string) => clean(n(x).replace(FILLER, " "));
    for (const f of FIXED_PHRASES) {
      if (f.terms.some((t) => tidy(t) === whole)) {
        if (f.id === "damage-reduction") DAMAGE_REDUCTION_CONCEPTS.forEach((x) => concepts.add(x));
        else concepts.add(f.id);
      }
    }
    if (concepts.size) return { concepts: [...concepts], side, text: null, immunity };
  }

  const up = new RegExp(UP_WORDS.source).test(q);
  const down = new RegExp(DOWN_WORDS.source).test(q);
  const remove = new RegExp(REMOVE_WORDS.source).test(q);
  let r = strip(strip(strip(q, UP_WORDS), DOWN_WORDS), REMOVE_WORDS);
  r = clean(r.replace(FILLER, " "));

  if (immunity && r === "") return { concepts: ["immune:*"], side, text: null, immunity };
  if (!immunity && remove && r === "") return { concepts: ["dispel-debuffs", "dispel-buffs", "dispel-other"], side, text: null, immunity };
  if (r === "") {
    if (up) return { concepts: ["fury-up"], side, text: null, immunity }; // «restaurar» alone
    return { concepts: [], side, text: null, immunity };
  }

  // 2. Statuses (applied or immunity).
  // The longest term of an entry that the wording contains or starts; an entry whose name merely CONTAINS the wording
  // does not match («curación» is not the statistic «tasa de curación»).
  const score = (names: string[]) => Math.max(0, ...names.map((raw) => clean(raw.replace(FILLER, " "))).map((x) => (x === r ? 1000 : x.length >= 4 && wordIn(r, x) ? x.length : r.length >= 4 && x.startsWith(r) ? 10 : 0)));
  const best = <T extends { names: string[] }>(defs: T[]) => {
    const scored = defs.map((d) => [d, score(d.names)] as const).filter(([, v]) => v > 0);
    const top = Math.max(0, ...scored.map(([, v]) => v));
    return scored.filter(([, v]) => v === top).map(([d]) => d);
  };
  for (const s of best(index.statuses)) concepts.add(immunity ? `immune:${s.key}` : `status:${s.key}`);
  if (!immunity) {
    for (const s of best(index.statistics)) {
      if (up && !down) concepts.add(`up:${s.key}`);
      else if (down && !up) concepts.add(`down:${s.key}`);
      else {
        concepts.add(`up:${s.key}`);
        concepts.add(`down:${s.key}`);
        concepts.add(`any:${s.key}`);
      }
    }
    if (r === "furia" || r === "fury") {
      if (down && !up) concepts.add("fury-down");
      else if (up && !down) concepts.add("fury-up");
      else {
        concepts.add("fury-up");
        concepts.add("fury-down");
      }
    }
  }
  // 4. Fixed concepts by single word («curar», «buffs»).
  if (!immunity && !up && !down && !remove) for (const f of FIXED_PHRASES) if (f.terms.some((t) => n(t) === r)) { if (f.id === "damage-reduction") DAMAGE_REDUCTION_CONCEPTS.forEach((x) => concepts.add(x)); else concepts.add(f.id); }

  if (concepts.size) return { concepts: [...concepts], side, text: null, immunity };
  return { concepts: [], side, text: q, immunity };
}

function effectMatches(e: IndexedEffect, rs: Resolved): boolean {
  if (rs.side && e.side !== rs.side) return false;
  if (rs.concepts.length) return rs.concepts.some((c) => e.concepts.has(c));
  if (rs.text) {
    if (rs.immunity && e.kind !== "IMMUNITY") return false;
    if (!rs.immunity && e.kind === "IMMUNITY") return false;
    return wordIn(e.text, rs.text) && (rs.immunity || occursAffirmatively(e.text, new RegExp(rs.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
  }
  return false;
}

/** Ids of the ninjas with at least one stored effect matching ANY of the terms; null when no term is usable (no filter). */
export async function ninjaIdsWithEffects(db: Db, terms: string[]): Promise<string[] | null> {
  const usable = terms.map((t) => t.trim()).filter((t) => n(t).length >= 2);
  if (usable.length === 0) return null;
  const index = await indexOf(db);
  const resolved = usable.map((t) => resolve(index, t));
  const ids = new Set<string>();
  for (const e of index.effects) {
    if (resolved.some((rs) => effectMatches(e, rs))) ids.add(e.ninjaId);
  }
  return [...ids];
}

/** How a typed term was understood, for tests and the interface. */
export async function explainEffectTerm(db: Db, term: string): Promise<{ concepts: string[]; text: string | null; side: Side | null }> {
  const rs = resolve(await indexOf(db), term);
  return { concepts: rs.concepts, text: rs.text, side: rs.side };
}

/** Spanish suggestions, only for effects that exist in the data and only wording that resolves back to the same concept. */
export async function effectSuggestions(db: Db): Promise<EffectSuggestion[]> {
  const index = await indexOf(db);
  const out = new Map<string, string>();
  const has = (c: string) => index.present.has(c);
  const add = (label: string, concept: string) => {
    if (has(concept) && resolve(index, label).concepts.includes(concept)) out.set(label, concept);
  };
  add("Curación", "heal");
  add("Restaurar furia", "fury-up");
  add("Reducir furia", "fury-down");
  add("Eliminar debuffs", "dispel-debuffs");
  add("Disipar buffs enemigos", "dispel-buffs");
  add("Reducción de daño", "up:final-damage-reduction");
  add("Inmunidad", "immune:*");
  for (const s of index.statuses) {
    const label = STATUS_ES[s.key]?.label ?? s.names[0];
    if (!label) continue;
    add(label, `status:${s.key}`);
    add(`Inmunidad a ${label.charAt(0).toLowerCase()}${label.slice(1)}`, `immune:${s.key}`);
  }
  for (const s of index.statistics) {
    const label = STAT_ES[s.key]?.label ?? s.names[0];
    if (!label) continue;
    add(`Aumento de ${label}`, `up:${s.key}`);
    add(`Reducción de ${label}`, `down:${s.key}`);
  }
  return [...out.keys()].map((value) => ({ value }));
}
