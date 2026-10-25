import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "./password";

/**
 * One-time bootstrap of the very first administrator.
 *
 * The page /setup exists only while BOTH hold: the environment variable SETUP_TOKEN is set (32+ characters) and the
 * database has no user at all. The person who opens the private link types their own e-mail and chooses their own password;
 * neither is ever stored in code, Git, logs or reports. After the account exists the page answers 404 for everyone, and the
 * variable should be removed from the project.
 */
export type FirstAdminError = "disabled" | "invalidToken" | "alreadyInitialized" | "invalidInput" | "weakPassword" | "mismatch";

export const MIN_SETUP_TOKEN_LENGTH = 32;
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

const sha = (value: string) => createHash("sha256").update(value).digest();
const sameToken = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));
export const tokenConfigured = (configured: string | undefined): configured is string => typeof configured === "string" && configured.length >= MIN_SETUP_TOKEN_LENGTH;

/** true only when the setup link may be shown: token configured and correct, and no user exists. */
export async function setupAvailable(db: PrismaClient, configured: string | undefined, given: string | undefined): Promise<boolean> {
  if (!tokenConfigured(configured) || typeof given !== "string" || !sameToken(configured, given)) return false;
  return (await db.user.count()) === 0;
}

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export async function createFirstAdmin(
  db: PrismaClient,
  input: { configuredToken: string | undefined; givenToken: string | undefined; email: string; password: string; confirm: string },
): Promise<{ ok: true } | { ok: false; error: FirstAdminError }> {
  if (!tokenConfigured(input.configuredToken)) return { ok: false, error: "disabled" };
  if (typeof input.givenToken !== "string" || !sameToken(input.configuredToken, input.givenToken)) return { ok: false, error: "invalidToken" };
  if ((await db.user.count()) > 0) return { ok: false, error: "alreadyInitialized" };
  const email = emailSchema.safeParse(input.email);
  if (!email.success) return { ok: false, error: "invalidInput" };
  if (input.password.length < MIN_ADMIN_PASSWORD_LENGTH || input.password.length > 200) return { ok: false, error: "weakPassword" };
  if (input.password !== input.confirm) return { ok: false, error: "mismatch" };
  const passwordHash = await hashPassword(input.password);
  // The count is checked again inside a serializable transaction, so two simultaneous submissions cannot create two accounts
  // (the loser fails with a serialization error and is reported as "already initialized").
  try {
    const created = await db.$transaction(
      async (tx) => {
        if ((await tx.user.count()) > 0) return false;
        await tx.user.create({ data: { email: email.data, name: "Administrador", role: "ADMIN", passwordHash } });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return created ? { ok: true } : { ok: false, error: "alreadyInitialized" };
  } catch {
    return (await db.user.count()) > 0 ? { ok: false, error: "alreadyInitialized" } : { ok: false, error: "invalidInput" };
  }
}
