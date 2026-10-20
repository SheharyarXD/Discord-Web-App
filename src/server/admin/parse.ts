import { ValidationError } from "@/game/db";
import type { EffectInput } from "@/game/schemas";

/** Small helpers that read form fields. An empty field is «not given», never zero. */
export const text = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};
export const textOrNull = (fd: FormData, key: string): string | null => text(fd, key) || null;
export const lines = (fd: FormData, key: string): string[] =>
  text(fd, key)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
export const flag = (fd: FormData, key: string): boolean => fd.get(key) === "on" || fd.get(key) === "true";

/** A decimal typed with a point or a comma. */
export function decimalOrNull(fd: FormData, key: string, label = key): string | null {
  const raw = text(fd, key).replace(",", ".");
  if (!raw) return null;
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new ValidationError(`${label}: «${raw}» no es un número`);
  return raw;
}

export function intOrNull(fd: FormData, key: string, label = key): number | null {
  const raw = text(fd, key);
  if (!raw) return null;
  if (!/^-?\d+$/.test(raw)) throw new ValidationError(`${label}: «${raw}» no es un número entero`);
  return Number(raw);
}

export const STAT_ROWS = 6;
export const TEXT_ROWS = 2;

/**
 * Reads the rows written by <StatRows prefix=…>: «statistic, value, unit» rows and free-text rows.
 * A row with a statistic but no value is rejected rather than stored as zero.
 */
export function statEffects(fd: FormData, prefix: string): EffectInput[] {
  const out: EffectInput[] = [];
  for (let i = 0; i < STAT_ROWS; i++) {
    const key = text(fd, `${prefix}_stat_${i}`);
    if (!key) continue;
    const value = decimalOrNull(fd, `${prefix}_value_${i}`, `${prefix}, fila ${i + 1}`);
    if (value === null) throw new ValidationError(`${prefix}, fila ${i + 1}: falta el valor`);
    out.push({ statisticKey: key, value, valueType: text(fd, `${prefix}_unit_${i}`) === "FLAT" ? "FLAT" : "PERCENT" });
  }
  for (let i = 0; i < TEXT_ROWS; i++) {
    const description = text(fd, `${prefix}_text_${i}`);
    if (description) out.push({ description, structuredStatus: "TEXT_ONLY", kind: "TEXT" });
  }
  return out;
}
