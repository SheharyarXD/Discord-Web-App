import "server-only";
import { gameApi } from "@/game/api";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";

/**
 * The game-data API bound to the CURRENT request's user. Every method re-checks permission on
 * the server, so server actions and route handlers can call it without their own role logic.
 */
export async function getGameApi() {
  return gameApi(db, await getCurrentUser());
}
