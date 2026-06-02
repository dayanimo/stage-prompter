<script lang="ts">
  import { uid } from '$lib/model';

  interface Props {
    value: string;
    label?: string;
    onchange: (c: string) => void;
  }

  let { value, label, onchange }: Props = $props();

  // Local editable text mirrors `value` but lets the user type freely
  // (e.g. an `oklch(...)` string) before committing.
  // svelte-ignore state_referenced_locally — seeded once; the $effect re-syncs.
  let text = $state(value);
  $effect(() => {
    // Keep the text field in sync when the parent value changes externally.
    text = value;
  });

  const fieldId = `cp_${uid()}`;

  // Presets suited to a dark stage: bg fields, bright inks, warm chords, teal cues.
  const presets: { c: string; name: string }[] = [
    { c: 'oklch(0.08 0 0)', name: 'שחור במה' },
    { c: 'oklch(0.135 0 0)', name: 'פחם' },
    { c: 'oklch(0.18 0.03 265)', name: 'כחול כהה' },
    { c: 'oklch(0.97 0 0)', name: 'לבן' },
    { c: 'oklch(0.8 0.13 75)', name: 'ענבר' },
    { c: 'oklch(0.72 0.118 200)', name: 'טורקיז' },
    { c: 'oklch(0.7 0.18 145)', name: 'ירוק' },
    { c: 'oklch(0.68 0.2 25)', name: 'אדום' },
  ];

  // Resolve any CSS color string to a #rrggbb hex so the native picker and the
  // swatch can reflect it. Returns null when the string is not a valid color.
  function toHex(color: string): string | null {
    if (typeof document === 'undefined') return null;
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const ctx = probe.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = color;
    const resolved = ctx.fillStyle;
    // Browser may return hex or rgb()/rgba(); normalise rgb forms to hex.
    if (resolved.startsWith('#')) return resolved.length === 7 ? resolved : null;
    const m = resolved.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    const [r, g, b] = parts;
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  const hex = $derived(toHex(value));
  const swatchColor = $derived(hex ?? value);
  const isValid = $derived(toHex(text) !== null);

  function commitText() {
    if (toHex(text) !== null) {
      onchange(text.trim());
    } else {
      // Revert invalid input back to the last good value.
      text = value;
    }
  }

  function onNativeInput(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    onchange(v);
  }

  function pickPreset(c: string) {
    onchange(c);
  }
</script>

<div class="colorpicker">
  {#if label}
    <label class="label" for={fieldId}>{label}</label>
  {/if}

  <div class="row">
    <span class="swatch-wrap">
      <span class="swatch" style:background={swatchColor} aria-hidden="true"></span>
      <input
        class="native"
        type="color"
        value={hex ?? '#000000'}
        oninput={onNativeInput}
        aria-label={label ? `${label} — בורר צבע` : 'בורר צבע'}
      />
    </span>

    <input
      id={fieldId}
      class="text tnum"
      class:invalid={!isValid}
      type="text"
      spellcheck="false"
      autocomplete="off"
      bind:value={text}
      onblur={commitText}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitText();
          (e.target as HTMLInputElement).blur();
        }
      }}
      aria-invalid={!isValid}
      placeholder="oklch(…) / #hex"
    />
  </div>

  <div class="presets" role="group" aria-label={label ? `${label} — צבעים מוכנים` : 'צבעים מוכנים'}>
    {#each presets as p (p.c)}
      <button
        type="button"
        class="preset"
        class:active={swatchColor === (toHex(p.c) ?? p.c)}
        style:background={p.c}
        title={p.name}
        aria-label={p.name}
        onclick={() => pickPreset(p.c)}
      ></button>
    {/each}
  </div>
</div>

<style>
  .colorpicker {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--ink-2);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .swatch-wrap {
    position: relative;
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: var(--r-md);
    overflow: hidden;
    border: 1px solid var(--border-2);
    background:
      linear-gradient(45deg, var(--surface-3) 25%, transparent 25%) 0 0 / 12px 12px,
      linear-gradient(-45deg, var(--surface-3) 25%, transparent 25%) 0 6px / 12px 12px;
  }
  .swatch {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .native {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    opacity: 0;
    cursor: pointer;
  }
  .swatch-wrap:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .text {
    flex: 1;
    min-width: 0;
    height: 36px;
    padding: 0 var(--sp-4);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface-2);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    transition:
      border-color var(--dur-fast) var(--ease-out),
      background var(--dur-fast) var(--ease-out);
  }
  .text:hover {
    border-color: var(--border-2);
  }
  .text:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
    border-color: transparent;
  }
  .text.invalid {
    border-color: var(--danger);
  }
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .preset {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--border-2);
    border-radius: var(--r-sm);
    cursor: pointer;
    transition:
      transform var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast) var(--ease-out);
  }
  .preset:hover {
    transform: scale(1.12);
  }
  .preset:active {
    transform: scale(1);
  }
  .preset:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .preset.active {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 4px var(--accent);
  }
</style>
