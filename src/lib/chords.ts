/**
 * Chord logic: roots, variations, transpose, and display formatting.
 * Pure functions — safe to unit test and to import anywhere.
 */
import type { Chord, Root, Variation } from './model';
import { ROOTS } from './model';

export { ROOTS };

/** Chromatic index 0..11 for every spelling we accept as a root. */
const PITCH: Record<string, number> = {
  C: 0, 'B#': 0, 'Dbb': 0,
  'C#': 1, Db: 1,
  D: 2, 'C##': 2, Ebb: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4, 'D##': 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7, 'F##': 7, Abb: 7,
  'G#': 8, Ab: 8,
  A: 9, 'G##': 9, Bbb: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11, 'A##': 11,
};

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export type Accidental = 'sharps' | 'flats';

export interface VariationDef {
  id: Variation;
  /** Suffix appended after the root, e.g. 'm', 'maj7'. '' for a major triad. */
  suffix: string;
  /** Human label for the picker. */
  label: string;
  /** Grouping for the variations panel. */
  group: 'triads' | 'sevenths' | 'sus/add' | 'extended' | 'altered';
}

/** Variation catalogue shown in the Chord Panel (Apple Chords-style). */
export const VARIATIONS: VariationDef[] = [
  { id: 'maj', suffix: '', label: 'maj', group: 'triads' },
  { id: 'min', suffix: 'm', label: 'min', group: 'triads' },
  { id: '5', suffix: '5', label: '5', group: 'triads' },
  { id: 'aug', suffix: 'aug', label: 'aug', group: 'triads' },
  { id: 'dim', suffix: 'dim', label: 'dim', group: 'triads' },

  { id: '7', suffix: '7', label: '7', group: 'sevenths' },
  { id: 'maj7', suffix: 'maj7', label: 'maj7', group: 'sevenths' },
  { id: 'm7', suffix: 'm7', label: 'm7', group: 'sevenths' },
  { id: 'm7b5', suffix: 'm7b5', label: 'm7♭5', group: 'sevenths' },
  { id: 'dim7', suffix: 'dim7', label: 'dim7', group: 'sevenths' },
  { id: '7sus4', suffix: '7sus4', label: '7sus4', group: 'sevenths' },

  { id: 'sus2', suffix: 'sus2', label: 'sus2', group: 'sus/add' },
  { id: 'sus4', suffix: 'sus4', label: 'sus4', group: 'sus/add' },
  { id: '6', suffix: '6', label: '6', group: 'sus/add' },
  { id: 'm6', suffix: 'm6', label: 'm6', group: 'sus/add' },
  { id: 'add9', suffix: 'add9', label: 'add9', group: 'sus/add' },

  { id: '9', suffix: '9', label: '9', group: 'extended' },
  { id: 'maj9', suffix: 'maj9', label: 'maj9', group: 'extended' },
  { id: 'm9', suffix: 'm9', label: 'm9', group: 'extended' },
  { id: '11', suffix: '11', label: '11', group: 'extended' },
  { id: '13', suffix: '13', label: '13', group: 'extended' },

  { id: '7b9', suffix: '7♭9', label: '7♭9', group: 'altered' },
  { id: '7sharp9', suffix: '7♯9', label: '7♯9', group: 'altered' },
  { id: '7b5', suffix: '7♭5', label: '7♭5', group: 'altered' },
  { id: '7sharp5', suffix: '7♯5', label: '7♯5', group: 'altered' },
];

const VAR_BY_ID = new Map(VARIATIONS.map((v) => [v.id, v]));

export function variationSuffix(id: Variation): string {
  return VAR_BY_ID.get(id)?.suffix ?? id;
}

/** Respell an arbitrary note name into the preferred accidental system. */
export function spell(note: string, acc: Accidental): string {
  const pc = PITCH[note];
  if (pc === undefined) return note;
  return acc === 'flats' ? FLAT_NAMES[pc] : SHARP_NAMES[pc];
}

/** Transpose a single note name by `semitones`, respelled per `acc`. */
export function transposeNote(note: string, semitones: number, acc: Accidental): string {
  const pc = PITCH[note];
  if (pc === undefined) return note;
  const next = (((pc + semitones) % 12) + 12) % 12;
  return acc === 'flats' ? FLAT_NAMES[next] : SHARP_NAMES[next];
}

