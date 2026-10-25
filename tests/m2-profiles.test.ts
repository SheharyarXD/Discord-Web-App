import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { abilityNoteCodes, effectNoteCodes } from "../src/domain/ability-text";
import { slugify } from "../src/domain/slug";
import { planProfiles, readProfileData, summarizePlan, type PlannedNinja, type ProfileData } from "../src/game/profile-loader";
import { readReferenceFile, type ReleaseFile } from "../src/game/reference-loader";
import type { EffectInput } from "../src/game/schemas";
import { PROFILE_HANDOFF_DIR, M3_HANDOFF_DIR, REFERENCE_DIR, handoffFile } from "./helpers";

/**
 * The staged ninja profiles and the plan built from them. No database here: what the plan
 * holds is exactly what the loader writes (tests/m2-reference.test.ts covers the written rows).
 */
const data = readProfileData(REFERENCE_DIR)!;
const plan = planProfiles(data);
const releaseNames = new Set(readReferenceFile<ReleaseFile>(REFERENCE_DIR, "release-order.json").entries.map(([, , name]) => name));
const planned = (name: string): PlannedNinja => {
  const ninja = plan.ninjas.find((n) => n.name === name);
  if (!ninja) throw new Error(`no planned ninja "${name}"`);
  return ninja;
};
const talentOf = (name: string) => planned(name).input.talentGroups![0]!.options[0]!;
/** Every block of effects a ninja's plan holds, awakenings included. */
function blocks(n: PlannedNinja): { typeKey?: string; name: string; description?: string | null; descriptionEs?: string | null; note?: string | null; translationStatus?: string; effects: EffectInput[] }[] {
  const out = [];
  for (const a of n.input.abilities ?? []) out.push(a, ...(a.awakenings ?? []));
  for (const g of n.input.talentGroups ?? []) for (const o of g.options) out.push(o, ...(o.awakenings ?? []));
  return out.map((b) => ({ ...b, effects: b.effects ?? [] }));
}
const allBlocks = plan.ninjas.flatMap((n) => blocks(n).map((b) => ({ ninja: n.name, ...b })));
const allEffects = allBlocks.flatMap((b) => b.effects);

/** The supplied archives are not part of the repository; these checks run wherever they are present. */
const withHandoff = existsSync(PROFILE_HANDOFF_DIR) && existsSync(M3_HANDOFF_DIR) ? it : it.skip;
const handoffText = (() => {
  const cache = new Map<string, string>();
  return (asset: string) => {
    if (!cache.has(asset)) cache.set(asset, readFileSync(handoffFile(asset), "utf8").replace(/\r\n/g, "\n"));
    return cache.get(asset)!;
  };
})();

describe("staging files against the supplied material", () => {
  withHandoff("every file they cite exists", () => {
    for (const a of plan.assets) expect(existsSync(handoffFile(a.path)), a.path).toBe(true);
    expect(plan.assets.filter((a) => a.category === "SCREENSHOT")).toHaveLength(176); // 175 distinct cards + the duplicated file
  });

  withHandoff("every English and Spanish line is in its file word for word", () => {
    let lines = 0;
    for (const file of data.files) {
      for (const entry of file.entries) {
        for (const ability of entry.abilities ?? []) {
          for (const text of [ability.en, ability.es]) {
            if (!text) continue;
            const source = handoffText(text.asset);
            for (const line of text.lines) {
              expect(source.includes(line.text), `${entry.sourceId}: ${line.text}`).toBe(true);
              lines++;
            }
          }
        }
      }
    }
    expect(lines).toBe(2372 + 2231);
  });

  withHandoff("an awakening rule quotes wording that is really in the source", () => {
    expect(data.rules.rules).toHaveLength(7);
    for (const rule of data.rules.rules) expect(handoffText(rule.asset).includes(rule.sourceText), rule.sourceText).toBe(true);
  });

  withHandoff("the file supplied as Might Gai's card is a byte-for-byte copy of another card", () => {
    const entry = data.files.flatMap((f) => f.entries).find((e) => e.sourceId === "assaulters:25")!;
    const read = (p: string) => readFileSync(path.join(PROFILE_HANDOFF_DIR, p));
    expect(read(entry.duplicateCardFile!.asset).equals(read(entry.duplicateCardFile!.duplicateOf))).toBe(true);
    expect(entry.card).toBeNull();
    const registered = plan.assets.find((a) => a.path.endsWith("25_185523.png"))!;
    expect(registered.duplicateOfPath?.endsWith("15_181046.png")).toBe(true);
  });

  it("a reviewed translation flag points at a line that exists for that entry", () => {
    expect(data.translationFlags.flags).toHaveLength(12);
    for (const flag of data.translationFlags.flags) {
      const entry = data.files.flatMap((f) => f.entries).find((e) => e.sourceId === flag.sourceId)!;
      expect((entry.abilities ?? []).some((a) => a.es !== null && a.en.lines.some((l) => l.text === flag.line)), flag.line).toBe(true);
    }
  });
});

