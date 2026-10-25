import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STACKING_RULES } from "../src/domain/constants";
import { es } from "../src/i18n/es";

/** Milestone 4: the Spanish interface is complete for the initial version. */
const flat = (o: unknown, prefix = ""): [string, string][] =>
  Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === "string" ? [[`${prefix}${k}`, v] as [string, string]] : flat(v, `${prefix}${k}.`)));
const entries = flat(es);
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
const node = (key: string) => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], es);

describe("Spanish interface", () => {
  it("has no empty text (apart from the one deliberately empty rule label) and no English function words left over", () => {
    const empty = entries.filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(empty).toEqual(["awakening.rule.NOT_APPLICABLE"]);
    const english = entries.filter(([, v]) => /(^|\s)(the|and|with|please|click|select|delete|cancel|save)(\s|$)/i.test(v) && !/^[A-Z]{2,}/.test(v)).map(([k, v]) => `${k}: ${v}`);
    expect(english).toEqual([]);
  });

  it("every dynamic translation key points at an existing group, and every awakening rule has its Spanish text", () => {
    const used = new Set<string>();
    for (const file of walk(path.resolve(__dirname, "../src"))) {
      for (const m of readFileSync(file, "utf8").matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(3);
    for (const prefix of used) expect(node(prefix), `group «${prefix}» is missing`).toBeTypeOf("object");
    for (const rule of Object.values(STACKING_RULES)) expect(node(`awakening.rule.${rule}`), rule).toBeTypeOf("string");
  });

  it("the client's replacement rule has a Spanish explanation", () => {
    expect(es.awakening.clientRule).toMatch(/sustituye al anterior/);
    expect(es.awakening.rule.REPLACES_PRIOR).toMatch(/No se suman/);
  });
});
