<script lang="ts">
  // PLACEHOLDER — Track C replaces this.
  interface Props { value: string; label?: string; onchange: (c: string) => void }
  let { value, label, onchange }: Props = $props();
</script>

<label class="ph">
  {#if label}<span>{label}</span>{/if}
  <input type="color" value={value.startsWith('#') ? value : '#000000'} oninput={(e) => onchange((e.target as HTMLInputElement).value)} />
</label>

<style>
  .ph { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--ink-2); }
</style>
