<script lang="ts">
  // PLACEHOLDER — Track C replaces this.
  interface Props { value: number; min: number; max: number; step?: number; label: string; onchange: (n: number) => void }
  let { value, min, max, step = 1, label, onchange }: Props = $props();
</script>

<label class="ph">
  <span>{label}</span>
  <input type="range" {min} {max} {step} {value} oninput={(e) => onchange(+(e.target as HTMLInputElement).value)} />
  <span class="tnum">{value}px</span>
</label>

<style>
  .ph { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--ink-2); }
  input[type='range'] { flex: 1; accent-color: var(--accent); }
</style>
