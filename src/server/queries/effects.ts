import "server-only";

// The row → view mapping lives with the game services so tests and the loader share it.
export { effectInclude, toEffectView } from "@/game/effects";
