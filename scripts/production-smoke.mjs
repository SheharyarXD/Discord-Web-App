import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { chromium } from "playwright-core";

/**
 * READ-ONLY smoke test of the live site. The only writes are two throw-away accounts (and their sessions) that are deleted at the end.
 *   node scripts/with-vercel-env.mjs production -- env TARGET_BASE_URL=https://<host> node scripts/production-smoke.mjs <screenshot folder>
 * Needs the PostgreSQL Prisma client as the default client (prisma generate --schema prisma/postgres/schema.prisma).
 * Passwords are random, kept in memory and never printed.
 */
const BASE = process.env.TARGET_BASE_URL?.replace(/\/$/, "");
if (!BASE || !(BASE.startsWith("https://") || (process.env.ALLOW_LOCAL === "1" && /^http:\/\/127\.0\.0\.1:\d+$/.test(BASE)))) throw new Error("TARGET_BASE_URL (https) is required");
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const db = new PrismaClient();
const adminMail = "smoke-admin@example.test";
const userMail = "smoke-user@example.test";
const adminPw = randomBytes(14).toString("hex");
const userPw = randomBytes(14).toString("hex");
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok: Boolean(ok), extra });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
};
const cleanup = async () => {
  await db.session.deleteMany({ where: { user: { email: { in: [adminMail, userMail] } } } });
  await db.user.deleteMany({ where: { email: { in: [adminMail, userMail] } } });
};
const before = { ninjas: await db.ninja.count(), users: await db.user.count(), abilities: await db.ability.count(), effects: await db.effect.count() };
await cleanup();
await db.user.create({ data: { email: adminMail, name: "Smoke admin", role: "ADMIN", passwordHash: await bcrypt.hash(adminPw, 10) } });
await db.user.create({ data: { email: userMail, name: "Smoke user", role: "USER", passwordHash: await bcrypt.hash(userPw, 10) } });

const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
const HIDE = "header, [class*='sticky'], [class*='fixed'] { position: static !important; } a.group > div:first-child:has(> span[aria-hidden]) { display: none !important; }";
async function login(email, password, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "es", deviceScaleFactor: width < 600 ? 2 : width < 1100 ? 1.75 : 1.25 });
  ctx.setDefaultTimeout(Number(process.env.CHECK_TIMEOUT_MS ?? 30000));
  ctx.setDefaultNavigationTimeout(Number(process.env.CHECK_TIMEOUT_MS ?? 30000));
  const page = await ctx.newPage();
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }).catch(() => null), page.click('button[type="submit"]')]);
  return { ctx, page, ok: !new URL(page.url()).pathname.startsWith("/login") };
}
const go = (p, url) => p.goto(url, { waitUntil: "networkidle" });
const shot = async (page, name, clip, full = true) => {
  await page.addStyleTag({ content: HIDE }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, name), fullPage: full, clip });
};
const total = async (page, url) => { await go(page, BASE + url); return Number(((await page.locator("[data-result-count]").first().innerText().catch(() => "0")).match(/\d+/) ?? [0])[0]); };
const around = async (page, url, re, name, height = 900, pre = 50) => {
  await go(page, BASE + url);
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
  const y = await page.evaluate((src) => {
    const r = new RegExp(src, "i");
    const el = [...document.querySelectorAll("main *")].find((e) => r.test(e.textContent ?? "") && ![...e.children].some((c) => r.test(c.textContent ?? "")));
    return el ? el.getBoundingClientRect().top + window.scrollY : null;
  }, re.source);
  if (y === null) { check(`anchor for ${name}`, false); return; }
  await shot(page, name, { x: 0, y: Math.max(0, y - pre), width: 960, height });
};

