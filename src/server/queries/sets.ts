import "server-only";
import { db } from "@/server/db";
import { listSets as listAllSets } from "@/game/items";

export const listSets = () => listAllSets(db);