describe("which ninja each source entry is", () => {
  const summary = summarizePlan(plan);

  it("accounts for every source entry exactly once", () => {
    // 184 source entries: the 121 of Milestone 2 plus the 63 additional Supporter cards. All 177 ninjas of the release list and the Alien collection have a profile.
    expect(summary.sourceEntries).toBe(184);
    expect(summary.byIdentity).toEqual({ EXACT: 153, ALIAS_VERIFIED: 6, ALIAS_CONFIRMED: 5, ALIAS_REVIEWED: 6, NEW: 10, UNRESOLVED: 4 });
    expect(summary.distinctNinjas).toBe(177);
    expect(new Set(plan.ninjas.map((n) => n.slug)).size).toBe(177);
    expect(new Set(plan.ledger.map((r) => r.sourceId)).size).toBe(184);
    expect(summary.byChannel).toMatchObject({
      vanguards: { entries: 28, cards: 28, withText: 28, collectionStatus: "COMPLETE" },
      assaulters: { entries: 60, cards: 58, withText: 60, collectionStatus: "COMPLETE" },
      supporters: { entries: 79, cards: 79, withText: 79, collectionStatus: "PARTIAL" },
      "alien-ninjas": { entries: 10, cards: 10, withText: 10 },
      "awakening-ninjas": { entries: 7, cards: 0, withText: 7 },
    });
    expect(summary.byCompleteness).toEqual({ CARD_AND_TEXT: 175, TEXT_ONLY: 2, STAGED_ONLY: 4 });
  });

  it("only writes to ninjas of the release list, plus the ten Alien ninjas", () => {
    const fresh = plan.ninjas.filter((n) => n.isNew);
    expect(fresh).toHaveLength(10);
    expect(fresh.every((n) => n.name.startsWith("Alien ") && n.input.roleKey === "alien-ninjas")).toBe(true);
    for (const n of plan.ninjas.filter((x) => !x.isNew)) expect(releaseNames.has(n.name), n.name).toBe(true);
    // A profile never sets or changes a release date.
    expect(plan.ninjas.every((n) => n.input.release === undefined && n.input.releaseOrder === undefined)).toBe(true);
  });

  it("an entry it cannot identify creates no ninja: its text is kept as staged evidence only", () => {
    expect(summary.unresolved).toEqual(["Immortal Madara", "Neji Hyuga", "Illusion God Itachi", "Nagato uzumaki"]);
    for (const name of summary.unresolved) {
      expect(plan.ninjas.some((n) => n.slug === slugify(name) || n.sourceIds.some((id) => id.startsWith("awakening:") && id.endsWith(slugify(name)))), name).toBe(false);
    }
    // «Neji Hyuga» has an obvious candidate in the release list. It is proposed, not applied.
    expect(data.identity.entries["awakening:neji-hyuga"]).toMatchObject({ status: "UNRESOLVED", ninja: null, proposed: "Hyūga Neji" });
    expect(planned("Reanimated Nagato").sourceIds).toEqual(["supporters:12_reanimated-nagato"]);
    expect(plan.staged).toHaveLength(11);
    expect(plan.staged.every((e) => e.ref.kind === "none" && e.reviewStatus === "NEEDS_REVIEW" && e.ambiguityNote)).toBe(true);
    const rows = plan.ledger.filter((r) => r.action === "STAGED_ONLY");
    expect(rows.map((r) => [r.ninja, r.slug, r.completeness])).toEqual(Array(4).fill([null, null, "STAGED_ONLY"]));
  });

  it("the five judgement matches are confirmed by the client and stay traceable as aliases with their evidence", () => {
    // The six judgement matches of the new Supporter cards are not confirmed by the client yet: reviewed, flagged, searchable.
    expect(summary.reviewedAliases).toEqual([
      "Uchiha Sakura → Sakura Uchiha", "6-tail Utakata → Utakata", "Terumi Mei (Summer) → Terumi Mei", "Neji Hyūga → Hyūga Neji", "Orochimaru (New Era) → Orochimaru from Boruto", "Susanoo Itachi & Sasuke → Susano Itachi&Sasuke",
    ]);
    expect(summary.confirmedAliases).toEqual([
      "The Seventh Hokage → 7th Hokage", "Ay-Bee Combo → A-B Combo", "Might Gai → Might Guy", "Nadeshiko Shizuka → Shizuka", "10-Tailed Obito → 10-Tails Obito",
    ]);
    const hokage = planned("7th Hokage");
    expect(hokage.input.aliases).toEqual([expect.objectContaining({ alias: "The Seventh Hokage", kind: "CARD_NAME", status: "VERIFIED", note: expect.stringContaining("Confirmado por el cliente") })]);
    expect(hokage.input.reviewStatus).toBe("CONFIRMED");
    expect(hokage.evidence.find((e) => e.key.endsWith(":identity"))).toMatchObject({ reviewStatus: "CONFIRMED", ref: { kind: "ninja" } });
    expect(plan.ledger.filter((r) => r.flags.includes("IDENTITY_CONFIRMED_BY_CLIENT"))).toHaveLength(5);
    // The same words in another order are matched mechanically and marked as such.
    expect(planned("Jugo Sage").input.aliases).toEqual([expect.objectContaining({ alias: "Sage Jugo", status: "VERIFIED" })]);
    expect(planned("Hinata (Soccer Star)").input.aliases).toEqual([expect.objectContaining({ alias: "Hinata [Soccer Star]", kind: "CARD_NAME", status: "VERIFIED" })]);
  });

  it("never merges ninjas whose names merely look alike", () => {
    for (const [a, b] of [["Uchiha Obito", "Uchiha Obito (golden)"], ["7th Hokage", "7th hokage & shadow"], ["Might Guy", "Might Gai (Gate of Death)"], ["Uzumaki Kushina", "Uzumaki Kushina (Summer)"], ["Uchiha Madara", "Reanimated Madara"]] as const) {
      expect(planned(a).slug, `${a} / ${b}`).not.toBe(planned(b).slug);
      expect(planned(a).sourceIds.some((id) => planned(b).sourceIds.includes(id))).toBe(false);
    }
    expect(planned("Uchiha Obito").input.ratingKey).toBe("SSS");
    expect(planned("Uchiha Obito (golden)").input.formationKey).toBe("support");
    expect(planned("Uchiha Obito").input.formationKey).toBe("vanguard");
  });

  it("the same ninja posted in two channels is stored once, with both sources cited", () => {
    for (const [name, ids] of [["Six Paths Sage", ["supporters:10_six-paths-sage", "awakening:six-paths-sage"]], ["Cursed Seal Sasuke", ["vanguards:01-cursed-seal-sasuke", "awakening:cursed-seal-sasuke"]]] as const) {
      const n = planned(name);
      expect(n.sourceIds).toEqual(ids);
      expect(n.input.abilities).toHaveLength(1);
      expect(n.input.abilities![0]!.awakenings).toHaveLength(1);
      expect(n.input.talentGroups![0]!.options).toHaveLength(1);
      expect(n.input.talentGroups![0]!.options[0]!.awakenings).toHaveLength(1);
      for (const id of ids) expect(n.evidence.filter((e) => e.key.startsWith(`profile:${id}:`) && e.key.endsWith(":en"))).toHaveLength(4);
      expect(plan.ledger.filter((r) => ids.includes(r.sourceId as never)).map((r) => r.action)).toEqual(["LOADED", "MERGED"]);
    }
    // The only difference: the awakening-channel copy of Yasaka Itachi has doubled spaces in three lines. The Supporter copy is kept, the other is evidence for review.
    expect(plan.ledger.filter((r) => r.flags.includes("CROSS_CHANNEL_TEXT_DIFFERS")).map((r) => r.nameAsPosted)).toEqual(["Yasaka Itachi", "Yasaka Itachi"]);
  });

  const reidentified = (sourceId: string, decision: Partial<ProfileData["identity"]["entries"][string]>): ProfileData => ({
    ...data,
    identity: { entries: { ...data.identity.entries, [sourceId]: { ...data.identity.entries[sourceId]!, ...decision } } },
  });

  it("a later decision on an unresolved entry is all it takes to load it", () => {
    expect(planned("Reanimated Nagato").input.abilities![0]!.awakenings).toBeUndefined();
    const resolved = planProfiles(reidentified("awakening:nagato-uzumaki", { status: "ALIAS_REVIEWED", ninja: "Reanimated Nagato" }));
    const nagato = resolved.ninjas.find((n) => n.name === "Reanimated Nagato")!;
    expect(nagato.sourceIds).toEqual(["supporters:12_reanimated-nagato", "awakening:nagato-uzumaki"]);
    expect(nagato.input.abilities![0]).toMatchObject({ name: "Almighty Push", awakenings: [{ name: "Super Shinra Tensei", stage: 1, typeKey: "skill_awakening", stackingRule: "UNKNOWN" }] });
    expect(nagato.input.talentGroups![0]!.options[0]).toMatchObject({ name: "Six Path Power", awakenings: [{ name: "True Chibaku Tensei", stage: 1, stackingRule: "UNKNOWN" }] });
    // Its three "A, OR B" lines arrive as three choice groups, not as six effects that all apply.
    const skill = nagato.input.abilities![0]!.awakenings![0]!.effects!;
    expect([...new Set(skill.map((e) => e.choiceGroup).filter((g) => g != null))]).toEqual([1, 2, 3]);
    expect(new Set(skill.filter((e) => e.choiceGroup === 2).map((e) => e.choiceLabel))).toEqual(new Set(["Preta Path", "Ashura Path"]));
    expect(resolved.staged).toHaveLength(9);
  });

  it("refuses to hang an awakening on a talent or skill it does not have", () => {
    expect(() => planProfiles(reidentified("awakening:nagato-uzumaki", { status: "NEW", ninja: "Nagato uzumaki" }))).toThrow(/awakening\(s\) but 0/);
  });
});

