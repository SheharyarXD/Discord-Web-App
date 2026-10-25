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
if (!BASE?.startsWith("https://")) throw new Error("TARGET_BASE_URL (https) is required");
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
  await go(R.page, BASE + "/admin/ninjas/natsu-dragneel");
  await shot(R.page, "p10-live-admin.png", { x: 0, y: 0, width: 960, height: 1100 });
  await R.ctx.close();
  const M = await login(adminMail, adminPw, 390);
  for (const p of ["/ninjas", "/ninjas/natsu-dragneel", "/search?q=gai", "/admin"]) {
    await go(M.page, BASE + p);
    const overflow = await M.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`no horizontal scrolling at 390 px on ${p}`, overflow <= 0, `${overflow}px`);
  }
  await go(M.page, BASE + "/ninjas/natsu-dragneel");
  await shot(M.page, "p11-live-mobile.png", { x: 0, y: 0, width: 390, height: 900 }, false);
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
