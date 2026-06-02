/**
 * Track F — auto-scroll engine for the performance stage.
 *
 * A rAF-driven, linear scroller using `performance.now()` for timing. Scroll
 * distance is accumulated as a fractional value and only committed to the
 * element's integer `scrollTop` once a whole pixel (or more) has built up, so
 * even very slow speeds advance smoothly instead of stalling. `onEnd` fires
 * exactly once when the bottom is reached.
 *
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

/** Distance (px) from the true bottom that still counts as "at the end". */
const END_EPSILON = 1;

export function createAutoScroller(
  el: HTMLElement,
  opts: { speed: number; onEnd?: () => void },
): AutoScroller {
  let speed = Math.max(0, opts.speed);
  let playing = false;
  let destroyed = false;
  let raf = 0;
  let lastTs = 0;
  /** Sub-pixel scroll carried between frames so slow speeds stay smooth. */
  let acc = 0;
  /** Guards so onEnd fires only once per arrival at the bottom. */
  let endFired = false;

  function maxScroll(): number {
    return Math.max(0, el.scrollHeight - el.clientHeight);
  }

  function isAtEnd(): boolean {
    return el.scrollTop >= maxScroll() - END_EPSILON;
  }

  function stopLoop(): void {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function frame(now: number): void {
    if (!playing) return;

    const dtMs = now - lastTs;
    lastTs = now;

    // Ignore absurd gaps (tab was backgrounded): don't lurch forward.
    const dt = Math.min(Math.max(dtMs, 0), 250) / 1000;

    const limit = maxScroll();
    if (limit <= 0) {
      // Nothing to scroll — we're effectively already at the end.
      fireEnd();
      return;
    }

    acc += speed * dt;
    if (acc >= 1) {
      const whole = Math.floor(acc);
      acc -= whole;
      el.scrollTop = Math.min(el.scrollTop + whole, limit);
    }

    if (isAtEnd()) {
      fireEnd();
      return;
    }

    raf = requestAnimationFrame(frame);
  }

  function fireEnd(): void {
    playing = false;
    stopLoop();
    if (!endFired) {
      endFired = true;
      opts.onEnd?.();
    }
  }

  const api: AutoScroller = {
    play() {
      if (destroyed || playing) return;
      // If already parked at the bottom, a play request should not silently
      // re-fire onEnd; the caller is expected to reset scroll first.
      if (isAtEnd()) return;
      playing = true;
      endFired = false;
      acc = 0;
      lastTs = performance.now();
      stopLoop();
      raf = requestAnimationFrame(frame);
    },
    pause() {
      playing = false;
      stopLoop();
    },
    toggle() {
      if (playing) api.pause();
      else api.play();
    },
    setSpeed(pxPerSec: number) {
      speed = Math.max(0, pxPerSec);
    },
    isPlaying() {
      return playing;
    },
    atEnd() {
      return isAtEnd();
    },
    destroy() {
      destroyed = true;
      playing = false;
      stopLoop();
    },
  };

  return api;
}
