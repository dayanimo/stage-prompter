import { describe, it, expect } from 'vitest';
import { stepToMidi, pitchName } from './notation';

describe('staff step → pitch / MIDI', () => {
  it('maps the treble bottom line (step 0) to E4 = MIDI 64', () => {
    expect(pitchName(0, 'treble')).toBe('E4');
    expect(stepToMidi(0, null, 'treble')).toBe(64);
  });

  it('maps A4 (step 3) to MIDI 69', () => {
    expect(pitchName(3, 'treble')).toBe('A4');
    expect(stepToMidi(3, null, 'treble')).toBe(69);
  });

  it('applies accidentals', () => {
    expect(stepToMidi(0, '#', 'treble')).toBe(65); // F4 enharmonic of E#
    expect(stepToMidi(3, 'b', 'treble')).toBe(68); // Ab4
  });

  it('handles the bass clef bottom line (G2 = MIDI 43)', () => {
    expect(pitchName(0, 'bass')).toBe('G2');
    expect(stepToMidi(0, null, 'bass')).toBe(43);
  });
});
