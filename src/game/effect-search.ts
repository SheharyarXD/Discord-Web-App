import { normalizeTerm } from "../domain/localize";
import { additiveKey, cumulate, type BonusLine } from "../domain/cumulative";
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
 *
 * Set bonuses ACCUMULATE (confirmed by the client): with N pieces equipped, the bonuses of every tier up to N count together. Only
 * comparable additive values are summed (see `domain/cumulative.ts`); wording-only and conditional effects stay as printed.
 */

type Side = "self" | "ally" | "enemy";

export interface EffectSuggestion {
  /** Spanish text shown in the suggestions; typing it back resolves to exactly this concept. */
  value: string;
}

export type EffectOwner = "ninja" | "equipment" | "jewelry";
export type EffectMode = "any" | "all";

interface IndexedEffect {
  owner: EffectOwner;
  /** The ninja, or the equipment/jewelry set version the effect belongs to. */
  ownerId: string;
  /** Set tier ("2 pieces") and jewelry category the effect is stored under; null for ninjas and pieces. */
  pieces: number | null;
  group: string | null;
  concepts: Set<string>;
  side: Side | null;
  kind: string;
  /** Accent-free lower-case source wording (English and Spanish). */
  text: string;
  /** The wording as stored, for showing which effect matched. */
  raw: string;
  /** Stored signed value of a structured effect (Weaken enemy's ATK +30% is stored as -30), or null. */
  value: number | null;
  /** FLAT, PERCENT or MULTIPLIER as stored. */
  unit: string | null;
  statKey: string | null;
  statusKey: string | null;
  /** False for effects that exist only as source wording: they are searchable but have no value to compare. */
  structured: boolean;
  /** Identity for adding set bonuses together (statistic, unit, target, direction); null for effects that are never added. */
  additiveKey: string | null;
}

