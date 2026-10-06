import { es, type Messages } from "./es";

export const LOCALES = ["es"] as const; // add "en" here + a dictionary file to localize
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "es";

const dictionaries: Record<Locale, Messages> = { es };

type Path<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Path<typeof es>;
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale];
}

export function createTranslator(locale: Locale = DEFAULT_LOCALE): Translate {
  const messages = getMessages(locale);
  return (key, vars) => {
    let node: unknown = messages;
    for (const part of key.split(".")) node = (node as Record<string, unknown>)?.[part];
    let text = typeof node === "string" ? node : key;
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
    return text;
  };
}
