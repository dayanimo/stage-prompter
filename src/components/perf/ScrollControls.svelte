<script lang="ts">
  /**
   * Track F — auto-hiding performance transport bar.
   *
   * A bottom bar with large (44px) stage-friendly targets: prev / play-pause /
   * next, a speed slider, the song title + position, and exit. It reveals on
   * pointer movement or key activity and fades out after ~2.5s of idle time
   * while playing. With reduced motion it simply toggles (no fade). Fully
   * RTL-aware via logical properties and dir-following layout.
   */
  import { onMount } from 'svelte';

  interface Props {
    playing: boolean;
    speed: number;
    onToggle: () => void;
    onSpeed: (n: number) => void;
    onNext: () => void;
    onPrev: () => void;
    onExit: () => void;
    songIndex: number;
    songCount: number;
    songTitle: string;
    autoAdvance: boolean;
    onToggleAutoAdvance: () => void;
    lineView: boolean;
    onToggleLineView: () => void;
    lineIndex: number;
    lineCount: number;
  }

  let {
    playing,
    speed,
    onToggle,
    onSpeed,
    onNext,
    onPrev,
    onExit,
    songIndex,
    songCount,
    songTitle,
    autoAdvance,
    onToggleAutoAdvance,
    lineView,
    onToggleLineView,
    lineIndex,
    lineCount,
  }: Props = $props();

  const IDLE_MS = 2500;
  const SPEED_MIN = 0;
  const SPEED_MAX = 200;
  const SPEED_STEP = 5;

  let visible = $state(true);
  let hovering = $state(false);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const atFirst = $derived(songIndex <= 0);
  const atLast = $derived(songIndex >= songCount - 1);

  function clearIdle(): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  /** Show the bar; schedule a hide only while playing and pointer is away. */
  function wake(): void {
    visible = true;
    clearIdle();
    if (playing && !hovering) {
      idleTimer = setTimeout(() => {
        visible = false;
      }, IDLE_MS);
    }
  }

  function onPointerMove(): void {
    wake();
  }

  function onKeyActivity(): void {
    wake();
  }

  // Re-evaluate auto-hide whenever transport or hover state changes.
  $effect(() => {
    // Touch the dependencies so the effect re-runs on change.
    void playing;
    void hovering;
    if (!playing || hovering) {
      // Paused or actively interacting: stay visible.
      clearIdle();
      visible = true;
    } else {
      wake();
    }
  });

  onMount(() => {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('keydown', onKeyActivity);
    wake();
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('keydown', onKeyActivity);
      clearIdle();
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="bar"
  class:hidden={!visible}
  role="toolbar"
  aria-label="פקדי ביצוע"
  aria-hidden={!visible}
  onpointerenter={() => {
    hovering = true;
  }}
  onpointerleave={() => {
    hovering = false;
  }}
>
  <button class="ctl exit" onclick={onExit} aria-label="יציאה" title="יציאה (Esc)">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
  </button>

  <div class="transport">
    <button
      class="ctl"
      onclick={onPrev}
      disabled={atFirst}
      aria-label="השיר הקודם"
      title="הקודם"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5v14M19 5l-9 7 9 7z" />
      </svg>
    </button>

    <button
      class="ctl play"
      onclick={onToggle}
      aria-pressed={playing}
      aria-label={lineView
        ? playing
          ? 'עצור מטרונום'
          : 'הפעל מטרונום'
        : playing
          ? 'השהיית גלילה'
          : 'התחלת גלילה'}
      title={lineView ? 'מטרונום' : playing ? 'השהה (רווח)' : 'נגן (רווח)'}
    >
      {#if playing}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h3v14H8zM13 5h3v14h-3z" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
      {/if}
    </button>

    <button class="ctl" onclick={onNext} disabled={atLast} aria-label="השיר הבא" title="הבא">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17 5v14M5 5l9 7-9 7z" />
      </svg>
    </button>
  </div>

  {#if lineView}
    <span class="line-pos tnum" aria-label="מיקום שורה">שורה {lineIndex + 1}/{lineCount}</span>
  {:else}
    <label class="speed">
      <span class="speed-label">מהירות</span>
      <input
        type="range"
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={SPEED_STEP}
        value={speed}
        oninput={(e) => onSpeed(+(e.currentTarget as HTMLInputElement).value)}
        aria-label="מהירות גלילה"
      />
      <span class="speed-val tnum">{Math.round(speed)}</span>
    </label>
  {/if}

  <button
    class="auto"
    class:on={lineView}
    role="switch"
    aria-checked={lineView}
    onclick={onToggleLineView}
    title="תצוגת 2 שורות גדולות"
  >
    <span class="auto-dot" aria-hidden="true"></span>
    <span class="auto-label">2 שורות</span>
  </button>

  <button
    class="auto"
    class:on={autoAdvance}
    role="switch"
    aria-checked={autoAdvance}
    onclick={onToggleAutoAdvance}
    title="נגן שיר אחרי שיר אוטומטית"
  >
    <span class="auto-dot" aria-hidden="true"></span>
    <span class="auto-label">רצף אוטומטי</span>
  </button>

  <div class="meta">
    <span class="song-title">{songTitle}</span>
    {#if songCount > 0}
      <span class="pos tnum">{songIndex + 1}/{songCount}</span>
    {/if}
  </div>
</div>

<style>
  .bar {
    position: fixed;
    inset-inline: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: var(--sp-5);
    padding: var(--sp-4) var(--sp-6);
    padding-bottom: max(var(--sp-4), env(safe-area-inset-bottom));
    background: oklch(0.135 0 0 / 0.9);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--border);
    z-index: var(--z-sticky);
    opacity: 1;
    transform: translateY(0);
    transition:
      opacity var(--dur-slow) var(--ease-out),
      transform var(--dur-slow) var(--ease-out);
  }
  .bar.hidden {
    opacity: 0;
    transform: translateY(100%);
    pointer-events: none;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
  }

  .ctl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex: none;
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface-2);
    color: var(--ink);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .ctl svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* Solid glyphs (play/pause/prev/next triangles) read better filled. */
  .ctl.play svg path,
  .transport .ctl svg path {
    fill: currentColor;
    stroke: none;
  }
  .ctl.exit svg path {
    fill: none;
    stroke: currentColor;
  }

  .ctl:hover:not(:disabled) {
    background: var(--surface-3);
    border-color: var(--border-2);
  }
  .ctl:active:not(:disabled) {
    background: var(--surface);
  }
  .ctl:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ctl.play {
    width: 52px;
    height: 52px;
    background: var(--accent);
    color: var(--accent-ink);
    border-color: transparent;
  }
  .ctl.play svg {
    width: 26px;
    height: 26px;
  }
  .ctl.play:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  .ctl.play:active:not(:disabled) {
    background: var(--accent-press);
  }

  .ctl.exit {
    color: var(--ink-2);
  }
  .ctl.exit:hover:not(:disabled) {
    color: var(--ink);
  }

  .speed {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
  }
  .speed-label {
    font-size: var(--text-sm);
    color: var(--ink-2);
    white-space: nowrap;
  }
  .speed input[type='range'] {
    width: clamp(120px, 22vw, 220px);
    height: 44px;
    accent-color: var(--accent);
    cursor: pointer;
  }
  .speed-val {
    font-size: var(--text-sm);
    color: var(--ink-2);
    min-width: 3ch;
    text-align: end;
  }
  .line-pos {
    font-size: var(--text-base);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .auto {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-3);
    height: 44px;
    padding-inline: var(--sp-4);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface-2);
    color: var(--ink-2);
    cursor: pointer;
    white-space: nowrap;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .auto:hover {
    background: var(--surface-3);
    border-color: var(--border-2);
  }
  .auto .auto-dot {
    width: 12px;
    height: 12px;
    border-radius: var(--r-full);
    background: var(--beat-idle);
    box-shadow: none;
    transition:
      background var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast) var(--ease-out);
  }
  .auto.on {
    color: var(--accent);
    border-color: color-mix(in oklch, var(--accent) 50%, transparent);
    background: var(--accent-soft);
  }
  .auto.on .auto-dot {
    background: var(--accent);
    box-shadow: 0 0 10px color-mix(in oklch, var(--accent) 75%, transparent);
  }
  .auto-label {
    font-size: var(--text-sm);
    font-weight: 500;
  }
  .auto:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .meta {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
    margin-inline-start: auto;
    min-width: 0;
    text-align: start;
  }

  /* On narrow screens drop the toggle's text label, keep the dot. */
  @media (max-width: 720px) {
    .auto-label {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .auto .auto-dot {
      transition: background var(--dur-fast) linear;
    }
  }
  .song-title {
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 38vw;
  }
  .pos {
    font-size: var(--text-base);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .ctl:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .speed input[type='range']:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 4px;
    border-radius: var(--r-sm);
  }

  @media (prefers-reduced-motion: reduce) {
    .bar {
      transition: none;
    }
    .bar.hidden {
      transform: none;
    }
  }

  @media (max-width: 560px) {
    .bar {
      gap: var(--sp-4);
      padding-inline: var(--sp-4);
    }
    .speed-label {
      display: none;
    }
    .song-title {
      max-width: 32vw;
    }
  }
</style>