interface EffectIndex {
  effects: IndexedEffect[];
  statuses: { key: string; names: string[] }[];
  statistics: { key: string; names: string[] }[];
  /** Concepts that exist in the data, for the suggestions, per kind of owner. */
  present: Record<EffectOwner, Set<string>>;
  /** The highest piece count printed for each set version (key `${owner}:${id}`): the complete set. */
  completeSet: Map<string, number>;
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
  "strategy-attack": { label: "ataque estratégico", terms: ["ataque estrategico", "ataque de estrategia"] },
  "avoid-injury": { label: "evasión de daño", terms: ["evasion de dano", "avoid injury"] },
  "punch-rate": { label: "tasa de golpe", terms: ["tasa de golpe", "punch rate"] },
  "s-attack": { label: "s.attack", terms: ["s attack", "s.attack", "ataque s"] },
  "s-crit": { label: "s.crit", terms: ["s crit", "s.crit"] },
  "s-block": { label: "s.bloqueo", terms: ["s bloqueo", "s.bloqueo", "s block"] },
  "resistance-to-ignore-defense": { label: "resistencia a ignorar defensa", terms: ["resistencia a ignorar defensa"] },
  "crit-damage-resistance": { label: "resistencia al daño crítico", terms: ["resistencia al dano critico"] },
  "total-damage-received": { label: "daño total recibido", terms: ["dano total recibido"] },
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

const DAMAGE_REDUCTION_CONCEPTS = ["up:final-damage-reduction", "up:damage-taken-reduction", "down:final-damage-received", "down:total-damage-received"];

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
    if (/\b(recover|restore)s?\b[^.]*\bhp\b/.test(t) && !/\bfury\b/.test(t)) c.add("heal");
    if (/\bdispel\w*\b[^.]*\bdebuffs?\b|\bremov\w*\b[^.]*\bdebuffs?\b|\bcleans\w*\b|\bclears?\b[^.]*\bdebuffs?\b/.test(t)) c.add("dispel-debuffs");
    if (/\bdispel\w*\b[^.]*\bbuffs?\b/.test(t) && !/\bdispel\w*\b[^.]*\bdebuffs?\b/.test(t)) c.add("dispel-buffs");
    if (/\b(restores?|gains?|recover\w*)\b[^.]*\bfury\b/.test(t)) c.add("fury-up");
    if (/\b(decreas\w*|reduc\w*|drain\w*)\b[^.]*\bfury\b/.test(t)) c.add("fury-down");
    for (const [key, re] of statusNames) {
      if (occursAffirmatively(t, re)) c.add(/\b(immun\w*|inmun\w*)\b/.test(t) && !occursAffirmatively(t, re) ? `immune:${key}` : `status:${key}`);
      else if (re.test(t) && /\b(immun\w*|inmun\w*)\b/.test(t)) c.add(`immune:${key}`);
    }
    for (const [key, re] of statNames) {
      // The verb must not be negated («Cannot increase control rate»): the same rule as for states.
      const m = occursAffirmatively(t, new RegExp(`\\b(increas\\w*|boost\\w*|raise\\w*|restor\\w*)\\b(?=[^.]*${re.source})`)) || new RegExp(`${re.source}[^.]*(?<!cannot )(?<!not )\\b(increas\\w*)`).test(t);
      const d = occursAffirmatively(t, new RegExp(`\\b(decreas\\w*|reduc\\w*|lower\\w*)\\b(?=[^.]*${re.source})`)) || new RegExp(`${re.source}[^.]*(?<!cannot )(?<!not )\\b(decreas\\w*|reduc\\w*)`).test(t);
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
        valueType: true,
        chancePercent: true,
        durationTurns: true,
        triggerText: true,
        conditionText: true,
        choiceGroup: true,
        targetSelector: true,
        targetCount: true,
        target: { select: { key: true } },
        statistic: { select: { key: true } },
        statusEffect: { select: { key: true } },
        note: true,
        ability: { select: { ninjaId: true } },
        talentOption: { select: { group: { select: { ninjaId: true } } } },
        equipment: { select: { setId: true } },
        equipmentSetBonus: { select: { setId: true, requiredPieces: true } },
        jewelry: { select: { setId: true, group: { select: { key: true } } } },
        jewelrySetBonus: { select: { setId: true, requiredPieces: true, group: { select: { key: true } } } },
      },
    }),
    db.statusEffect.findMany({ select: { key: true, name: true, nameEs: true, aliases: { select: { alias: true } } } }),
    db.statistic.findMany({ select: { key: true, name: true, nameEs: true } }),
  ]);
  const statusDefs = statuses.map((s) => ({
    key: s.key,
    names: [...new Set([n(s.name), ...(s.nameEs ? [n(s.nameEs)] : []), ...s.aliases.map((a) => n(a.alias)), ...(STATUS_ES[s.key]?.terms ?? [])])].filter((x) => x.length >= 3),
  }));
  const statDefs = statistics.filter((s) => s.key !== "fury").map((s) => ({
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
  const completeSet = new Map<string, number>();
  const present: Record<EffectOwner, Set<string>> = { ninja: new Set(), equipment: new Set(), jewelry: new Set() };
  for (const r of rows) {
    // The printed main statistic of a piece (Physical Attack: 4000) is a statistic, not an effect: stat filters use it, effect search does not.
    if (r.note === "PRINTED_MAIN_STAT") continue;
    let owner: EffectOwner = "ninja";
    let ownerId: string | null | undefined = r.ability?.ninjaId ?? r.talentOption?.group.ninjaId;
    let pieces: number | null = null;
    let group: string | null = null;
    if (!ownerId && (r.equipmentSetBonus || r.equipment)) {
      owner = "equipment";
      ownerId = r.equipmentSetBonus?.setId ?? r.equipment?.setId;
      pieces = r.equipmentSetBonus?.requiredPieces ?? null;
    } else if (!ownerId && (r.jewelrySetBonus || r.jewelry)) {
      owner = "jewelry";
      ownerId = r.jewelrySetBonus?.setId ?? r.jewelry?.setId;
      pieces = r.jewelrySetBonus?.requiredPieces ?? null;
      group = r.jewelrySetBonus?.group?.key ?? r.jewelry?.group?.key ?? null;
    }
    if (!ownerId) continue;
    const text = n([r.sourceText, r.descriptionEs, r.description].filter(Boolean).join(" . "));
    const textOnly = r.structuredStatus === "TEXT_ONLY" || r.kind === "TEXT";
    const concepts = classify(
      { kind: r.kind, value: r.value === null ? null : Number(r.value.toString()), description: r.description, statKey: r.statistic?.key ?? null, statusKey: r.statusEffect?.key ?? null, text, textOnly },
      statusRe,
      statRe,
    );
    const side = (r.target?.key as Side | undefined) && ["self", "ally", "enemy"].includes(r.target!.key) ? (r.target!.key as Side) : sideOfText(text);
    for (const k of concepts) present[owner].add(k);
    const value = r.value === null || textOnly ? null : Number(r.value.toString());
    const conditional = Boolean(r.chancePercent !== null || r.durationTurns !== null || r.triggerText || r.conditionText || r.choiceGroup !== null || r.targetSelector || r.targetCount !== null);
    if (pieces !== null && owner !== "ninja") completeSet.set(`${owner}:${ownerId}`, Math.max(completeSet.get(`${owner}:${ownerId}`) ?? 0, pieces));
    effects.push({
      owner,
      ownerId,
      pieces,
      group,
      concepts,
      side,
      kind: r.kind,
      text,
      raw: r.sourceText ?? r.descriptionEs ?? r.description ?? "",
      value,
      unit: r.valueType ?? null,
      statKey: r.statistic?.key ?? null,
      statusKey: r.statusEffect?.key ?? null,
      structured: !textOnly,
      additiveKey: additiveKey({ kind: r.kind, structured: !textOnly, value, unit: r.valueType ?? null, statKey: r.statistic?.key ?? null, statusKey: r.statusEffect?.key ?? null, side, conditional }),
    });
  }
  return { effects, statuses: statusDefs, statistics: statDefs, present, completeSet };
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
  /** The wording the user typed for this effect, for naming the effect that controls sorting. */
  source?: string;
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
  const flat = (x: string) => clean(x.replace(/[^a-z0-9\-\s']/g, " "));
  const score = (names: string[]) => Math.max(0, ...names.map((raw) => clean(flat(raw).replace(FILLER, " "))).map((x) => (x === r ? 1000 : x.length >= 4 && wordIn(r, x) ? x.length : r.length >= 4 && x.startsWith(r) ? 10 : 0)));
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

/** Two typed terms that resolve to the same concept, side and wording are one selected effect. */
const termKey = (rs: Resolved) => `${[...rs.concepts].sort().join(",")}|${rs.text ?? ""}|${rs.side ?? ""}|${rs.immunity ? "i" : ""}`;

/** Resolves the typed terms and drops duplicates, so a duplicated selection never changes an ALL result. */
function distinctTerms(index: EffectIndex, terms: string[]): Resolved[] {
  const seen = new Set<string>();
  const out: Resolved[] = [];
  for (const t of terms.map((x) => x.trim()).filter((x) => n(x).length >= 2)) {
    const rs = resolve(index, t);
    const key = termKey(rs);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...rs, source: t });
  }
  return out;
}

export interface EffectEvidence {
  pieces: number | null;
  group: string | null;
  /** The source wording of one matching effect. */
  text: string;
}

/**
 * ── Sorting by the value of an effect ──
 * Only the effect the user chose to sort by is looked at. Each matching stored effect is put in a MEASURE CLASS made of what it
 * does and its unit, so an increase of Control Rate (+40%) is never compared with a reduction of the enemy's Control Rate (-20%),
 * with a flat value, or with a different state's immunity.
 *
 * Set bonuses ACCUMULATE (confirmed by the client). With N pieces equipped the value of an owner is the TOTAL of the comparable
 * additive bonuses of every tier up to N (Deatbone, Damage Rate: +30% at 2 pieces and +40% at 6 pieces make +70% with 6 pieces; the
 * 4-piece tier does not need to have it). Comparable means the same statistic, unit, target and direction, in the same jewelry slot;
 * conditional, timed, chance-based and wording-only effects are never added. Without a chosen piece count the complete set counts.
 * The best total of the owner (largest magnitude) decides the position. Ties are broken by the printed value at the highest piece
 * count, then the next lower one, and finally by the caller (name, then identity). Effects that exist only as wording, effects
 * with no number (heal, a state applied) and owners that do not contain the chosen effect (possible with Match Any) come after
 * every number, and are labelled as such. Nothing is ever guessed.
 */
export interface EffectValueUse {
  pieces: number | null;
  group: string | null;
  /** The stored value with its sign as printed in the application (reductions are negative). */
  value: number;
  unit: string;
  text: string;
}
/** The total available with a piece count: the printed bonuses that were added and their sum. */
export interface EffectTotal {
  /** Additive identity of the effect (null for a single value that is never added). */
  key: string | null;
  value: number;
  unit: string;
  /** The piece count the total is for (selected, or the complete set); null for ninjas. */
  pieces: number | null;
  /** Jewelry slot whose 2-piece bonus is part of the total. */
  slot: string | null;
  /** The printed bonuses added, lowest piece count first. */
  parts: EffectValueUse[];
}
export type EffectRankStatus = "ranked" | "other-measure" | "text-only" | "no-value" | "no-match";
export interface EffectRank {
  status: EffectRankStatus;
  /** Measure class, e.g. "up|PERCENT" (increase of the statistic, in percent). Null when nothing numeric was found. */
  measure: string | null;
  /** The total that decided the position, with the printed bonuses it is made of. */
  total: EffectTotal | null;
  /** Every printed value of the same measure in scope, highest piece count first: the individual bonuses. */
  uses: EffectValueUse[];
  /** Position of the measure among the measures present: 0 is the primary one. Used by the comparison. */
  group: number;
  /** Magnitude of the total; null when there is none. */
  magnitude: number | null;
  /** Largest printed magnitude per tier of the best total, from the highest piece count down. Missing tiers are -Infinity. */
  tierValues: number[];
}

const DIRECTION_ORDER = ["up", "reduction", "fury-up", "immune", "down", "fury-down"];
const UNIT_ORDER = ["PERCENT", "FLAT", "MULTIPLIER"];

/** Describes a measure class for the interface: its direction word and its unit. */
export function describeMeasure(measure: string): { direction: string; unit: string } {
  const [direction = "", unit = ""] = measure.split("|");
  return { direction: direction.startsWith("immune:") ? "immune" : direction, unit };
}

function measureOf(e: IndexedEffect, rs: Resolved): { measure: string; magnitude: number } | null {
  if (!e.structured || e.value === null || !e.unit) return null;
  const concept = rs.concepts.find((c) => e.concepts.has(c));
  if (!concept) return null;
  const magnitude = Math.abs(e.value);
  if (concept.startsWith("up:") || concept.startsWith("down:")) {
    const direction = DAMAGE_REDUCTION_CONCEPTS.includes(concept) ? "reduction" : concept.startsWith("up:") ? "up" : "down";
    return { measure: `${direction}|${e.unit}`, magnitude };
  }
  if (concept === "fury-up" || concept === "fury-down") return { measure: `${concept}|${e.unit}`, magnitude };
  if (concept.startsWith("immune:") && e.statusKey) return { measure: `immune:${e.statusKey}|${e.unit}`, magnitude: e.value };
  return null;
}

const directionRank = (m: string) => {
  const d = describeMeasure(m).direction;
  const i = DIRECTION_ORDER.indexOf(d);
  return i < 0 ? DIRECTION_ORDER.length : i;
};
const unitRank = (m: string) => {
  const i = UNIT_ORDER.indexOf(describeMeasure(m).unit);
  return i < 0 ? UNIT_ORDER.length : i;
};

interface OwnerMatches {
  uses: { measure: string; magnitude: number; use: EffectValueUse; effect: IndexedEffect }[];
  wording: boolean;
  anyMatch: boolean;
}

const useOf = (e: IndexedEffect): EffectValueUse => ({ pieces: e.pieces, group: e.group, value: e.value!, unit: e.unit!, text: e.raw });

/**
 * The best total of one owner for one measure: the comparable additive set bonuses are added tier by tier up to `atPieces`; every
 * other line (a ninja effect, a piece effect, a conditional or wording line) counts as a single value, never added to anything.
 */
function bestTotal(lines: OwnerMatches["uses"], atPieces: number | null, slot: string | null | undefined): { total: EffectTotal; magnitude: number } {
  const candidates: EffectTotal[] = [];
  const additive: BonusLine[] = [];
  for (const l of lines) {
    if (atPieces !== null && l.effect.pieces !== null && l.effect.additiveKey) additive.push({ pieces: l.effect.pieces, group: l.effect.group, key: l.effect.additiveKey, value: l.effect.value, unit: l.effect.unit, label: l.effect.statKey ?? l.effect.statusKey ?? "", text: l.effect.raw });
    else candidates.push({ key: null, value: l.effect.value!, unit: l.effect.unit!, pieces: l.effect.pieces, slot: l.effect.group, parts: [l.use] });
  }
  // Additive totals decide the position when the owner has any; a conditional or otherwise non-additive number is only a single printed
  // value and never outranks (or is added to) a total. It stays visible among the individual bonuses.
  const totals: EffectTotal[] = [];
  if (atPieces !== null && additive.length) {
    for (const t of cumulate(additive, atPieces, slot)) totals.push({ key: t.key, value: t.value, unit: t.unit, pieces: atPieces, slot: t.slot, parts: t.parts.map((p) => ({ pieces: p.pieces, group: p.group, value: p.value, unit: p.unit, text: p.text })) });
  }
  if (totals.length) candidates.splice(0, candidates.length, ...totals);
  const magnitudeOf = (t: EffectTotal) => Math.abs(t.value);
  const topPiece = (t: EffectTotal) => Math.max(0, ...t.parts.map((p) => p.pieces ?? 0));
  const best = candidates.reduce((a, b) => (magnitudeOf(b) > magnitudeOf(a) || (magnitudeOf(b) === magnitudeOf(a) && topPiece(b) > topPiece(a)) ? b : a));
  return { total: best, magnitude: magnitudeOf(best) };
}

/** Builds the rank of every owner for the chosen effect. `atPieces` gives the piece count an owner's total is for. */
function buildRanks(matches: Map<string, OwnerMatches>, atPieces: (ownerKey: string) => number | null, slot: string | null | undefined): Map<string, EffectRank> {
  // Which measures exist, and how many owners have each.
  const owners = new Map<string, Set<string>>();
  for (const [key, m] of matches) for (const u of m.uses) (owners.get(u.measure) ?? owners.set(u.measure, new Set()).get(u.measure)!).add(key);
  const measures = [...owners.keys()];
  // Primary: the highest-priority direction; inside it the unit most owners use (percent first on a tie). The others follow in a fixed order.
  const byDirection = [...measures].sort((a, b) => directionRank(a) - directionRank(b));
  const topDirection = byDirection.length ? describeMeasure(byDirection[0]!).direction : null;
  const topPool = measures.filter((m) => describeMeasure(m).direction === topDirection);
  topPool.sort((a, b) => owners.get(b)!.size - owners.get(a)!.size || unitRank(a) - unitRank(b) || a.localeCompare(b));
  const rest = measures.filter((m) => !topPool.includes(m)).sort((a, b) => directionRank(a) - directionRank(b) || a.localeCompare(b) || unitRank(a) - unitRank(b));
  const order = [...(topPool.length ? [topPool[0]!] : []), ...topPool.slice(1), ...rest];
  const groupOf = new Map(order.map((m, i) => [m, i]));

  const tiers = [...new Set([...matches.values()].flatMap((m) => m.uses.map((u) => u.use.pieces ?? 0)))].sort((a, b) => b - a);
  const out = new Map<string, EffectRank>();
  for (const [key, m] of matches) {
    if (!m.anyMatch) {
      out.set(key, { status: "no-match", measure: null, total: null, uses: [], group: order.length + 2, magnitude: null, tierValues: [] });
      continue;
    }
    if (m.uses.length === 0) {
      out.set(key, { status: m.wording ? "text-only" : "no-value", measure: null, total: null, uses: [], group: order.length + 1, magnitude: null, tierValues: [] });
      continue;
    }
    // The owner's own best measure: the one that comes first in the order.
    const own = [...new Set(m.uses.map((u) => u.measure))].sort((a, b) => groupOf.get(a)! - groupOf.get(b)!)[0]!;
    const ownLines = m.uses.filter((u) => u.measure === own);
    const uses = ownLines.map((u) => u.use).sort((x, y) => (y.pieces ?? 0) - (x.pieces ?? 0) || Math.abs(y.value) - Math.abs(x.value));
    const { total, magnitude } = bestTotal(ownLines, atPieces(key), slot);
    const tierValues = tiers.map((t) => Math.max(-Infinity, ...total.parts.filter((u) => (u.pieces ?? 0) === t).map((u) => Math.abs(u.value))));
    const group = groupOf.get(own)!;
    out.set(key, { status: group === 0 ? "ranked" : "other-measure", measure: own, total, uses, group, magnitude, tierValues });
  }
  return out;
}

/**
 * Orders two ranks. desc: the larger total first; asc: the smaller first. Within one measure: the best total, then the printed value at
 * the highest piece count, then the next. Measures keep their fixed order and wording-only owners stay last in both directions.
 */
export function compareRanks(a: EffectRank, b: EffectRank, direction: "asc" | "desc"): number {
  if (a.group !== b.group) return a.group - b.group;
  if (a.magnitude === null || b.magnitude === null) return 0;
  const sign = direction === "desc" ? -1 : 1;
  if (a.magnitude !== b.magnitude) return (a.magnitude - b.magnitude) * sign;
  for (let i = 0; i < Math.min(a.tierValues.length, b.tierValues.length); i++) {
    const x = a.tierValues[i]!;
    const y = b.tierValues[i]!;
    if (x === y) continue;
    return (x === -Infinity ? -1 : y === -Infinity ? 1 : x - y) * sign;
  }
  return 0;
}

/**
 * Restricts which stored effects are looked at, BEFORE any matching. `pieces`: the piece count the user equips. Bonuses of that
 * threshold and of every lower one count (they accumulate); a bonus printed only at a HIGHER threshold never qualifies a result, so a
 * 2-piece search never shows an effect that exists only at 4 or 6 pieces. `slot`: for jewelry, the 2-piece bonus of that category only;
 * the set-wide bonus (8 pieces) has no category and is not narrowed by it. Ninjas are not scoped.
 */
export interface EffectScope {
  pieces?: number;
  slot?: string | null;
}

function inScope(e: IndexedEffect, scope: EffectScope | undefined): boolean {
  if (!scope || e.owner === "ninja") return true;
  if (scope.pieces !== undefined && (e.pieces === null || e.pieces > scope.pieces)) return false;
  if (scope.slot && e.owner === "jewelry" && e.group !== null && e.group !== scope.slot) return false;
  return true;
}

/**
 * The set-wide bonus of one jewelry version, shown under a result whose total is for fewer pieces than the complete set. The total
 * with the complete set (the slot's 2-piece bonus plus the 8-piece bonus) is given when the SAME additive effect is printed there.
 */
export interface FullSetInfo {
  /** Every effect printed at the full-set tier of that version, as printed. */
  effects: string[];
  /**
   * stronger: the same additive effect is printed at the full-set tier, so the total with the complete set is larger.
   * unrelated: the full-set bonus has no comparable value of the selected effect (it is shown as printed, nothing is added).
   * included: the result's own total already counts the complete set.
   */
  comparison: { status: "stronger" | "unrelated" | "included"; matching: EffectTotal | null; fullSet: EffectTotal | null };
}

export interface EffectAnalysis {
  perOwner: Record<EffectOwner, { ids: string[]; evidence: Map<string, EffectEvidence[]> }>;
  distinct: number;
  /** The effect that controls sorting, as typed. */
  sortTerm: string | null;
  /** Rank of every matching owner for the sorting effect, by `${owner}:${id}`. */
  ranks: Map<string, EffectRank>;
  /** The set-wide bonus of matching jewelry versions (key `jewelry:${id}`), when asked for. */
  fullSet: Map<string, FullSetInfo>;
}

/**
 * Matches the typed terms (ANY or ALL) for one or several kinds of owner and ranks the matches by the value of ONE chosen effect:
 * `sortTerm` (as typed), defaulting to the first selected effect. Null when no term is usable.
 */
export async function analyseEffects(
  db: Db,
  owners: EffectOwner[],
  terms: string[],
  mode: EffectMode = "any",
  sortTerm?: string | null,
  options: { scope?: EffectScope; fullSetTier?: number } = {},
): Promise<EffectAnalysis | null> {
  const index = await indexOf(db);
  const resolved = distinctTerms(index, terms);
  if (resolved.length === 0) return null;
  // The sorting effect: the one typed as `sortTerm` (the same effect typed another way counts), else the first.
  let sortIndex = 0;
  if (sortTerm && n(sortTerm).length >= 2) {
    const wanted = termKey(resolve(index, sortTerm));
    const hit = resolved.findIndex((r) => termKey(r) === wanted);
    if (hit >= 0) sortIndex = hit;
  }
  const sorting = resolved[sortIndex]!;
  const perTerm = new Map<string, Map<string, EffectEvidence[]>[]>();
  const sortMatches = new Map<string, OwnerMatches>();
  for (const owner of owners) perTerm.set(owner, resolved.map(() => new Map()));
  for (const e of index.effects) {
    if (!owners.includes(e.owner) || !inScope(e, options.scope)) continue;
    resolved.forEach((rs, i) => {
      if (!effectMatches(e, rs)) return;
      const bucket = perTerm.get(e.owner)![i]!;
      const list = bucket.get(e.ownerId) ?? [];
      if (list.length < 6) list.push({ pieces: e.pieces, group: e.group, text: e.raw });
      bucket.set(e.ownerId, list);
      if (i !== sortIndex) return;
      const key = `${e.owner}:${e.ownerId}`;
      const m = sortMatches.get(key) ?? { uses: [], wording: false, anyMatch: true };
      const meas = measureOf(e, sorting);
      if (meas && e.value !== null && e.unit) m.uses.push({ measure: meas.measure, magnitude: meas.magnitude, use: useOf(e), effect: e });
      else if (!e.structured) m.wording = true;
      sortMatches.set(key, m);
    });
  }
  const perOwner = {} as EffectAnalysis["perOwner"];
  for (const kind of ["ninja", "equipment", "jewelry"] as EffectOwner[]) perOwner[kind] = { ids: [], evidence: new Map() };
  const all = new Map<string, OwnerMatches>();
  for (const owner of owners) {
    const buckets = perTerm.get(owner)!;
    const candidates = new Set(buckets.flatMap((m) => [...m.keys()]));
    for (const id of candidates) {
      const hits = buckets.map((m) => m.get(id));
      if (!(mode === "all" ? hits.every(Boolean) : hits.some(Boolean))) continue;
      perOwner[owner].ids.push(id);
      perOwner[owner].evidence.set(id, hits.flatMap((h) => h ?? []));
      all.set(`${owner}:${id}`, sortMatches.get(`${owner}:${id}`) ?? { uses: [], wording: false, anyMatch: false });
    }
  }
  // The total is for the selected piece count; without one, for the complete set of that version (6 or 8 pieces as printed).
  const selected = options.scope?.pieces;
  const atPieces = (ownerKey: string): number | null => (ownerKey.startsWith("ninja:") ? null : (selected ?? index.completeSet.get(ownerKey) ?? null));
  const ranks = buildRanks(all, atPieces, options.scope?.slot);
  const fullSet = new Map<string, FullSetInfo>();
  const tier = options.fullSetTier;
  if (tier !== undefined && owners.includes("jewelry")) {
    const setWide = new Map<string, IndexedEffect[]>();
    const lines = new Map<string, IndexedEffect[]>();
    for (const e of index.effects) {
      if (e.owner !== "jewelry") continue;
      if (e.pieces === tier && e.group === null) (setWide.get(e.ownerId) ?? setWide.set(e.ownerId, []).get(e.ownerId)!).push(e);
      if (e.additiveKey) (lines.get(e.ownerId) ?? lines.set(e.ownerId, []).get(e.ownerId)!).push(e);
    }
    for (const id of perOwner.jewelry.ids) {
      const list = setWide.get(id);
      // Only under a result that matched through a bonus of fewer pieces (the 2-piece bonus of a category).
      if (!list?.length || !(perOwner.jewelry.evidence.get(id) ?? []).some((x) => x.pieces !== null && x.pieces !== tier)) continue;
      const rank = ranks.get(`jewelry:${id}`);
      let comparison: FullSetInfo["comparison"] = { status: "unrelated", matching: null, fullSet: null };
      if (rank?.total?.key) {
        const key = rank.total.key;
        const bonus: BonusLine[] = (lines.get(id) ?? []).filter((e) => e.additiveKey === key && e.pieces !== null).map((e) => ({ pieces: e.pieces, group: e.group, key, value: e.value, unit: e.unit, label: e.statKey ?? "", text: e.raw }));
        const full = cumulate(bonus, tier, options.scope?.slot ?? rank.total.slot).filter((t) => t.slot === rank.total!.slot || rank.total!.slot === null);
        const top = full.length ? full.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a)) : null;
        if (top && top.parts.some((p) => p.pieces === tier)) {
          const fullTotal: EffectTotal = { key, value: top.value, unit: top.unit, pieces: tier, slot: top.slot, parts: top.parts.map((p) => ({ pieces: p.pieces, group: p.group, value: p.value, unit: p.unit, text: p.text })) };
          const already = (rank.total.pieces ?? 0) >= tier;
          comparison = { status: already ? "included" : Math.abs(fullTotal.value) > Math.abs(rank.total.value) ? "stronger" : "unrelated", matching: rank.total, fullSet: fullTotal };
        }
      }
      fullSet.set(`jewelry:${id}`, { effects: list.map((e) => e.raw), comparison });
    }
  }
  return { perOwner, distinct: resolved.length, sortTerm: sorting.source ?? null, ranks, fullSet };
}

/**
 * Ids of the owners (ninjas, equipment set versions or jewelry set versions) whose stored effects match the typed terms.
 * ANY: at least one term is found. ALL: every distinct term is found, each possibly in a different effect row, tier or category.
 * Null when no term is usable (no filter). With `evidence`, the matching effect wording per owner is returned as well.
 */
export async function idsWithEffects(
  db: Db,
  owner: EffectOwner,
  terms: string[],
  mode: EffectMode = "any",
): Promise<{ ids: string[]; evidence: Map<string, EffectEvidence[]>; distinct: number } | null> {
  const a = await analyseEffects(db, [owner], terms, mode);
  return a ? { ids: a.perOwner[owner].ids, evidence: a.perOwner[owner].evidence, distinct: a.distinct } : null;
}

/** Ids of the ninjas with a stored effect matching ANY of the terms (ALL with mode "all"); null when no term is usable. */
export async function ninjaIdsWithEffects(db: Db, terms: string[], mode: EffectMode = "any"): Promise<string[] | null> {
  return (await idsWithEffects(db, "ninja", terms, mode))?.ids ?? null;
}

/** How a typed term was understood, for tests and the interface. */
export async function explainEffectTerm(db: Db, term: string): Promise<{ concepts: string[]; text: string | null; side: Side | null }> {
  const rs = resolve(await indexOf(db), term);
  return { concepts: rs.concepts, text: rs.text, side: rs.side };
}

/** Spanish suggestions, only for effects that exist in the data and only wording that resolves back to the same concept. */
export async function effectSuggestions(db: Db, owner: EffectOwner = "ninja"): Promise<EffectSuggestion[]> {
  const index = await indexOf(db);
  const out = new Map<string, string>();
  const has = (c: string) => index.present[owner].has(c);
  const add = (label: string, concept: string) => {
    if (has(concept) && resolve(index, label).concepts.includes(concept)) out.set(label, concept);
  };
  add("Curación", "heal");
  add("Restaurar furia", "fury-up");
  add("Reducir furia", "fury-down");
  add("Eliminar debuffs", "dispel-debuffs");
  add("Disipar buffs enemigos", "dispel-buffs");
  const reduction = DAMAGE_REDUCTION_CONCEPTS.find(has);
  if (reduction) add("Reducción de daño", reduction);
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
