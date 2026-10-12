import "server-only";
import { db } from "@/server/db";
import { getNinjaDetail, listNinjas as listNinjasPage } from "@/game/ninjas";
import type { NinjaListParams } from "@/game/schemas";

/** One bounded page of published ninjas, newest first. */
export const listNinjas = (params: NinjaListParams = {}) => listNinjasPage(db, params);

/** Published ninja with the VIEWER's own talent picks (never a canonical default). */
export const getNinjaBySlug = (slug: string, viewerId?: string) => getNinjaDetail(db, slug, { viewerId });
