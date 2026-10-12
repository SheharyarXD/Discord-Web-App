import { TRANSLATION_STATUSES, type TranslationStatus } from "./constants";

export interface LocalizedText {
  text: string | null;
  /** true = the Spanish text is absent and the original source wording is shown instead. */
  isSourceFallback: boolean;
  /** true = shown text is a translation that nobody has verified yet. */
  isDraft: boolean;
}

/**
 * Picks the text for a locale without ever pretending a translation exists.
 * The source wording is never replaced: it stays in its own column and is the fallback.
 */
export function localize(
  source: string | null | undefined,
  spanish: string | null | undefined,
  status: TranslationStatus | string,
  locale = "es",
): LocalizedText {
  const original = source ?? null;
  if (locale !== "es") return { text: original, isSourceFallback: false, isDraft: false };
  if (spanish && status !== TRANSLATION_STATUSES.MISSING) {
    return { text: spanish, isSourceFallback: false, isDraft: status !== TRANSLATION_STATUSES.VERIFIED };
  }
  return { text: original, isSourceFallback: original !== null, isDraft: false };
}

/** Lower-cased, accent-free, single-spaced form used to match names and aliases. */
export function normalizeTerm(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
