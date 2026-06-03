<script lang="ts">
  /**
   * Floating quick-pick of the user's recently chosen chords. Drag it anywhere
   * on the editor by its header; click a chip to drop that chord on the current
   * text selection. Position is remembered in localStorage between sessions.
   */
  import type { Chord } from '$lib/model';
  import { formatChord } from '$lib/chords';

  interface Props {
    chords: Chord[];
    accidental: 'sharps' | 'flats';
    /** True when a text selection exists, so a click can actually place a chord. */
    armed: boolean;
    onpick: (chord: Chord) => void;
    onremove: (chord: Chord) => void;
    onclose: () => void;
  }

  let { chords, accidental, armed, onpick, onremove, onclose }: Props = $props();

  const POS_KEY = 'sp.favPos';
  type Pos = { x: number; y: number };

  function loadPos(): Pos {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw) as Pos;
    } catch {
      /* ignore */
    }
    return { x: 24, y: 96 };
  }

  let pos = $state<Pos>(loadPos());
  let panelEl = $state<HTMLDivElement | null>(null);

  function clamp(p: Pos): Pos {
    const w = 260;
    const h = 160;
    return {
      x: Math.max(8, Math.min(window.innerWidth - w, p.x)),
      y: Math.max(8, Math.min(window.innerHeight - h, p.y)),
    };
  }

  function startDrag(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    // `x` is inset-inline-start, which grows leftward in RTL — invert the
    // horizontal delta there so the panel follows the pointer.
    const rtl = panelEl ? getComputedStyle(panelEl).direction === 'rtl' : false;
    const startX = e.clientX;
    const startY = e.clientY;
    const base = { ...pos };
    function move(ev: PointerEvent) {
      const dx = (ev.clientX - startX) * (rtl ? -1 : 1);
      pos = clamp({ x: base.x + dx, y: base.y + (ev.clientY - startY) });
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
</script>

<div
  class="fav"
  bind:this={panelEl}
  style="inset-inline-start:{pos.x}px; top:{pos.y}px;"
  role="dialog"
  aria-label="אקורדים מועדפים"
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header class="fav-head" onpointerdown={startDrag}>
    <span class="grip" aria-hidden="true">⠿</span>
    <span class="fav-title">מועדפים</span>
    <button class="fav-x" type="button" onclick={onclose} aria-label="סגור מועדפים">✕</button>
  </header>

  {#if chords.length === 0}
    <p class="fav-empty">בחר אקורד כדי שיתווסף לכאן.</p>
  {:else}
    {#if !armed}
      <p class="fav-hint">סמן טקסט ואז הקלק על אקורד למיקום.</p>
    {/if}
    <div class="fav-grid">
      {#each chords as chord (chord.root + chord.variation + (chord.bass ?? ''))}
        <span class="fav-chip" class:disabled={!armed}>
          <button
            type="button"
            class="fav-pick"
            dir="ltr"
            disabled={!armed}
            onclick={() => onpick(chord)}
            title="מקם אקורד על הבחירה"
          >
            {formatChord(chord, { acc: accidental })}
          </button>
          <button
            type="button"
            class="fav-remove"
            onclick={() => onremove(chord)}
            aria-label="הסר מהמועדפים"
            title="הסר">✕</button>
        </span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .fav {
    position: fixed;
    z-index: var(--z-dropdown, 40);
    width: 240px;
    background: var(--surface);
    border: 1px solid var(--border-2);
    border-radius: var(--r-lg);
    box-shadow: 0 16px 40px oklch(0 0 0 / 0.45);
    overflow: hidden;
  }
  .fav-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .fav-head:active {
    cursor: grabbing;
  }
  .grip {
    color: var(--ink-3);
    font-size: var(--text-sm);
  }
  .fav-title {
    flex: 1;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink-2);
  }
  .fav-x {
    background: none;
    border: none;
    color: var(--ink-3);
    cursor: pointer;
    font-size: var(--text-sm);
    padding: 0 var(--sp-1);
  }
  .fav-x:hover {
    color: var(--ink);
  }
  .fav-empty,
  .fav-hint {
    margin: 0;
    padding: var(--sp-3) var(--sp-4);
    color: var(--ink-3);
    font-size: var(--text-xs);
    line-height: 1.5;
  }
  .fav-hint {
    padding-bottom: 0;
  }
  .fav-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    padding: var(--sp-3);
  }
  .fav-chip {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    overflow: hidden;
    background: var(--surface-2);
  }
  .fav-chip.disabled {
    opacity: 0.55;
  }
  .fav-pick {
    background: none;
    border: none;
    color: var(--accent);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 600;
    padding: var(--sp-2) var(--sp-3);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out);
  }
  .fav-pick:hover:not(:disabled) {
    background: var(--accent-soft);
  }
  .fav-pick:disabled {
    cursor: not-allowed;
  }
  .fav-remove {
    background: none;
    border: none;
    border-inline-start: 1px solid var(--border);
    color: var(--ink-3);
    font-size: 10px;
    padding: 0 var(--sp-2);
    cursor: pointer;
  }
  .fav-remove:hover {
    background: color-mix(in oklch, var(--danger) 18%, transparent);
    color: var(--danger);
  }
  .fav-pick:focus-visible,
  .fav-remove:focus-visible,
  .fav-x:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }
</style>
