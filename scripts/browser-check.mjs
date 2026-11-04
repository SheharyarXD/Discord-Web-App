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
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: Number(process.env.CHECK_TIMEOUT_MS ?? 20000) }).catch(() => null), page.click('button[type="submit"]')]);
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
    await Promise.all([page.waitForURL((u) => u.href !== before, { timeout: Number(process.env.CHECK_TIMEOUT_MS ?? 20000) }), button.click()]);
  }
  else {
    await button.click();
    await page.waitForSelector("[data-form-result]", { timeout: Number(process.env.CHECK_TIMEOUT_MS ?? 20000) });
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
  await go(page, BASE + "/equipment/pieces?q=PRUEBA");
  check("the new piece is in the public list", (await page.locator("ul li a").allInnerTexts()).some((n) => /PRUEBA Espada/.test(n)));
  const statMin = await total("/equipment/pieces?q=PRUEBA&stat1=attack&min1=10");
  const statMax = await total("/equipment/pieces?q=PRUEBA&stat1=attack&max1=5");
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

  // ── 10c. equipment and jewelry catalogue, Match Any / Match All ──
  const gearRows = async (kind) => (kind === "equipment" ? db.equipmentSet : db.jewelrySet).findMany({ where: { familyId: { not: null } }, select: { id: true, slug: true, versionLabel: true } });
  const eqSets = await gearRows("equipment");
  const jwSets = await gearRows("jewelry");
  check("the catalogue lists every imported version: equipment, jewelry and both together", (await total("/equipment")) === eqSets.length && (await total("/jewelry")) === jwSets.length && (await total("/sets")) === eqSets.length + jwSets.length && eqSets.length >= 78, `eq=${eqSets.length} jw=${jwSets.length}`);
  await go(page, BASE + "/sets?q=sand+burial");
  const sbText = await page.locator("[data-gear-results]").innerText();
  check("Sand Burial shows its base equipment, base jewelry and the R1 jewelry as separate cards", /Sand Burial R1/.test(sbText) && (await page.locator("[data-gear-card]").count()) === 3, sbText.replace(/\s+/g, " ").slice(0, 160));
  await go(page, BASE + "/sets?q=warlord");
  const wText = await page.locator("[data-gear-results]").innerText();
  check("a version with no printed statistics of its own does not claim zero pieces", !/0 piezas/.test(wText));
  check("Warlord shows Base, SSR5, R1 and R2 as four cards and no invented labels", /Warlord SSR5/.test(wText) && /Warlord R1/.test(wText) && /Warlord R2/.test(wText) && (await page.locator("[data-gear-card]").count()) === 4);
  await go(page, BASE + "/sets?q=sange");
  const sangeText = await page.locator("[data-gear-results]").innerText();
  check("unlabeled variants say variante and are not named R1 or R2", /variante A/.test(sangeText) && !/Sange R[12]/.test(sangeText));
  await go(page, BASE + "/sets?q=legendary");
  check("name-only sets create no card", (await page.locator("[data-gear-card]").count()) === 0 && /Ningún conjunto coincide/.test(await page.locator("main").innerText()));
  const tier8 = await db.jewelrySetBonus.findMany({ where: { requiredPieces: 8, set: { familyId: { not: null } } }, select: { setId: true }, distinct: ["setId"] });
  check("the tier filter matches the stored 8-piece bonuses", (await total("/jewelry?tier=8")) === tier8.length, `${tier8.length}`);
  const speedDb = await db.equipmentSet.findMany({ where: { familyId: { not: null }, items: { some: { effects: { some: { note: "PRINTED_MAIN_STAT", statistic: { key: "speed" }, value: { gte: 70000 } } } } } }, select: { id: true } });
  check("a printed-statistic range matches the stored values", (await total("/equipment?stat1=speed&min1=70000")) === speedDb.length && speedDb.length > 0, `${speedDb.length}`);
  // effect search: compare with independent counts of the stored wording
  const gearEffectOwners = async (kind, re) => {
    const rows = await db.effect.findMany({ where: kind === "equipment" ? { equipmentSetBonusId: { not: null } } : { jewelrySetBonusId: { not: null } }, select: { sourceText: true, equipmentSetBonus: { select: { setId: true } }, jewelrySetBonus: { select: { setId: true } } } });
    return new Set(rows.filter((r) => re.test(r.sourceText ?? "")).map((r) => r.equipmentSetBonus?.setId ?? r.jewelrySetBonus?.setId));
  };
  const stunSets = await gearEffectOwners("equipment", /\bstun/i);
  const healSets = await gearEffectOwners("equipment", /(recover|restore)s?\b[^.]*\bhp\b|(?<!forbidden )\bheal(?!\s*(reduction|forbid))/i);
  const fxStunEq = await total("/equipment?fx=aturdir");
  check("effect search aturdir on equipment equals the sets whose stored tiers say stun", fxStunEq === stunSets.size && fxStunEq > 0, `${fxStunEq} vs ${stunSets.size}`);
  await go(page, BASE + "/equipment?fx=aturdir");
  check("an effect result names the tier it sits in and says it does not mean it is equipped", /Bonus de \d+ piezas/.test(await page.locator("[data-effect-evidence]").first().innerText()) && /No significa que la tengas equipada/.test(await page.locator("main").innerText()));
  const unionEq = new Set([...stunSets, ...healSets]);
  const interEq = new Set([...stunSets].filter((x) => healSets.has(x)));
  const anyEq = await total("/equipment?fx=aturdir&fx=curaci%C3%B3n&fxm=any");
  const allEq = await total("/equipment?fx=aturdir&fx=curaci%C3%B3n&fxm=all");
  check("Match Any = union and Match All = intersection of the two effects (equipment)", anyEq === unionEq.size && allEq === interEq.size && allEq <= anyEq, `any=${anyEq}/${unionEq.size} all=${allEq}/${interEq.size}`);
  check("the default mode is Any (no mode in the address)", (await total("/equipment?fx=aturdir&fx=curaci%C3%B3n")) === anyEq);
  const nA = await total("/ninjas?fx=aturdir");
  const nB = await total("/ninjas?fx=curaci%C3%B3n");
  const nAny = await total("/ninjas?fx=aturdir&fx=curaci%C3%B3n&fxm=any");
  const nAll = await total("/ninjas?fx=aturdir&fx=curaci%C3%B3n&fxm=all");
  check("ninjas: Match All = A + B - (A or B), and never more than Any", nAll === nA + nB - nAny && nAll <= nAny && nAny >= Math.max(nA, nB), `A=${nA} B=${nB} any=${nAny} all=${nAll}`);
  const eA = fxStunEq;
  const eB = await total("/equipment?fx=aumento+de+agilidad");
  const eAny = await total("/equipment?fx=aturdir&fx=aumento+de+agilidad&fxm=any");
  const eAll = await total("/equipment?fx=aturdir&fx=aumento+de+agilidad&fxm=all");
  check("equipment: Match All (stun and Agility up, in different tiers) = A + B - (A or B) and is not empty", eAll === eA + eB - eAny && eAll > 0 && eAll <= eAny, `A=${eA} B=${eB} any=${eAny} all=${eAll}`);
  const jA = await total("/jewelry?fx=aturdir");
  const jB = await total("/jewelry?fx=eliminar+debuffs");
  const jAny = await total("/jewelry?fx=aturdir&fx=eliminar+debuffs&fxm=any");
  const jAll = await total("/jewelry?fx=aturdir&fx=eliminar+debuffs&fxm=all");
  check("jewelry: Match All = A + B - (A or B)", jAll === jA + jB - jAny && jAll <= jAny, `A=${jA} B=${jB} any=${jAny} all=${jAll}`);
  const sAny = await total("/sets?fx=aturdir&fx=curaci%C3%B3n&fxm=any");
  check("the combined list is the sum of both categories", sAny === anyEq + (await total("/jewelry?fx=aturdir&fx=curaci%C3%B3n&fxm=any")));
  check("combined with a printed-statistic range and a tier (AND)", (await total("/equipment?fx=aumento+de+agilidad&stat1=speed&min1=70000&tier=6")) <= (await total("/equipment?fx=aumento+de+agilidad")));
  // the mode survives paging, sorting, reloads and clearing
  await go(page, BASE + "/equipment?fx=aumento+de+velocidad&fx=aumento+de+agilidad&fxm=all&sort=name:desc");
  const pagerHref = await page.locator("nav[aria-label='Paginación'] a").first().getAttribute("href").catch(() => null);
  check("paging and sorting links keep the effects and the mode", pagerHref === null || (/fxm=all/.test(pagerHref) && /fx=/.test(pagerHref)), String(pagerHref));
  check("the selected mode is shown and checked", (await page.locator("input[name=fxm][value=all]").isChecked()) && /todos los efectos elegidos/.test(await page.locator("[data-effect-mode-note]").innerText()));
  await page.reload({ waitUntil: "networkidle" });
  check("reloading keeps the mode", await page.locator("input[name=fxm][value=all]").isChecked());
  const clear = page.getByRole("link", { name: /Quitar filtros/ }).first();
  check("clearing the filters removes the effects but keeps the chosen mode", (await clear.getAttribute("href")) === "/equipment?fxm=all", String(await clear.getAttribute("href")));
  const gearChip = page.locator("[data-effect-search] ul li a").first();
  check("a chip removal link keeps the other effects and the mode", /fxm=all/.test((await gearChip.getAttribute("href")) ?? "") && (await page.locator("[data-effect-search] ul li").count()) === 2);
  // keyboard: choose Match All with the keyboard and apply
  await go(page, BASE + "/equipment");
  await page.locator("[data-filter-panel] summary").first().click().catch(() => {});
  await page.locator("input#fx").focus();
  await page.keyboard.type("aturdir");
  await page.locator("input[name=fxm][value=any]").focus();
  await page.keyboard.press("ArrowRight");
  await Promise.all([page.waitForURL((u) => u.search.includes("fxm=all"), { timeout: 15000 }).catch(() => null), page.locator("input#fx").press("Enter")]);
  check("the keyboard can pick Match All and apply it", /fxm=all/.test(page.url()) && /fx=aturdir/.test(page.url()), page.url());
  // detail pages
  await go(page, BASE + "/sets/jewelry/sand-burial-r1");
  const r1 = await page.locator("main").innerText();
  check("Sand Burial R1 detail: title, client-stated label, sibling versions and tiers", /Sand Burial R1/.test(r1) && /indicada por el cliente/.test(r1) && /Otras versiones/.test(r1) && /8 piezas|2 piezas/.test(r1));
  check("set tiers are never labelled always active, and jewelry tiers name their category", !/Siempre activo/.test(r1) && /2 piezas de «Force»/.test(r1));
  await go(page, BASE + "/sets/equipment/warlord");
  const wl = await page.locator("main").innerText();
  check("Warlord detail: upgrade costs are shown as costs and not as bonuses", /Costes de mejora/.test(wl) && /Warlord myth - 170/.test(wl) && /No son bonificaciones de combate/.test(wl));
  await go(page, BASE + "/sets/equipment/sange-seq-b");
  check("an unlabeled variant says the source does not label it", /no la etiqueta/.test(await page.locator("main").innerText()));
  await go(page, BASE + "/sets/equipment/mekansm");
  check("Mekansm shows the source title MEKA", /MEKA/.test(await page.locator("main").innerText()));
  await shot(page, "19-gear-set-detail.png", { full: false });
  await go(page, BASE + "/equipment?fx=aturdir&fx=aumento+de+agilidad&fxm=all");
  await shot(page, "20-gear-effect-all.png", { full: false });
  // 390 px
  const GM = await login(adminMail, adminPw, 390);
  for (const url of ["/equipment?fx=aturdir&fxm=all", "/jewelry?tier=8", "/sets?q=warlord", "/sets/jewelry/sand-burial-r1"]) {
    await go(GM.page, BASE + url);
    const ov = await GM.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`390 px: no horizontal scrolling on ${url}`, ov <= 0, `${ov}px`);
  }
  await go(GM.page, BASE + "/equipment?fx=aturdir&fxm=all");
  const rb = await GM.page.locator("input[name=fxm][value=all]").boundingBox();
  const rl = await GM.page.locator("label:has(input[name=fxm][value=all])").boundingBox();
  check("390 px: the Match All control fits the screen and is large enough to tap", rb && rl && rb.x >= 0 && rl.x + rl.width <= 390 && rl.height >= 32);
  await shot(GM.page, "21-gear-mobile.png", { full: false });
  await GM.ctx.close();
  check("individual pieces are still listed under /equipment/pieces", (await total("/equipment/pieces")) >= 1);

  const SP = page;
  // ── sorting by the value of the selected effect ──
  const CCQ = "aumento+de+tasa+de+control";
  const AGQ = "aumento+de+agilidad";
  const ccRows = await db.effect.findMany({ where: { statistic: { key: "control-rate" }, kind: "STAT", structuredStatus: "STRUCTURED", valueType: "PERCENT", value: { gt: 0 }, OR: [{ equipmentSetBonusId: { not: null } }, { jewelrySetBonusId: { not: null } }] }, select: { value: true, equipmentSetBonus: { select: { setId: true } }, jewelrySetBonus: { select: { setId: true } } } });
  const ccBest = new Map();
  for (const r of ccRows) {
    const id = r.equipmentSetBonus?.setId ?? r.jewelrySetBonus?.setId;
    ccBest.set(id, Math.max(ccBest.get(id) ?? 0, Number(r.value.toString())));
  }
  const ccMax = Math.max(...ccBest.values());
  const rankValues = async (pg) => (await pg.locator("[data-effect-rank][data-rank-status='ranked']").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-rank-magnitude")))));
  await go(SP, BASE + `/sets?fx=${CCQ}&sort=fx:desc`);
  const descVals = await rankValues(SP);
  check("sort by value, highest first: the top result carries the largest stored Control Rate bonus and values never rise", descVals.length > 5 && descVals[0] === ccMax && descVals.every((v, i) => i === 0 || descVals[i - 1] >= v), `top=${descVals[0]} max=${ccMax} shown=${descVals.length}`);
  check("the result says how it is ordered and that tiers are not added", /Ordenado de mayor a menor por el valor de/.test(await SP.locator("[data-effect-rank-note]").innerText()) && /No se suman niveles/.test(await SP.locator("[data-effect-rank-note]").innerText()));
  await go(SP, BASE + `/sets?fx=${CCQ}&sort=fx:asc`);
  const ascVals = await rankValues(SP);
  check("sort by value, lowest first", ascVals.length > 5 && ascVals.every((v, i) => i === 0 || ascVals[i - 1] <= v), ascVals.slice(0, 6).join(" < "));
  await go(SP, BASE + `/equipment?fx=${CCQ}&sort=fx:desc&q=susanoo`);
  const susanoo = await SP.locator("[data-gear-card] h2").allInnerTexts();
  check("Susanoo: the variant with +18% at 6 pieces ranks ahead of +15%, both with +40% at 4 pieces, and the tiers are shown apart", /variante B/.test(susanoo[0] ?? "") && /variante A/.test(susanoo[1] ?? "") && /6 piezas: \+18%/.test(await SP.locator("[data-effect-rank]").first().innerText()) && /4 piezas: \+40%/.test(await SP.locator("[data-effect-rank]").first().innerText()), susanoo.join(" | "));
  const wholeDesc = await (async () => { const seen = []; for (let n = 1; n <= 12; n++) { await go(SP, BASE + `/sets?fx=${AGQ}&sort=fx:desc&page=${n}`); seen.push(...(await SP.locator("[data-gear-card] h2 a").evaluateAll((els) => els.map((e) => e.getAttribute("href"))))); } return seen; })();
  const ccTotal = await total("/sets?fx=" + AGQ);
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
  const un = await total(`/equipment?fx=${CCQ}`);
  check("sorting by value does not change which sets are found", (await total(`/equipment?fx=${CCQ}&sort=fx:desc`)) === un && (await total(`/equipment?fx=${CCQ}&sort=name:asc`)) === un);
  check("Match All and a printed-statistic range still filter a value sort", (await total(`/equipment?fx=${CCQ}&fx=aumento+de+agilidad&fxm=all&sort=fx:desc`)) <= un && (await total(`/equipment?fx=${CCQ}&stat1=speed&min1=70000&sort=fx:desc`)) <= un);
  await go(SP, BASE + "/equipment?fx=zzzxxyy&sort=fx:desc");
  check("an effect nobody has gives the empty message when sorting by value", /Ningún conjunto tiene/.test(await SP.locator("main").innerText()));
  // the reduction of the enemy's control rate is its own effect
  await go(SP, BASE + "/sets?fx=reducci%C3%B3n+de+tasa+de+control&sort=fx:desc");
  const redVals = await rankValues(SP);
  check("a reduction of the enemy's control rate is ordered by its own size and never mixed with the increases", redVals.length > 3 && redVals.every((v, i) => i === 0 || redVals[i - 1] >= v) && !(await SP.locator("main").innerText()).includes("Increase CC Rate"), redVals.slice(0, 4).join(","));
  // ninjas
  const nx = await total(`/ninjas?fx=aumento+de+velocidad`);
  await go(SP, BASE + "/ninjas?fx=aumento+de+velocidad&sort=fx:desc");
  const nVals = await rankValues(SP);
  check("ninjas: the value sort lists the largest Speed increase first and never rises", nVals.length > 10 && nVals.every((v, i) => i === 0 || nVals[i - 1] >= v), `${nVals.slice(0, 5).join(",")} of ${nx}`);
  check("ninjas: sorting by value keeps the count", (await total("/ninjas?fx=aumento+de+velocidad&sort=fx:desc")) === nx);
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
  const pctRows = (statKey) => db.effect.findMany({ where: { statistic: { key: statKey }, kind: "STAT", structuredStatus: "STRUCTURED", valueType: "PERCENT", value: { gt: 0 }, jewelrySetBonusId: { not: null } }, select: { value: true, jewelrySetBonus: { select: { setId: true, requiredPieces: true, group: { select: { key: true } } } } } });
  const jewelOracle = async (statKey, slot) => {
    const two = new Map();
    const eight = new Map();
    for (const r of await pctRows(statKey)) {
      const b = r.jewelrySetBonus;
      const v = Number(r.value.toString());
      if (b.requiredPieces === 2 && b.group?.key === slot) two.set(b.setId, Math.max(two.get(b.setId) ?? 0, v));
      if (b.requiredPieces === 8) eight.set(b.setId, Math.max(eight.get(b.setId) ?? 0, v));
    }
    return { two, eight, stronger: [...two].filter(([id, v]) => (eight.get(id) ?? 0) > v).length };
  };
  const equipOracle = async (tier) => {
    const rows = await db.effect.findMany({ where: { statistic: { key: "control-rate" }, kind: "STAT", structuredStatus: "STRUCTURED", valueType: "PERCENT", value: { gt: 0 }, equipmentSetBonus: { requiredPieces: tier } }, select: { equipmentSetBonus: { select: { setId: true } } } });
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
  for (const tier of [2, 4, 6]) eqCounts.push([await total(`/equipment?fx=${CCQ2}&tier=${tier}`), await equipOracle(tier)]);
  check("equipment: Control Rate at exactly 2, 4 and 6 pieces returns the sets whose stored bonus of THAT tier has it", eqCounts.every(([shown, stored]) => shown === stored) && eqCounts.some(([, stored]) => stored > 0), JSON.stringify(eqCounts));
  await go(SP, BASE + `/equipment?fx=${CCQ2}&tier=2`);
  check("equipment: a 2-piece search with nothing printed at 2 pieces says so instead of listing 4 and 6 piece sets", eqCounts[0][1] > 0 || /Ningún conjunto tiene/.test(await SP.locator("main").innerText()));
  await go(SP, BASE + `/equipment?fx=${CCQ2}&tier=6&sort=fx:desc`);
  const e6 = await SP.locator("[data-effect-rank][data-rank-status='ranked'] [data-match-value]").allInnerTexts();
  check("equipment: results name the matching tier and show the value printed at it", e6.length > 3 && e6.every((t) => /6 piezas/.test(t)), e6.slice(0, 2).join(" / ").replace(/\s+/g, " "));
  // the client's scenario
  const ccAg = await jewelOracle("control-rate", "agility");
  const SCN = `/jewelry?slot=agility&tier=2&fx=${CCQ2}&sort=fx:desc`;
  await go(SP, BASE + SCN);
  const agVals = (await SP.locator("[data-effect-rank][data-rank-status='ranked']").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-rank-magnitude")))));
  const matchText = await SP.locator("[data-match-value]").allInnerTexts();
  check("Joyería + Agilidad + 2 piezas + Control Rate + mayor a menor: exactly the sets whose stored Agility 2-piece bonus has it, highest first", agVals.length === ccAg.two.size && agVals.length > 5 && agVals[0] === Math.max(...ccAg.two.values()) && agVals.every((v, i) => i === 0 || agVals[i - 1] >= v), `${agVals.join(",")} stored=${ccAg.two.size}`);
  check("every result shows the exact percentage prominently with its tier and slot, and none comes from Fuerza, Chakra or Poder", matchText.length === agVals.length && matchText.every((t) => /2 piezas/.test(t) && /Agilidad/.test(t) && !/Fuerza|Chakra|Poder/.test(t)), matchText.slice(0, 2).join(" / ").replace(/\s+/g, " "));
  const noSlotTotal = await total(`/jewelry?tier=2&fx=${CCQ2}`);
  const forceTotal = await total(`/jewelry?slot=force&tier=2&fx=${CCQ2}`);
  check("choosing a slot narrows the result and the slot is enforced by the query (URL, reload and back keep it)", (await total(SCN)) <= noSlotTotal && forceTotal <= noSlotTotal && (await total(SCN)) === (await total(`/jewelry?slot=agility&tier=2&fx=${CCQ2}`)), `agility<=${noSlotTotal} force=${forceTotal}`);
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
  check("under every 2-piece result that has one, the set's 8-piece bonus is shown separately and says it needs the full set", fullBlocks > 3 && /Bono de 8 piezas/.test(fullText) && /Requiere el conjunto completo/.test(fullText) && /No se indica que los bonos se sumen/.test(fullText), `blocks=${fullBlocks}`);
  const strongCc = await SP.locator("[data-full-set-stronger]").count();
  check("the «stronger» note appears only where the stored 8-piece value is higher (Control Rate, Agility)", strongCc === ccAg.stronger, `shown=${strongCc} stored=${ccAg.stronger}`);
  const dm = await jewelOracle("damage-rate", "agility");
  await go(SP, BASE + `/jewelry?slot=agility&tier=2&fx=${DMQ}&sort=fx:desc`);
  const strongDm = await SP.locator("[data-full-set-stronger]").count();
  const cmp = await SP.locator("[data-full-set-compare]").first().innerText().catch(() => "");
  check("a genuinely stronger 8-piece value is pointed out with both values (Damage Rate, Agility)", strongDm === dm.stronger && dm.stronger > 0 && /2 piezas/.test(cmp) && /8 piezas/.test(cmp) && /ofrece un bono mayor/.test(await SP.locator("[data-full-set-stronger]").first().innerText()), `shown=${strongDm} stored=${dm.stronger}`);
  // 8-piece search
  const e8 = await total(`/jewelry?tier=8&fx=reducci%C3%B3n+de+tasa+de+control&sort=fx:desc`);
  const e2 = await total(`/jewelry?tier=2&fx=reducci%C3%B3n+de+tasa+de+control`);
  await go(SP, BASE + `/jewelry?tier=8&fx=reducci%C3%B3n+de+tasa+de+control&sort=fx:desc`);
  check("an 8-piece search matches the 8-piece bonus on its own (no 8-piece block under it)", e8 > 0 && (await SP.locator("[data-match-value]").allInnerTexts()).every((t) => /8 piezas/.test(t)) && (await SP.locator("[data-full-set]").count()) === 0, `8pc=${e8} 2pc=${e2}`);
  // Match All / Any inside the scope, and choosing the sorting effect
  const anyN = await total(`/jewelry?slot=agility&tier=2&fx=${CCQ2}&fx=aumento+de+tasa+de+da%C3%B1o&fxm=any`);
  const allN = await total(`/jewelry?slot=agility&tier=2&fx=${CCQ2}&fx=aumento+de+tasa+de+da%C3%B1o&fxm=all`);
  const a1 = await total(`/jewelry?slot=agility&tier=2&fx=${CCQ2}`);
  const a2 = await total(`/jewelry?slot=agility&tier=2&fx=${DMQ}`);
  check("Match Any / Match All apply inside the selected slot and tier (All = A + B - Any)", allN === a1 + a2 - anyN && allN <= anyN && a1 > 0, `A=${a1} B=${a2} any=${anyN} all=${allN}`);
  await go(SP, BASE + `/jewelry?slot=agility&tier=2&fx=${CCQ2}&fx=${DMQ}&fxm=any&sort=fx:desc&fxs=${DMQ.replace(/%C3%B1/g, "%C3%B1")}`);
  const sortSel = await SP.locator("select#fxs").inputValue();
  check("with several effects the one that decides the order can be chosen", /da.o/.test(sortSel) && (await SP.locator("select#fxs option").count()) === 2, sortSel);
  // mobile
  const TM = await login(adminMail, adminPw, 390);
  await go(TM.page, BASE + SCN);
  const tmo = await TM.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const tmSlot = await TM.page.locator("[data-radio-group=slot]").boundingBox();
  const tmVal = await TM.page.locator("[data-match-value]").first().boundingBox();
  const tmFull = await TM.page.locator("[data-full-set]").first().boundingBox();
  check("390 px: the slot choice, the prominent value and the 8-piece bonus fit without sideways scrolling", tmo <= 0 && tmSlot && tmSlot.x + tmSlot.width <= 390 && tmVal && tmVal.x + tmVal.width <= 390 && tmFull && tmFull.x + tmFull.width <= 390, `${tmo}px`);
  await TM.ctx.close();

  // ── 11. cleanup of the test records and final state ──
  await go(page, BASE + "/admin/equipment/prueba-espada");
  await openAll(page);
  const kEq = page.locator('form:has(input[name="confirm"])').last();
  await kEq.locator('input[name="confirm"]').fill("prueba-espada");
  await submit(page, kEq, true);
  check("deleting a piece removes it from the public list", (await total("/equipment/pieces?q=PRUEBA")) === 0);
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
