import { USER_ROLES, type UserRole } from "@/domain/constants";

export type Action = "content:read" | "content:write" | "users:manage" | "admin:access";

const POLICY: Record<UserRole, ReadonlySet<Action>> = {
  USER: new Set<Action>(["content:read"]),
  ADMIN: new Set<Action>(["content:read", "content:write", "users:manage", "admin:access"]),
};

/** Single source of truth for authorization. Always evaluated server-side. */
export function can(user: { role: UserRole } | null, action: Action): boolean {
  return !!user && POLICY[user.role]?.has(action) === true;
}

export const isAdmin = (user: { role: UserRole } | null) => user?.role === USER_ROLES.ADMIN;
