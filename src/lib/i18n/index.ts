import { en } from './en';
import { sv, type MessageKey } from './sv';

export const LOCALES = ['sv', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'sv';

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { sv, en };

/** Falls back to Swedish, which is always complete by construction. */
export function t(key: MessageKey, locale: Locale = DEFAULT_LOCALE): string {
  return DICTIONARIES[locale][key] ?? sv[key];
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export type { MessageKey };
export { sv, en };
