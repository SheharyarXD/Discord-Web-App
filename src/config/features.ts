/**
 * Feature switches. A hidden section keeps its database tables and data; only its
 * navigation entry and pages are switched off.
 *
 * Gems: the client asked to hide this section for now (it may return later).
 * Set FEATURE_GEMS=true in the environment to bring it back — no migration needed.
 */
export const FEATURES = {
  gems: process.env.FEATURE_GEMS === "true",
} as const;

export type FeatureKey = keyof typeof FEATURES;
export type FeatureFlags = Readonly<Record<FeatureKey, boolean>>;