describe("card data", () => {
  const ALIEN_ASSAULTERS = plan.ninjas.filter((n) => n.isNew && n.input.formationKey === "assaulter").map((n) => n.name);

  it("stores nothing a missing card would have shown", () => {
    const guy = planned("Might Guy").input;
    // Text was supplied for Might Gai, a card was not: nothing a card would have shown is stored.
    expect([guy.ratingKey, guy.formationKey, guy.typeKey, guy.baseStats]).toEqual([undefined, undefined, undefined, undefined]);
    expect(guy).toMatchObject({ roleKey: "assaulters", reviewStatus: "PARTIALLY_CONFIRMED" });
    expect(guy.aliases!.map((a) => [a.alias, a.kind, a.status])).toEqual([["Might Gai", "SOURCE_NAME", "VERIFIED"], ["Might Gai / Might Guy", "SOURCE_NAME", "VERIFIED"]]);
    expect(guy.abilities!.map((a) => a.name)).toEqual(["Night Guy"]);
    const taka = planned("Sasuke (Taka)").input;
    expect([taka.ratingKey, taka.formationKey, taka.typeKey, taka.baseStats]).toEqual([undefined, undefined, undefined, undefined]);
    expect(taka.abilities!.map((a) => [a.typeKey, a.name, a.cardLabel])).toEqual([["skill", "Susanoo Arrow", null]]);
    // Yasaka Itachi was only an awakening-channel record; the Supporter card now enriches the same ninja.
    const itachi = planned("Yasaka Itachi");
    expect(itachi.sourceIds).toEqual(["supporters:17_yasaka-itachi", "awakening:yasaka-itachi"]);
    expect([itachi.input.roleKey, itachi.input.ratingKey, itachi.input.baseStats!.map((s) => s.statisticKey)]).toEqual(["supporters", "SSS", ["force", "power", "agility", "hp"]]);
    expect(plan.ledger.filter((r) => r.flags.includes("CARD_MISSING")).map((r) => r.nameAsPosted)).toEqual(["Might Gai", "Sasuke (Taka)"]);
  });

  it("every card gives a rating, a type, a formation and four attributes, as printed", () => {
    const withCard = plan.ninjas.filter((n) => n.input.baseStats);
    expect(withCard).toHaveLength(175);
    for (const n of withCard) {
      expect(n.input.baseStats, n.name).toHaveLength(4);
      expect(["S", "SS", "SSS", "SR", "SSR"], n.name).toContain(n.input.ratingKey);
      expect(["support", "assaulter", "vanguard"], n.name).toContain(n.input.formationKey);
      expect(["taijutsu", "great-jutsu", "genjutsu"], n.name).toContain(n.input.typeKey);
      expect(n.input.baseStats!.every((s) => /^\d+(\.\d+)?$/.test(String(s.baseValue)) && /^\d+(\.\d+)?$/.test(String(s.growthRate)))).toBe(true);
    }
    expect(planned("Variable Sakura").input).toMatchObject({
      ratingKey: "S", typeKey: "taijutsu", formationKey: "assaulter", reviewStatus: "CONFIRMED",
      baseStats: [
        { statisticKey: "force", sourceLabel: "Force", baseValue: "1000", growthRate: "4.2" },
        { statisticKey: "chakra", sourceLabel: "Chakra", baseValue: "600", growthRate: "3.4" },
        { statisticKey: "agility", sourceLabel: "Agility", baseValue: "700", growthRate: "3.6" },
        { statisticKey: "hp", sourceLabel: "HP", baseValue: "2000", growthRate: "4" },
      ],
    });
  });

  it("the card label «Assaulter» is stored as printed, never rewritten to Center", () => {
    const assaulters = plan.ninjas.filter((n) => n.input.formationKey === "assaulter");
    expect(assaulters.filter((n) => n.input.roleKey === "assaulters")).toHaveLength(58);
    // Each Alien card prints its own formation; four of them print Assaulter.
    expect(assaulters.filter((n) => n.input.roleKey !== "assaulters").map((n) => [n.name, n.input.roleKey])).toEqual(ALIEN_ASSAULTERS.map((name) => [name, "alien-ninjas"]));
    expect(plan.ninjas.some((n) => n.input.formationKey === "center")).toBe(false);
    // In the three formation channels the card always agrees with the channel it was posted in.
    const expected = { vanguards: "vanguard", assaulters: "assaulter", supporters: "support" } as const;
    for (const n of plan.ninjas) {
      const channel = n.input.roleKey as keyof typeof expected;
      if (n.input.formationKey && channel in expected) expect(n.input.formationKey, n.name).toBe(expected[channel]);
    }
  });

  it("keeps «Power» where a card prints it instead of Chakra", () => {
    const momoshiki = planned("Otsutsuki Momoshiki").input.baseStats!;
    expect(momoshiki.map((s) => [s.statisticKey, s.sourceLabel, s.baseValue, s.growthRate])).toEqual([["force", "Force", "12000", "10.5"], ["power", "Power", "11000", "8.5"], ["agility", "Agility", "9000", "8.5"], ["hp", "HP", "90000", "13"]]);
    expect(plan.ledger.filter((r) => r.flags.includes("STAT_LABEL_POWER")).map((r) => r.ninja)).toEqual(["Otsutsuki Momoshiki", "Eight Gates Gai", "Naruto & Hinata", "Kakashi & Gai", "Yasaka Itachi", "Reanimated Hiruzen", "Sasuke & Itachi", "Pain & Konan", "Xmas Haku"]);
  });

  it("a card in another language is matched by field position and marked as only partly confirmed", () => {
    const guren = planned("Guren");
    expect(guren.input).toMatchObject({ formationKey: "vanguard", typeKey: "great-jutsu", ratingKey: "SSS", reviewStatus: "PARTIALLY_CONFIRMED" });
    expect(guren.input.baseStats!.map((s) => [s.statisticKey, s.sourceLabel])).toEqual([["force", "腕力"], ["chakra", "精神"], ["agility", "迅捷"], ["hp", "体力"]]);
    expect(guren.input.aliases).toEqual([expect.objectContaining({ alias: "红莲", kind: "CARD_NAME", locale: "zh" })]);
    expect(guren.evidence.find((e) => e.key.endsWith(":card"))).toMatchObject({ reviewStatus: "PARTIALLY_CONFIRMED", ambiguityNote: expect.stringContaining("Chinese card") });
    // The English name comes from the supplied text; the card's own wording is kept next to it.
    expect(talentOf("Guren")).toMatchObject({ name: "Crystal Dun", cardLabel: "晶遁" });
    expect(abilityNoteCodes(talentOf("Guren").note)).toContain("CARD_OTHER_LANGUAGE");
    expect(plan.ledger.filter((r) => r.flags.some((f) => f.startsWith("CARD_LANGUAGE_"))).map((r) => r.ninja)).toEqual([
      "Nagato & Itachi", "Guren", "Gai & Rock Lee", "Chino", "A-B Combo", "Konoha's Shadow Sasuke", "Orochimaru & Kabuto", "Hiruko", "1-Tail Gaara", "Armored Jiraiya",
      "Deidara & Sasori", "Hyuuga Hanabi", "Otsutsuki Kinshiki", "Swimsuit Tsunade", "Momoshiki (Awaken)", "Otsutsuki Ashura", "Naori Uchiha", "Wind Blaster Temari", "Yamanaka Ino", "Mui",
      "Princess Hinata", "Cursed Tayuya", "Sage Dragon Kabuto", "Mitsuki", "Uzumaki Naruko", "Yugao Uzuki",
    ]);
    for (const r of plan.ledger.filter((x) => x.flags.some((f) => f.startsWith("CARD_LANGUAGE_")))) {
      expect(r.flags, r.ninja!).toContain("LABEL_MATCHED_BY_POSITION");
      expect(planned(r.ninja!).input.reviewStatus, r.ninja!).toBe("PARTIALLY_CONFIRMED");
    }
  });

  it("a ninja with a card and no text gets its talent and skill by name only", () => {
    // No entry is left without text, so the name-only path is exercised on a copy of the data with one entry's text removed.
    const stripped: ProfileData = {
      ...data,
      files: data.files.map((f) => ({ ...f, entries: f.entries.map((e) => (["assaulters:01", "assaulters:03"].includes(e.sourceId) ? { ...e, abilities: [] } : e)) })),
    };
    const sakura = planProfiles(stripped).ninjas.find((n) => n.name === "Variable Sakura")!.input;
    expect(sakura.abilities).toEqual([{ typeKey: "skill", name: "Super Strength", cardLabel: "Super Strength", cardLabelCut: false, note: "NAME_FROM_CARD", reviewStatus: "PARTIALLY_CONFIRMED", effects: [] }]);
    expect(sakura.talentGroups![0]!.options).toEqual([{ name: "Force Talent", cardLabel: "Force Talent", cardLabelCut: false, note: "NAME_FROM_CARD", reviewStatus: "PARTIALLY_CONFIRMED", effects: [] }]);
    // A name the card layout cuts off is stored as printed and sent to review, not completed.
    expect(planProfiles(stripped).ninjas.find((n) => n.name === "Toad Sage")!.input.abilities![0]).toMatchObject({ name: "Sage Art: Bath of Boiling", cardLabelCut: true, note: "NAME_FROM_CARD;CARD_LABEL_CUT", reviewStatus: "NEEDS_REVIEW" });
    // With text supplied, the full name comes from the text and the cut label stays beside it.
    expect(planned("Madara & Obito").input.abilities![0]).toMatchObject({ name: "Heavenly Insertion Hammering Star", cardLabel: "Heavenly Insertion Hamr", cardLabelCut: true });
  });

  it("never assigns Tank or DPS", () => {
    expect(plan.ninjas.every((n) => n.input.clientCombatClass === undefined)).toBe(true);
  });
});