try {
  // anonymous
  const health = await fetch(BASE + "/api/health");
  check("health endpoint answers ok over HTTPS", health.status === 200 && (await health.text()) === '{"status":"ok"}');
  for (const p of ["/ninjas", "/admin", "/search", "/ninjas/natsu-dragneel"]) {
    const r = await fetch(BASE + p, { redirect: "manual" });
    check(`anonymous visitor is sent to the login on ${p}`, r.status >= 300 && r.status < 400 && /\/login/.test(r.headers.get("location") ?? ""), String(r.status));
    check(`private page ${p} is not cacheable`, /no-store|private/.test(r.headers.get("cache-control") ?? ""), r.headers.get("cache-control") ?? "");
  }
  const gems = await fetch(BASE + "/gems", { redirect: "manual" });
  check("gems stays hidden (404)", gems.status === 404, String(gems.status));
  const hsts = (await fetch(BASE + "/login")).headers.get("strict-transport-security");
  check("HTTPS is enforced with HSTS", Boolean(hsts), hsts ?? "");

  // regular user
  const U = await login(userMail, userPw);
  check("regular user can sign in", U.ok);
  const adminAsUser = await U.page.goto(BASE + "/admin");
  check("regular user gets 404 on /admin", adminAsUser.status() === 404, String(adminAsUser.status()));
  const ninjasAsUser = await U.page.goto(BASE + "/ninjas", { waitUntil: "networkidle" });
  check("regular user can read /ninjas", ninjasAsUser.status() === 200);
  await U.ctx.close();

  // administrator
  const A = await login(adminMail, adminPw);
  check("administrator can sign in", A.ok);
  const cookie = (await A.ctx.cookies()).find((c) => /session/i.test(c.name));
  check("session cookie is Secure and HttpOnly", Boolean(cookie?.secure && cookie?.httpOnly), cookie ? `secure=${cookie.secure} httpOnly=${cookie.httpOnly} sameSite=${cookie.sameSite}` : "no cookie");
  const all = await total(A.page, "/ninjas");
  check("177 ninjas are listed", all === 177, String(all));
  check("Center and Assaulter filters return the same ninjas", (await total(A.page, "/ninjas?formation=center")) === (await total(A.page, "/ninjas?formation=assaulter")));
  check("search finds First Hokage by the confirmed name Shodai", (await total(A.page, "/ninjas?q=shodai")) === 1);
  check("search finds Might Guy by the confirmed alias Might Gai", (await total(A.page, "/ninjas?q=might+gai")) >= 1);
  check("accent-insensitive search (otsutsuki)", (await total(A.page, "/ninjas?q=otsutsuki")) >= 3);
  const supporters = await total(A.page, "/ninjas?formation=support");
  check("Support formation lists 83 ninjas (79 Supporters and 4 Alien cards)", supporters === 83, String(supporters));
  const natsu = await A.page.goto(BASE + "/ninjas/natsu-dragneel", { waitUntil: "networkidle" });
  const natsuText = await A.page.locator("main").innerText();
  check("Natsu Dragneel page: replacement rule and skill awakening", natsu.status() === 200 && /550%/.test(natsuText) && /reemplazan|Sustituye/i.test(natsuText) && /replace those of Talent Awakening 1/.test(natsuText));
  await go(A.page, BASE + "/ninjas/cursed-tayuya");
  check("Cursed Tayuya page: special awakening 88% to 92%", /88%/.test(await A.page.locator("main").innerText()) && /92%/.test(await A.page.locator("main").innerText()));
  await go(A.page, BASE + "/ninjas/kimono-kurenai");
  check("Kimono Kurenai: the final Spanish line is present", /Restaura 68 puntos de furia propia y 30 para los aliados/.test(await A.page.locator("main").innerText()));
  await go(A.page, BASE + "/ninjas/yamanaka-ino");
  check("Yamanaka Ino: awakening 2 replaces awakening 1 by client decision", /Decisión del cliente/.test(await A.page.locator("main").innerText()));
  await go(A.page, BASE + "/ninjas/mitarashi-anko");
  check("Mitarashi Anko HP stays 45000 as printed", /45[.,]?000(?![.,]?\d)/.test(await A.page.locator("main").innerText()));
  for (const p of ["/admin", "/admin/ninjas", "/admin/users"]) {
    const r = await A.page.goto(BASE + p, { waitUntil: "networkidle" });
    check(`administrator can open ${p}`, r.status() === 200);
  }
  const gemsAdmin = await A.page.goto(BASE + "/gems");
  check("gems is 404 even for the administrator", gemsAdmin.status() === 404);

  // persistence across requests / serverless instances
  let allOk = true;
  for (let i = 0; i < 6; i++) { const r = await A.page.goto(BASE + "/ninjas?page=" + (i + 1), { waitUntil: "domcontentloaded" }); allOk &&= r.status() === 200 && !/\/login/.test(A.page.url()); }
  check("the session persists across repeated requests", allOk);

  // search by effect, read-only: result sets are compared with independent queries on the stored effects
  const owners = async (where) => {
    const rows = await db.effect.findMany({ where, select: { ability: { select: { ninjaId: true } }, talentOption: { select: { group: { select: { ninjaId: true } } } } } });
    return new Set(rows.map((r) => r.ability?.ninjaId ?? r.talentOption?.group.ninjaId).filter(Boolean));
  };
  const stunStructured = await owners({ kind: "STATUS", statusEffect: { key: "stun" } });
  const stunAny = new Set(stunStructured);
  for (const r of await db.effect.findMany({ where: { OR: [{ kind: "TEXT" }, { structuredStatus: { not: "STRUCTURED" } }] }, select: { sourceText: true, descriptionEs: true, ability: { select: { ninjaId: true } }, talentOption: { select: { group: { select: { ninjaId: true } } } } } })) {
    if (/stun|aturd/i.test(`${r.sourceText ?? ""} ${r.descriptionEs ?? ""}`)) stunAny.add(r.ability?.ninjaId ?? r.talentOption?.group.ninjaId);
  }
  const fxStun = await total(A.page, "/ninjas?fx=aturdir");
  check("live effect search «aturdir» returns every structured Stun ninja and only ninjas with evidence", fxStun >= stunStructured.size && fxStun <= stunAny.size && fxStun > 5, `shown=${fxStun} structured=${stunStructured.size} evidence=${stunAny.size}`);
  check("live: English «stun», capitals and accents give the same result", (await total(A.page, "/ninjas?fx=stun")) === fxStun && (await total(A.page, "/ninjas?fx=ATURD%C3%8DR")) === fxStun);
  const immuneLive = await total(A.page, "/ninjas?fx=inmunidad+a+aturdir");
  check("live: immunity to Stun equals the stored immunity effects and differs from applying Stun", immuneLive === (await owners({ kind: "IMMUNITY", statusEffect: { key: "stun" } })).size && immuneLive !== fxStun, `${immuneLive}`);
  const healLive = await total(A.page, "/ninjas?fx=curaci%C3%B3n");
  check("live: «curación» covers every ninja with a Heal effect", healLive >= (await owners({ kind: "HEAL" })).size && healLive > 0, `${healLive}`);
  const speedLive = await total(A.page, "/ninjas?fx=aumento+de+velocidad");
  const speedHp = await total(A.page, "/ninjas?fx=aumento+de+velocidad&stat1=hp&min1=100000");
  const speedSsr = await total(A.page, "/ninjas?fx=aumento+de+velocidad&rating=SSR&formation=center");
  check("live: effect + statistic range + rank + formation combine (AND)", speedLive > 0 && speedHp <= speedLive && speedSsr <= speedLive, `effect=${speedLive} withHp=${speedHp} withSsrCenter=${speedSsr}`);
  const unionLive = await total(A.page, "/ninjas?fx=aturdir&fx=sellar");
  check("live: several effects mean ANY (union)", unionLive >= fxStun && unionLive <= fxStun + (await total(A.page, "/ninjas?fx=sellar")), `${unionLive}`);
  const links = [];
  for (let n = 1; n <= Math.ceil(unionLive / 24) + 1; n++) { await go(A.page, BASE + `/ninjas?fx=aturdir&fx=sellar&page=${n}`); links.push(...(await A.page.locator("ul li a[href^='/ninjas/']").evaluateAll((els) => els.map((e) => e.getAttribute("href"))))); }
  check("live: paging through effect results shows each ninja once", links.length === unionLive && new Set(links).size === links.length, `${links.length}/${unionLive}`);
  await go(A.page, BASE + "/ninjas?fx=zzzxxyy");
  check("live: an effect nobody has gives the Spanish empty message", /Ningún ninja tiene registrado el efecto «zzzxxyy»/.test(await A.page.locator("main").innerText()));
  await go(A.page, BASE + "/ninjas?fx=aturdir");
  check("live: the control is labelled «Buscar por efecto» with suggestions and a chip", (await A.page.locator("label[for=fx]").innerText()) === "Buscar por efecto" && (await A.page.locator("#fx-suggestions option").count()) >= 20 && (await A.page.locator("[data-effect-search] ul li").count()) === 1);


  // equipment, jewelry and Match Any / Match All: read-only, compared with independent queries on the stored rows
  const gearRows = async (kind) => (kind === "equipment" ? db.equipmentSet : db.jewelrySet).findMany({ where: { familyId: { not: null } }, select: { id: true, slug: true } });
  const eqSets = await gearRows("equipment");
  const jwSets = await gearRows("jewelry");
  const gt = (url) => total(A.page, url);
  check("gear: the catalogue lists every imported version (equipment, jewelry, both)", (await gt("/equipment")) === eqSets.length && (await gt("/jewelry")) === jwSets.length && (await gt("/sets")) === eqSets.length + jwSets.length && eqSets.length >= 78, `eq=${eqSets.length} jw=${jwSets.length}`);
  await go(A.page, BASE + "/sets?q=sand+burial");
  const sbText = await A.page.locator("[data-gear-results]").innerText();
  check("gear: Sand Burial shows base equipment, base jewelry and the R1 jewelry as three cards", /Sand Burial R1/.test(sbText) && (await A.page.locator("[data-gear-card]").count()) === 3);
  await go(A.page, BASE + "/sets?q=warlord");
  const wText = await A.page.locator("[data-gear-results]").innerText();
  check("gear: a version with no printed statistics of its own does not claim zero pieces", !/0 piezas/.test(wText));
  check("gear: Warlord shows Base, SSR5, R1 and R2 as four cards", /Warlord SSR5/.test(wText) && /Warlord R1/.test(wText) && /Warlord R2/.test(wText) && (await A.page.locator("[data-gear-card]").count()) === 4);
  await go(A.page, BASE + "/sets?q=sange");
  const sangeText = await A.page.locator("[data-gear-results]").innerText();
  check("gear: unlabeled variants say variante and are never named R1 or R2", /variante A/.test(sangeText) && !/Sange R[12]/.test(sangeText));
  await go(A.page, BASE + "/sets?q=legendary");
  check("gear: name-only sets create no card", (await A.page.locator("[data-gear-card]").count()) === 0);
  const tier8 = await db.jewelrySetBonus.findMany({ where: { requiredPieces: 8, set: { familyId: { not: null } } }, select: { setId: true }, distinct: ["setId"] });
  check("gear: the tier filter matches the stored 8-piece bonuses", (await gt("/jewelry?tier=8")) === tier8.length, `${tier8.length}`);
  const speedDb = await db.equipmentSet.findMany({ where: { familyId: { not: null }, items: { some: { effects: { some: { note: "PRINTED_MAIN_STAT", statistic: { key: "speed" }, value: { gte: 70000 } } } } } }, select: { id: true } });
  check("gear: a printed-statistic range matches the stored values", (await gt("/equipment?stat1=speed&min1=70000")) === speedDb.length && speedDb.length > 0, `${speedDb.length}`);
  const gearEffectOwners = async (re) => {
    const rows = await db.effect.findMany({ where: { equipmentSetBonusId: { not: null } }, select: { sourceText: true, equipmentSetBonus: { select: { setId: true } } } });
    return new Set(rows.filter((r) => re.test(r.sourceText ?? "")).map((r) => r.equipmentSetBonus.setId));
  };
  const stunSets = await gearEffectOwners(/\bstun/i);
  const healSets = await gearEffectOwners(/(recover|restore)s?\b[^.]*\bhp\b|(?<!forbidden )\bheal(?!\s*(reduction|forbid))/i);
  const eA = await gt("/equipment?fx=aturdir");
  check("gear: effect search aturdir on equipment equals the sets whose stored tiers say stun", eA === stunSets.size && eA > 0, `${eA} vs ${stunSets.size}`);
  await go(A.page, BASE + "/equipment?fx=aturdir");
  check("gear: a result names its tier and says it does not mean it is equipped", /Bonus de \d+ piezas/.test(await A.page.locator("[data-effect-evidence]").first().innerText()) && /No significa que la tengas equipada/.test(await A.page.locator("main").innerText()));
  const unionEq = new Set([...stunSets, ...healSets]);
  const anyEq = await gt("/equipment?fx=aturdir&fx=curaci%C3%B3n&fxm=any");
  const allEq = await gt("/equipment?fx=aturdir&fx=curaci%C3%B3n&fxm=all");
  check("gear: Match Any = union of the two effects, Match All = intersection (equipment)", anyEq === unionEq.size && allEq === [...stunSets].filter((x) => healSets.has(x)).length && allEq <= anyEq, `any=${anyEq}/${unionEq.size} all=${allEq}`);
  check("gear: the default mode is Any", (await gt("/equipment?fx=aturdir&fx=curaci%C3%B3n")) === anyEq);
  const eB = await gt("/equipment?fx=aumento+de+agilidad");
  const eAny = await gt("/equipment?fx=aturdir&fx=aumento+de+agilidad&fxm=any");
  const eAll = await gt("/equipment?fx=aturdir&fx=aumento+de+agilidad&fxm=all");
  check("gear: Match All (stun and Agility up, different tiers) = A + B - (A or B), not empty", eAll === eA + eB - eAny && eAll > 0 && eAll <= eAny, `A=${eA} B=${eB} any=${eAny} all=${eAll}`);
  const nA = await gt("/ninjas?fx=aturdir");
  const nB = await gt("/ninjas?fx=curaci%C3%B3n");
  const nAny = await gt("/ninjas?fx=aturdir&fx=curaci%C3%B3n&fxm=any");
  const nAll = await gt("/ninjas?fx=aturdir&fx=curaci%C3%B3n&fxm=all");
  check("ninjas: Match All = A + B - (A or B), never more than Any", nAll === nA + nB - nAny && nAll <= nAny && nAny >= Math.max(nA, nB), `A=${nA} B=${nB} any=${nAny} all=${nAll}`);
  const jA = await gt("/jewelry?fx=aturdir");
  const jB = await gt("/jewelry?fx=eliminar+debuffs");
  const jAny = await gt("/jewelry?fx=aturdir&fx=eliminar+debuffs&fxm=any");
  const jAll = await gt("/jewelry?fx=aturdir&fx=eliminar+debuffs&fxm=all");
  check("jewelry: Match All = A + B - (A or B)", jAll === jA + jB - jAny && jAll <= jAny, `A=${jA} B=${jB} any=${jAny} all=${jAll}`);
  check("gear: duplicate and synonymous selections count once", (await gt("/equipment?fx=aturdir&fx=stun&fx=ATURDIR&fxm=all")) === eA);
  check("gear: combined with a statistic range and a tier (AND)", (await gt("/equipment?fx=aumento+de+agilidad&stat1=speed&min1=70000&tier=6")) <= eB);
  await go(A.page, BASE + "/equipment?fx=aumento+de+velocidad&fx=aumento+de+agilidad&fxm=all&sort=name:desc");
  const pagerHref = await A.page.locator("nav[aria-label='Paginación'] a").first().getAttribute("href").catch(() => null);
  check("gear: paging links keep the effects and the mode", pagerHref === null || (/fxm=all/.test(pagerHref) && /fx=/.test(pagerHref)), String(pagerHref));
  check("gear: the selected mode is shown and checked, and survives a reload", (await A.page.locator("input[name=fxm][value=all]").isChecked()) && /todos los efectos elegidos/.test(await A.page.locator("[data-effect-mode-note]").innerText()));
  await A.page.reload({ waitUntil: "networkidle" });
  check("gear: reloading keeps the mode", await A.page.locator("input[name=fxm][value=all]").isChecked());
  const clearLink = A.page.getByRole("link", { name: /Quitar filtros/ }).first();
  check("gear: clearing the filters keeps the chosen mode", (await clearLink.getAttribute("href")) === "/equipment?fxm=all", String(await clearLink.getAttribute("href")));
  await go(A.page, BASE + "/sets/jewelry/sand-burial-r1");
  const r1 = await A.page.locator("main").innerText();
  check("gear: Sand Burial R1 detail shows title, client-stated label, sibling versions and tiers", /Sand Burial R1/.test(r1) && /indicada por el cliente/.test(r1) && /Otras versiones/.test(r1) && /8 piezas|2 piezas/.test(r1));
  check("gear: set tiers are never labelled always active, and jewelry tiers name their category", !/Siempre activo/.test(r1) && /2 piezas de «Force»/.test(r1), "");
  await go(A.page, BASE + "/sets/equipment/warlord");
  const wl = await A.page.locator("main").innerText();
  check("gear: Warlord detail shows upgrade costs as costs, not bonuses", /Costes de mejora/.test(wl) && /Warlord myth - 170/.test(wl) && /No son bonificaciones de combate/.test(wl));
  await go(A.page, BASE + "/sets/equipment/mekansm");
  check("gear: Mekansm shows the source title MEKA", /MEKA/.test(await A.page.locator("main").innerText()));
  const allowedPrefixes = await db.sourceAsset.count({ where: { path: { startsWith: "gear-source/" } } });
  check("gear: 143 source sheets are registered as private provenance", allowedPrefixes === 143, `${allowedPrefixes}`);
  const leak = await fetch(BASE + "/gear-source/sources/01_akatsuki/01_gear.png", { redirect: "manual" });
  check("gear: source sheets are not served publicly", leak.status !== 200, String(leak.status));

  const SP = A.page;
  // ── sorting by the value of the selected effect ──
  const CCQ = "aumento+de+tasa+de+control";
  const AGQ = "aumento+de+agilidad";
  const ccRows = await db.effect.findMany({ where: { statistic: { key: "control-rate" }, kind: "STAT", structuredStatus: "STRUCTURED", valueType: "PERCENT", value: { gt: 0 }, OR: [{ equipmentSetBonus: { set: { familyId: { not: null } } } }, { jewelrySetBonus: { set: { familyId: { not: null } } } }] }, select: { value: true, equipmentSetBonus: { select: { setId: true } }, jewelrySetBonus: { select: { setId: true, requiredPieces: true, group: { select: { key: true } } } } } });
  // The bonuses accumulate: equipment adds every tier; jewelry adds the slot's 2-piece bonus and the set-wide 8-piece bonus (the best slot counts).
  const eqSum = new Map();
  const jw = new Map();
  for (const r of ccRows) {
    const v = Number(r.value.toString());
    if (r.equipmentSetBonus) eqSum.set(r.equipmentSetBonus.setId, (eqSum.get(r.equipmentSetBonus.setId) ?? 0) + v);
    else {
      const b = r.jewelrySetBonus;
      const o = jw.get(b.setId) ?? { slots: new Map(), eight: 0 };
      if (b.requiredPieces === 8) o.eight += v;
      else o.slots.set(b.group.key, (o.slots.get(b.group.key) ?? 0) + v);
      jw.set(b.setId, o);
    }
  }
  const ccBest = new Map(eqSum);
  for (const [id, o] of jw) ccBest.set(id, Math.max(o.eight, ...[...o.slots.values()].map((x) => x + o.eight)));
  const ccMax = Math.max(...ccBest.values());
  const rankValues = async (pg) => (await pg.locator("[data-effect-rank][data-rank-status='ranked']").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-rank-magnitude")))));
  await go(SP, BASE + `/sets?fx=${CCQ}&sort=fx:desc`);
  const descVals = await rankValues(SP);
  check("sort by value, highest first: the top result carries the largest cumulative Control Rate total (tiers added) and values never rise", descVals.length > 5 && descVals[0] === ccMax && descVals.every((v, i) => i === 0 || descVals[i - 1] >= v), `top=${descVals[0]} max=${ccMax} shown=${descVals.length}`);
  check("the result says how it is ordered and that the tiers are added", /Ordenado de mayor a menor por el valor de/.test(await SP.locator("[data-effect-rank-note]").innerText()) && /total acumulado/i.test(await SP.locator("[data-effect-rank-note]").innerText()) && !/No se suman niveles/.test(await SP.locator("[data-effect-rank-note]").innerText()));
  await go(SP, BASE + `/sets?fx=${CCQ}&sort=fx:asc`);
  const ascVals = await rankValues(SP);
  check("sort by value, lowest first", ascVals.length > 5 && ascVals.every((v, i) => i === 0 || ascVals[i - 1] <= v), ascVals.slice(0, 6).join(" < "));
  await go(SP, BASE + `/equipment?fx=${CCQ}&sort=fx:desc&q=susanoo`);
  const susanoo = await SP.locator("[data-gear-card] h2").allInnerTexts();
  check("Susanoo: the variant with +18% at 6 pieces ranks ahead of +15%, both with +40% at 4 pieces, and the tiers are shown apart", /variante B/.test(susanoo[0] ?? "") && /variante A/.test(susanoo[1] ?? "") && /6 piezas: \+18%/.test(await SP.locator("[data-effect-rank]").first().innerText()) && /4 piezas: \+40%/.test(await SP.locator("[data-effect-rank]").first().innerText()), susanoo.join(" | "));
  const wholeDesc = await (async () => { const seen = []; for (let n = 1; n <= 12; n++) { await go(SP, BASE + `/sets?fx=${AGQ}&sort=fx:desc&page=${n}`); seen.push(...(await SP.locator("[data-gear-card] h2 a").evaluateAll((els) => els.map((e) => e.getAttribute("href"))))); } return seen; })();
  const ccTotal = await total(SP, "/sets?fx=" + AGQ);
  check("paging a value sort shows each set once and none missing", wholeDesc.length === ccTotal && new Set(wholeDesc).size === wholeDesc.length, `${wholeDesc.length}/${ccTotal}`);
  await go(SP, BASE + `/sets?fx=${AGQ}&sort=fx:desc&page=2`);
  check("paging links keep the value sort", /sort=fx(%3A|:)desc/.test((await SP.locator("nav[aria-label='Paginación'] a[href*='page=3']").first().getAttribute("href", { timeout: 5000 }).catch(() => "")) ?? ""));
  const page2first = await SP.locator("[data-gear-card] h2 a").first().getAttribute("href");
  await SP.goBack({ waitUntil: "networkidle" }).catch(() => {});
  await SP.goForward({ waitUntil: "networkidle" }).catch(() => {});
  check("back and forward keep the same ordered page", (await SP.locator("[data-gear-card] h2 a").first().getAttribute("href")) === page2first && /sort=fx:desc/.test(decodeURIComponent(SP.url())));
  await SP.reload({ waitUntil: "networkidle" });
  check("reloading keeps the value sort", (await SP.locator("[data-gear-card] h2 a").first().getAttribute("href")) === page2first);
  // two selected effects: the sorting effect is chosen explicitly
  await go(SP, BASE + `/equipment?fx=congelar&fx=${CCQ}&fxm=any&sort=fx:desc&fxs=${CCQ.replace(/\+/g, "%20")}`);
  const chosen = await SP.locator("select#fxs").inputValue();
  const viaChosen = await rankValues(SP);
  await go(SP, BASE + `/equipment?fx=congelar&fx=${CCQ}&fxm=any&sort=fx:desc`);
  const viaFirst = await rankValues(SP);
  check("with two effects the chosen one orders the list; by default the first selected effect does", chosen === CCQ.replace(/\+/g, " ") && viaChosen.length > 3 && viaFirst.length === 0 && (await SP.locator("select#fxs").inputValue()) === "congelar", `chosen=${viaChosen.length} first=${viaFirst.length}`);
  check("with a single effect there is no choice of ordering effect", (await (async () => { await go(SP, BASE + `/equipment?fx=${CCQ}`); return SP.locator("select#fxs").count(); })()) === 0);
  await go(SP, BASE + `/equipment?fx=${CCQ}&sort=fx:desc`);
  const opts = await SP.locator("select[name=sort] option").allInnerTexts();
  check("the sort control offers the value order next to the existing orders", opts.some((o) => /Valor del efecto elegido: de mayor a menor/.test(o)) && opts.some((o) => /Nombre: de la A a la Z/.test(o)));
  const un = await total(SP, `/equipment?fx=${CCQ}`);
  check("sorting by value does not change which sets are found", (await total(SP, `/equipment?fx=${CCQ}&sort=fx:desc`)) === un && (await total(SP, `/equipment?fx=${CCQ}&sort=name:asc`)) === un);
  check("Match All and a printed-statistic range still filter a value sort", (await total(SP, `/equipment?fx=${CCQ}&fx=aumento+de+agilidad&fxm=all&sort=fx:desc`)) <= un && (await total(SP, `/equipment?fx=${CCQ}&stat1=speed&min1=70000&sort=fx:desc`)) <= un);
  await go(SP, BASE + "/equipment?fx=zzzxxyy&sort=fx:desc");
  check("an effect nobody has gives the empty message when sorting by value", /Ningún conjunto tiene/.test(await SP.locator("main").innerText()));
  // the reduction of the enemy's control rate is its own effect
  await go(SP, BASE + "/sets?fx=reducci%C3%B3n+de+tasa+de+control&sort=fx:desc");
  const redVals = await rankValues(SP);
  check("a reduction of the enemy's control rate is ordered by its own size and never mixed with the increases", redVals.length > 3 && redVals.every((v, i) => i === 0 || redVals[i - 1] >= v) && !(await SP.locator("main").innerText()).includes("Increase CC Rate"), redVals.slice(0, 4).join(","));
  // ninjas
  const nx = await total(SP, `/ninjas?fx=aumento+de+velocidad`);
  await go(SP, BASE + "/ninjas?fx=aumento+de+velocidad&sort=fx:desc");
  const nVals = await rankValues(SP);
  check("ninjas: the value sort lists the largest Speed increase first and never rises", nVals.length > 10 && nVals.every((v, i) => i === 0 || nVals[i - 1] >= v), `${nVals.slice(0, 5).join(",")} of ${nx}`);
  check("ninjas: sorting by value keeps the count", (await total(SP, "/ninjas?fx=aumento+de+velocidad&sort=fx:desc")) === nx);
  const SM = await login(adminMail, adminPw, 390);
  await go(SM.page, BASE + `/sets?fx=${CCQ}&fx=congelar&sort=fx:desc`);
  const smo = await SM.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const smSel = await SM.page.locator("select#fxs").boundingBox();
  const smRank = await SM.page.locator("[data-effect-rank]").first().boundingBox();
  check("390 px: the value sort, the choice of ordering effect and the values fit the screen without sideways scrolling", smo <= 0 && smSel && smSel.x >= 0 && smSel.x + smSel.width <= 390 && smRank && smRank.x + smRank.width <= 390, `${smo}px`);
  await SM.ctx.close();

  // ── exact piece counts, jewelry slots and the 8-piece bonus under a 2-piece result ──
  const CCQ2 = "aumento+de+tasa+de+control";
  const DMQ = "aumento+de+tasa+de+da%C3%B1o";
  const pctRows = (statKey) => db.effect.findMany({ where: { statistic: { key: statKey }, kind: "STAT", structuredStatus: "STRUCTURED", valueType: "PERCENT", value: { gt: 0 }, jewelrySetBonusId: { not: null }, jewelrySetBonus: { set: { familyId: { not: null } } } }, select: { value: true, jewelrySetBonus: { select: { setId: true, requiredPieces: true, group: { select: { key: true } } } } } });
  const jewelOracle = async (statKey, slot) => {
    const two = new Map();
    const eight = new Map();
    for (const r of await pctRows(statKey)) {
      const b = r.jewelrySetBonus;
      const v = Number(r.value.toString());
      if (b.requiredPieces === 2 && b.group?.key === slot) two.set(b.setId, (two.get(b.setId) ?? 0) + v);
      if (b.requiredPieces === 8) eight.set(b.setId, (eight.get(b.setId) ?? 0) + v);
    }
    return { two, eight, stronger: [...two].filter(([id]) => (eight.get(id) ?? 0) > 0).length };
  };
  const eqDebug = [];
  const equipOracle = async (tier) => {
    const rows = await db.effect.findMany({ where: { statistic: { key: "control-rate" }, kind: "STAT", structuredStatus: "STRUCTURED", valueType: "PERCENT", value: { gt: 0 }, equipmentSetBonus: { requiredPieces: { lte: tier }, set: { familyId: { not: null } } } }, select: { equipmentSetBonus: { select: { setId: true } } } });
    eqDebug.push(`${tier}:${rows.map((r) => String(r.value)).join("/")}`);
    return new Set(rows.map((r) => r.equipmentSetBonus.setId)).size;
  };
  // the controls
  await go(SP, BASE + "/jewelry");
  const slotLabels = await SP.locator("[data-radio-group=slot] label").evaluateAll((els) => els.map((e) => e.textContent ?? ""));
  const jTiers = await SP.locator("input[name=tier]").evaluateAll((els) => els.map((e) => e.value));
  check("jewelry has an obvious slot choice (Todas, Fuerza, Chakra, Agilidad, Poder), one at a time, and the 2 and 8 piece bonus tiers", ["Todas", "Fuerza", "Chakra", "Agilidad", "Poder"].every((l) => slotLabels.some((x) => x.trim() === l)) && (await SP.locator("input[name=slot]").first().getAttribute("type")) === "radio" && jTiers.join() === "2,8", `${slotLabels.join("|")} tiers=${jTiers}`);
  await go(SP, BASE + "/equipment");
  check("equipment offers the 2, 4 and 6 piece tiers and no slot choice", (await SP.locator("input[name=tier]").evaluateAll((els) => els.map((e) => e.value))).join() === "2,4,6" && (await SP.locator("[data-radio-group=slot]").count()) === 0);
  // equipment: the selected piece count is exact
  const eqCounts = [];
  for (const tier of [2, 4, 6]) eqCounts.push([await total(SP, `/equipment?fx=${CCQ2}&tier=${tier}`), await equipOracle(tier)]);
  check("equipment: Control Rate with 2, 4 and 6 pieces returns the catalogue sets that have it at that tier or a lower one, and none that has it only at a higher tier", eqCounts.every(([shown, stored]) => shown === stored) && eqCounts.some(([, stored]) => stored > 0), JSON.stringify(eqCounts) + " " + eqDebug.map((d) => d.slice(0, 40)).join(";"));
  await go(SP, BASE + `/equipment?fx=${CCQ2}&tier=2`);
  check("equipment: a 2-piece search with nothing printed at 2 pieces says so instead of listing 4 and 6 piece sets", eqCounts[0][1] > 0 || /Ningún conjunto tiene/.test(await SP.locator("main").innerText()));
  await go(SP, BASE + `/equipment?fx=${CCQ2}&tier=6&sort=fx:desc`);
  const e6 = await SP.locator("[data-effect-rank][data-rank-status='ranked'] [data-match-value]").allInnerTexts();
  check("equipment: results name the piece count and show the accumulated total for it", e6.length > 3 && e6.every((t) => /6 piezas/.test(t)), e6.slice(0, 2).join(" / ").replace(/\s+/g, " "));
  // the client's scenario
  const ccAg = await jewelOracle("control-rate", "agility");
  const SCN = `/jewelry?slot=agility&tier=2&fx=${CCQ2}&sort=fx:desc`;
  await go(SP, BASE + SCN);
  const agVals = (await SP.locator("[data-effect-rank][data-rank-status='ranked']").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-rank-magnitude")))));
  const matchText = await SP.locator("[data-match-value]").allInnerTexts();
  check("Joyería + Agilidad + 2 piezas + Control Rate + mayor a menor: exactly the sets whose stored Agility 2-piece bonus has it, highest first", agVals.length === ccAg.two.size && agVals.length > 5 && agVals[0] === Math.max(...ccAg.two.values()) && agVals.every((v, i) => i === 0 || agVals[i - 1] >= v), `${agVals.join(",")} stored=${ccAg.two.size}`);
  check("every result shows the exact percentage prominently with its tier and slot, and none comes from Fuerza, Chakra or Poder", matchText.length === agVals.length && matchText.every((t) => /2 piezas/.test(t) && /Agilidad/.test(t) && !/Fuerza|Chakra|Poder/.test(t)), matchText.slice(0, 2).join(" / ").replace(/\s+/g, " "));
  const noSlotTotal = await total(SP, `/jewelry?tier=2&fx=${CCQ2}`);
  const forceTotal = await total(SP, `/jewelry?slot=force&tier=2&fx=${CCQ2}`);
  check("choosing a slot narrows the result and the slot is enforced by the query (URL, reload and back keep it)", (await total(SP, SCN)) <= noSlotTotal && forceTotal <= noSlotTotal && (await total(SP, SCN)) === (await total(SP, `/jewelry?slot=agility&tier=2&fx=${CCQ2}`)), `agility<=${noSlotTotal} force=${forceTotal}`);
  await go(SP, BASE + SCN);
  const firstScn = await SP.locator("[data-gear-card] h2 a").first().getAttribute("href");
  await go(SP, BASE + "/jewelry");
  await SP.goBack({ waitUntil: "networkidle" });
  check("back keeps the slot, tier, effect and order", /slot=agility/.test(SP.url()) && (await SP.locator("[data-gear-card] h2 a").first().getAttribute("href")) === firstScn && (await SP.locator("input[name=slot][value=agility]").isChecked()));
  await SP.reload({ waitUntil: "networkidle" });
  check("reloading keeps them", (await SP.locator("input[name=slot][value=agility]").isChecked()) && (await SP.locator("input[name=tier][value='2']").isChecked()));
  check("clearing the filters removes the slot and the effects", /^\/jewelry(\?|$)/.test((await SP.getByRole("link", { name: /Quitar filtros/ }).first().getAttribute("href")) ?? "") && !/slot=|fx=/.test((await SP.getByRole("link", { name: /Quitar filtros/ }).first().getAttribute("href")) ?? ""));
  // the 8-piece bonus
  const fullBlocks = await SP.locator("[data-full-set]").count();
  const fullText = await SP.locator("[data-full-set]").first().innerText();
  check("under every 2-piece result that has one, the set's 8-piece bonus is shown separately and says it needs the full set", fullBlocks > 3 && /Bono de 8 piezas/.test(fullText) && /Requiere el conjunto completo/.test(fullText) && !/No se indica que los bonos se sumen/.test(fullText), `blocks=${fullBlocks}`);
  const strongCc = await SP.locator("[data-full-set-stronger]").count();
  check("the «stronger» note appears exactly where the set prints an 8-piece Control Rate to add (Control Rate, Agility)", strongCc === ccAg.stronger, `shown=${strongCc} stored=${ccAg.stronger}`);
  const dm = await jewelOracle("damage-rate", "agility");
  await go(SP, BASE + `/jewelry?slot=agility&tier=2&fx=${DMQ}&sort=fx:desc`);
  const strongDm = await SP.locator("[data-full-set-stronger]").count();
  const cmp = await SP.locator("[data-full-set-compare]").first().innerText().catch(() => "");
  check("a genuinely stronger 8-piece value is pointed out with both values (Damage Rate, Agility)", strongDm === dm.stronger && dm.stronger > 0 && /2 piezas/.test(cmp) && /8 piezas/.test(cmp) && /ofrece un bono mayor/.test(await SP.locator("[data-full-set-stronger]").first().innerText()), `shown=${strongDm} stored=${dm.stronger}`);
  // 8-piece search
  const e8 = await total(SP, `/jewelry?tier=8&fx=reducci%C3%B3n+de+tasa+de+control&sort=fx:desc`);
  const e2 = await total(SP, `/jewelry?tier=2&fx=reducci%C3%B3n+de+tasa+de+control`);
  await go(SP, BASE + `/jewelry?tier=8&fx=reducci%C3%B3n+de+tasa+de+control&sort=fx:desc`);
  check("an 8-piece search counts the complete set: every result shows the total with 8 piezas and no «stronger» note (the 8-piece bonus is already in it)", e8 >= e2 && e8 > 0 && (await SP.locator("[data-match-value]").allInnerTexts()).every((t) => /con 8 piezas/.test(t)) && (await SP.locator("[data-full-set-stronger]").count()) === 0, `8pc=${e8} 2pc=${e2}`);
  // Match All / Any inside the scope, and choosing the sorting effect
  const anyN = await total(SP, `/jewelry?slot=agility&tier=2&fx=${CCQ2}&fx=aumento+de+tasa+de+da%C3%B1o&fxm=any`);
  const allN = await total(SP, `/jewelry?slot=agility&tier=2&fx=${CCQ2}&fx=aumento+de+tasa+de+da%C3%B1o&fxm=all`);
  const a1 = await total(SP, `/jewelry?slot=agility&tier=2&fx=${CCQ2}`);
  const a2 = await total(SP, `/jewelry?slot=agility&tier=2&fx=${DMQ}`);
  check("Match Any / Match All apply inside the selected slot and tier (All = A + B - Any)", allN === a1 + a2 - anyN && allN <= anyN && a1 > 0, `A=${a1} B=${a2} any=${anyN} all=${allN}`);
  await go(SP, BASE + `/jewelry?slot=agility&tier=2&fx=${CCQ2}&fx=${DMQ}&fxm=any&sort=fx:desc&fxs=${DMQ.replace(/%C3%B1/g, "%C3%B1")}`);
  const sortSel = await SP.locator("select#fxs").inputValue();
  check("with several effects the one that decides the order can be chosen", /da.o/.test(sortSel) && (await SP.locator("select#fxs option").count()) === 2, sortSel);

  // ── cumulative bonuses (confirmed by the client): Deatbone, Damage Rate +30% at 2 pieces and +40% at 6 pieces make +70% with 6 pieces ──
  const DMG6 = `/equipment?fx=${DMQ}&tier=6&q=deatbone&sort=fx:desc`;
  const drRows = await db.effect.findMany({ where: { statistic: { key: "damage-rate" }, kind: "STAT", structuredStatus: "STRUCTURED", valueType: "PERCENT", value: { gt: 0 }, equipmentSetBonus: { set: { familyId: { not: null } } } }, select: { value: true, equipmentSetBonus: { select: { setId: true, requiredPieces: true, set: { select: { slug: true } } } } } });
  const drTotals = (tier) => {
    const m = new Map();
    for (const r of drRows) if (r.equipmentSetBonus.requiredPieces <= tier) m.set(r.equipmentSetBonus.setId, (m.get(r.equipmentSetBonus.setId) ?? 0) + Number(r.value.toString()));
    return m;
  };
  const deat = drRows.filter((r) => r.equipmentSetBonus.set.slug === "deatbone").map((r) => [r.equipmentSetBonus.requiredPieces, Number(r.value.toString())]);
  await go(SP, BASE + DMG6);
  const deatText = (await SP.locator("[data-gear-card]", { hasText: "Deatbone" }).first().innerText()).replace(/\s+/g, " ");
  check("Deatbone is stored with Damage Rate +30% at 2 pieces and +40% at 6 pieces", JSON.stringify(deat.sort((a, b) => a[0] - b[0])) === JSON.stringify([[2, 30], [6, 40]]), JSON.stringify(deat));
  check("Deatbone with 6 pieces: «Total acumulado con 6 piezas: +70%» with the breakdown 2 piezas +30% and 6 piezas +40%", /Total acumulado con 6 piezas: \+70%/.test(deatText) && /Desglose por piezas/.test(deatText) && /2 piezas: \+30%/.test(deatText) && /6 piezas: \+40%/.test(deatText) && /Bonos individuales/.test(deatText), deatText.slice(0, 40));
  check("the card says nothing about stacking being unconfirmed", !/no est(a|á) confirmado|no se suman/i.test(deatText));
  const sixTotals = drTotals(6);
  await go(SP, BASE + `/equipment?fx=${DMQ}&tier=6&sort=fx:desc`);
  const sixPage = await rankValues(SP);
  const sortedOracle = [...sixTotals.values()].sort((a, b) => b - a);
  check("equipment, 6 pieces, Damage Rate, highest first: every total is the sum of the stored tiers up to 6 and the order never rises", sixPage.length > 10 && sixPage.every((v, i) => v === sortedOracle[i]) && sixPage[0] === Math.max(...sixTotals.values()), `${sixPage.slice(0, 6).join(",")} oracle=${sortedOracle.slice(0, 6).join(",")}`);
    const drShown = [await total(SP, `/equipment?fx=${DMQ}&tier=2`), await total(SP, `/equipment?fx=${DMQ}&tier=4`), await total(SP, `/equipment?fx=${DMQ}&tier=6`)];
  const drOracle = [drTotals(2).size, drTotals(4).size, sixTotals.size];
  check("the number of sets found with 2, 4 and 6 pieces is the sets that have Damage Rate at that tier or a lower one (plus the few that only word it, labelled)", drShown.every((n, i) => n >= drOracle[i] && n <= drOracle[i] + 3) && drShown[0] < drShown[2], `shown ${drShown} stored ${drOracle}`);
  await go(SP, BASE + `/equipment?fx=${DMQ}&tier=2&q=deatbone`);
  check("with 2 pieces Deatbone shows +30% and not the 6-piece bonus", /Total acumulado con 2 piezas: \+30%/.test((await SP.locator("[data-gear-card]", { hasText: "Deatbone" }).first().innerText()).replace(/\s+/g, " ")));
  await go(SP, BASE + `/equipment?fx=${DMQ}&tier=6&q=deatbone&sort=fx:asc&page=1`);
  check("ascending order keeps the same totals", /\+70%/.test(await SP.locator("main").innerText()));
  await go(SP, BASE + "/sets/equipment/deatbone");
  const detailText = (await SP.locator("main").innerText()).replace(/\s+/g, " ");
  const detailTotal = SP.locator('[data-set-total][data-total-key="stat:damage-rate|PERCENT|self|+"][data-total-pieces="6"]');
  check("the Deatbone page shows Bonos individuales, Total acumulado and Desglose por piezas, and agrees with the card: Damage Rate +70% with 6 piezas", (await detailTotal.count()) === 1 && (await detailTotal.getAttribute("data-total-value")) === "70" && /Bonos individuales/.test(detailText) && /Total acumulado/.test(detailText) && /Desglose por piezas/.test(detailText) && /Total acumulado con 6 piezas/.test(detailText), detailText.slice(0, 60));
  check("the Deatbone page breakdown lists 2 piezas +30% and 6 piezas +40%", /2 piezas: \+30%/.test((await detailTotal.innerText()).replace(/\s+/g, " ")) && /6 piezas: \+40%/.test((await detailTotal.innerText()).replace(/\s+/g, " ")));
  check("no page says that stacking is unconfirmed", !/no est(a|á) confirmado si los niveles/i.test(detailText) && (await SP.locator("[data-stacking-unknown]").count()) === 0);
  await go(SP, BASE + "/sets/jewelry/sand-burial-r1");
  check("a jewelry set page shows Bonos individuales and Total acumulado too", (await SP.locator("[data-set-totals]").count()) === 1 && /Bonos individuales/.test(await SP.locator("main").innerText()));
  const TD = await login(adminMail, adminPw, 390);
  for (const u of [DMG6, "/sets/equipment/deatbone"]) {
    await go(TD.page, BASE + u);
    const o = await TD.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const box = await TD.page.locator("[data-match-value], [data-set-total]").first().boundingBox();
    check(`390 px: ${u.split("?")[0]} fits without sideways scrolling`, o <= 0 && box && box.x + box.width <= 390, `${o}px`);
  }
  await TD.ctx.close();

  // mobile
  const TM = await login(adminMail, adminPw, 390);
  await go(TM.page, BASE + SCN);
  const tmo = await TM.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const tmSlot = await TM.page.locator("[data-radio-group=slot]").boundingBox();
  const tmVal = await TM.page.locator("[data-match-value]").first().boundingBox();
  const tmFull = await TM.page.locator("[data-full-set]").first().boundingBox();
  check("390 px: the slot choice, the prominent value and the 8-piece bonus fit without sideways scrolling", tmo <= 0 && tmSlot && tmSlot.x + tmSlot.width <= 390 && tmVal && tmVal.x + tmVal.width <= 390 && tmFull && tmFull.x + tmFull.width <= 390, `${tmo}px`);
  await TM.ctx.close();

  // screenshots (real, from the live site)
  await go(A.page, BASE + "/ninjas?rating=SSR&formation=center&sort=stat:desc:force");
  await shot(A.page, "p01-live-results.png", { x: 0, y: 0, width: 1600, height: 1500 });
  await go(A.page, BASE + "/search?q=Shodai");
  await shot(A.page, "p02-live-search.png", { x: 0, y: 0, width: 1600, height: 520 });
  await A.ctx.close();
  const R = await login(adminMail, adminPw, 960);
  await go(R.page, BASE + "/ninjas/natsu-dragneel");
  await shot(R.page, "p03-live-natsu.png", { x: 0, y: 0, width: 960, height: 1150 });
  await around(R.page, "/ninjas/natsu-dragneel", /Fire Dragon's Talon/, "p04-live-natsu-talent2.png", 800, 40);
  await around(R.page, "/ninjas/natsu-dragneel", /Skill Awakening 1/, "p05-live-natsu-skill.png", 820, 60);
  await around(R.page, "/ninjas/kimono-kurenai", /Applies the below/, "p06-live-kimono.png", 900, 40);
  await around(R.page, "/ninjas/cursed-tayuya", /Special Tayuya Card Awakening/, "p07-live-tayuya.png", 1000, 40);
  await around(R.page, "/ninjas/yamanaka-ino", /Talent Awakening 2/, "p08-live-ino-rule.png", 700, 40);
  await go(R.page, BASE + "/ninjas?formation=support");
  const y = await R.page.evaluate(() => { const el = document.querySelector("[data-result-count]"); return el ? el.getBoundingClientRect().top + window.scrollY : 0; });
  await shot(R.page, "p09-live-supporters.png", { x: 0, y: Math.max(0, y - 40), width: 960, height: 950 });
  // live screenshots of the effect search (desktop 960 px)
  const region = async (page, url, name, locator) => {
    await go(page, BASE + url);
    await page.addStyleTag({ content: HIDE }).catch(() => {});
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await page.locator(locator).first().screenshot({ path: path.join(OUT, name) });
  };
  const below = async (page, url, name, height) => {
    await go(page, BASE + url);
    const y = await page.evaluate(() => { const el = document.querySelector("[data-result-count]"); return el ? el.getBoundingClientRect().top + window.scrollY : 0; });
    await shot(page, name, { x: 0, y: Math.max(0, y - 20), width: 960, height }, true);
  };
  await region(R.page, "/ninjas?fx=aturdir", "p12-live-effect-control.png", "[data-effect-search]");
  await below(R.page, "/ninjas?fx=aturdir", "p13-live-effect-results.png", 760);
  await region(R.page, "/ninjas?fx=inmunidad+a+aturdir", "p14-live-effect-immunity-control.png", "[data-effect-search]");
  await below(R.page, "/ninjas?fx=inmunidad+a+aturdir", "p15-live-effect-immunity-results.png", 560);
  await region(R.page, "/ninjas?fx=aumento+de+velocidad&stat1=hp&min1=100000&rating=SSR", "p16-live-combined-filters.png", "[data-filter-panel] form");
  await below(R.page, "/ninjas?fx=aumento+de+velocidad&stat1=hp&min1=100000&rating=SSR", "p17-live-combined-results.png", 700);
  // gear screenshots (desktop 960 px and 390 px)
  await region(R.page, "/equipment?fx=aturdir&fx=aumento+de+agilidad&fxm=all", "p20-live-gear-effect-control.png", "[data-effect-search]");
  await below(R.page, "/equipment?fx=aturdir&fx=aumento+de+agilidad&fxm=all", "p21-live-gear-all-results.png", 520);
  await below(R.page, "/equipment?fx=aturdir&fx=aumento+de+agilidad&fxm=any", "p22-live-gear-any-results.png", 700);
  await below(R.page, "/sets?q=warlord", "p23-live-gear-warlord.png", 560);
  await below(R.page, "/sets?q=sand+burial", "p24-live-gear-sand-burial.png", 560);
  await go(R.page, BASE + "/sets/jewelry/sand-burial-r1");
  await shot(R.page, "p25-live-gear-detail-r1.png", { x: 0, y: 0, width: 960, height: 1250 });
  await go(R.page, BASE + "/sets/equipment/warlord");
  await shot(R.page, "p26-live-gear-detail-warlord.png", { x: 0, y: 0, width: 960, height: 1300 });
  await below(R.page, "/sets?q=sange", "p27-live-gear-variants.png", 640);
  // value sort screenshots: Control Rate, highest to lowest
  const fromNote = async (page, url, name, height, width = 960) => {
    await go(page, BASE + url);
    await page.addStyleTag({ content: HIDE }).catch(() => {});
    const y = await page.evaluate(() => { const el = document.querySelector("[data-effect-rank-note]"); return el ? el.getBoundingClientRect().top + window.scrollY : 0; });
    await shot(page, name, { x: 0, y: Math.max(0, y - 8), width, height }, true);
  };
  await fromNote(R.page, "/sets?fx=aumento+de+tasa+de+control&sort=fx:desc", "p30-live-sort-cc-desc.png", 1280);
  await fromNote(R.page, "/jewelry?fx=aumento+de+tasa+de+control&sort=fx:desc", "p31-live-sort-cc-jewelry.png", 900);
  await fromNote(R.page, "/sets?fx=aumento+de+tasa+de+control&sort=fx:asc", "p32-live-sort-cc-asc.png", 760);
  await fromNote(R.page, "/equipment?fx=aumento+de+tasa+de+control&q=susanoo&sort=fx:desc", "p33-live-sort-susanoo.png", 760);
  await region(R.page, "/equipment?fx=congelar&fx=aumento+de+tasa+de+control&sort=fx:desc&fxs=aumento+de+tasa+de+control", "p34-live-sort-choose-effect.png", "[data-effect-search]");
  // final filtering corrections: exact piece counts, jewelry slot, 8-piece bonus
  await fromNote(R.page, "/equipment?fx=aumento+de+tasa+de+da%C3%B1o&tier=2&sort=fx:desc", "p36-live-equipment-2-pieces.png", 900);
  await around(R.page, "/equipment?fx=aumento+de+tasa+de+control&tier=2", /Ningún conjunto tiene/, "p37-live-equipment-2-pieces-none.png", 200, 30);
  await region(R.page, "/jewelry?slot=agility&tier=2&fx=aumento+de+tasa+de+control&sort=fx:desc", "p38-live-jewelry-slot-controls.png", "[data-filter-panel] form");
  await fromNote(R.page, "/jewelry?slot=agility&tier=2&fx=aumento+de+tasa+de+control&sort=fx:desc", "p39-live-agility-2-pieces-desc.png", 1500);
  await region(R.page, "/jewelry?slot=agility&tier=2&fx=aumento+de+tasa+de+da%C3%B1o&sort=fx:desc", "p40-live-8-piece-stronger.png", "[data-gear-card]:has([data-full-set-stronger])");
  await fromNote(R.page, "/jewelry?slot=agility&tier=2&fx=aumento+de+tasa+de+control&fx=aumento+de+evasi%C3%B3n+de+da%C3%B1o&fxm=all&sort=fx:desc", "p41-live-match-all-slot-tier.png", 900);
  // cumulative bonuses: Deatbone, Damage Rate +30% (2 pieces) + +40% (6 pieces) = +70% with 6 pieces
  await region(R.page, "/equipment?fx=aumento+de+tasa+de+da%C3%B1o&tier=6&q=deatbone&sort=fx:desc", "p44-live-deatbone-cumulative.png", "[data-gear-card]");
  await region(R.page, "/sets/equipment/deatbone", "p45-live-deatbone-detail-totals.png", "[data-set-totals]");
  await region(R.page, "/sets/equipment/deatbone", "p46-live-deatbone-detail-individual.png", "[data-individual-bonuses]");
  await fromNote(R.page, "/equipment?fx=aumento+de+tasa+de+da%C3%B1o&tier=6&sort=fx:desc", "p47-live-cumulative-sort-damage-rate.png", 900);
  await go(R.page, BASE + "/admin/ninjas/natsu-dragneel");
  await shot(R.page, "p10-live-admin.png", { x: 0, y: 0, width: 960, height: 1100 });
  await R.ctx.close();
  const M = await login(adminMail, adminPw, 390);
  for (const p of ["/ninjas", "/ninjas/natsu-dragneel", "/search?q=gai", "/admin"]) {
    await go(M.page, BASE + p);
    const overflow = await M.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`no horizontal scrolling at 390 px on ${p}`, overflow <= 0, `${overflow}px`);
  }
  await go(M.page, BASE + "/ninjas?fx=aturdir");
  const ovf = await M.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const fxBox = await M.page.locator("input#fx").boundingBox();
  check("live 390 px: effect search has no horizontal scroll and its field fits", ovf <= 0 && fxBox && fxBox.x >= 0 && fxBox.x + fxBox.width <= 390, `${ovf}px ${JSON.stringify(fxBox)}`);
  await M.page.addStyleTag({ content: HIDE }).catch(() => {});
  await M.page.locator("[data-effect-search]").first().screenshot({ path: path.join(OUT, "p18-live-effect-mobile.png") });
  const yM = await M.page.evaluate(() => { const el = document.querySelector("[data-result-count]"); return el ? el.getBoundingClientRect().top + window.scrollY : 0; });
  await shot(M.page, "p19-live-effect-mobile-results.png", { x: 0, y: Math.max(0, yM - 20), width: 390, height: 700 }, true);
  await go(M.page, BASE + "/ninjas/natsu-dragneel");
  await shot(M.page, "p11-live-mobile.png", { x: 0, y: 0, width: 390, height: 900 }, false);
  await go(M.page, BASE + "/equipment?fx=aturdir&fxm=all");
  const gm = await M.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("gear 390 px: the effect search with Match All has no horizontal scrolling", gm <= 0, `${gm}px`);
  await M.page.addStyleTag({ content: HIDE }).catch(() => {});
  await M.page.locator("[data-effect-search]").first().screenshot({ path: path.join(OUT, "p28-live-gear-mobile-control.png") });
  const yG = await M.page.evaluate(() => { const el = document.querySelector("[data-result-count]"); return el ? el.getBoundingClientRect().top + window.scrollY : 0; });
  await shot(M.page, "p29-live-gear-mobile-results.png", { x: 0, y: Math.max(0, yG - 20), width: 390, height: 700 }, true);
  await fromNote(M.page, "/sets?fx=aumento+de+tasa+de+control&sort=fx:desc", "p35-live-sort-cc-mobile.png", 1300, 390);
  await fromNote(M.page, "/jewelry?slot=agility&tier=2&fx=aumento+de+tasa+de+control&sort=fx:desc", "p42-live-agility-mobile.png", 1500, 390);
  await region(M.page, "/jewelry?slot=agility&tier=2&fx=aumento+de+tasa+de+control&sort=fx:desc", "p43-live-slot-mobile-control.png", "[data-filter-panel] form");
  await region(M.page, "/equipment?fx=aumento+de+tasa+de+da%C3%B1o&tier=6&q=deatbone&sort=fx:desc", "p48-live-deatbone-mobile.png", "[data-gear-card]");
  await region(M.page, "/sets/equipment/deatbone", "p49-live-deatbone-detail-mobile.png", "[data-set-totals]");
  await M.ctx.close();
} catch (e) {
  check("script completed without an unexpected error", false, String(e).slice(0, 300));
} finally {
  await browser.close();
  await cleanup();
  const after = { ninjas: await db.ninja.count(), users: await db.user.count(), abilities: await db.ability.count(), effects: await db.effect.count() };
  check("the smoke accounts were removed and no game data changed", JSON.stringify(before) === JSON.stringify(after), `before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
  await db.$disconnect();
  const failed = results.filter((r) => !r.ok);
  writeFileSync(path.join(OUT, "production-smoke.txt"), results.map((r) => `${r.ok ? "PASS" : "FAIL"} ${r.name}${r.extra ? " | " + r.extra : ""}`).join("\n") + `\n\n${results.length - failed.length} passed, ${failed.length} failed\n`);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length ? 1 : 0;
}
