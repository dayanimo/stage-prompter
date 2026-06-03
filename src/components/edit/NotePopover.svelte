<script lang="ts">
  /**
   * Small popover to create/edit a performance Note: a text label (e.g.
   * "סולו גיטרה") plus a highlight color. Emits only { label, highlight };
   * the caller pairs it with the active selection range to build the full Note.
   */
  import type { Note } from '$lib/model';

  interface Props {
    note?: Note | null;
    onsave: (note: { label: string; highlight: string; color?: string }) => void;
    oncancel?: () => void;
  }

  let { note = null, onsave, oncancel }: Props = $props();

  const NONE = '';

  /** Stage-friendly highlight swatches (OKLCH, translucent so lyrics stay legible). */
  const swatches = [
    { id: 'none', color: NONE },
    { id: 'teal', color: 'oklch(0.72 0.118 200 / 0.32)' },
    { id: 'amber', color: 'oklch(0.8 0.14 75 / 0.32)' },
    { id: 'red', color: 'oklch(0.64 0.205 25 / 0.32)' },
    { id: 'green', color: 'oklch(0.72 0.15 150 / 0.32)' },
    { id: 'violet', color: 'oklch(0.62 0.18 300 / 0.32)' },
    { id: 'blue', color: 'oklch(0.7 0.13 250 / 0.32)' },
  ];

  /** Bright solid swatches for the text color itself. */
  const textSwatches = [
    { id: 'default', color: NONE },
    { id: 'amber', color: 'oklch(0.84 0.15 75)' },
    { id: 'teal', color: 'oklch(0.8 0.13 200)' },
    { id: 'red', color: 'oklch(0.7 0.2 25)' },
    { id: 'green', color: 'oklch(0.78 0.16 150)' },
    { id: 'violet', color: 'oklch(0.72 0.17 300)' },
    { id: 'blue', color: 'oklch(0.76 0.13 250)' },
  ];

  // The popover is mounted fresh each time it opens, so seeding state from the
  // incoming `note` prop once (not reactively) is the intended behaviour.
  // svelte-ignore state_referenced_locally
  let label = $state(note?.label ?? '');
  // svelte-ignore state_referenced_locally
  let highlight = $state(note?.highlight ?? swatches[1].color);
  // svelte-ignore state_referenced_locally
  let color = $state(note?.color ?? NONE);
  let inputEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    inputEl?.focus();
  });

  function save() {
    // Label is optional: a pure color mark (highlight and/or text color) is valid.
    onsave({ label: label.trim(), highlight, color: color || undefined });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      oncancel?.();
    }
  }
</script>

<div class="popover" role="dialog" tabindex="-1" aria-label="הערה / צביעה" onkeydown={onKeydown}>
  <label class="field">
    <span class="lbl">תווית (לא חובה)</span>
    <input
      bind:this={inputEl}
      bind:value={label}
      type="text"
      placeholder="למשל: סולו גיטרה — או השאר ריק לצביעה בלבד"
      aria-label="תווית ההערה"
    />
  </label>

  <div class="field">
    <span class="lbl">רקע</span>
    <div class="swatches" role="radiogroup" aria-label="צבע רקע">
      {#each swatches as sw (sw.id)}
        <button
          type="button"
          class="swatch"
          class:none={sw.color === NONE}
          class:selected={highlight === sw.color}
          role="radio"
          aria-checked={highlight === sw.color}
          aria-label={sw.id === 'none' ? 'ללא רקע' : sw.id}
          style="--sw:{sw.color || 'transparent'};"
          onclick={() => (highlight = sw.color)}
        >{#if sw.color === NONE}∅{/if}</button>
      {/each}
    </div>
  </div>

  <div class="field">
    <span class="lbl">צבע טקסט</span>
    <div class="swatches" role="radiogroup" aria-label="צבע טקסט">
      {#each textSwatches as sw (sw.id)}
        <button
          type="button"
          class="swatch"
          class:none={sw.color === NONE}
          class:selected={color === sw.color}
          role="radio"
          aria-checked={color === sw.color}
          aria-label={sw.id === 'default' ? 'ברירת מחדל' : sw.id}
          style="--sw:{sw.color || 'transparent'};"
          onclick={() => (color = sw.color)}
        >{#if sw.color === NONE}∅{/if}</button>
      {/each}
    </div>
  </div>

  <div class="preview">
    <span
      class="preview-text"
      style="background:{highlight || 'transparent'}; color:{color || 'var(--perf-lyric)'};"
      >{label.trim() || 'תצוגה מקדימה'}</span
    >
  </div>

  <div class="actions">
    {#if oncancel}
      <button type="button" class="btn ghost" onclick={() => oncancel?.()}>ביטול</button>
    {/if}
    <button type="button" class="btn filled" onclick={save}>שמור</button>
  </div>
</div>

<style>
  .popover {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding: var(--sp-5);
    background: var(--surface-2);
    border: 1px solid var(--border-2);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-2);
    min-width: 240px;
    text-align: start;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .lbl {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--ink-3);
  }
  input[type='text'] {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink);
    padding: var(--sp-3) var(--sp-4);
    font: inherit;
    font-size: var(--text-base);
  }
  input[type='text']:hover {
    border-color: var(--border-2);
  }
  input[type='text']:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
    border-color: transparent;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
  .swatch {
    width: 28px;
    height: 28px;
    border-radius: var(--r-full);
    border: 2px solid var(--border-2);
    background: var(--sw);
    cursor: pointer;
    transition:
      transform var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }
  .swatch:hover {
    border-color: var(--ink-3);
    transform: scale(1.08);
  }
  .swatch.selected {
    border-color: var(--accent);
  }
  .swatch.none {
    color: var(--ink-3);
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background:
      linear-gradient(45deg, var(--surface-3) 25%, transparent 25%) 0 0 / 10px 10px,
      linear-gradient(-45deg, var(--surface-3) 25%, transparent 25%) 0 5px / 10px 10px;
  }
  .swatch:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .preview {
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--perf-bg);
    padding: var(--sp-3) var(--sp-4);
    text-align: center;
  }
  .preview-text {
    padding: 0 var(--sp-2);
    border-radius: var(--r-sm);
    font-size: var(--text-sm);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--sp-3);
  }
  .btn {
    height: 32px;
    padding: 0 var(--sp-5);
    border-radius: var(--r-md);
    border: 1px solid transparent;
    font: inherit;
    font-weight: 600;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out);
  }
  .btn.filled {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .btn.filled:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  .btn.filled:active:not(:disabled) {
    background: var(--accent-press);
  }
  .btn.filled:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .btn.ghost {
    background: transparent;
    color: var(--ink-2);
    border-color: var(--border);
  }
  .btn.ghost:hover {
    background: var(--surface-3);
    color: var(--ink);
  }
  .btn:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