/** Apply transpose + accidental preference, returning a display-ready chord. */
export function transposeChord(chord: Chord, semitones: number, acc: Accidental): Chord {
  return {
    ...chord,
    root: transposeNote(chord.root, semitones, acc) as Root,
    bass: chord.bass ? transposeNote(chord.bass, semitones, acc) : undefined,
  };
}

/** Render a chord to its display string, e.g. 'C#m7/G#'. */
export function formatChord(
  chord: Chord,
  opts: { semitones?: number; acc?: Accidental } = {},
): string {
  const acc = opts.acc ?? 'sharps';
  // Honor the chosen enharmonic spelling. When transposing we respell to the
  // accidental preference (via transposeChord); when not, we keep exactly what
  // the user picked — so Ab stays Ab and is never silently flipped to G#.
  const c = opts.semitones ? transposeChord(chord, opts.semitones, acc) : chord;
  const base = `${c.root}${variationSuffix(c.variation)}`;
  return c.bass ? `${base}/${c.bass}` : base;
}

/** Roots grouped for the horizontal scroller (naturals + accidentals interleaved). */
export const ROOT_LIST: readonly Root[] = ROOTS;

// ---- Parsing (typed chord input in the panel) ------------------------------

/** Normalise a suffix to a lookup key: unicode ♯/♭ → #/b, lower-cased. */
function normSuffix(s: string): string {
  return s.replace(/♯/g, '#').replace(/♭/g, 'b').toLowerCase();
}

/** suffix / id / label (normalised) → variation id, for typed lookup. */
const SUFFIX_TO_ID = new Map<string, Variation>();
for (const v of VARIATIONS) {
  SUFFIX_TO_ID.set(normSuffix(v.suffix), v.id);
  SUFFIX_TO_ID.set(normSuffix(v.id), v.id);
  SUFFIX_TO_ID.set(normSuffix(v.label), v.id);
}
// Common spoken aliases.
SUFFIX_TO_ID.set('maj', 'maj');
SUFFIX_TO_ID.set('major', 'maj');
SUFFIX_TO_ID.set('-', 'min');
SUFFIX_TO_ID.set('min', 'min');
SUFFIX_TO_ID.set('minor', 'min');
SUFFIX_TO_ID.set('°', 'dim');
SUFFIX_TO_ID.set('+', 'aug');

const ROOT_SET = new Set<string>(ROOTS as readonly string[]);

function parseNote(raw: string, acc: Accidental): string | undefined {
  const m = /^([A-Ga-g])([#b]*)/.exec(raw.trim());
  if (!m) return undefined;
  const name = m[1].toUpperCase() + m[2];
  if (PITCH[name] === undefined) return undefined;
  return ROOT_SET.has(name) ? name : spell(name, acc);
}

/**
 * Parse a typed chord like `C`, `Am`, `C#m7`, `Gsus4`, `D/F#`, `Bbmaj7/D`
 * into a structured Chord, or null when it isn't a recognisable chord. Roots
 * are kept as typed when they're a known spelling, otherwise respelled to the
 * preferred accidental. Accepts both `#`/`b` and `♯`/`♭`.
 */
export function parseChord(input: string, acc: Accidental = 'sharps'): Chord | null {
  const s = input.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  if (!s) return null;
  const m = /^([A-Ga-g])([#b]*)(.*)$/.exec(s);
  if (!m) return null;
  const rootRaw = m[1].toUpperCase() + m[2];
  if (PITCH[rootRaw] === undefined) return null;
  const root = (ROOT_SET.has(rootRaw) ? rootRaw : spell(rootRaw, acc)) as Root;

  let rest = m[3];
  let bass: string | undefined;
  const slash = rest.indexOf('/');
  if (slash >= 0) {
    bass = parseNote(rest.slice(slash + 1), acc);
    rest = rest.slice(0, slash);
  }

  const variation = SUFFIX_TO_ID.get(normSuffix(rest.trim()));
  if (variation === undefined) return null;
  return { root, variation, bass };
}
