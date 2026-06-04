import { describe, it, expect } from 'vitest';
import { formatChord, parseChord } from './chords';

describe('formatChord preserves the chosen enharmonic spelling', () => {
  it('keeps Ab as Ab even when the accidental preference is sharps', () => {
    expect(formatChord({ root: 'Ab', variation: 'maj' }, { acc: 'sharps' })).toBe('Ab');
    expect(formatChord({ root: 'Ab', variation: 'm7' }, { acc: 'sharps' })).toBe('Abm7');
  });

  it('keeps G# as G# even when the accidental preference is flats', () => {
    expect(formatChord({ root: 'G#', variation: 'maj' }, { acc: 'flats' })).toBe('G#');
  });

  it('keeps a chosen slash bass spelling', () => {
    expect(formatChord({ root: 'D', variation: 'maj', bass: 'Gb' }, { acc: 'sharps' })).toBe('D/Gb');
  });

  it('still respells when transposing (semitones provided)', () => {
    // C up a semitone with sharps -> C#, with flats -> Db.
    expect(formatChord({ root: 'C', variation: 'maj' }, { semitones: 1, acc: 'sharps' })).toBe('C#');
    expect(formatChord({ root: 'C', variation: 'maj' }, { semitones: 1, acc: 'flats' })).toBe('Db');
  });

  it('round-trips a typed enharmonic chord through parse + format', () => {
    const c = parseChord('Abm7', 'sharps');
    expect(c).not.toBeNull();
    expect(formatChord(c!, { acc: 'sharps' })).toBe('Abm7');
  });
});
