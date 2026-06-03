<script lang="ts">
  /**
   * Click-to-place staff editor. Pick a duration (and optional accidental) from
   * the toolbar, then click the staff to drop a note at that pitch. Click a note
   * head to remove it. Pure: changes are reported up for `updateSong`.
   */
  import type { NotationContent, StaffNote, NoteDur } from '$lib/model';
  import { DURATIONS, pitchName } from '$lib/notation';
  import Staff from '$components/common/Staff.svelte';

  interface Props {
    notation: NotationContent;
    onAppend: (note: StaffNote) => void;
    onRemove: (index: number) => void;
    onClef: (clef: 'treble' | 'bass') => void;
    onClear: () => void;
  }
  let { notation, onAppend, onRemove, onClef, onClear }: Props = $props();

  let dur = $state<NoteDur>('q');
  let acc = $state<'#' | 'b' | null>(null);

  function pick(step: number) {
    onAppend({ step, dur, acc });
  }

  const lastPitch = $derived(
    notation.notes.length
      ? pitchName(notation.notes[notation.notes.length - 1].step, notation.clef)
      : '—',
  );
</script>

<div class="ned">
  <div class="toolbar">
    <div class="group" role="radiogroup" aria-label="משך">
      {#each DURATIONS as d (d.id)}
        <button
          type="button"
          class="dbtn"
          class:on={dur === d.id}
          role="radio"
          aria-checked={dur === d.id}
          title={d.label}
          onclick={() => (dur = d.id)}>{d.id === 'w' ? '𝅝' : d.id === 'h' ? '𝅗𝅥' : d.id === 'q' ? '♩' : d.id === '8' ? '♪' : '♬'}</button>
      {/each}
    </div>

    <div class="group" role="radiogroup" aria-label="סימן היתק">
      <button type="button" class="dbtn" class:on={acc === null} role="radio" aria-checked={acc === null} onclick={() => (acc = null)} title="ללא">♮</button>
      <button type="button" class="dbtn" class:on={acc === '#'} role="radio" aria-checked={acc === '#'} onclick={() => (acc = '#')} title="דיאז">♯</button>
      <button type="button" class="dbtn" class:on={acc === 'b'} role="radio" aria-checked={acc === 'b'} onclick={() => (acc = 'b')} title="במול">♭</button>
    </div>

    <button type="button" class="dbtn wide" onclick={() => onClef(notation.clef === 'treble' ? 'bass' : 'treble')} title="החלף מפתח">
      {notation.clef === 'treble' ? '𝄞 סול' : '𝄢 פה'}
    </button>

    <button type="button" class="dbtn wide" onclick={onClear} disabled={!notation.notes.length} title="נקה">נקה</button>
  </div>

  <div class="staff-wrap">
    <Staff notes={notation.notes} clef={notation.clef} size={15} onPick={pick} onNoteClick={onRemove} />
  </div>

  <p class="hint">לחץ על החמשה כדי להוסיף תו בגובה הזה · לחץ על תו כדי למחוק. תו אחרון: {lastPitch}</p>
</div>

<style>
  .ned {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-3);
  }
  .group {
    display: flex;
    gap: var(--sp-1);
    background: var(--surface-2);
    border-radius: var(--r-md);
    padding: 2px;
  }
  .dbtn {
    min-width: 34px;
    height: 34px;
    padding: 0 var(--sp-2);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    color: var(--ink);
    font-size: var(--text-md);
    line-height: 1;
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out);
  }
  .dbtn.wide {
    background: var(--surface-2);
    border-color: var(--border);
    font-size: var(--text-sm);
  }
  .dbtn:hover:not(:disabled) {
    background: var(--surface-3);
  }
  .dbtn.on {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .dbtn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .staff-wrap {
    overflow-x: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: var(--sp-3);
    color: var(--ink);
  }
  .hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--ink-3);
    line-height: 1.5;
  }
</style>
