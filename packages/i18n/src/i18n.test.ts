import { describe, expect, it } from 'vitest';
import { createI18n, formatINR, pickLocalized, resources } from './index';

type Tree = { [k: string]: string | Tree };
const flatten = (o: Tree, p = ''): Record<string, string> =>
  Object.entries(o).reduce((acc, [k, v]) => ({ ...acc, ...(typeof v === 'string' ? { [`${p}${k}`]: v } : flatten(v, `${p}${k}.`)) }), {} as Record<string, string>);
const vars = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort();

const en = flatten(resources.en as unknown as Tree);

describe.each(['te', 'hi'] as const)('%s translations', (lng) => {
  const other = flatten(resources[lng] as unknown as Tree);
  it('has exactly the same keys as English', () => {
    expect(Object.keys(other).sort()).toEqual(Object.keys(en).sort());
  });
  it('has no empty values', () => {
    expect(Object.entries(other).filter(([, v]) => !v.trim())).toEqual([]);
  });
  it('keeps the same interpolation variables', () => {
    const mismatched = Object.keys(en).filter((k) => vars(en[k]!).join() !== vars(other[k]!).join());
    expect(mismatched).toEqual([]);
  });
  it('is actually translated (not copied English) for most strings', () => {
    const same = Object.keys(en).filter((k) => en[k] === other[k] && /[a-z]{4,}/.test(en[k]!));
    // Brand names, language names and test acronyms legitimately stay in English.
    expect(same.length).toBeLessThan(10);
  });
});

describe('runtime', () => {
  it('switches language and falls back to English for unknown keys', () => {
    const te = createI18n('te');
    expect(te.t('navigation:checkEligibility')).toBe('అర్హతను పరిశీలించండి');
    expect(createI18n('hi').t('navigation:checkEligibility')).toBe('पात्रता जाँचें');
    expect(te.t('counseling:types.SCHOLARSHIP')).toBe('స్కాలర్‌షిప్ మార్గదర్శనం');
    te.addResource('en', 'common', 'onlyInEnglish', 'English fallback');
    expect(te.t('common:onlyInEnglish')).toBe('English fallback');
  });
  it('picks localized CMS content with English fallback', () => {
    expect(pickLocalized({ en: 'Hi', te: '' }, 'te')).toBe('Hi');
    expect(pickLocalized({ en: 'Hi', hi: 'नमस्ते' }, 'hi')).toBe('नमस्ते');
  });
  it('formats rupees in Indian grouping', () => {
    expect(formatINR(2000000, 'en')).toBe('₹20,00,000');
  });
});
