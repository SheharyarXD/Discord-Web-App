import { createTranslator, DEFAULT_LOCALE, type Translate } from "./index";

/** Server-side translator. Locale selection (cookie/user pref) plugs in here later. */
export async function getT(): Promise<Translate> {
  return createTranslator(DEFAULT_LOCALE);
}
