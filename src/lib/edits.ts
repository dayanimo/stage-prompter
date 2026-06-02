/**
 * Pure model edit operations on the segment/notes model. Shared infra (like model.ts):
 * the editor (Track B) and chord-panel wiring (EditView) both use these.
 * Every function mutates the passed song draft in place — call inside `updateSong`.
 */
import type { Song, Line, Chord, Note } from './model';
import { lineText } from './model';

function findLine(song: Song, lineId: string): Line | undefined {
  return song.lines.find((l) => l.id === lineId);
}

/**
 * Ensure a segment boundary exists at char index `at` within the line, returning
 * the index of the segment that STARTS at `at`. Splits a segment if needed.
 */
export function splitAt(line: Line, at: number): number {
  let acc = 0;
  for (let i = 0; i < line.segments.length; i++) {
    const seg = line.segments[i];
    const segStart = acc;
    const segEnd = acc + seg.text.length;
    if (at === segStart) return i;
    if (at > segStart && at < segEnd) {
      const before = seg.text.slice(0, at - segStart);
      const after = seg.text.slice(at - segStart);
      // The chord (if any) stays on the left part; the right part starts fresh.
      line.segments.splice(i, 1, { text: before, chord: seg.chord }, { text: after });
      return i + 1;
    }
    acc = segEnd;
  }
  // at >= total length: append an empty trailing segment.
  line.segments.push({ text: '' });
  return line.segments.length - 1;
}

/** Pin a chord above the character at `start` (selection start). */
export function applyChord(song: Song, lineId: string, start: number, chord: Chord): void {
  const line = findLine(song, lineId);
  if (!line) return;
  const idx = splitAt(line, start);
  line.segments[idx].chord = chord;
}

/** Remove the chord on a given segment. */
export function removeChord(song: Song, lineId: string, segmentIndex: number): void {
  const line = findLine(song, lineId);
  if (!line || !line.segments[segmentIndex]) return;
  delete line.segments[segmentIndex].chord;
  mergeAdjacent(line);
}

/** Merge neighbouring chord-less segments to keep the model tidy. */
export function mergeAdjacent(line: Line): void {
  for (let i = line.segments.length - 1; i > 0; i--) {
    const prev = line.segments[i - 1];
    const cur = line.segments[i];
    if (!cur.chord) {
      prev.text += cur.text;
      line.segments.splice(i, 1);
    }
  }
  if (line.segments.length === 0) line.segments.push({ text: '' });
}

/** Add or replace a note over [start,end). Notes are kept sorted by start. */
export function applyNote(song: Song, lineId: string, note: Note): void {
  const line = findLine(song, lineId);
  if (!line) return;
  line.notes = line.notes.filter((n) => n.end <= note.start || n.start >= note.end);
  line.notes.push(note);
  line.notes.sort((a, b) => a.start - b.start);
}

export function removeNote(song: Song, lineId: string, noteIndex: number): void {
  const line = findLine(song, lineId);
  if (!line) return;
  line.notes.splice(noteIndex, 1);
}

/** Replace a line's text, rebuilding into a single segment (drops chords/notes). */
export function setLineText(song: Song, lineId: string, text: string): void {
  const line = findLine(song, lineId);
  if (!line) return;
  line.segments = [{ text }];
  line.notes = [];
}

/** Set the plain text of a line while preserving chords/notes where possible.
 * Used when typing: re-flows segment text but keeps chord anchors by offset. */
export function editLineText(song: Song, lineId: string, text: string): void {
  const line = findLine(song, lineId);
  if (!line) return;
  const old = lineText(line);
  if (text === old) return;
  // Simple strategy: if only appended/truncated at the end, keep segments; else reset.
  if (text.startsWith(old)) {
    const lastWithChord = line.segments[line.segments.length - 1];
    lastWithChord.text += text.slice(old.length);
  } else if (old.startsWith(text)) {
    let remaining = text.length;
    const kept = [];
    for (const seg of line.segments) {
      if (remaining <= 0) break;
      if (seg.text.length <= remaining) {
        kept.push(seg);
        remaining -= seg.text.length;
      } else {
        kept.push({ ...seg, text: seg.text.slice(0, remaining) });
        remaining = 0;
      }
    }
    line.notes = line.notes.filter((n) => n.end <= text.length);
    line.segments = kept.length ? kept : [{ text: '' }];
  } else {
    setLineText(song, lineId, text);
  }
}
