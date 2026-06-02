/**
 * Chart importer — turns a pasted "chords above lyrics" text chart into a Song.
 *
 * Supports the two formats every chord site / songbook uses:
 *   1. Column-aligned: a chord line sits above a lyric line, each chord token
 *      positioned (by spaces) over the syllable where it changes.
 *   2. Inline ChordPro: chords in brackets within the lyric, e.g. "[Am]שלום".
 *
 * IMPORTANT: this parser only transforms text you provide. It does not fetch
 * anything. Only paste charts you have the right to use (your own
 * transcriptions, public-domain works, or licensed material).
 */
import {
  type Song,
  type Line,
  type Segment,
  type Chord,
  type Root,
  type Variation,
  uid,
} from './model';

// ---- Chord token parsing ---------------------------------------------------

const ROOT_RE = '[A-G](?:#|##|b|bb)?';
/** A bare chord token, optionally with a slash bass: e.g. C#m7, Gsus4, D/F#. */
const CHORD_TOKEN_RE = new RegExp(
  `^${ROOT_RE}[a-zA-Z0-9+\\-#b°Δ()]*?(?:/${ROOT_RE})?$`,
);

/**
 * Map a written chord suffix to one of the model's Variation ids.
 * Order matters: longer / more specific spellings are tested first.
 */
const SUFFIX_RULES: [RegExp, Variation][] = [
  [/^(maj7|M7|Δ7?)$/, 'maj7'],
  [/^(m7b5|min7b5|ø)$/, 'm7b5'],
  [/^(dim7|°7)$/, 'dim7'],
  [/^(m7|min7|-7)$/, 'm7'],
  [/^(maj9|M9)$/, 'maj9'],
  [/^(m9|min9|-9)$/, 'm9'],
  [/^(m6|min6|-6)$/, 'm6'],
  [/^(7sus4|7sus)$/, '7sus4'],
  [/^(sus4|sus)$/, 'sus4'],
  [/^sus2$/, 'sus2'],
  [/^add9$/, 'add9'],
  [/^(aug|\+)$/, 'aug'],
  [/^(dim|°)$/, 'dim'],
  [/^(m|min|-)$/, 'min'],
  [/^7b9$/, '7b9'],
  [/^(7#9|7sharp9)$/, '7sharp9'],
  [/^7b5$/, '7b5'],
  [/^(7#5|7sharp5)$/, '7sharp5'],
  [/^maj$/, 'maj'],
  [/^7$/, '7'],
  [/^9$/, '9'],
  [/^11$/, '11'],
  [/^13$/, '13'],
  [/^6$/, '6'],
  [/^5$/, '5'],
  [/^$/, 'maj'], // bare root -> major triad
];

const VALID_ROOTS = new Set<string>([
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb',
  'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb',
]);

function normalizeRoot(raw: string): Root | null {
  // Capitalize the letter, keep accidentals as written.
  const m = /^([A-Ga-g])(#|##|b|bb)?$/.exec(raw);
  if (!m) return null;
  const root = m[1].toUpperCase() + (m[2] ?? '');
  return VALID_ROOTS.has(root) ? (root as Root) : null;
}

function suffixToVariation(suffix: string): Variation | null {
  for (const [re, id] of SUFFIX_RULES) {
    if (re.test(suffix)) return id;
  }
  return null;
}

/** Parse a single chord token (e.g. "C#m7/G#") into a Chord, or null if invalid. */
export function parseChordToken(token: string): Chord | null {
  const t = token.trim();
  if (!t || !CHORD_TOKEN_RE.test(t)) return null;

  let bass: string | undefined;
  let body = t;
  const slash = t.indexOf('/');
  if (slash !== -1) {
    const bassRoot = normalizeRoot(t.slice(slash + 1));
    if (!bassRoot) return null;
    bass = bassRoot;
    body = t.slice(0, slash);
  }

  const rm = new RegExp(`^(${ROOT_RE})`).exec(body);
  if (!rm) return null;
  const root = normalizeRoot(rm[1]);
  if (!root) return null;

  const variation = suffixToVariation(body.slice(rm[1].length));
  if (!variation) return null;

  return bass ? { root, variation, bass } : { root, variation };
}

/** True if every whitespace-separated token on the line is a chord. */
function isChordLine(text: string): boolean {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((tok) => parseChordToken(tok) !== null);
}

// ---- Section detection ------------------------------------------------------

// Note: \b word boundaries are avoided for Hebrew — Hebrew letters are not
// \w in JS regex, so \bפזמון\b never matches. Latin keys keep boundaries.
const SECTION_PATTERNS: [RegExp, string][] = [
  [/\bintro\b|אינטרו|פתיחה/i, 'intro'],
  [/\bverse\b|בית/i, 'verse'],
  [/\bpre[\s-]?chorus\b|פר[י]?[\s-]?פזמון/i, 'prechorus'],
  [/\b(chorus|refrain)\b|פזמון/i, 'chorus'],
  [/\bbridge\b|גשר/i, 'bridge'],
  [/\bsolo\b|סולו/i, 'solo'],
  [/\b(outro|coda)\b|סיום|יציאה/i, 'outro'],
];

/** A bracketed/parenthesized label line like "[Chorus]" or "פזמון:". */
function detectSection(text: string): string | undefined {
  const stripped = text.trim().replace(/^[[\](){}]+|[[\](){}:]+$/g, '').trim();
  if (!stripped) return undefined;
  const looksLikeLabel = /^[[\](){}]/.test(text.trim()) || /:$/.test(text.trim());
  if (!looksLikeLabel) return undefined;
  for (const [re, kind] of SECTION_PATTERNS) {
    if (re.test(stripped)) return kind;
  }
  return undefined;
}

// ---- Column-aligned chord placement -----------------------------------------

interface PlacedChord {
  col: number; // char index into the lyric line where the chord change starts
  chord: Chord;
}

/** Extract chord tokens with their column index from a chord line. */
function placedChords(chordLine: string): PlacedChord[] {
  const out: PlacedChord[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chordLine)) !== null) {
    const chord = parseChordToken(m[0]);
    if (chord) out.push({ col: m.index, chord });
  }
  return out;
}

/**
 * Split a lyric line into segments, pinning each chord to the start of the
 * segment that begins at (or nearest to) its column. Columns are logical
 * string indices, so this works for RTL Hebrew too — alignment lives in the
 * source text, independent of display direction.
 */
function segmentLyric(lyric: string, chords: PlacedChord[]): Segment[] {
  if (chords.length === 0) return [{ text: lyric }];

  const sorted = [...chords].sort((a, b) => a.col - b.col);
  const segs: Segment[] = [];

  // Lyric text before the first chord (e.g. a pickup syllable) gets no chord.
  const firstCol = Math.min(sorted[0].col, lyric.length);
  if (firstCol > 0) segs.push({ text: lyric.slice(0, firstCol) });

  for (let i = 0; i < sorted.length; i++) {
    const start = Math.min(sorted[i].col, lyric.length);
    const end = i + 1 < sorted.length ? Math.min(sorted[i + 1].col, lyric.length) : lyric.length;
    segs.push({ text: lyric.slice(start, end), chord: sorted[i].chord });
  }
  return segs.filter((s) => s.text.length > 0 || s.chord);
}

// ---- Inline ChordPro --------------------------------------------------------

const INLINE_RE = /\[([^\]]+)\]/g;

/** True if the line uses inline [chord] markup. */
function hasInlineChords(text: string): boolean {
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (parseChordToken(m[1])) return true;
  }
  return false;
}

function segmentInline(text: string): Segment[] {
  const segs: Segment[] = [];
  let last = 0;
  let pendingChord: Chord | undefined;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_RE.exec(text)) !== null) {
    const before = text.slice(last, m.index);
    if (before.length > 0 || pendingChord) {
      segs.push(pendingChord ? { text: before, chord: pendingChord } : { text: before });
    }
    pendingChord = parseChordToken(m[1]) ?? undefined;
    last = m.index + m[0].length;
  }
  const tail = text.slice(last);
  if (tail.length > 0 || pendingChord) {
    segs.push(pendingChord ? { text: tail, chord: pendingChord } : { text: tail });
  }
  return segs.length ? segs : [{ text }];
}