describe("ability text", () => {
  it("every source line is kept verbatim and produces at least one row", () => {
    // Status definitions ("Charm: ... by 220%") are kept as text and deliberately produce no effect rows.
    for (const b of allBlocks.filter((x) => x.description && x.typeKey !== "status_note")) {
      const lines = b.description!.split("\n");
      for (const [i, line] of lines.entries()) {
        const rows = b.effects.filter((e) => e.sourceLine === i);
        expect(rows.length, `${b.ninja} · ${b.name}: ${line}`).toBeGreaterThan(0);
        expect(rows.every((e) => e.sourceText === line)).toBe(true);
      }
      expect(b.effects.every((e) => e.sourceLine != null && e.sourceLine < lines.length)).toBe(true);
    }
    expect(allEffects).toHaveLength(4395);
    const count = (status: string) => allEffects.filter((e) => (e.structuredStatus ?? "STRUCTURED") === status).length;
    expect([count("STRUCTURED"), count("NEEDS_REVIEW"), count("TEXT_ONLY")]).toEqual([3876, 105, 414]);
  });

  it("a chance is stored only where the source says «chance»; every rate says what kind of rate it is", () => {
    for (const e of allEffects) {
      if (e.chancePercent != null) expect(/chance/i.test(e.sourceText!), e.sourceText!).toBe(true);
      if (e.rateValue != null) expect(e.rateKind, e.sourceText!).toBeTruthy();
      if (e.magnitudeOverride != null) expect(/\(\d+(\.\d+)?%\)/.test(e.sourceText!), e.sourceText!).toBe(true);
    }
    expect(allEffects.filter((e) => e.magnitudeOverride != null).length).toBeGreaterThan(10);
  });

  it("Sai (Errant Knight): (10%) Shatter Storm with a 60% chance for 2 rounds on one random ally", () => {
    const storm = blocks(planned("Sai (Errant Knight)")).flatMap((b) => b.effects).filter((e) => e.statusKey === "shatter-storm");
    expect(storm).toEqual([
      expect.objectContaining({ kind: "STATUS", magnitudeOverride: "10", chancePercent: "60", durationTurns: 2, targetKey: "ally", targetCount: 1, targetSelector: "RANDOM", triggerText: "After being attacked", structuredStatus: "STRUCTURED" }),
    ]);
  });

  it("a line that names a chakra nature never yields only unconditional rows", () => {
    const natureLine = /\b(earth|wind|fire|thunder|water|inactivated) chakra\b/i;
    let checked = 0;
    for (const b of allBlocks) {
      const byLine = new Map<number, EffectInput[]>();
      for (const e of b.effects) byLine.set(e.sourceLine!, [...(byLine.get(e.sourceLine!) ?? []), e]);
      for (const rows of byLine.values()) {
        if (!natureLine.test(rows[0]!.sourceText!)) continue;
        checked++;
        const conditional = rows.some((e) => (e.conditions ?? []).some((c) => c.typeKey === "nature") || e.conditionText || e.structuredStatus === "TEXT_ONLY");
        expect(conditional, `${b.ninja}: ${rows[0]!.sourceText}`).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("supplied Spanish sits next to the English original and never replaces it", () => {
    for (const b of allBlocks) {
      if (b.descriptionEs) expect(b.description, `${b.ninja} · ${b.name}`).toBeTruthy();
      for (const e of b.effects) {
        expect(e.sourceText).toBeTruthy();
        expect(e.translationStatus).toBe(e.descriptionEs ? "SOURCE_PROVIDED" : "MISSING");
      }
    }
    const bond = talentOf("Cursed Seal Sasuke");
    expect(bond).toMatchObject({ description: "Increases self force.", descriptionEs: "Aumenta la fuerza propia.", translationStatus: "SOURCE_PROVIDED", nameEs: null });
    expect(talentOf("Hinata (Soccer Star)")).toMatchObject({ name: "Mystical Palm", nameEs: "Palma Mística" });
    // The first 16 Supporters got their Spanish from the recovery package; the English stays the original.
    for (const n of plan.ninjas.filter((x) => x.input.roleKey === "supporters")) {
      for (const b of blocks(n)) {
        expect(b.description, `${n.name} · ${b.name}`).toBeTruthy();
        // A status definition ("Armor Break: ...") is given in English only in some profiles.
        if (b.typeKey === "status_note" && b.descriptionEs == null) continue;
        expect(b.descriptionEs, `${n.name} · ${b.name}`).toBeTruthy();
      }
    }
    const konan = planned("Angel Konan");
    expect(konan.input.abilities![0]!).toMatchObject({ name: "Paper Plane Dance", translationStatus: "SOURCE_PROVIDED" });
    expect(konan.input.abilities![0]!.description).toMatch(/^Attacks/);
    expect(konan.input.abilities![0]!.descriptionEs).toMatch(/^Ataca/);
  });

  it("keeps both texts and flags them where English and Spanish disagree", () => {
    const awakening = talentOf("Cursed Seal Sasuke").awakenings![0]!;
    expect(awakening.description!.split("\n")).toHaveLength(7);
    expect(awakening.descriptionEs!.split("\n")).toHaveLength(8);
    expect(abilityNoteCodes(awakening.note)).toEqual(expect.arrayContaining(["ES_LINE_COUNT_DIFFERS", "ES_WORDING_DIFFERS", "NAME_NOT_SUPPLIED"]));
    expect(awakening.reviewStatus).toBe("PARTIALLY_CONFIRMED");
    // Lines are not paired when their counts differ, so no Spanish is attached to the wrong line.
    expect(awakening.effects!.every((e) => e.descriptionEs == null)).toBe(true);
    const immune = awakening.effects!.filter((e) => e.sourceText!.startsWith("Immune to 100% of enemy defenses"));
    expect(immune.length).toBeGreaterThan(0);
    expect(immune.every((e) => effectNoteCodes(e.note).includes("ES_WORDING_DIFFERS"))).toBe(true);

    const kakuzu = blocks(planned("Jiongu Kakuzu")).flatMap((b) => b.effects).filter((e) => effectNoteCodes(e.note).includes("ES_NUMBERS_DIFFER"));
    expect(new Set(kakuzu.map((e) => e.sourceText))).toEqual(new Set(["Increases water chakra allies' defenses by 35%, and attack by 35%."]));
    expect(kakuzu.every((e) => e.descriptionEs === "Aumenta las defensas y el ataque de los aliados de chakra agua en 35%.")).toBe(true);

    const sai = blocks(planned("Sai (Errant Knight)")).flatMap((b) => b.effects).filter((e) => effectNoteCodes(e.note).includes("ES_TEXT_CUT"));
    expect(sai.map((e) => e.descriptionEs)).toEqual(Array(sai.length).fill("Restaura 68 de furia propia, 30 para los [TRUNCATED IN SOURCE]."));
    const conflicts = summarizePlan(plan).spanishConflicts;
    expect(conflicts).toHaveLength(26);
    expect(conflicts).toEqual(expect.arrayContaining([
      "Cursed Seal Sasuke: ES_LINE_COUNT_DIFFERS, ES_WORDING_DIFFERS", "Jiongu Kakuzu: ES_NUMBERS_DIFFER", "Warrior Sakura: ES_LINE_COUNT_DIFFERS", "Sai (Errant Knight): ES_TEXT_CUT",
      "Sasuke (Taka): ES_WORDING_DIFFERS", "Awakened Kawaki: ES_LINE_COUNT_DIFFERS", "Hokage Candidate Danzo: ES_WORDING_DIFFERS", "Shin Uchiha: ES_WORDING_DIFFERS",
      "Christmas Mito: ES_LINE_COUNT_DIFFERS", "Kyūbi Minato: ES_LINE_COUNT_DIFFERS",
    ]));
  });

  it("text headed with another ninja's name is attached for review, not as confirmed", () => {
    const shadow = planned("7th hokage & shadow");
    expect(blocks(shadow).every((b) => abilityNoteCodes(b.note).includes("TEXT_ATTRIBUTION_UNVERIFIED"))).toBe(true);
    expect(shadow.input.abilities!.map((a) => [a.name, a.cardLabel, a.reviewStatus])).toEqual([
      ["Majestic Attire: Susano", "Majestic Attire: Susanoo", "NEEDS_REVIEW"],
      ["Scorch Release: Halo Hurricane Jet Black Arrow Style Zero", null, "NEEDS_REVIEW"],
    ]);
    expect(shadow.evidence.filter((e) => e.key.endsWith(":en")).every((e) => e.reviewStatus === "NEEDS_REVIEW" && e.ambiguityNote?.includes("7th Hokage & Sasuke"))).toBe(true);
  });

  it("does not guess which of two skills a card name belongs to", () => {
    const pain = planned("Pain Animal Path");
    expect(pain.input.abilities!.map((a) => [a.typeKey, a.name, a.cardLabel])).toEqual([["normal_skill", "Normal Skill", null], ["special_skill", "Special Skill", null]]);
    expect(plan.ledger.find((r) => r.ninja === "Pain Animal Path")!.flags).toContain("CARD_SKILL_LABEL_UNPLACED");
    expect(pain.evidence.find((e) => e.key.endsWith(":card"))!.sourceText).toContain("Skill: PsychicHellhound");
  });
});

describe("awakenings", () => {
  const awakenings = plan.ninjas.flatMap((n) => [
    ...(n.input.abilities ?? []).flatMap((a) => a.awakenings ?? []),
    ...(n.input.talentGroups ?? []).flatMap((g) => g.options.flatMap((o) => o.awakenings ?? [])),
  ].map((w) => ({ ninja: n.name, ...w })));

  it("Hinata (Soccer Star): level 2 replaces level 1, as the source says in words", () => {
    const [l1, l2] = talentOf("Hinata (Soccer Star)").awakenings!;
    expect(l1).toMatchObject({ name: "Twin Lion Fists", stage: 1, typeKey: "talent_awakening", stackingRule: "UNKNOWN", supersedesStage: null });
    expect(l2).toMatchObject({
      name: "Twin Lion Strike", stage: 2, stackingRule: "REPLACES_PRIOR", supersedesStage: 1,
      ruleSourceText: "NOTE: The effects of Lvl 2 awakening REPLACE the effects of Lvl 1 awakening.",
    });
    // The effects of the two levels stay in two separate lists.
    expect(l1!.effects!.length).toBeGreaterThan(0);
    expect(l2!.effects!.length).toBeGreaterThan(0);
  });

  it("Jugo Sage: the card-specific stage restates a base number (83% → 86%) and keeps its condition", () => {
    const stage3 = talentOf("Jugo Sage").awakenings!.find((w) => w.stage === 3)!;
    expect(stage3).toMatchObject({ stackingRule: "UPGRADES_BASE", conditionText: "Special Jugo Card Awakening", ruleSourceText: "Increases self speed from 83% → 86%." });
    expect(stage3.effects!.find((e) => e.replacesValue != null)).toMatchObject({ statisticKey: "speed", value: "86", replacesValue: "83" });
    expect(planned("Jugo Sage").input.abilities![0]!.awakenings![0]).toMatchObject({ stage: 1, conditionText: "Special Jugo Card Awakening", stackingRule: "UNKNOWN" });
  });

  it("every awakening after the first replaces the previous one (client rule); the rest is as the source says", () => {
    expect(awakenings).toHaveLength(120);
    // Rules that come from the source text or from a specific client decision.
    const specific = awakenings.filter((w) => w.stackingRule !== "UNKNOWN" && !w.ruleSourceText!.startsWith("Client decision"));
    expect(specific.map((w) => [w.ninja, w.stage, w.stackingRule])).toEqual([
      ["Jugo Sage", 3, "UPGRADES_BASE"], ["Hinata (Soccer Star)", 2, "REPLACES_PRIOR"], ["First Hokage", 3, "CANCELS_PRIOR"], ["Kusanagi Kyo", 2, "REPLACES_PRIOR"],
      ["Cursed Tayuya", 3, "UPGRADES_BASE"], ["Natsu Dragneel", 1, "UPGRADES_BASE"], ["Natsu Dragneel", 2, "REPLACES_PRIOR"],
    ]);
    // The general client rule: a numbered stage with an earlier stage in the same talent or skill replaces it.
    const general = awakenings.filter((w) => w.ruleSourceText?.startsWith("Client decision"));
    expect(general.length).toBeGreaterThan(5);
    for (const w of general) expect([w.stackingRule, w.supersedesStage != null, (w.stage ?? 0) > 1], `${w.ninja} stage ${w.stage}`).toEqual(["REPLACES_PRIOR", true, true]);
    // What stays UNKNOWN: a first stage (its relation to the base is not stated) or a stage the source does not number.
    for (const w of awakenings.filter((x) => x.stackingRule === "UNKNOWN")) {
      expect(w.stage == null || w.stage === 1 || w.stage > 1, `${w.ninja}`).toBe(true);
      expect(w.ruleSourceText).toBeFalsy();
    }
    expect(awakenings.every((w) => (w.stackingRule === "UNKNOWN") === (w.ruleSourceText == null))).toBe(true);
    // Several stages of one talent stay separate entries; the second replaces the first.
    expect(talentOf("Uzumaki Boruto").awakenings!.map((w) => [w.stage, w.stackingRule])).toEqual([[1, "UNKNOWN"], [2, "REPLACES_PRIOR"]]);
  });

  it("Kusanagi Kyo: level 2 replaces level 1, as the supplied note says in both languages", () => {
    const [l1, l2] = talentOf("Kusanagi Kyo").awakenings!;
    expect(l1).toMatchObject({ name: "Poisonous Bite", stage: 1, stackingRule: "UNKNOWN", supersedesStage: null });
    expect(l2).toMatchObject({
      name: "Sin Chant", stage: 2, stackingRule: "REPLACES_PRIOR", supersedesStage: 1,
      ruleSourceText: "The effects of Lvl 2 awakening replace the effects of Lvl 1 awakening.",
    });
    expect(l1!.effects!.length).toBeGreaterThan(0);
    expect(l2!.effects!.length).toBeGreaterThan(0);
  });

  it("First Hokage: level 3 cancels level 2 only after the «Shodai Hokage» heading was matched to the entry", () => {
    const hokage = planned("First Hokage");
    expect(hokage.sourceIds).toEqual(["assaulters:44"]);
    const awakeningList = talentOf("First Hokage").awakenings!;
    expect(awakeningList.map((w) => [w.stage, w.stackingRule, w.supersedesStage])).toEqual([[1, "UNKNOWN", null], [2, "REPLACES_PRIOR", 1], [3, "CANCELS_PRIOR", 2]]);
    expect(awakeningList[2]).toMatchObject({ ruleSourceText: "Cancels Talent Awakening 2." });
    // The client confirmed (25 October 2026) that Shodai Hokage is the First Hokage: one ninja, the heading is a verified name.
    expect(hokage.input.aliases).toEqual([expect.objectContaining({ alias: "Shodai Hokage", kind: "SOURCE_NAME", status: "VERIFIED" })]);
    expect(data.rules.rules.find((r) => r.sourceId === "assaulters:44")).toMatchObject({ identityNote: expect.stringContaining("Shodai is the Japanese word for First") });
    // The placeholders [Talent] and [Skill] are not turned into names: the card's names are used and flagged.
    const hokageCard = data.files.flatMap((f) => f.entries).find((e) => e.sourceId === "assaulters:44")!.card!;
    expect(talentOf("First Hokage")).toMatchObject({ name: hokageCard.talentLabel.text, note: expect.stringContaining("NAME_NOT_SUPPLIED") });
  });

  it("the recovered text is in the package it cites, and the grouped copies agree with the per-profile files", () => {
    const pkg = path.join(PROFILE_HANDOFF_DIR, "M2_Supplementary_Text_Recovery_58_Assaulters_16_Supporters");
    if (!existsSync(pkg)) return;
    const lines = (dir: string) => {
      const out: string[] = [];
      for (const f of readdirSync(path.join(pkg, dir)).sort()) {
        for (const l of readFileSync(path.join(pkg, dir, f), "utf8").split("\n")) if (l.startsWith("- ")) out.push(l);
      }
      return out.sort();
    };
    expect(lines("per_profile/assaulters")).toEqual(lines("assaulters_en_es"));
    expect(lines("per_profile/supporters_es")).toEqual(lines("supporters_es"));
    expect(lines("per_profile/assaulters")).toHaveLength(1511);
    expect(lines("per_profile/supporters_es")).toHaveLength(118);
  });

  it("a status definition from a ninja's text is kept as text with its own value, never as an effect", () => {
    const charm37 = planned("Daiguren Toshiro").input.abilities!.find((a) => a.typeKey === "status_note")!;
    const charm38 = planned("Hotaru").input.abilities!.find((a) => a.typeKey === "status_note")!;
    expect(charm37).toMatchObject({ name: "Charm", effects: [], description: expect.stringContaining("220%"), descriptionEs: expect.stringContaining("220") });
    expect(charm38.description).toContain("160%");
    // The ninja's own skills keep their effect rows.
    expect(planned("Hotaru").input.abilities!.filter((a) => ["normal_skill", "special_skill"].includes(a.typeKey)).map((a) => a.name)).toEqual(["Normal Skill", "Special Skill"]);
  });

  it("the entries of the recovery package are matched by position and by name, with no new ninja", () => {
    const assaulters = data.files.find((f) => f.channel === "assaulters")!.entries;
    expect(assaulters.filter((e) => (e.abilities ?? []).length > 0)).toHaveLength(60);
    const plannedAssaulters = plan.ninjas.filter((n) => n.sourceIds.some((id) => id.startsWith("assaulters:")));
    expect(plannedAssaulters).toHaveLength(60);
    expect(plannedAssaulters.every((n) => !n.isNew)).toBe(true);
    // Source variants stay distinct.
    expect(planned("Uzumaki Kushina (Summer)").sourceIds).toEqual(["assaulters:46"]);
    expect(planned("Uzumaki Kushina").sourceIds).toEqual(["vanguards:05-kushina-uzumaki"]);
    expect(planned("4-Tail Roshi").input.abilities!.map((a) => a.typeKey)).toEqual(["normal_skill", "special_skill"]);
    // Hiruko: «Applies one from each» with three groups of two stay three groups of alternatives, with nothing chosen by default.
    const hiruko = planned("Hiruko").input.abilities![0]!.effects!;
    expect([...new Set(hiruko.map((e) => e.choiceGroup).filter((g) => g != null))]).toEqual([1, 2, 3]);
    expect(hiruko.filter((e) => e.choiceGroup === 2).map((e) => [e.choiceLabel, e.sourceText])).toEqual([
      ["Option 1", "Increases ally vanguards' and assaulters' defenses by 500% for 2 rounds."],
      ["Option 2", "100% rate to chaos enemy supporters for 2 rounds."],
    ]);
    // The four lines before the heading are not alternatives.
    expect(hiruko.filter((e) => e.choiceGroup == null).every((e) => !/crit rate|burst|chaos|500%/.test(e.sourceText!) || /Applies one from each/.test(e.sourceText!))).toBe(true);
  });

  it("one talent per ninja is stored: nothing in the supplied text offers two talents to combine", () => {
    expect(plan.ninjas.filter((n) => (n.input.talentGroups?.[0]?.options.length ?? 0) > 1)).toEqual([]);
    expect(plan.ninjas.filter((n) => (n.input.talentGroups?.length ?? 0) > 1)).toEqual([]);
    expect(plan.ninjas.every((n) => (n.input.talentGroups ?? []).every((g) => g.selectionMode === "ONE_OF"))).toBe(true);
  });
});
