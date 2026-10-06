import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";
import { can, type Action } from "./permissions";

export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

/** For pages/layouts: redirect anonymous visitors to the login page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages/layouts: anonymous → login; authenticated non-admin → 404 (hides the admin area). */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, "admin:access")) notFound();
  return user;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function requirePermission(action: Action): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !can(user, action)) throw new ForbiddenError(action);
  return user;
}
