<script lang="ts">
  // PLACEHOLDER — Track A replaces this. Contract: see CONTRACTS.md.
  import type { Chord } from '$lib/model';
  import { ROOT_LIST, VARIATIONS } from '$lib/chords';

  interface Props {
    value?: Chord | null;
    accidental: 'sharps' | 'flats';
    onpick: (chord: Chord) => void;
    onremove?: () => void;
  }
  let { value = null, onpick, onremove }: Props = $props();

  let root = $state<Chord['root']>(value?.root ?? 'C');
</script>

<div class="ph">
  <p>Chord Panel (placeholder)</p>
  <div class="roots">
    {#each ROOT_LIST as r (r)}
      <button class:active={r === root} onclick={() => (root = r)}>{r}</button>
    {/each}
  </div>
  <div class="vars">
    {#each VARIATIONS.slice(0, 6) as v (v.id)}
      <button onclick={() => onpick({ root, variation: v.id })}>{v.label}</button>
    {/each}
  </div>
  {#if value && onremove}<button onclick={onremove}>remove</button>{/if}
</div>

<style>
  .ph { color: var(--ink-2); font-size: var(--text-sm); }
  .roots, .vars { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; }
  button { background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; color: var(--ink); padding: 4px 8px; cursor: pointer; }
  button.active { background: var(--accent); color: var(--accent-ink); }
</style>
