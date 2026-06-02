<script lang="ts">
  import { uid } from '$lib/model';

  interface Props {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    onchange: (n: number) => void;
  }

  let { value, min, max, step = 1, label, onchange }: Props = $props();

  const fieldId = `sz_${uid()}`;

  function onInput(e: Event) {
    onchange(+(e.target as HTMLInputElement).value);
  }
</script>

<div class="sizeslider">
  <div class="head">
    <label class="label" for={fieldId}>{label}</label>
    <span class="readout tnum">{Math.round(value)}px</span>
  </div>
  <input
    id={fieldId}
    class="range"
    type="range"
    {min}
    {max}
    {step}
    {value}
    oninput={onInput}
    aria-valuetext={`${Math.round(value)} פיקסל`}
  />
</div>

<style>
  .sizeslider {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-3);
  }
  .label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-2);
  }
  .readout {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink);
    min-width: 4ch;
    text-align: end;
  }

  /* Custom accent-colored track + thumb, cross-browser. */
  .range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 22px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }
  .range:focus-visible {
    outline: none;
  }

  /* Track */
  .range::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: var(--r-full);
    background: var(--surface-3);
    border: 1px solid var(--border);
  }
  .range::-moz-range-track {
    height: 6px;
    border-radius: var(--r-full);
    background: var(--surface-3);
    border: 1px solid var(--border);
  }
  .range::-moz-range-progress {
    height: 6px;
    border-radius: var(--r-full);
    background: var(--accent);
  }

  /* Thumb */
  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6px; /* center on 6px track (border adds 1px each side) */
    border-radius: var(--r-full);
    background: var(--accent);
    border: 2px solid var(--surface);
    box-shadow: var(--shadow-1);
    transition:
      background var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
  }
  .range::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: var(--r-full);
    background: var(--accent);
    border: 2px solid var(--surface);
    box-shadow: var(--shadow-1);
    transition:
      background var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
  }

  .range:hover::-webkit-slider-thumb {
    background: var(--accent-hover);
  }
  .range:hover::-moz-range-thumb {
    background: var(--accent-hover);
  }
  .range:active::-webkit-slider-thumb {
    background: var(--accent-press);
    transform: scale(1.1);
  }
  .range:active::-moz-range-thumb {
    background: var(--accent-press);
    transform: scale(1.1);
  }

  .range:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px var(--focus-ring);
  }
  .range:focus-visible::-moz-range-thumb {
    box-shadow: 0 0 0 3px var(--focus-ring);
  }
</style>
