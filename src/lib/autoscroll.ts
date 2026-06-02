/**
 * PLACEHOLDER — Track F replaces this with a refined rAF engine.
 * Exported shape is the frozen contract (see CONTRACTS.md).
 */
export interface AutoScroller {
  play(): void;
  pause(): void;
  toggle(): void;
  setSpeed(pxPerSec: number): void;
  isPlaying(): boolean;
  atEnd(): boolean;
  destroy(): void;
}

export function createAutoScroller(
  el: HTMLElement,
  opts: { speed: number; onEnd?: () => void },
): AutoScroller {
  let speed = opts.speed;
  let playing = false;
  let raf = 0;
  let last = 0;

  function step(now: number) {
    if (!playing) return;
    const dt = (now - last) / 1000;
    last = now;
    el.scrollTop += speed * dt;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
      playing = false;
      opts.onEnd?.();
      return;
    }
    raf = requestAnimationFrame(step);
  }

  return {
    play() {
      if (playing) return;
      playing = true;
      last = performance.now();
      raf = requestAnimationFrame(step);
    },
    pause() {
      playing = false;
      cancelAnimationFrame(raf);
    },
    toggle() {
      playing ? this.pause() : this.play();
    },
    setSpeed(v) {
      speed = v;
    },
    isPlaying() {
      return playing;
    },
    atEnd() {
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    },
    destroy() {
      this.pause();
    },
  };
}
