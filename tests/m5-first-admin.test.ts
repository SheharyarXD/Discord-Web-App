import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFirstAdmin, setupAvailable } from "../src/server/auth/first-admin";
import { verifyPassword } from "../src/server/auth/password";
import { testDb } from "./helpers";

const db = testDb();
const TOKEN = "t".repeat(40);
const input = (over: Partial<Parameters<typeof createFirstAdmin>[1]> = {}) => ({ configuredToken: TOKEN, givenToken: TOKEN, email: "Owner@Example.test", password: "a-long-private-secret", confirm: "a-long-private-secret", ...over });

beforeAll(async () => {
  await db.session.deleteMany();
  await db.user.deleteMany();
});
afterAll(async () => {
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.$disconnect();
});

describe("first administrator bootstrap", () => {
  it("is disabled without a configured token, or with a short one", async () => {
    expect(await createFirstAdmin(db, input({ configuredToken: undefined }))).toEqual({ ok: false, error: "disabled" });
    expect(await createFirstAdmin(db, input({ configuredToken: "short", givenToken: "short" }))).toEqual({ ok: false, error: "disabled" });
    expect(await setupAvailable(db, undefined, TOKEN)).toBe(false);
    expect(await db.user.count()).toBe(0);
  });

  it("rejects a wrong or missing token, and bad input, without creating anything", async () => {
    expect(await createFirstAdmin(db, input({ givenToken: "x".repeat(40) }))).toEqual({ ok: false, error: "invalidToken" });
    expect(await createFirstAdmin(db, input({ givenToken: undefined }))).toEqual({ ok: false, error: "invalidToken" });
    expect(await createFirstAdmin(db, input({ email: "not-an-email" }))).toEqual({ ok: false, error: "invalidInput" });
    expect(await createFirstAdmin(db, input({ password: "short", confirm: "short" }))).toEqual({ ok: false, error: "weakPassword" });
    expect(await createFirstAdmin(db, input({ confirm: "another-long-secret!" }))).toEqual({ ok: false, error: "mismatch" });
    expect(await setupAvailable(db, TOKEN, "wrong")).toBe(false);
    expect(await db.user.count()).toBe(0);
  });

  it("the page is available with the right token while no account exists", async () => {
    expect(await setupAvailable(db, TOKEN, TOKEN)).toBe(true);
  });

  it("creates exactly one administrator with a hashed password, and the e-mail is normalised", async () => {
    expect(await createFirstAdmin(db, input())).toEqual({ ok: true });
    const users = await db.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: "owner@example.test", role: "ADMIN", isActive: true });
    expect(users[0]!.passwordHash).not.toContain("a-long-private-secret");
    expect(await verifyPassword("a-long-private-secret", users[0]!.passwordHash)).toBe(true);
    expect(await verifyPassword("something-else-entirely", users[0]!.passwordHash)).toBe(false);
  });

  it("then closes: no second account can be created and the page is unavailable", async () => {
    expect(await createFirstAdmin(db, input({ email: "second@example.test" }))).toEqual({ ok: false, error: "alreadyInitialized" });
    expect(await setupAvailable(db, TOKEN, TOKEN)).toBe(false);
    expect(await db.user.count()).toBe(1);
  });

  it("two simultaneous submissions still create only one account", async () => {
    await db.session.deleteMany();
    await db.user.deleteMany();
    const results = await Promise.all([createFirstAdmin(db, input({ email: "a@example.test" })), createFirstAdmin(db, input({ email: "b@example.test" }))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.user.count()).toBe(1);
  });
});
