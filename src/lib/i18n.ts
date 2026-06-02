/**
 * Hebrew localization helpers.
 *
 * This is a local-first Svelte app with a single (Hebrew) UI locale, so there
 * is no i18n framework — but Hebrew still needs two things English doesn't:
 *   1. Plural agreement with three CLDR categories (one / two / other), where
 *      "two" is a distinct dual form (שתי שורות, not 2 שורה).
 *   2. Bidi-safe embedding of LTR runs (numbers, "BPM", "4/4") inside RTL text,
 *      so they don't get visually reordered.
 */

// ---- Plurals ---------------------------------------------------------------

/** Forms for a counted noun. `other` uses {n} as the number placeholder. */
export interface PluralForms {
  one: string; // n = 1
  two: string; // n = 2 (Hebrew dual)
  other: string; // 0, 3+, decimals
}

/** Unicode CLDR plural category for Hebrew: one (n=1), two (n=2), other. */
export function hePluralCategory(n: number): keyof PluralForms {
  if (Number.isInteger(n)) {
    if (n === 1) return 'one';
    if (n === 2) return 'two';
  }
  return 'other';
}

/** Counted Hebrew nouns used across the UI, with correct dual forms. */
export const NOUNS = {
  chord: { one: 'אקורד אחד', two: 'שני אקורדים', other: '{n} אקורדים' },
  line: { one: 'שורה אחת', two: 'שתי שורות', other: '{n} שורות' },
  song: { one: 'שיר אחד', two: 'שני שירים', other: '{n} שירים' },
  bar: { one: 'תיבה אחת', two: 'שתי תיבות', other: '{n} תיבות' },
} as const satisfies Record<string, PluralForms>;

/**
 * Render a count with the grammatically correct Hebrew form, e.g.
 *   plural(1, NOUNS.song) -> "שיר אחד"
 *   plural(2, NOUNS.song) -> "שני שירים"
 *   plural(5, NOUNS.song) -> "5 שירים"
 */
export function plural(n: number, forms: PluralForms): string {
  const form = forms[hePluralCategory(n)];
  return form.replace('{n}', formatNumber(n));
}

// ---- Numbers & bidi --------------------------------------------------------

const heNumber = new Intl.NumberFormat('he-IL');

/** Format a number with Israeli conventions (1,234.5). */
export function formatNumber(n: number): string {
  return heNumber.format(n);
}

// Unicode bidi isolates: First-Strong Isolate ... Pop Directional Isolate.
const LRI = '⁦'; // Left-to-Right Isolate
const PDI = '⁩'; // Pop Directional Isolate

/**
 * Isolate an LTR run inside RTL text for contexts that can't use markup —
 * confirm()/alert() strings, aria-labels, tap hints. In HTML, prefer
 * <bdi> or dir="ltr" instead.
 */
export function ltrIsolate(text: string | number): string {
  return `${LRI}${text}${PDI}`;
}
