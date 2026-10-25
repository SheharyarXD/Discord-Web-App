import { randomBytes } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { chromium } from "playwright-core";

/**
 * End-to-end check of the first-administrator flow on a PREVIEW deployment (never production): the page is hidden without the token,
 * the client can choose an e-mail and password, exactly one administrator is created, the page then closes, sign-in, role restrictions,
 * session persistence and sign-out work. Throw-away accounts are deleted at the end (the preview database ends with 0 users).
 *   node scripts/with-vercel-env.mjs preview -- env TARGET_BASE_URL=<preview url> VERCEL_BYPASS_SECRET=... SETUP_TOKEN_FILE=.setup-token-preview.tmp node scripts/verify-setup-flow.mjs
 */
const BASE = process.env.TARGET_BASE_URL?.replace(/\/$/, "");
if (!BASE || /^https:\/\/furia-ninja(-furia-ninja)?\.vercel\.app$/.test(BASE)) throw new Error("a PREVIEW url is required; production is refused");
const token = readFileSync(process.env.SETUP_TOKEN_FILE ?? ".setup-token-preview.tmp", "utf8").trim();
const headers = process.env.VERCEL_BYPASS_SECRET ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS_SECRET } : {};
const db = new PrismaClient();
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " | " + extra : ""}`); };
const email = "setup-check@example.test";
const regularMail = "setup-check-user@example.test";
const password = randomBytes(12).toString("hex");
const regularPw = randomBytes(12).toString("hex");
const wipe = async () => { await db.session.deleteMany(); await db.user.deleteMany(); };

const browser = await chromium.launch({ executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
try {
  if ((await db.user.count()) > 0) throw new Error("the preview database already has users; refusing to touch it");
  const status = async (url) => (await fetch(url, { headers, redirect: "manual" })).status;
  check("/setup without a token is 404", (await status(BASE + "/setup")) === 404);
  check("/setup with a wrong token is 404", (await status(BASE + "/setup?token=" + "0".repeat(64))) === 404);
  check("/setup with the right token is available", (await status(BASE + "/setup?token=" + token)) === 200);

  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, locale: "es", extraHTTPHeaders: headers });
  const page = await ctx.newPage();
  await page.goto(BASE + "/setup?token=" + token, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.fill("#confirm", password + "x");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => /no coinciden/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  check("mismatching passwords are refused with a Spanish message", /no coinciden/.test(await page.locator("body").innerText()) && (await db.user.count()) === 0);
  await page.fill("#password", "corta");
  await page.fill("#confirm", "corta");
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => /al menos 12/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  check("a short password is refused", /al menos 12/.test(await page.locator("body").innerText()) && (await db.user.count()) === 0);
  await page.fill("#password", password);
  await page.fill("#confirm", password);
  await Promise.all([page.waitForURL(/\/login/, { timeout: 30000 }), page.click('button[type="submit"]')]);
  check("the account is created and the client lands on the sign-in page", /\/login/.test(page.url()));
  const users = await db.user.findMany();
  check("exactly one user exists, an active administrator, with a hashed password", users.length === 1 && users[0].role === "ADMIN" && users[0].isActive && users[0].email === email && !users[0].passwordHash.includes(password) && (await bcrypt.compare(password, users[0].passwordHash)));
  check("the setup page is closed afterwards (404 even with the token)", (await status(BASE + "/setup?token=" + token)) === 404);

  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);
  check("the new administrator can sign in", !/\/login/.test(page.url()));
  const cookie = (await ctx.cookies()).find((c) => /session/i.test(c.name));
  check("session cookie is Secure and HttpOnly", Boolean(cookie?.secure && cookie?.httpOnly));
  let persisted = true;
  for (const p of ["/ninjas", "/ninjas/natsu-dragneel", "/admin", "/admin/users", "/ninjas?page=2"]) {
    const r = await page.goto(BASE + p, { waitUntil: "domcontentloaded" });
    persisted &&= r.status() === 200 && !/\/login/.test(page.url());
  }
  check("the session persists across requests and administration opens", persisted);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /cerrar sesión/i }).first().click().catch(() => {});
  await page.waitForURL(/\/login/, { timeout: 20000 }).catch(() => {});
  check("sign-out ends the session", /\/login/.test(page.url()));
  await page.goto(BASE + "/admin", { waitUntil: "domcontentloaded" });
  check("after sign-out the administration redirects to the sign-in page", /\/login/.test(page.url()));
  await ctx.close();

  await db.user.create({ data: { email: regularMail, name: "Setup check user", role: "USER", passwordHash: await bcrypt.hash(regularPw, 10) } });
  const ctx2 = await browser.newContext({ viewport: { width: 1000, height: 900 }, locale: "es", extraHTTPHeaders: headers });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + "/login", { waitUntil: "networkidle" });
  await p2.fill('input[name="email"]', regularMail);
  await p2.fill('input[name="password"]', regularPw);
  await Promise.all([p2.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 }), p2.click('button[type="submit"]')]);
  const adminAsUser = await p2.goto(BASE + "/admin");
  check("a regular user gets 404 on the administration", adminAsUser.status() === 404);
  await ctx2.close();
} catch (e) {
  check("script completed without an unexpected error", false, String(e).slice(0, 300));
} finally {
  await browser.close();
  await wipe();
  check("throw-away accounts removed (0 users left)", (await db.user.count()) === 0);
  await db.$disconnect();
  if (results.every(Boolean)) rmSync(process.env.SETUP_TOKEN_FILE ?? ".setup-token-preview.tmp", { force: true });
  console.log(`\n${results.filter(Boolean).length} passed, ${results.filter((r) => !r).length} failed`);
  process.exitCode = results.every(Boolean) ? 0 : 1;
}
