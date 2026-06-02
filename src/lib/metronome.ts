/**
 * Web Audio lookahead metronome scheduler.
 *
 * Timing is driven by the AudioContext clock (sample-accurate), not by
 * setInterval/setTimeout (which jitter). A 25ms setInterval merely wakes the
 * scheduler; on each wake it schedules every beat whose time falls within the
 * next ~100ms (scheduleAheadTime). Clicks are synthesized as short blips with
 * an OscillatorNode + GainNode envelope; the downbeat is higher-pitched and
 * louder. A small visual queue records each scheduled beat's audio time, and a
 * rAF loop fires `onBeat` exactly when the audio clock reaches that time, so the
 * lights stay in sync with the sound.
 *
 * The exported shape is the frozen contract (see CONTRACTS.md).
 */
import type { TimeSignature } from './model';

export interface MetronomeHandle {
  start(): void;
  stop(): void;
  setTempo(bpm: number, timeSig: TimeSignature): void;
  setClick(on: boolean): void;
}

export interface BeatInfo {
  beat: number;
  bar: number;
  isDownbeat: boolean;
  countingIn: boolean;
}

const LOOKAHEAD_MS = 25; // how often the scheduler wakes
const SCHEDULE_AHEAD = 0.1; // seconds of audio to schedule in advance

interface QueuedBeat {
  time: number; // AudioContext time the beat sounds
  info: BeatInfo;
}

type ACtor = typeof AudioContext;

function getAudioContextCtor(): ACtor | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext ||
    null
  );
}

export function createMetronome(opts: {
  bpm: number;
  timeSig: TimeSignature;
  click?: boolean;
  countInBars?: number;
  onBeat: (info: BeatInfo) => void;
}): MetronomeHandle {
  let bpm = clampBpm(opts.bpm);
  let timeSig = sanitizeSig(opts.timeSig);
  let click = opts.click ?? false;
  const countInBars = Math.max(0, Math.floor(opts.countInBars ?? 0));

  let ctx: AudioContext | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let raf = 0;
  let running = false;

  // Scheduler state.
  let nextNoteTime = 0; // AudioContext time of the next beat to schedule
  let absoluteBeat = 0; // monotonically increasing beat index (incl. count-in)
  const queue: QueuedBeat[] = [];

  function secondsPerBeat(): number {
    // The displayed light row is one cell per `beats`; pulse the beat unit.
    return 60 / bpm;
  }

  function beatsBeforeStart(): number {
    return countInBars * timeSig.beats;
  }

  function infoFor(absBeat: number): BeatInfo {
    const countIn = beatsBeforeStart();
    const counting = absBeat < countIn;
    const local = counting ? absBeat : absBeat - countIn;
    const beat = ((local % timeSig.beats) + timeSig.beats) % timeSig.beats;
    const bar = Math.floor(local / timeSig.beats);
    return { beat, bar, isDownbeat: beat === 0, countingIn: counting };
  }

  function playClick(time: number, info: BeatInfo) {
    if (!click || !ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Downbeat: higher pitch + louder. Count-in shares the accent scheme.
    const accent = info.isDownbeat;
    const freq = accent ? 1600 : 1000;
    const peak = accent ? 0.5 : 0.32;
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);

    // Short percussive envelope (~40ms) — no lingering decay bounce.
    const attack = 0.001;
    const release = 0.04;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(peak, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + release);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + attack + release + 0.01);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  function scheduler() {
    if (!ctx) return;
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const info = infoFor(absoluteBeat);
      playClick(nextNoteTime, info);
      queue.push({ time: nextNoteTime, info });
      nextNoteTime += secondsPerBeat();
      absoluteBeat += 1;
    }
  }

  function drainVisualQueue() {
    if (!running || !ctx) return;
    const now = ctx.currentTime;
    while (queue.length && queue[0].time <= now) {
      const next = queue.shift()!;
      try {
        opts.onBeat(next.info);
      } catch {
        /* swallow listener errors so the loop survives */
      }
    }
    raf = requestAnimationFrame(drainVisualQueue);
  }

  function clearTimers() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  return {
    start() {
      if (running) return;
      const Ctor = getAudioContextCtor();
      if (!Ctor) return; // no Web Audio (SSR / unsupported) — silently no-op
      if (!ctx) ctx = new Ctor();
      // Resume in case the context starts suspended (autoplay policy).
      void ctx.resume();

      running = true;
      absoluteBeat = 0;
      queue.length = 0;
      // Small offset so the first beat isn't scheduled in the past.
      nextNoteTime = ctx.currentTime + 0.06;

      scheduler();
      timer = setInterval(scheduler, LOOKAHEAD_MS);
      raf = requestAnimationFrame(drainVisualQueue);
    },

    stop() {
      running = false;
      clearTimers();
      queue.length = 0;
      absoluteBeat = 0;
      if (ctx) {
        // Suspend to silence + save battery; keep the context for fast restart.
        void ctx.suspend().catch(() => {});
      }
    },

    setTempo(nextBpm, nextSig) {
      bpm = clampBpm(nextBpm);
      timeSig = sanitizeSig(nextSig);
      // New tempo applies to beats scheduled from now on; already-queued beats
      // keep their times so the audio that's already committed stays clean.
    },

    setClick(on) {
      click = on;
    },
  };
}

function clampBpm(v: number): number {
  if (!Number.isFinite(v)) return 100;
  return Math.min(300, Math.max(30, v));
}

function sanitizeSig(sig: TimeSignature): TimeSignature {
  const beats = Number.isFinite(sig?.beats)
    ? Math.min(16, Math.max(1, Math.floor(sig.beats)))
    : 4;
  const unit = Number.isFinite(sig?.unit) ? sig.unit : 4;
  return { beats, unit };
}
