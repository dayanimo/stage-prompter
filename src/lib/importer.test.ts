import { describe, it, expect } from 'vitest';
import { parseChordToken, parseChart, songFromChart } from './importer';
import { lineText } from './model';

describe('parseChordToken', () => {
  it('parses a bare major triad', () => {
    expect(parseChordToken('C')).toEqual({ root: 'C', variation: 'maj' });
  });

  it('parses minor, sevenths and extensions', () => {
    expect(parseChordToken('Am')).toEqual({ root: 'A', variation: 'min' });
    expect(parseChordToken('G7')).toEqual({ root: 'G', variation: '7' });
    expect(parseChordToken('Cmaj7')).toEqual({ root: 'C', variation: 'maj7' });
    expect(parseChordToken('Dm7')).toEqual({ root: 'D', variation: 'm7' });
    expect(parseChordToken('Esus4')).toEqual({ root: 'E', variation: 'sus4' });
  });

  it('parses accidentals and slash bass', () => {
    expect(parseChordToken('F#m7')).toEqual({ root: 'F#', variation: 'm7' });
    expect(parseChordToken('D/F#')).toEqual({ root: 'D', variation: 'maj', bass: 'F#' });
    expect(parseChordToken('Bb')).toEqual({ root: 'Bb', variation: 'maj' });
  });

  it('rejects non-chords', () => {
    expect(parseChordToken('hello')).toBeNull();
    expect(parseChordToken('שלום')).toBeNull();
    expect(parseChordToken('H')).toBeNull();
  });
});

describe('parseChart — column-aligned (public-domain Hava Nagila)', () => {
  // Traditional Hebrew folk song — public domain.
  const chart = `Am
הבה נגילה הבה נגילה
        Dm        Am
הבה נגילה ונשמחה`;

  it('pins chords to the syllable under their column', () => {
    const { lines, chordCount } = parseChart(chart);
    expect(chordCount).toBe(3);
    expect(lines).toHaveLength(2);

    // First line: single Am over the whole lyric.
    expect(lineText(lines[0])).toBe('הבה נגילה הבה נגילה');
    expect(lines[0].segments[0].chord).toEqual({ root: 'A', variation: 'min' });

    // Second line: Dm then Am, split at the columns.
    expect(lineText(lines[1])).toBe('הבה נגילה ונשמחה');
    const chords = lines[1].segments.filter((s) => s.chord).map((s) => s.chord);
    expect(chords).toEqual([
      { root: 'D', variation: 'min' },
      { root: 'A', variation: 'min' },
    ]);
  });
});

describe('parseChart — inline ChordPro', () => {
  it('parses [chord] markup inline', () => {
    const { lines, chordCount } = parseChart('[Am]הבה [Dm]נגילה');
    expect(chordCount).toBe(2);
    expect(lines[0].segments[0].chord).toEqual({ root: 'A', variation: 'min' });
    expect(lineText(lines[0])).toBe('הבה נגילה');
  });
});

describe('parseChart — sections and chord-only lines', () => {
  it('detects section labels and intro progressions', () => {
    const chart = `[Intro]
Am  Dm  E7
פזמון:
G
שורה`;
    const { lines } = parseChart(chart);
    // Intro label is consumed; the chord-only progression carries the section.
    const intro = lines.find((l) => l.section === 'intro');
    expect(intro).toBeDefined();
    expect(intro!.segments.filter((s) => s.chord)).toHaveLength(3);

    const chorus = lines.find((l) => l.section === 'chorus');
    expect(chorus).toBeDefined();
    expect(lineText(chorus!)).toBe('שורה');
  });
});

describe('songFromChart', () => {
  it('guesses RTL for Hebrew and carries options', () => {
    const song = songFromChart('בדיקה', 'Am\nשלום', { bpm: 128, beats: 3 });
    expect(song.title).toBe('בדיקה');
    expect(song.dir).toBe('rtl');
    expect(song.bpm).toBe(128);
    expect(song.timeSig.beats).toBe(3);
  });

  it('guesses LTR for Latin text', () => {
    expect(songFromChart('Test', 'C\nhello world').dir).toBe('ltr');
  });
});
