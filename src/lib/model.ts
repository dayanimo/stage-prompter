/**
 * Stage Prompter — domain model. The single source of truth for data shapes.
 * Every track imports types/helpers from here. Do not fork these types.
 */

// ---- Chords ----------------------------------------------------------------

export const ROOTS = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb',
  'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb',
] as const;
export type Root = (typeof ROOTS)[number];

/** Variation id -> human label is in chords.ts (VARIATIONS). Kept open-ended. */
export type Variation = string;

export interface Chord {
  root: Root;
  variation: Variation; // e.g. 'maj', 'min', '7', 'm7', 'sus4'
  bass?: string; // optional slash-chord bass note, e.g. 'G' for C/G
}

// ---- Lines / segments / notes ----------------------------------------------

/** A line is a sequence of segments; a chord pins to a segment's start. */
export interface Segment {
  text: string;
  chord?: Chord;
}

/** A note is a character range over the line's concatenated text. */
export interface Note {
  start: number; // inclusive char index into the line's full text
  end: number; // exclusive
  label: string; // e.g. 'Guitar solo'
  highlight: string; // CSS color for the highlighted run
}

export type SectionKind =
  | 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'solo' | 'outro' | string;

export interface Line {
  id: string;
  segments: Segment[];
  notes: Note[];
  section?: SectionKind;
}

// ---- Theme / song / set ----------------------------------------------------

export interface SongTheme {
  bg?: string;
  text?: string;
  chord?: string;
  note?: string;
  lyricSize?: number; // px
  chordSize?: number; // px
  noteSize?: number; // px
}

export interface TimeSignature {
  beats: number; // numerator, e.g. 4
  unit: number; // denominator, e.g. 4
}

export type Direction = 'rtl' | 'ltr' | 'auto';

export interface Song {
  id: string;
  title: string;
  dir: Direction;
  lines: Line[];
  timeSig: TimeSignature;
  bpm: number;
  capo?: number;
  transpose?: number; // semitones applied to displayed chords
  theme?: SongTheme;
  scrollSpeed?: number; // remembered per-song auto-scroll speed
  createdAt: number;
  updatedAt: number;
}

export interface SetList {
  id: string;
  name: string;
  songIds: string[]; // ordered
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  defaultTheme: Required<SongTheme>;
  accidentalPref: 'sharps' | 'flats';
  clickEnabled: boolean;
  countInBars: number; // 0 = off
  chromeDir: Direction; // app chrome direction default
  autoAdvance: boolean; // play the set song-after-song automatically
}

// ---- Defaults & factories --------------------------------------------------

export const DEFAULT_THEME: Required<SongTheme> = {
  bg: 'oklch(0.08 0 0)',
  text: 'oklch(0.97 0 0)',
  chord: 'oklch(0.8 0.13 75)',
  note: 'oklch(0.72 0.118 200)',
  lyricSize: 40,
  chordSize: 28,
  noteSize: 20,
};

export const DEFAULT_SETTINGS: AppSettings = {
  defaultTheme: { ...DEFAULT_THEME },
  accidentalPref: 'sharps',
  clickEnabled: false,
  countInBars: 1,
  chromeDir: 'rtl',
  autoAdvance: true,
};

/** Time-ordered, URL-safe unique id. Avoids crypto dependency assumptions. */
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rand}`;
}

export function lineText(line: Line): string {
  return line.segments.map((s) => s.text).join('');
}

export function createLine(text = ''): Line {
  return { id: uid('ln_'), segments: [{ text }], notes: [] };
}

export function createSong(title = 'New Song'): Song {
  const now = Date.now();
  return {
    id: uid('sg_'),
    title,
    dir: 'auto',
    lines: [createLine('')],
    timeSig: { beats: 4, unit: 4 },
    bpm: 100,
    transpose: 0,
    capo: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSetList(name = 'New Set'): SetList {
  const now = Date.now();
  return { id: uid('st_'), name, songIds: [], createdAt: now, updatedAt: now };
}

/** Resolve a song's effective theme by layering song overrides over defaults. */
export function resolveTheme(song: Song, settings: AppSettings): Required<SongTheme> {
  return { ...settings.defaultTheme, ...(song.theme ?? {}) };
}
