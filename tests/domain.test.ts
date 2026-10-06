import { describe, expect, it } from "vitest";
import { formatEffectValue } from "../src/domain/effects";
import { isExclusiveChoice, validateTalentSelection, type TalentGroupView } from "../src/domain/talents";
import { can } from "../src/server/auth/permissions";
import { createTranslator, DEFAULT_LOCALE } from "../src/i18n";
import { slugify } from "../src/domain/slug";

const group = (n: number, mode: TalentGroupView["selectionMode"] = "ONE_OF"): TalentGroupView => ({
  id: "g", name: null, selectionMode: mode, minSelections: 1, maxSelections: 1,
  options: Array.from({ length: n }, (_, i) => ({ id: `o${i}`, name: `o${i}`, description: null, isDefault: i === 0 })),
});

describe("formatEffectValue", () => {
  it("formats percent, flat and multiplier", () => {
    expect(formatEffectValue(30, "PERCENT")).toBe("+30%");
    expect(formatEffectValue(120, "FLAT")).toBe("+120");
    expect(formatEffectValue(-5, "PERCENT")).toBe("-5%");
    expect(formatEffectValue(1.5, "MULTIPLIER")).toBe("×1,5");
    expect(formatEffectValue(null, "FLAT")).toBe("");
  });
});

describe("talent groups", () => {
  it("ONE_OF with several options is an exclusive choice", () => {
    expect(isExclusiveChoice(group(2))).toBe(true);
    expect(isExclusiveChoice(group(3))).toBe(true);
    expect(isExclusiveChoice(group(1))).toBe(false);
    expect(isExclusiveChoice(group(2, "ALL"))).toBe(false);
  });
  it("rejects selecting both alternatives", () => {
    expect(validateTalentSelection(group(2), ["o0", "o1"])).toBe("tooMany");
    expect(validateTalentSelection(group(2), ["o1"])).toBeNull();
    expect(validateTalentSelection(group(2), [])).toBe("tooFew");
    expect(validateTalentSelection(group(2), ["zzz"])).toBe("unknownOption");
  });
});

describe("authorization policy", () => {
  it("regular users can read but never write or access admin", () => {
    const user = { role: "USER" as const };
    expect(can(user, "content:read")).toBe(true);
    expect(can(user, "content:write")).toBe(false);
    expect(can(user, "admin:access")).toBe(false);
    expect(can(user, "users:manage")).toBe(false);
  });
  it("admins can do everything; anonymous nothing", () => {
    const admin = { role: "ADMIN" as const };
    for (const a of ["content:read", "content:write", "admin:access", "users:manage"] as const) {
      expect(can(admin, a)).toBe(true);
      expect(can(null, a)).toBe(false);
    }
  });
});

describe("i18n", () => {
  it("defaults to Spanish and interpolates", () => {
    expect(DEFAULT_LOCALE).toBe("es");
    const t = createTranslator();
    expect(t("talents.chooseOne")).toBe("Elige solo uno");
    expect(t("sets.pieces", { count: 4 })).toBe("4 piezas");
  });
});

describe("slugify", () => {
  it("strips accents and symbols", () => {
    expect(slugify("Árbol de Fuego!")).toBe("arbol-de-fuego");
  });
});
