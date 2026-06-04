/**
 * Staff-notation helpers. We model pitch as a diatonic `step`: an integer
 * position on the staff where 0 = the bottom staff line. This makes click-to-
 * place trivial (map a y offset to the nearest step) while still letting us name
 * the pitch for accessibility/export. Geometry (pixels) lives in the component.
 */
import type { NoteDur, NotationContent } from './model';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Letter index + base octave of the bottom staff line per clef.
const BOTTOM = {
  treble: { letter: 2, octave: 4 }, // E4
  bass: { letter: 4, octave: 2 }, // G2
} as const;

/** Name the pitch at a diatonic `step` for the given clef, e.g. 'E4', 'A5'. */
export function pitchName(step: number, clef: 'treble' | 'bass' = 'treble'): string {
  const base = BOTTOM[clef];
  const total = base.letter + step;
  const letter = LETTERS[((total % 7) + 7) % 7];
  const octave = base.octave + Math.floor(total / 7);
  return `${letter}${octave}`;
}

// Semitone offset within an octave for each diatonic letter (C..B order).
const LETTER_SEMITONE = [0, 2, 4, 5, 7, 9, 11];

/** MIDI note number for a step (+ accidental), e.g. treble step 0 = E4 = 64. */
export function stepToMidi(
  step: number,
  acc: '#' | 'b' | null | undefined,
  clef: 'treble' | 'bass' = 'treble',
): number {
  const base = BOTTOM[clef];
  const total = base.letter + step;
  const letterIdx = ((total % 7) + 7) % 7;
  const octave = base.octave + Math.floor(total / 7);
  let midi = (octave + 1) * 12 + LETTER_SEMITONE[letterIdx];
  if (acc === '#') midi += 1;
  else if (acc === 'b') midi -= 1;
  return midi;
}

export const DURATIONS: { id: NoteDur; label: string; beats: number; filled: boolean; flags: number }[] = [
  { id: 'w', label: 'שלם', beats: 4, filled: false, flags: 0 },
  { id: 'h', label: 'חצי', beats: 2, filled: false, flags: 0 },
  { id: 'q', label: 'רבע', beats: 1, filled: true, flags: 0 },
  { id: '8', label: 'שמינית', beats: 0.5, filled: true, flags: 1 },
  { id: '16', label: 'שש-עשרה', beats: 0.25, filled: true, flags: 2 },
];

export function durMeta(id: NoteDur) {
  return DURATIONS.find((d) => d.id === id) ?? DURATIONS[2];
}

/** Whole staff as a readable pitch string (remote mirror / export). */
export function notationToText(n: NotationContent): string {
  if (!n.notes.length) return '𝄞 (ריק)';
  return n.notes.map((nt) => pitchName(nt.step, n.clef) + (nt.acc ?? '')).join(' ');
}