// ---- Whole-chart parsing ----------------------------------------------------

export interface ParseOptions {
  bpm?: number;
  beats?: number;
  dir?: Song['dir'];
}

export interface ParseResult {
  lines: Line[];
  chordCount: number;
}

function mkLine(segments: Segment[], section?: string): Line {
  return {
    id: uid('ln_'),
    segments: segments.length ? segments : [{ text: '' }],
    notes: [],
    ...(section ? { section } : {}),
  };
}

/** Parse chart text into lines + a chord count (for feedback). */
export function parseChart(text: string): ParseResult {
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  const lines: Line[] = [];
  let chordCount = 0;
  let currentSection: string | undefined;

  for (let i = 0; i < raw.length; i++) {
    const rowRaw = raw[i];
    const row = rowRaw.replace(/\s+$/g, '');

    // Section label line.
    const section = detectSection(row);
    if (section) {
      currentSection = section;
      continue;
    }

    // Inline ChordPro line.
    if (hasInlineChords(row)) {
      const segs = segmentInline(row);
      chordCount += segs.filter((s) => s.chord).length;
      lines.push(mkLine(segs, currentSection));
      currentSection = undefined;
      continue;
    }

    // Column-aligned: chord line followed by a lyric line.
    if (isChordLine(row)) {
      const next = raw[i + 1]?.replace(/\s+$/g, '') ?? '';
      const chords = placedChords(row);
      chordCount += chords.length;
      if (next.trim() && !isChordLine(next) && !detectSection(next)) {
        lines.push(mkLine(segmentLyric(next, chords), currentSection));
        currentSection = undefined;
        i++; // consume the lyric line
      } else {
        // Chord-only line (e.g. an intro progression): keep chords, no lyric.
        const segs = chords.map((p) => ({ text: '', chord: p.chord }));
        lines.push(mkLine(segs, currentSection));
        currentSection = undefined;
      }
      continue;
    }

    // Plain lyric / blank line.
    if (row.trim() === '') {
      lines.push(mkLine([{ text: '' }]));
    } else {
      lines.push(mkLine([{ text: row }], currentSection));
      currentSection = undefined;
    }
  }

  return { lines, chordCount };
}

/** RTL if the text contains Hebrew/Arabic characters. */
function guessDir(text: string): Song['dir'] {
  return /[֐-׿؀-ۿ]/.test(text) ? 'rtl' : 'ltr';
}

/** Build a full Song from a title + pasted chart. */
export function songFromChart(title: string, chart: string, opts: ParseOptions = {}): Song {
  const now = Date.now();
  const { lines } = parseChart(chart);
  return {
    id: uid('sg_'),
    title: title.trim() || 'Imported Song',
    dir: opts.dir ?? guessDir(chart),
    lines: lines.length ? lines : [mkLine([{ text: '' }])],
    timeSig: { beats: opts.beats ?? 4, unit: 4 },
    bpm: opts.bpm ?? 100,
    capo: 0,
    transpose: 0,
    createdAt: now,
    updatedAt: now,
  };
}
