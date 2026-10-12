import "server-only";
import { db } from "@/server/db";
import { listStatusEffects } from "@/game/status-effects";

export const listGlossary = () => listStatusEffects(db);
