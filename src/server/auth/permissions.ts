import { USER_ROLES, type UserRole } from "@/domain/constants";

export type Action = "content:read" | "content:write" | "users:manage" | "admin:access";

const POLICY: Record<UserRole, ReadonlySet<Action>> = {
  USER: new Set<Action>(["content:read"]),
  ADMIN: new Set<Action>(["content:read", "content:write", "users:manage", "admin:access"]),
};

/** Who is asking. `null` = anonymous. */
export type Actor = { id: string; role: UserRole } | null;

/** Single source of truth for authorization. Always evaluated server-side. */
export function can(user: { role: UserRole } | null, action: Action): boolean {
  return !!user && POLICY[user.role]?.has(action) === true;
}

export const isAdmin = (user: { role: UserRole } | null) => user?.role === USER_ROLES.ADMIN;

export class ForbiddenError extends Error {
  constructor(public readonly action: Action) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

/** Throws unless the actor may perform the action. */
export function assertCan(actor: Actor, action: Action): asserts actor is NonNullable<Actor> {
  if (!can(actor, action)) throw new ForbiddenError(action);
}
