import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, en, isLocale, sv, t } from './index';

describe('i18n bundles', () => {
  it('defaults to Swedish, the source of truth for checklist wording', () => {
    expect(DEFAULT_LOCALE).toBe('sv');
    expect(t('answer.ja')).toBe('Ja');
  });

  it('translates when an explicit locale is given', () => {
    expect(t('answer.ingetBehov', 'en')).toBe('Not needed');
  });

  it('has an English string for every Swedish key', () => {
    const missing = Object.keys(sv).filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });

  it('has no blank translations in either bundle', () => {
    const blank = [...Object.entries(sv), ...Object.entries(en)].filter(
      ([, value]) => value.trim() === '',
    );
    expect(blank).toEqual([]);
  });

  it('keeps the "hinner inte" coaching text, which the paper form mandates', () => {
    expect(sv['note.whyNot']).toContain('hinner inte');
  });

  it('recognises supported locales only', () => {
    expect(isLocale('sv')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });
});
