/**
 * Tiny Web Audio synth for previewing notes in the staff editor. No samples —
 * additive sine partials with a simple envelope give a passable organ / piano
 * voice that's free, offline and instant. The AudioContext is created lazily on
 * the first call (which always happens inside a user click, satisfying the
 * browser's autoplay gesture requirement).
 */
export type Timbre = 'piano' | 'organ';

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** MIDI note number → frequency in Hz (A4 = 69 = 440Hz). */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const PARTIALS: Record<Timbre, { mult: number; gain: number }[]> = {
  // Drawbar-ish, sustained.
  organ: [
    { mult: 1, gain: 0.5 },
    { mult: 2, gain: 0.26 },
    { mult: 3, gain: 0.14 },
    { mult: 4, gain: 0.08 },
  ],
  // Brighter attack, fewer partials, decays away.
  piano: [
    { mult: 1, gain: 0.6 },
    { mult: 2, gain: 0.22 },
    { mult: 3, gain: 0.09 },
  ],
};

/** Play `freq` for `durSec` seconds with the given timbre. Safe no-op if audio
 *  is unavailable. */
export function playTone(freq: number, durSec: number, timbre: Timbre = 'piano'): void {
  const c = audioCtx();
  if (!c) return;
  const now = c.currentTime;
  const dur = Math.max(0.12, Math.min(4, durSec));

  const master = c.createGain();
  master.connect(c.destination);

  const peak = 0.45;
  const attack = timbre === 'organ' ? 0.03 : 0.004;
  master.gain.setValueAtTime(0.0001, now);
  master.gain.linearRampToValueAtTime(peak, now + attack);
  if (timbre === 'organ') {
    // Hold, then a short release.
    master.gain.setValueAtTime(peak, now + Math.max(attack, dur - 0.06));
    master.gain.linearRampToValueAtTime(0.0001, now + dur);
  } else {
    // Piano: exponential decay across the note's length.
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  }

  for (const p of PARTIALS[timbre]) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * p.mult;
    const g = c.createGain();
    g.gain.value = p.gain;
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }
}
