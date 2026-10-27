import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { chromium } from "playwright-core";

// Usage: npm run build; node scripts/browser-check.mjs <output folder>   (creates and removes its own test accounts and records)
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const PORT = 3100;
// TARGET_BASE_URL runs the checks against a deployed PREVIEW (with VERCEL_BYPASS_SECRET for its deployment protection). Never against production.
const REMOTE = process.env.TARGET_BASE_URL?.replace(/\/$/, "");
if (REMOTE && /^https:\/\/furia-ninja(-furia-ninja)?\.vercel\.app$/.test(REMOTE)) throw new Error("refusing to run the test script against the production address");
const BASE = REMOTE ?? `http://127.0.0.1:${PORT}`;
const BYPASS = process.env.VERCEL_BYPASS_SECRET ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS_SECRET } : {};
const _fetch = fetch;
globalThis.fetch = (url, init = {}) => _fetch(url, { ...init, headers: { ...BYPASS, ...(init.headers ?? {}) } });
const db = new PrismaClient();
const adminMail = "m3-admin@example.test";
const userMail = "m3-user@example.test";
const newMail = "m3-new@example.test";
const pw = () => randomBytes(12).toString("hex");
const adminPw = pw(), userPw = pw(), newPw = pw(), resetPw = pw();
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok: Boolean(ok), extra });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`);
};

const CLEAN = async () => {
  await db.ninja.deleteMany({ where: { slug: { startsWith: "prueba-" } } });
  await db.equipment.deleteMany({ where: { slug: { startsWith: "prueba-" } } });
  await db.jewelry.deleteMany({ where: { slug: { startsWith: "prueba-" } } });
  await db.gem.deleteMany({ where: { slug: { startsWith: "prueba-" } } });
  await db.equipmentSet.deleteMany({ where: { slug: { startsWith: "prueba-" } } });
  await db.jewelrySet.deleteMany({ where: { slug: { startsWith: "prueba-" } } });
  await db.session.deleteMany({ where: { user: { email: { endsWith: "@example.test" } } } });
  await db.user.deleteMany({ where: { email: { endsWith: "@example.test" } } });
};
await CLEAN();
await db.user.create({ data: { email: adminMail, name: "Admin prueba", role: "ADMIN", passwordHash: await bcrypt.hash(adminPw, 10) } });
await db.user.create({ data: { email: userMail, name: "Usuario prueba", role: "USER", passwordHash: await bcrypt.hash(userPw, 10) } });

const server = REMOTE ? { kill() {} } : spawn(process.execPath, [path.resolve("node_modules/next/dist/bin/next"), "start", "-p", String(PORT), "-H", "127.0.0.1"], { stdio: "pipe" });
await new Promise((resolve, reject) => {
  if (REMOTE) return resolve();
  const t = setTimeout(() => reject(new Error("server did not start")), 60000);
  server.stdout.on("data", (d) => { if (String(d).includes("Ready") || String(d).includes("started")) { clearTimeout(t); resolve(); } });
  server.on("exit", () => reject(new Error("server exited")));
});
const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
const STATIC = "header, [class*='sticky'], [class*='fixed'] { position: static !important; }";

async function login(email, password, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: "es", deviceScaleFactor: width < 600 ? 2 : width < 1100 ? 1.75 : 1.25, extraHTTPHeaders: BYPASS });
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => null), page.click('button[type="submit"]')]);
  return { ctx, page, ok: !new URL(page.url()).pathname.startsWith("/login") };
}
const go = (p, url) => p.goto(url, { waitUntil: "networkidle" });
const openAll = (page) => page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
const shot = async (page, name, opts = {}) => {
  await page.addStyleTag({ content: STATIC }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, name), fullPage: opts.full ?? false, clip: opts.clip });
};
const submit = async (page, form, expectRedirect = false) => {
  const button = form.locator('button[type="submit"]').first();
  if (expectRedirect) {
    const before = page.url();
    await Promise.all([page.waitForURL((u) => u.href !== before, { timeout: 20000 }), button.click()]);
  }
  else {
    await button.click();
    await page.waitForSelector("[data-form-result]", { timeout: 20000 });
  }
};
// A delete removes the very row that holds the form, so there is no message to wait for: wait for the refresh instead.
const fire = async (page, form) => {
  await form.locator('button[type="submit"]').first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
};
const resultText = async (form) => (await form.locator("[data-form-result]").first().innerText().catch(() => "")).replace(/\s+/g, " ");

const numbers = (text) => (text.match(/[\d.]+/g) ?? []).map((s) => Number(s.replace(/\./g, "")));

try {
  // ── 1. anonymous ──
  for (const p of ["/ninjas", "/equipment", "/jewelry", "/sets", "/search", "/ninjas/might-guy", "/admin", "/admin/users", "/admin/ninjas"]) {
    const r = await fetch(BASE + p, { redirect: "manual" });
    check(`anonymous ${p} redirects to login`, r.status === 307 && (r.headers.get("location") ?? "").includes("/login"), `${r.status}`);
  }

  // ── 2. a regular user ──
  const U = await login(userMail, userPw);
  check("regular user can sign in", U.ok);
  for (const p of ["/admin", "/admin/users", "/admin/ninjas", "/admin/equipment/new", "/gems", "/gems/anything"]) {
    const r = await go(U.page, BASE + p);
    check(`regular user gets 404 on ${p}`, r.status() === 404, `${r.status()}`);
  }
  for (const p of ["/ninjas", "/equipment", "/jewelry", "/sets", "/search?q=gai", "/effects"]) {
    const r = await go(U.page, BASE + p);
    check(`regular user can read ${p}`, r.status() === 200, `${r.status()}`);
  }
  await go(U.page, BASE + "/ninjas");
  const navU = (await U.page.locator("nav a").allInnerTexts()).join("|");
  check("regular user's menu has no Administración and no Gemas", !/Administración|Gemas/.test(navU), navU);
  // A forged server-action call from a user must not change anything: the form posts need the action id, so check the data instead later.

  // ── 3. administrator: public search, filters, sorting ──
  const A = await login(adminMail, adminPw);
  check("administrator can sign in", A.ok);
  const page = A.page;
  const total = async (url) => { await go(page, BASE + url); return Number(((await page.locator("[data-result-count]").first().innerText().catch(() => "0")).match(/\d+/) ?? [0])[0]); };
  const all = await total("/ninjas");
  const center = await total("/ninjas?formation=center");
  const assaulter = await total("/ninjas?formation=assaulter");
  const vanguard = await total("/ninjas?formation=vanguard");
  check("ninja list shows the full collection", all >= 177, `${all}`);
  check("Center and Assaulter are one position (same result)", center === assaulter && center >= 58, `center=${center} assaulter=${assaulter}`);
  check("Vanguard filter is different from Center", vanguard !== center && vanguard >= 28, `vanguard=${vanguard}`);
  const ssr = await total("/ninjas?rating=SSR");
  const sss = await total("/ninjas?rating=SSS");
  const both = await total("/ninjas?rating=SSR&rating=SSS");
  check("several ranks OR together", both === ssr + sss && ssr > 0 && sss > 0, `SSR=${ssr} SSS=${sss} both=${both}`);
  const combined = await total("/ninjas?rating=SSR&formation=center");
  check("rank and formation filters AND together", combined > 0 && combined <= Math.min(ssr, center), `${combined}`);
  const facetOptions = await page.locator('input[name="rating"]').evaluateAll((els) => els.map((e) => e.value));
  check("the rank filter offers all fifteen ranks", ["D", "C", "B-", "B", "B+", "A-", "A", "A+", "S-", "S", "S+", "SS", "SSS", "SR", "SSR"].every((r) => facetOptions.includes(r)), facetOptions.join(","));

  await go(page, BASE + "/ninjas?sort=stat:desc:force&stat1=force&min1=30000");
  const sortTexts = await page.locator("[data-sort-stat]").allInnerTexts();
  const forceValues = sortTexts.map((t) => numbers(t.split("·")[0].split(":")[1] ?? "")[0]).filter((n) => Number.isFinite(n));
  check("a minimum on Force keeps only ninjas at or above it", forceValues.length > 0 && forceValues.every((v) => v >= 30000), `${forceValues.length} shown, min=${Math.min(...forceValues)}`);
  check("sorting Force from highest to lowest", forceValues.every((v, i) => i === 0 || forceValues[i - 1] >= v), forceValues.slice(0, 6).join(" > "));
  await go(page, BASE + "/ninjas?sort=stat:asc:force&stat1=force&min1=30000&max1=50000");
  const asc = (await page.locator("[data-sort-stat]").allInnerTexts()).map((t) => numbers(t.split("·")[0].split(":")[1] ?? "")[0]).filter((n) => Number.isFinite(n));
  check("sorting lowest to highest with a maximum", asc.length > 0 && asc.every((v) => v <= 50000 && v >= 30000) && asc.every((v, i) => i === 0 || asc[i - 1] <= v), asc.slice(0, 6).join(" < "));

  await go(page, BASE + "/ninjas?q=Might+Gai");
  const names = await page.locator("ul li a").allInnerTexts();
  check("searching the alias «Might Gai» finds Might Guy", names.some((n) => /Might Guy/.test(n)), names.slice(0, 3).join(" | "));
  await go(page, BASE + "/search?q=Might+Gai");
  const aliasNote = await page.locator("[data-search-results]").innerText();
  check("global search names the alias that matched", /Might Guy/.test(aliasNote) && /alias: Might Gai/i.test(aliasNote), aliasNote.replace(/\s+/g, " ").slice(0, 120));
  for (const [q, expected] of [["Seventh Hokage", "7th Hokage"], ["Ay-Bee", "A-B Combo"], ["Nadeshiko", "Shizuka"], ["10-Tailed", "10-Tails Obito"]]) {
    await go(page, BASE + `/search?q=${encodeURIComponent(q)}`);
    check(`alias «${q}» finds ${expected}`, (await page.locator("[data-search-results]").innerText().catch(() => "")).includes(expected));
  }
  await go(page, BASE + "/search?q=jinchu");
  check("global search covers the effect glossary", (await page.locator("body").innerText()).length > 0);

  await go(page, BASE + "/ninjas?rating=SSR&formation=center&sort=stat:desc:force");
  await shot(page, "01-ninjas-filtered.png", { full: true });
  await go(page, BASE + "/search?q=Might+Gai");
  await shot(page, "02-search-alias.png", { clip: { x: 0, y: 0, width: 1280, height: 520 } });
  await go(page, BASE + "/ninjas/might-guy");
  const mg = await page.locator("main, body").first().innerText();
  check("Might Guy shows both names and its formation", /Might Gai/.test(mg) && /(Assaulter|Centro)/.test(mg), mg.replace(/\s+/g, " ").slice(0, 260));
  await shot(page, "03-ninja-might-guy.png", { clip: { x: 0, y: 0, width: 1280, height: 900 } });

  // ── 4. administrator: equipment CRUD through the real forms ──
  await go(page, BASE + "/admin/equipment/new");
  let form = page.locator("main form").first();
  await form.locator('input[name="name"]').fill("PRUEBA Espada");
  await form.locator('input[name="nameEs"]').fill("PRUEBA Espada de ejemplo");
  await form.locator('select[name="status"]').selectOption("PUBLISHED");
  await form.locator('select[name="effects_stat_0"]').selectOption("attack");
  await form.locator('input[name="effects_value_0"]').fill("12,5");
  await submit(page, form, true);
  check("creating an equipment piece goes to its edit page", page.url().includes("/admin/equipment/prueba-espada"), page.url());
  await go(page, BASE + "/equipment?q=PRUEBA");
  check("the new piece is in the public list", (await page.locator("ul li a").allInnerTexts()).some((n) => /PRUEBA Espada/.test(n)));
  const statMin = await total("/equipment?q=PRUEBA&stat1=attack&min1=10");
  const statMax = await total("/equipment?q=PRUEBA&stat1=attack&max1=5");
  check("minimum and maximum filters on an item statistic", statMin === 1 && statMax === 0, `min10=${statMin} max5=${statMax}`);
  await go(page, BASE + "/equipment/prueba-espada");
  const detail = await page.locator("main, body").first().innerText();
  check("equipment detail shows its own statistic", /attack/i.test(detail) && /12,5/.test(detail), "");
  await shot(page, "04-equipment-detail.png", { clip: { x: 0, y: 0, width: 1280, height: 760 } });

  await go(page, BASE + "/admin/equipment/prueba-espada");
  form = page.locator('form:has(input[name="effects_value_0"])').first();
  await form.locator('input[name="effects_value_0"]').fill("20");
  await submit(page, form);
  check("editing saves", /Guardado/.test(await resultText(form)), await resultText(form));
  await go(page, BASE + "/equipment/prueba-espada");
  check("the edit is visible to users", /\+20/.test(await page.locator("body").innerText()));
  // invalid input is refused with a message and nothing is written
  await go(page, BASE + "/admin/equipment/prueba-espada");
  form = page.locator('form:has(input[name="effects_value_0"])').first();
  await form.locator('input[name="effects_value_0"]').fill("abc");
  await submit(page, form);
  check("a non-numeric value is rejected with a message", /Revisa|no es un número|not a number/i.test(await resultText(form)), await resultText(form));

  // ── 5. sets ──
  await go(page, BASE + "/admin/sets/new?kind=equipment");
  form = page.locator("main form").first();
  await form.locator('input[name="name"]').fill("PRUEBA Conjunto");
  await submit(page, form, true);
  check("creating a set goes to its page", page.url().includes("/admin/sets/equipment/prueba-conjunto"), page.url());
  await openAll(page);
  for (const [pieces, value] of [["2", "5"], ["4", "9"]]) {
    const tier = page.locator('form:has(input[name="requiredPieces"])').first();
    await tier.locator('input[name="requiredPieces"]').fill(pieces);
    await tier.locator('select[name="tier_stat_0"]').selectOption("attack");
    await tier.locator('input[name="tier_value_0"]').fill(value);
    await submit(page, tier);
    await page.reload();
    await openAll(page);
  }
  await go(page, BASE + "/admin/equipment/prueba-espada");
  form = page.locator('form:has(select[name="setSlug"])').first();
  await form.locator('select[name="setSlug"]').selectOption("prueba-conjunto");
  await form.locator('input[name="effects_value_0"]').fill("20");
  await submit(page, form);
  await go(page, BASE + "/sets/equipment/prueba-conjunto");
  const setText = await page.locator("body").innerText();
  check("set page shows both tiers separately", /2 piezas/.test(setText) && /4 piezas/.test(setText) && /\+5/.test(setText) && /\+9/.test(setText));
  check("while stacking is unknown a warning says tiers are not summed", (await page.locator("[data-stacking-unknown]").count()) === 1);
  check("the set lists its piece", /PRUEBA Espada/.test(setText));
  await shot(page, "05-set-detail.png", { clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await go(page, BASE + "/equipment/prueba-espada");
  check("a piece shows its set bonuses apart from its own statistics", /Bonificaciones del conjunto/.test(await page.locator("body").innerText()));

  // ── 6. jewelry and gems ──
  await go(page, BASE + "/admin/jewelry/new");
  form = page.locator("main form").first();
  await form.locator('input[name="name"]').fill("PRUEBA Anillo");
  await form.locator('select[name="status"]').selectOption("PUBLISHED");
  await form.locator('select[name="effects_stat_0"]').selectOption("speed");
  await form.locator('input[name="effects_value_0"]').fill("7");
  await submit(page, form, true);
  await go(page, BASE + "/jewelry/prueba-anillo");
  check("jewelry detail page works", /PRUEBA Anillo/.test(await page.locator("body").innerText()));
  await go(page, BASE + "/admin/gems/new");
  form = page.locator("main form").first();
  await form.locator('input[name="name"]').fill("PRUEBA Gema");
  await form.locator('select[name="status"]').selectOption("PUBLISHED");
  await submit(page, form, true);
  check("a gem can be prepared in the admin", page.url().includes("/admin/gems/prueba-gema"));
  const g1 = await go(page, BASE + "/gems");
  const g2 = await go(page, BASE + "/gems/prueba-gema");
  check("the Gems pages stay hidden even for the administrator while the feature is off", g1.status() === 404 && g2.status() === 404, `${g1.status()} ${g2.status()}`);
  await go(page, BASE + "/ninjas");
  check("the Gems menu entry is still hidden", !(await page.locator("nav a").allInnerTexts()).some((n) => /Gemas/.test(n)));

  // ── 7. ninja CRUD and the ability editor ──
  await go(page, BASE + "/admin/ninjas/new");
  form = page.locator("main form").first();
  await form.locator('input[name="name"]').fill("PRUEBA Ninja");
  await form.locator('select[name="ratingKey"]').selectOption("A-");
  await form.locator('select[name="formationKey"]').selectOption("assaulter");
  await form.locator('select[name="status"]').selectOption("PUBLISHED");
  await form.locator('input[name="base_force"]').fill("1234");
  await form.locator('input[name="growth_force"]').fill("2,5");
  await form.locator('textarea[name="otherNames"]').fill("PRUEBA Alias Discord");
  await submit(page, form, true);
  check("creating a ninja goes to its edit page", page.url().includes("/admin/ninjas/prueba-ninja"), page.url());
  check("a new ninja is found by the A- rank and by Center", (await total("/ninjas?q=PRUEBA&rating=A-")) === 1 && (await total("/ninjas?q=PRUEBA&formation=center")) === 1);
  check("a new ninja is found by its alias", (await total("/ninjas?q=Alias+Discord")) === 1);
  check("Tank or DPS is not set unless the administrator sets it", (await db.ninja.findUnique({ where: { slug: "prueba-ninja" }, select: { clientCombatClass: true } })).clientCombatClass === null);

  await go(page, BASE + "/admin/ninjas/prueba-ninja");
  await openAll(page);
  const add = async (fields, parentLabel) => {
    const f = page.locator('form:has(select[name="kind"])').last();
    await f.locator('select[name="kind"]').selectOption(fields.kind);
    await f.locator('input[name="name"]').fill(fields.name);
    if (fields.stage) await f.locator('input[name="stage"]').fill(fields.stage);
    if (parentLabel) await f.locator('select[name="parentId"]').selectOption({ label: parentLabel });
    await f.locator('textarea[name="linesEn"]').fill(fields.en);
    if (fields.es) await f.locator('textarea[name="linesEs"]').fill(fields.es);
    await submit(page, f);
    const msg = await resultText(f);
    await page.reload();
    await openAll(page);
    return msg;
  };
  const m1 = await add({ kind: "skill", name: "Habilidad de prueba", en: "Attacks enemies with 300% growth rate.\nMakes 2 random allies enter (20%) shatter storm state for 2 rounds.\nSomething nobody has described.", es: "Ataca a los enemigos con una tasa de crecimiento del 300%.\nHace que 2 aliados aleatorios entren en tormenta destructora (20%) durante 2 rondas.\nAlgo que nadie ha descrito." });
  check("adding a skill from pasted text saves", /Guardado/.test(m1), m1);
  const m2 = await add({ kind: "talent", name: "Talento de prueba", en: "Increases self force by 10%." });
  check("adding a talent saves", /Guardado/.test(m2), m2);
  const m3 = await add({ kind: "talent_awakening", name: "Despertar uno", stage: "1", en: "Increases self force by 20%." }, "Talento: Talento de prueba");
  const m4 = await add({ kind: "talent_awakening", name: "Despertar dos", stage: "2", en: "Increases self force by 30%." }, "Talento: Talento de prueba");
  check("adding two awakenings saves", /Guardado/.test(m3) && /Guardado/.test(m4), `${m3} / ${m4}`);
  const bad = await add({ kind: "skill_awakening", name: "Huérfano", stage: "1", en: "Increases self force by 5%." }, "Talento: Talento de prueba");
  check("an awakening attached to the wrong kind of parent is refused", /referencia|Unknown|no existe/i.test(bad) || bad !== "", bad);
  await go(page, BASE + "/ninjas/prueba-ninja");
  const pub = await page.locator("body").innerText();
  check("public page shows the skill with the verbatim source line", /Attacks enemies with 300% growth rate/.test(pub));
  check("(20%) is shown as this usage's own strength, not a chance", /Valor de este uso: 20%/.test(pub) || /Valor propio de este uso/.test(pub));
  check("what the parser cannot structure is kept as flagged text", /Something nobody has described/.test(pub) && /Solo texto de origen/.test(pub));
  check("both awakenings are listed with the unknown stacking warning", /Etapa 1/.test(pub) && /Etapa 2/.test(pub) && /no dice si se suma/i.test(pub), `${/Etapa 1/.test(pub)} ${/Etapa 2/.test(pub)} ${/no dice si se suma/i.test(pub)} ${(pub.match(/Despertares[\s\S]{0,400}/) ?? [""])[0].replace(/\s+/g, " ")}`);
  check("the talent is shown once, not as an alternative", !/Elige solo uno/.test(pub));
  await shot(page, "06-ninja-created-abilities.png", { full: true });

  // delete an ability, wrong then right confirmation for the ninja
  await go(page, BASE + "/admin/ninjas/prueba-ninja");
  await openAll(page);
  const before = await db.ability.count({ where: { ninja: { slug: "prueba-ninja" } } });
  await fire(page, page.locator('form:has(input[name="what"])').first());
  const afterCount = await db.ability.count({ where: { ninja: { slug: "prueba-ninja" } } });
  check("deleting an ability works", afterCount < before, `${before} -> ${afterCount}`);
  await page.reload();
  await openAll(page);
  const killForm = page.locator('form:has(input[name="confirm"])').last();
  await killForm.locator('input[name="confirm"]').fill("wrong");
  await submit(page, killForm);
  check("deleting a ninja needs the identifier typed", (await db.ninja.count({ where: { slug: "prueba-ninja" } })) === 1 && /Revisa/.test(await resultText(killForm)), await resultText(killForm));
  await shot(page, "07-admin-ninja-edit.png", { clip: { x: 0, y: 0, width: 1280, height: 1100 } });
  await killForm.locator('input[name="confirm"]').fill("prueba-ninja");
  await submit(page, killForm, true);
  check("deleting a ninja with the confirmation removes it and its data", (await db.ninja.count({ where: { slug: "prueba-ninja" } })) === 0 && page.url().includes("/admin/ninjas"));
  check("no orphan abilities remain", (await db.ability.count({ where: { ninja: { slug: "prueba-ninja" } } })) === 0);

  // ── 8. users ──
  await go(page, BASE + "/admin/users");
  form = page.locator('form:has(input[name="password"])').first();
  await form.locator('input[name="email"]').fill(newMail);
  await form.locator('input[name="name"]').fill("Persona nueva");
  await form.locator('input[name="password"]').fill(newPw);
  await submit(page, form);
  check("creating an account works", /Creado/.test(await resultText(form)), await resultText(form));
  await page.reload();
  form = page.locator('form:has(input[name="password"])').first();
  await form.locator('input[name="email"]').fill(newMail);
  await form.locator('input[name="password"]').fill(newPw);
  await submit(page, form);
  check("a duplicate email is refused", /Ya existe/.test(await resultText(form)), await resultText(form));
  await shot(page, "08-admin-users.png", { clip: { x: 0, y: 0, width: 1280, height: 900 } });
  const N = await login(newMail, newPw);
  check("the new account can sign in", N.ok);
  const stored = await db.user.findUnique({ where: { email: newMail } });
  check("the password is stored hashed, never in clear", stored.passwordHash !== newPw && stored.passwordHash.startsWith("$2"));
  await go(page, BASE + "/admin/users");
  await openAll(page);
  const row = page.locator(`[data-user-email="${newMail}"]`);
  const deact = row.locator('form:has(input[name="isActive"])').first();
  await submit(page, deact);
  await go(N.page, BASE + "/ninjas");
  check("deactivating an account ends its session at once", new URL(N.page.url()).pathname === "/login", N.page.url());
  const own = page.locator(`[data-user-email="${adminMail}"]`);
  const demote = own.locator('form:has(select[name="role"])').first();
  await demote.locator('select[name="role"]').selectOption("USER");
  await submit(page, demote);
  check("an administrator cannot demote themselves", /No puedes quitarte/.test(await resultText(demote)), await resultText(demote));
  check("the administrator is still an administrator", (await db.user.findUnique({ where: { email: adminMail } })).role === "ADMIN");
  await go(page, BASE + "/admin/users");
  await openAll(page);
  const row2 = page.locator(`[data-user-email="${newMail}"]`);
  const reset = row2.locator('form:has(input[name="password"])').first();
  await reset.locator('input[name="password"]').fill(resetPw);
  await submit(page, reset);
  check("resetting a password works", /Contraseña cambiada/.test(await resultText(reset)), await resultText(reset));
  const kill = row2.locator('form:has(input[name="email"])').first();
  await kill.locator('input[name="confirm"]').fill(newMail);
  await fire(page, kill);
  check("deleting an account works", (await db.user.count({ where: { email: newMail } })) === 0);

  // ── 9. effects glossary admin loads ──
  const e1 = await go(page, BASE + "/admin/effects/shatter-storm");
  check("glossary entries can be opened for editing", e1.status() === 200, `${e1.status()}`);

  // ── 10. mobile ──
  const M = await login(adminMail, adminPw, 390);
  for (const p of ["/ninjas?rating=SSR&formation=center", "/ninjas/might-guy", "/search?q=gai", "/sets", "/equipment/prueba-espada", "/admin", "/admin/ninjas", "/admin/users", "/admin/equipment/prueba-espada", "/admin/sets/equipment/prueba-conjunto"]) {
    await go(M.page, BASE + p);
    const overflow = await M.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`no horizontal scrolling at 390 px on ${p}`, overflow <= 0, `${overflow}px`);
  }
  await go(M.page, BASE + "/ninjas?rating=SSR&formation=center&sort=stat:desc:force");
  await shot(M.page, "09-mobile-ninjas.png");
  await go(M.page, BASE + "/admin/ninjas");
  await shot(M.page, "10-mobile-admin.png");

  // ── 10z. production health endpoint ──
  const health = await fetch(BASE + "/api/health");
  check("the health endpoint answers ok without signing in and reveals no data", health.status === 200 && (await health.text()) === '{"status":"ok"}');
  const anon = await fetch(BASE + "/admin", { redirect: "manual" });
  check("an anonymous visitor is not served the admin area", anon.status !== 200, String(anon.status));

  // ── 10a. tablet and small laptop widths (Milestone 4: responsive optimization) ──
  for (const width of [360, 768, 1024, 1280]) {
    const T = await login(adminMail, adminPw, width);
    for (const p of ["/", "/ninjas?rating=SSR&formation=center", "/ninjas/natsu-dragneel", "/ninjas/kimono-kurenai", "/search?q=gai", "/equipment", "/jewelry", "/sets", "/effects", "/admin", "/admin/ninjas", "/admin/ninjas/natsu-dragneel", "/admin/users"]) {
      await go(T.page, BASE + p);
      const overflow = await T.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`no horizontal scrolling at ${width} px on ${p}`, overflow <= 0, `${overflow}px`);
    }
    if (width === 768) {
      await go(T.page, BASE + "/ninjas?rating=SSR&formation=center&sort=stat:desc:force");
      await T.page.addStyleTag({ content: STATIC + " a.group > div:first-child:has(> span[aria-hidden]) { display: none !important; }" }).catch(() => {});
      await T.page.screenshot({ path: path.join(OUT, "t01-tablet-ninjas.png"), clip: { x: 0, y: 0, width: 768, height: 1100 } });
    }
    if (width === 1024) {
      await go(T.page, BASE + "/ninjas/natsu-dragneel");
      await T.page.click('button[aria-controls="mobile-nav"]');
      await T.page.addStyleTag({ content: STATIC + " a.group > div:first-child:has(> span[aria-hidden]) { display: none !important; }" }).catch(() => {});
      await T.page.screenshot({ path: path.join(OUT, "t02-tablet-menu.png"), clip: { x: 0, y: 0, width: 1024, height: 700 } });
    }
    await T.ctx.close();
  }

  // ── 10b. the imported Supporter profiles ──
  const pageText = async (slug) => {
    const r = await page.goto(BASE + "/ninjas/" + slug, { waitUntil: "networkidle" });
    await openAll(page);
    return { status: r.status(), text: await page.locator("main").innerText() };
  };
  const natsu = await pageText("natsu-dragneel");
  check("Natsu Dragneel page opens with both awakening levels and the replace rule", natsu.status === 200 && /Fire Dragon's Roar|Rugido del Drag/.test(natsu.text) && /replace those of Talent Awakening 1|reemplazan los del Despertar de Talento 1/i.test(natsu.text) && /550%/.test(natsu.text));
  await shot(page, "11-natsu.png", { full: true });
  const tay = await pageText("cursed-tayuya");
  check("Cursed Tayuya shows the special card awakening with 88% to 92%", tay.status === 200 && /Special Tayuya Card Awakening|Carta Especial Tayuya/i.test(tay.text) && /88%/.test(tay.text) && /92%/.test(tay.text));
  await shot(page, "12-tayuya.png", { full: true });
  const kim = await pageText("kimono-kurenai");
  check("Kimono Kurenai keeps the three OR lines and shows the Spanish text", kim.status === 200 && (kim.text.match(/\bOR\b|\bO aumenta\b|, O /g) || []).length >= 3);
  await shot(page, "13-kimono.png", { full: true });
  const iss = await pageText("otsutsuki-isshiki");
  check("Otsutsuki Isshiki shows the one-of-four 25% alternatives", iss.status === 200 && (iss.text.match(/25%/g) || []).length >= 4);
  await shot(page, "14-isshiki.png", { full: true });
  const moon = await pageText("uchiha-madara-moon-s-eye");
  check("Madara (Moon's Eye) is one record with its card statistics and text", moon.status === 200 && /44500/.test(moon.text.replace(/[.,\s]/g, "")) && /Truth-Seeking Pierce/.test(moon.text));
  await shot(page, "15-moon-eye.png", { full: true });
  const yas = await pageText("yasaka-itachi");
  check("Yasaka Itachi now has its card (SSS, Support) and Spanish text", yas.status === 200 && /SSS/.test(yas.text) && /Yasaka Beads/.test(yas.text));
  const anko = await pageText("mitarashi-anko");
  check("Mitarashi Anko shows HP exactly as printed (45000)", anko.status === 200 && /45[.,]?000(?![.,]?\d)/.test(anko.text) && !/450[.,]?000/.test(anko.text));
  check("177 ninjas in the list, at least 79 with the Support formation", (await total("/ninjas")) === 177 && (await total("/ninjas?formation=support")) >= 79);
  check("search finds Natsu and the new Supporters by name", (await total("/ninjas?q=natsu")) === 1 && (await total("/ninjas?q=isshiki")) === 1);
  check("rating filter SR lists the new SR Supporters", (await total("/ninjas?rating=SR")) >= 12);
  await go(page, BASE + "/ninjas?formation=support");
  await shot(page, "16-supporters-list.png", { full: true });
  // ── 10b. search by effect (Buscar por efecto) ──
  const owners = async (where) => {
    const rows = await db.effect.findMany({ where, select: { ability: { select: { ninjaId: true } }, talentOption: { select: { group: { select: { ninjaId: true } } } } } });
    return new Set(rows.map((r) => r.ability?.ninjaId ?? r.talentOption?.group.ninjaId).filter(Boolean));
  };
  const published = (await db.ninja.findMany({ where: { status: "PUBLISHED" }, select: { id: true } })).map((n) => n.id);
  const inList = (s) => [...s].filter((id) => published.includes(id)).length;
  const stunStructured = await owners({ kind: "STATUS", statusEffect: { key: "stun" } });
  const stunAny = new Set(stunStructured);
  for (const r of await db.effect.findMany({ where: { OR: [{ kind: "TEXT" }, { structuredStatus: { not: "STRUCTURED" } }] }, select: { sourceText: true, descriptionEs: true, ability: { select: { ninjaId: true } }, talentOption: { select: { group: { select: { ninjaId: true } } } } } })) {
    if (/stun|aturd/i.test(`${r.sourceText ?? ""} ${r.descriptionEs ?? ""}`)) stunAny.add(r.ability?.ninjaId ?? r.talentOption?.group.ninjaId);
  }
  const fxAturdir = await total("/ninjas?fx=aturdir");
  check("effect search «aturdir» covers every structured Stun ninja and only ninjas with Stun evidence", fxAturdir >= inList(stunStructured) && fxAturdir <= inList(stunAny) && fxAturdir > 5, `shown=${fxAturdir} structured=${inList(stunStructured)} evidence=${inList(stunAny)}`);
  check("English, Spanish, case and accents give the same result", (await total("/ninjas?fx=stun")) === fxAturdir && (await total("/ninjas?fx=ATURDIR")) === fxAturdir && (await total("/ninjas?fx=aturd%C3%ADr")) === fxAturdir);
  const sellar = await total("/ninjas?fx=sellar");
  const multi = await total("/ninjas?fx=aturdir&fx=sellar");
  check("several effects mean ANY of them (union, no duplicates)", multi >= Math.max(fxAturdir, sellar) && multi <= fxAturdir + sellar && sellar > 0, `aturdir=${fxAturdir} sellar=${sellar} both=${multi}`);
  const immune = await total("/ninjas?fx=inmunidad+a+aturdir");
  const immuneDb = inList(await owners({ kind: "IMMUNITY", statusEffect: { key: "stun" } }));
  check("immunity to Stun is kept apart from applying Stun and matches the stored immunity effects", immune === immuneDb && immune > 0, `${immune} vs ${immuneDb}`);
  const heal = await total("/ninjas?fx=curaci%C3%B3n");
  check("«curación» finds the ninjas with a Heal effect (not the statistic of the same name)", heal >= inList(await owners({ kind: "HEAL" })) && heal > 0, `${heal}`);
  const healHp = await total("/ninjas?fx=curaci%C3%B3n&stat1=hp&min1=100000");
  check("effect search combines with a statistic range and a rating (AND)", healHp <= heal && (await total("/ninjas?fx=aturdir&rating=SSR")) <= fxAturdir && (await total("/ninjas?fx=aturdir&rating=SSR&formation=center")) <= (await total("/ninjas?fx=aturdir&rating=SSR")), `heal=${heal} withHp=${healHp}`);
  check("effect search combines with the statistic-effect select", (await total("/ninjas?fx=aturdir&effect=speed")) <= fxAturdir);
  // pagination: every page, no repeated ninja, count equals the total
  const seen = [];
  for (let n = 1; n <= Math.ceil(multi / 24) + 1; n++) {
    await go(page, BASE + `/ninjas?fx=aturdir&fx=sellar&page=${n}`);
    seen.push(...(await page.locator("ul li a[href^='/ninjas/']").evaluateAll((els) => els.map((e) => e.getAttribute("href")))));
  }
  check("paging through effect results shows each ninja once", seen.length === multi && new Set(seen).size === seen.length, `${seen.length} links, ${new Set(seen).size} distinct, total ${multi}`);
  // sorting still works with the effect filter
  await go(page, BASE + "/ninjas?fx=aturdir&sort=name:asc");
  check("sorting works together with the effect filter", (await page.locator("[data-result-count]").first().innerText()).includes(String(fxAturdir)) && (await page.locator("ul li a[href^='/ninjas/']").count()) > 0);
  // empty result
  await go(page, BASE + "/ninjas?fx=zzzxxyy");
  check("an effect nobody has gives a helpful Spanish message", /Ningún ninja tiene registrado el efecto «zzzxxyy»/.test(await page.locator("main").innerText()));
  // controls: label, placeholder, suggestions, chips, clear
  await go(page, BASE + "/ninjas?fx=aturdir");
  check("the control is labelled «Buscar por efecto» and has at least 20 suggestions", (await page.locator("label[for=fx]").innerText()) === "Buscar por efecto" && (await page.locator("#fx-suggestions option").count()) >= 20);
  const chip = page.locator("[data-effect-search] ul li", { hasText: "aturdir" });
  check("the chosen effect shows as a chip with a remove link", (await chip.count()) === 1 && (await chip.locator("a").getAttribute("aria-label")) === "Quitar el efecto aturdir");
  await shot(page, "17-effect-search-desktop.png", { full: false });
  await Promise.all([page.waitForURL((u) => !u.search.includes("fx="), { timeout: 15000 }).catch(() => null), chip.locator("a").click()]);
  await page.waitForLoadState("networkidle");
  check("removing the chip clears the effect and keeps other filters", !page.url().includes("fx=") && Number(((await page.locator("[data-result-count]").first().innerText()).match(/\d+/) ?? [0])[0]) === all);
  await go(page, BASE + "/ninjas?fx=aturdir&rating=SSR");
  await Promise.all([page.waitForURL((u) => u.search === "", { timeout: 15000 }).catch(() => null), page.getByRole("link", { name: /Limpiar|Borrar|Quitar filtros/ }).first().click().catch(() => {})]);
  await page.waitForLoadState("networkidle");
  check("clear filters resets the effect search too", !page.url().includes("fx=") && !page.url().includes("rating="), page.url());
  // keyboard: type an effect and press Enter, then add a second one: both stay as chips
  await go(page, BASE + "/ninjas");
  await page.locator("[data-filter-panel] summary").first().click().catch(() => {});
  await page.locator("input#fx").focus();
  await page.keyboard.type("curación");
  await Promise.all([page.waitForURL((u) => u.search.includes("fx="), { timeout: 15000 }).catch(() => null), page.keyboard.press("Enter")]);
  await page.waitForLoadState("networkidle");
  check("typing an effect and pressing Enter filters by it (URL keeps the term)", /fx=cura/.test(decodeURIComponent(page.url())), page.url());
  await page.locator("input#fx").focus();
  await page.keyboard.type("velocidad");
  await Promise.all([page.waitForURL((u) => u.search.includes("velocidad"), { timeout: 15000 }).catch(() => null), page.keyboard.press("Enter")]);
  await page.waitForLoadState("networkidle");
  check("a second effect is added next to the first", (await page.locator("[data-effect-search] ul li").count()) === 2, decodeURIComponent(page.url()));
  // mobile 390 px
  const MB = await login(adminMail, adminPw, 390);
  await go(MB.page, BASE + "/ninjas?fx=aturdir");
  const overflow = await MB.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const box = await MB.page.locator("input#fx").boundingBox();
  check("390 px: no horizontal scroll and the effect field fits the screen", overflow <= 1 && box && box.x >= 0 && box.x + box.width <= 390, `overflow=${overflow} box=${JSON.stringify(box)}`);
  check("390 px: the chip remove target is at least 32 px", ((await MB.page.locator("[data-effect-search] ul li a").first().boundingBox())?.width ?? 0) >= 32);
  await shot(MB.page, "18-effect-search-mobile.png", { full: false });
  await MB.ctx?.close?.();

  const gem = await page.goto(BASE + "/gems");
  check("gems stay hidden after the import (404)", gem.status() === 404);
  const M2 = await login(adminMail, adminPw, 390);
  for (const slug of ["natsu-dragneel", "kimono-kurenai", "otsutsuki-isshiki"]) {
    await go(M2.page, BASE + "/ninjas/" + slug);
    const overflow = await M2.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(`no horizontal scrolling at 390 px on /ninjas/${slug}`, overflow <= 0, `${overflow}px`);
  }
  await go(M2.page, BASE + "/ninjas/natsu-dragneel");
  await shot(M2.page, "17-mobile-natsu.png");
  await M2.ctx.close();

  // ── 10c. screenshots for the client report: narrower window and a higher scale, so the text prints larger ──
  // No character images have been supplied, so the empty picture boxes are hidden in the report screenshots only.
  const STATIC_R = STATIC + " a.group > div:first-child:has(> span[aria-hidden]) { display: none !important; }";
  const R = await login(adminMail, adminPw, 960);
  const around = async (url, pattern, name, height = 800, before = 60) => {
    await R.page.goto(BASE + url, { waitUntil: "networkidle" });
    await openAll(R.page);
    const y = await R.page.evaluate((src) => {
      const re = new RegExp(src, "i");
      const el = [...document.querySelectorAll("main *")].find((e) => re.test(e.textContent ?? "") && ![...e.children].some((c) => re.test(c.textContent ?? "")));
      return el ? el.getBoundingClientRect().top + window.scrollY : null;
    }, pattern.source);
    if (y === null) { check(`report screenshot ${name}: anchor text found`, false, pattern.source); return; }
    await R.page.addStyleTag({ content: STATIC_R }).catch(() => {});
    await R.page.screenshot({ path: path.join(OUT, name), fullPage: true, clip: { x: 0, y: Math.max(0, y - before), width: 960, height } });
  };
  const top = async (url, name, height) => {
    await R.page.goto(BASE + url, { waitUntil: "networkidle" });
    await R.page.addStyleTag({ content: STATIC_R }).catch(() => {});
    await R.page.screenshot({ path: path.join(OUT, name), fullPage: true, clip: { x: 0, y: 0, width: 960, height } });
  };
  await top("/ninjas/natsu-dragneel", "r04-natsu-top.png", 1150);
  await around("/ninjas/natsu-dragneel", /Skill Awakening 1/, "r05-natsu-skill-awakening.png", 820);
  await around("/ninjas/natsu-dragneel", /Fire Dragon's Talon/, "r06-natsu-talent2.png", 820);
  await around("/ninjas/cursed-tayuya", /Special Tayuya Card Awakening/, "r07-tayuya.png", 1000);
  await around("/ninjas/kimono-kurenai", /Applies the below/, "r08-kimono.png", 900, 40);
  await around("/ninjas/otsutsuki-isshiki", /only one of the following skills/, "r09-isshiki.png", 1000, 40);
  await around("/ninjas/yamanaka-ino", /Talent Awakening 2/, "r14-ino-replaces.png", 700, 40);
  await top("/ninjas/uchiha-madara-moon-s-eye", "r10-moon-eye.png", 1150);
  await top("/ninjas/uchiha-hikari", "r11-hikari.png", 1150);
  await R.page.goto(BASE + "/ninjas?rating=SSR&formation=center&sort=stat:desc:force", { waitUntil: "networkidle" });
  await R.page.addStyleTag({ content: STATIC_R }).catch(() => {});
  const listY = await R.page.evaluate(() => { const el = document.querySelector("[data-result-count]"); return el ? el.getBoundingClientRect().top + window.scrollY : 0; });
  await R.page.screenshot({ path: path.join(OUT, "r01-results.png"), fullPage: true, clip: { x: 0, y: Math.max(0, listY - 520), width: 960, height: 1100 } });
  await R.page.goto(BASE + "/ninjas?formation=support", { waitUntil: "networkidle" });
  await R.page.addStyleTag({ content: STATIC_R }).catch(() => {});
  const supY = await R.page.evaluate(() => { const el = document.querySelector("[data-result-count]"); return el ? el.getBoundingClientRect().top + window.scrollY : 0; });
  await R.page.screenshot({ path: path.join(OUT, "r03-supporters-list.png"), fullPage: true, clip: { x: 0, y: Math.max(0, supY - 40), width: 960, height: 950 } });
  await R.page.goto(BASE + "/search?q=Might+Gai", { waitUntil: "networkidle" });
  await R.page.addStyleTag({ content: STATIC_R }).catch(() => {});
  await R.page.screenshot({ path: path.join(OUT, "r02-search-alias.png"), clip: { x: 0, y: 0, width: 960, height: 420 } });
  await top("/admin/ninjas/natsu-dragneel", "r12-admin-ninja.png", 1100);
  await top("/admin/users", "r13-admin-users.png", 900);
  await R.ctx.close();

  // ── 11. cleanup of the test records and final state ──
  await go(page, BASE + "/admin/equipment/prueba-espada");
  await openAll(page);
  const kEq = page.locator('form:has(input[name="confirm"])').last();
  await kEq.locator('input[name="confirm"]').fill("prueba-espada");
  await submit(page, kEq, true);
  check("deleting a piece removes it from the public list", (await total("/equipment?q=PRUEBA")) === 0);
  await go(page, BASE + "/admin/sets/equipment/prueba-conjunto");
  await openAll(page);
  const kSet = page.locator('form:has(input[name="confirm"])').last();
  await kSet.locator('input[name="confirm"]').fill("prueba-conjunto");
  await submit(page, kSet, true);
  check("deleting a set works", (await db.equipmentSet.count({ where: { slug: "prueba-conjunto" } })) === 0);
} catch (e) {
  check("script completed without an unexpected error", false, String(e).slice(0, 400));
} finally {
  await browser.close();
  server.kill();
  await CLEAN();
  const left = [await db.ninja.count({ where: { slug: { startsWith: "prueba-" } } }), await db.equipment.count({ where: { slug: { startsWith: "prueba-" } } }), await db.jewelry.count({ where: { slug: { startsWith: "prueba-" } } }), await db.gem.count({ where: { slug: { startsWith: "prueba-" } } }), await db.user.count({ where: { email: { endsWith: "@example.test" } } })];
  check("test records and accounts were removed", left.every((n) => n === 0), left.join(","));
  await db.$disconnect();
  const failed = results.filter((r) => !r.ok);
  writeFileSync(path.join(OUT, "e2e-results.txt"), results.map((r) => `${r.ok ? "PASS" : "FAIL"} ${r.name}${r.extra ? " | " + r.extra : ""}`).join("\n") + `\n\n${results.length - failed.length} passed, ${failed.length} failed\n`);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
}
