import { describe, expect, it } from "vitest";
import { CLIENT_AWAKENING_RULE_TEXT, resolveAwakenings, withClientReplacement } from "../src/domain/awakenings";

describe("the client's awakening rule: each new awakening replaces the previous one", () => {
  const stage = (n: number | null, extra: Record<string, unknown> = {}) => ({ stage: n, stackingRule: "UNKNOWN" as const, supersedesStage: null as number | null, ruleSourceText: null as string | null, ...extra });

  it("three stages: 2 replaces 1, 3 replaces 2, so only the latest unlocked stage is in force", () => {
    const list = withClientReplacement([stage(1), stage(2), stage(3)]);
    expect(list.map((w) => [w.stackingRule, w.supersedesStage])).toEqual([["UNKNOWN", null], ["REPLACES_PRIOR", 1], ["REPLACES_PRIOR", 2]]);
    expect(list.every((w, i) => (i === 0 ? w.ruleSourceText === null : w.ruleSourceText === CLIENT_AWAKENING_RULE_TEXT))).toBe(true);
    const refs = list.map((w, i) => ({ id: `s${i + 1}`, stage: w.stage, rule: w.stackingRule, supersedesId: w.supersedesStage ? `s${w.supersedesStage}` : null }));
    expect(resolveAwakenings(refs, 3).superseded.map((x) => [x.id, x.byId])).toEqual([["s1", "s2"], ["s2", "s3"]]);
    expect(resolveAwakenings(refs, 3).unknown).toEqual(["s3"].filter(() => false));
    expect(resolveAwakenings(refs, 2).superseded.map((x) => x.id)).toEqual(["s1"]);
    expect(resolveAwakenings(refs, 1).superseded).toEqual([]);
  });

  it("an explicit rule is never overwritten (First Hokage cancels, Jugo upgrades the base, Natsu replaces)", () => {
    const list = withClientReplacement([stage(1), stage(2), stage(3, { stackingRule: "CANCELS_PRIOR", supersedesStage: 2, ruleSourceText: "Cancels Talent Awakening 2." })]);
    expect(list.map((w) => w.stackingRule)).toEqual(["UNKNOWN", "REPLACES_PRIOR", "CANCELS_PRIOR"]);
    expect(list[2]!.ruleSourceText).toBe("Cancels Talent Awakening 2.");
    const upgrade = withClientReplacement([stage(1), stage(2), stage(3, { stackingRule: "UPGRADES_BASE", ruleSourceText: "Increases self speed from 83% → 86%." })]);
    expect(upgrade[2]!.stackingRule).toBe("UPGRADES_BASE");
  });

  it("a single stage, an unnumbered stage, and a gap in numbering are handled without guessing", () => {
    expect(withClientReplacement([stage(1)])[0]!.stackingRule).toBe("UNKNOWN");
    expect(withClientReplacement([stage(null), stage(null)]).map((w) => w.stackingRule)).toEqual(["UNKNOWN", "UNKNOWN"]);
    expect(withClientReplacement([stage(1), stage(3)]).map((w) => [w.stackingRule, w.supersedesStage])).toEqual([["UNKNOWN", null], ["REPLACES_PRIOR", 1]]);
  });

  it("talent awakenings and skill awakenings are separate lists, so they never replace each other", () => {
    const talent = withClientReplacement([stage(1), stage(2)]);
    const skill = withClientReplacement([stage(1)]);
    expect(talent[1]!.stackingRule).toBe("REPLACES_PRIOR");
    expect(skill[0]!.stackingRule).toBe("UNKNOWN");
  });
});
