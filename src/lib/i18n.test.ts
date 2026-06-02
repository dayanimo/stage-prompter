import { describe, it, expect } from 'vitest';
import { hePluralCategory, plural, NOUNS, formatNumber } from './i18n';

describe('hePluralCategory', () => {
  it('uses one / two / other per CLDR Hebrew rules', () => {
    expect(hePluralCategory(1)).toBe('one');
    expect(hePluralCategory(2)).toBe('two');
    expect(hePluralCategory(0)).toBe('other');
    expect(hePluralCategory(3)).toBe('other');
    expect(hePluralCategory(11)).toBe('other');
  });

  it('treats decimals (incl. 1.0/2.0) as other', () => {
    expect(hePluralCategory(1.5)).toBe('other');
    expect(hePluralCategory(2.5)).toBe('other');
  });
});

describe('plural', () => {
  it('renders the dual form for two — not "2 <plural>"', () => {
    expect(plural(1, NOUNS.song)).toBe('שיר אחד');
    expect(plural(2, NOUNS.song)).toBe('שני שירים');
    expect(plural(5, NOUNS.song)).toBe('5 שירים');
  });

  it('handles feminine nouns with the correct dual', () => {
    expect(plural(1, NOUNS.line)).toBe('שורה אחת');
    expect(plural(2, NOUNS.line)).toBe('שתי שורות');
    expect(plural(2, NOUNS.bar)).toBe('שתי תיבות');
  });
});

describe('formatNumber', () => {
  it('uses Israeli grouping', () => {
    expect(formatNumber(1234)).toBe('1,234');
  });
});
