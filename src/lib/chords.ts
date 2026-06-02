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
  const c = opts.semitones ? transposeChord(chord, opts.semitones, acc) : chord;
  const base = `${spell(c.root, acc)}${variationSuffix(c.variation)}`;
  return c.bass ? `${base}/${spell(c.bass, acc)}` : base;
}

/** Roots grouped for the horizontal scroller (naturals + accidentals interleaved). */
export const ROOT_LIST: readonly Root[] = ROOTS;
