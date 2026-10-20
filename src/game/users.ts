import bcrypt from "bcryptjs";
import { z } from "zod";
import { USER_ROLES, type UserRole } from "../domain/constants";
import { ValidationError, parseInput, type Db } from "./db";

/**
 * Account management for the administrator. Permission is checked by the caller (gameApi: users:manage).
 *
 * Rules kept here, so no screen can break them:
 *  - an administrator cannot demote, deactivate or delete themselves;
 *  - the last active administrator can never be demoted, deactivated or deleted;
 *  - deactivating an account, deleting it or resetting its password ends its sessions;
 *  - passwords are stored only as bcrypt hashes and are never returned.
 */

export const MIN_PASSWORD_LENGTH = 10;
const COST = 12;

const email = z.string().trim().toLowerCase().email().max(200);
const password = z.string().min(MIN_PASSWORD_LENGTH, `at least ${MIN_PASSWORD_LENGTH} characters`).max(200);
const role = z.enum([USER_ROLES.USER, USER_ROLES.ADMIN]);

export const createUserInput = z.object({ email, name: z.string().trim().max(120).nullish(), role: role.default("USER"), password });
export type CreateUserInput = z.input<typeof createUserInput>;

export const updateUserInput = z.object({ name: z.string().trim().max(120).nullish(), role: role.optional(), isActive: z.boolean().optional() });
export type UpdateUserInput = z.input<typeof updateUserInput>;

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export class UserRuleError extends ValidationError {
  constructor(public readonly code: "SELF" | "LAST_ADMIN" | "NOT_FOUND" | "EMAIL_TAKEN", message: string) {
    super(message);
    this.name = "UserRuleError";
  }
}

const select = { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, createdAt: true } as const;
const toRow = (u: { id: string; email: string; name: string | null; role: string; isActive: boolean; lastLoginAt: Date | null; createdAt: Date }): UserRow => ({ ...u, role: u.role as UserRole });

export async function listUsers(db: Db): Promise<UserRow[]> {
  return (await db.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }], select })).map(toRow);
}

export async function createUser(db: Db, input: CreateUserInput): Promise<UserRow> {
  const d = parseInput(createUserInput, input, "user");
  if (await db.user.findUnique({ where: { email: d.email }, select: { id: true } })) throw new UserRuleError("EMAIL_TAKEN", "There is already an account with that email");
  const row = await db.user.create({ data: { email: d.email, name: d.name ?? null, role: d.role, passwordHash: await bcrypt.hash(d.password, COST) }, select });
  return toRow(row);
}

async function otherActiveAdmins(db: Db, id: string) {
  return db.user.count({ where: { role: USER_ROLES.ADMIN, isActive: true, id: { not: id } } });
}

export async function updateUser(db: Db, actorId: string, id: string, input: UpdateUserInput): Promise<UserRow> {
  const d = parseInput(updateUserInput, input, "user");
  const current = await db.user.findUnique({ where: { id }, select });
  if (!current) throw new UserRuleError("NOT_FOUND", "User not found");
  const demotes = d.role !== undefined && d.role !== USER_ROLES.ADMIN && current.role === USER_ROLES.ADMIN;
  const deactivates = d.isActive === false && current.isActive;
  if ((demotes || deactivates) && id === actorId) throw new UserRuleError("SELF", "You cannot remove your own administrator access");
  if ((demotes || deactivates) && current.role === USER_ROLES.ADMIN && current.isActive && (await otherActiveAdmins(db, id)) === 0) {
    throw new UserRuleError("LAST_ADMIN", "There must always be one active administrator");
  }
  const row = await db.user.update({
    where: { id },
    data: { ...(d.name !== undefined ? { name: d.name } : {}), ...(d.role ? { role: d.role } : {}), ...(d.isActive !== undefined ? { isActive: d.isActive } : {}) },
    select,
  });
  // Access that was revoked ends now, not when the session expires.
  if (deactivates || demotes) await db.session.deleteMany({ where: { userId: id } });
  return toRow(row);
}

export async function resetPassword(db: Db, id: string, newPassword: string): Promise<void> {
  const d = parseInput(z.object({ password }), { password: newPassword }, "password");
  if (!(await db.user.findUnique({ where: { id }, select: { id: true } }))) throw new UserRuleError("NOT_FOUND", "User not found");
  await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(d.password, COST) } });
  await db.session.deleteMany({ where: { userId: id } });
}

export async function deleteUser(db: Db, actorId: string, id: string): Promise<void> {
  if (id === actorId) throw new UserRuleError("SELF", "You cannot delete your own account");
  const current = await db.user.findUnique({ where: { id }, select });
  if (!current) throw new UserRuleError("NOT_FOUND", "User not found");
  if (current.role === USER_ROLES.ADMIN && current.isActive && (await otherActiveAdmins(db, id)) === 0) {
    throw new UserRuleError("LAST_ADMIN", "There must always be one active administrator");
  }
  await db.user.delete({ where: { id } });
}
