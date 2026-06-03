<script lang="ts">
  /**
   * Click-to-place guitar-tab editor. A grid of 6 strings × N columns; click a
   * cell and type a fret (0–24), or clear it. Add/remove columns at the end.
   * Pure: every change is reported up so it flows through `updateSong` (undoable).
   */
  import type { TabContent } from '$lib/model';

  interface Props {
    tab: TabContent;
    onset: (col: number, str: number, fret: number | null) => void;
    onAddCols: () => void;
    onRemoveCol: () => void;
  }
  let { tab, onset, onAddCols, onRemoveCol }: Props = $props();

  const colCount = $derived(tab.cols.length);

  function onInput(col: number, str: number, e: Event) {
    const el = e.currentTarget as HTMLInputElement;
    const v = el.value.replace(/[^0-9]/g, '').slice(0, 2);
    el.value = v;
    onset(col, str, v === '' ? null : Math.min(24, parseInt(v, 10)));
  }

  // Enter / arrows move between cells for fast entry.
  function onKey(col: number, str: number, e: KeyboardEvent) {
    const move = (c: number, s: number) => {
      const next = document.querySelector<HTMLInputElement>(`[data-cell="${c}:${s}"]`);
      if (next) {
        e.preventDefault();
        next.focus();
        next.select();
      }
    };
    if (e.key === 'ArrowRight') move(col + 1, str);
    else if (e.key === 'ArrowLeft') move(col - 1, str);
    else if (e.key === 'ArrowDown') move(col, str + 1);
    else if (e.key === 'ArrowUp') move(col, str - 1);
    else if (e.key === 'Enter') move(col + 1, str);
  }
</script>

<div class="tabedit" dir="ltr">
  <div class="grid" style="grid-template-columns: 1.4em repeat({colCount}, 2.1em);">
    {#each tab.strings as label, s (s)}
      <span class="slabel">{label}</span>
      {#each tab.cols as col, c (c)}
        <input
          class="cell"
          data-cell={`${c}:${s}`}
          inputmode="numeric"
          maxlength="2"
          value={col[s] ?? ''}
          oninput={(e) => onInput(c, s, e)}
          onkeydown={(e) => onKey(c, s, e)}
          onfocus={(e) => (e.currentTarget as HTMLInputElement).select()}
          aria-label={`מיתר ${label} עמודה ${c + 1}`}
        />
      {/each}
    {/each}
  </div>

  <div class="tools">
    <button type="button" class="tbtn" onclick={onAddCols} title="הוסף עמודות">+ עמודות</button>
    <button
      type="button"
      class="tbtn"
      onclick={onRemoveCol}
      disabled={colCount <= 1}
      title="הסר עמודה אחרונה">− עמודה</button>
  </div>
</div>

<style>
  .tabedit {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    overflow-x: auto;
  }
  .grid {
    display: grid;
    align-items: center;
    gap: 0;
    width: max-content;
    font-family: var(--font-mono);
  }
  .slabel {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--accent);
    text-align: center;
    padding-inline-end: var(--sp-1);
  }
  .cell {
    width: 2.1em;
    height: 1.9em;
    border: none;
    background:
      linear-gradient(var(--border-2), var(--border-2)) left center / 100% 1.5px no-repeat;
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: 600;
    text-align: center;
    padding: 0;
    border-radius: var(--r-sm);
  }
  .cell:hover {
    background-color: var(--surface-2);
  }
  .cell:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
    background-color: var(--accent-soft);
  }
  .tools {
    display: flex;
    gap: var(--sp-2);
  }
  .tbtn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink-2);
    font: inherit;
    font-size: var(--text-xs);
    padding: var(--sp-2) var(--sp-3);
    cursor: pointer;
  }
  .tbtn:hover:not(:disabled) {
    background: var(--surface-3);
    color: var(--ink);
  }
  .tbtn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
