<script lang="ts">
  // PLACEHOLDER — Track B replaces this.
  import type { Note } from '$lib/model';
  interface Props {
    note?: Note | null;
    onsave: (note: { label: string; highlight: string }) => void;
    oncancel?: () => void;
  }
  let { note = null, onsave }: Props = $props();
  let label = $state(note?.label ?? '');
  let highlight = $state(note?.highlight ?? 'oklch(0.72 0.118 200)');
</script>

<div class="ph">
  <input bind:value={label} placeholder="הערה (למשל סולו גיטרה)" />
  <input type="color" bind:value={highlight} />
  <button onclick={() => onsave({ label, highlight })}>שמור</button>
</div>

<style>
  .ph { display: flex; gap: 6px; align-items: center; }
  input[type='text'], input:not([type]) { background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; color: var(--ink); padding: 4px 8px; }
</style>
