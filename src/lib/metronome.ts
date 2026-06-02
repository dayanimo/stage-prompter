/**
 * PLACEHOLDER — Track D replaces this with a Web Audio lookahead scheduler.
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

export function createMetronome(opts: {
  bpm: number;
  timeSig: TimeSignature;
  click?: boolean;
  countInBars?: number;
  onBeat: (info: BeatInfo) => void;
}): MetronomeHandle {
  let timer: ReturnType<typeof setInterval> | null = null;
  let bpm = opts.bpm;
  let timeSig = opts.timeSig;
  let beat = 0;

  return {
    start() {
      this.stop();
      timer = setInterval(() => {
        const isDownbeat = beat % timeSig.beats === 0;
        opts.onBeat({ beat: beat % timeSig.beats, bar: Math.floor(beat / timeSig.beats), isDownbeat, countingIn: false });
        beat++;
      }, (60 / bpm) * 1000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      beat = 0;
    },
    setTempo(nextBpm, nextSig) {
      bpm = nextBpm;
      timeSig = nextSig;
    },
    setClick() {},
  };
}
