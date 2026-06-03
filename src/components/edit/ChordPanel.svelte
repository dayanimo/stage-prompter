<script lang="ts">
  import type { Chord, Root } from '$lib/model';
  import { ROOT_LIST, VARIATIONS, formatChord, spell, parseChord } from '$lib/chords';
  import type { VariationDef } from '$lib/chords';

  interface Props {
    value?: Chord | null;
    accidental: 'sharps' | 'flats';
    onpick: (chord: Chord) => void;
    onremove?: () => void;
  }

  let { value = null, accidental, onpick, onremove }: Props = $props();

  // ---- Local picker state -------------------------------------------------
  // Seed from `value` so an existing chord is preselected. We track a "dirty"
  // version too so re-opening on a different chord re-seeds correctly.
  // svelte-ignore state_referenced_locally — intentional initial seed; the
  // $effect below keeps these in sync when the upstream `value` changes.
  let root = $state<Root>(value?.root ?? 'C');
  // svelte-ignore state_referenced_locally
  let variation = $state<string>(value?.variation ?? 'maj');
  // svelte-ignore state_referenced_locally
  let bass = $state<string | undefined>(value?.bass);
  // svelte-ignore state_referenced_locally
  let seeded: Chord | null | undefined = value;

  $effect(() => {
    // Re-seed when the upstream `value` identity changes.
    if (value !== seeded) {
      seeded = value;
      root = value?.root ?? root;
      variation = value?.variation ?? variation;
      bass = value?.bass;
    }
  });

  // ---- Derived ------------------------------------------------------------
  const current = $derived<Chord>({ root, variation, bass });
  const preview = $derived(formatChord(current, { acc: accidental }));

  // Variations grouped in catalogue order, preserving group sequence.
  const GROUP_LABELS: Record<VariationDef['group'], string> = {
    triads: 'משולשים',
    sevenths: 'שביעיות',
    'sus/add': 'sus / add',
    extended: 'מורחבים',
    altered: 'מותאמים',
  };

  type Group = { group: VariationDef['group']; label: string; items: VariationDef[] };
  const groups = $derived.by<Group[]>(() => {
    const order: VariationDef['group'][] = [];
    const map = new Map<VariationDef['group'], VariationDef[]>();
    for (const v of VARIATIONS) {
      if (!map.has(v.group)) {
        map.set(v.group, []);
        order.push(v.group);
      }
      map.get(v.group)!.push(v);
    }
    return order.map((g) => ({ group: g, label: GROUP_LABELS[g], items: map.get(g)! }));
  });

  // Bass options: "none" + the 12 chromatic notes, respelled per accidental.
  const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const bassOptions = $derived(CHROMATIC.map((n) => spell(n, accidental)));

  // ---- Actions ------------------------------------------------------------
  function pickRoot(r: Root) {
    root = r;
    commit();
  }
  function pickVariation(id: string) {
    variation = id;
    commit();
  }
  function pickBass(b: string | undefined) {
    // Toggle off if re-selecting the active bass.
    bass = bass === b ? undefined : b;
    commit();
  }
  function commit() {
    onpick({ root, variation, bass });
  }

  // ---- Typed chord entry --------------------------------------------------
  // Type "Csus4", "C#m7", "D/F#"… to jump the selection to that chord. Invalid
  // partial input just doesn't match (no error nag until something is typed).
  let query = $state('');
  let queryBad = $state(false);

  function applyQuery(commitIt: boolean) {
    const parsed = parseChord(query, accidental);
    if (parsed) {
      root = parsed.root;
      variation = parsed.variation;
      bass = parsed.bass;
      queryBad = false;
      if (commitIt) {
        commit();
        query = '';
      }
    } else {
      queryBad = query.trim().length > 0;
    }
  }

  function onQueryKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyQuery(true);
    }
  }

  // ---- Root scroller: keyboard + scroll-into-view -------------------------
  let scroller = $state<HTMLDivElement | null>(null);
  let rootButtons: HTMLButtonElement[] = $state([]);

  function scrollSelectedIntoView() {
    const idx = ROOT_LIST.indexOf(root);
    const el = rootButtons[idx];
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }

  $effect(() => {
    // Track `root` so a programmatic/external change re-centers the pill.
    void root;
    scrollSelectedIntoView();
  });

  function onRootKey(e: KeyboardEvent) {
    const idx = ROOT_LIST.indexOf(root);
    if (idx < 0) return;
    let next = idx;
    // Logical next/prev — mirrored for RTL via the DOM direction.
    const rtl = scroller ? getComputedStyle(scroller).direction === 'rtl' : false;
    const fwd = rtl ? -1 : 1;
    if (e.key === 'ArrowRight') next = idx + fwd;
    else if (e.key === 'ArrowLeft') next = idx - fwd;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ROOT_LIST.length - 1;
    else return;
    e.preventDefault();
    next = Math.max(0, Math.min(ROOT_LIST.length - 1, next));
    const r = ROOT_LIST[next];
    root = r;
    rootButtons[next]?.focus();
    commit();
  }
</script>

<div class="chord-panel">
  <!-- Preview header -->
  <div class="preview-bar">
    <span class="preview-label">אקורד</span>
    <output class="preview-symbol tnum" dir="ltr" aria-live="polite">{preview}</output>
    {#if value && onremove}
      <button class="remove" type="button" onclick={() => onremove?.()}>הסר אקורד</button>
    {/if}
  </div>

  <!-- Typed chord entry -->
  <div class="region region-type">
    <input
      class="chord-input"
      class:bad={queryBad}
      dir="ltr"
      type="text"
      bind:value={query}
      oninput={() => applyQuery(false)}
      onkeydown={onQueryKey}
      placeholder="הקלד אקורד: Csus4, C#m7, D/F#…"
      aria-label="הקלדת אקורד"
      spellcheck="false"
      autocomplete="off"
    />
  </div>

  <!-- ROOT scroller -->
  <div class="region region-root">
    <div
      class="root-scroller"
      role="radiogroup"
      aria-label="בחירת צליל יסוד"
      dir="ltr"
      tabindex="-1"
      bind:this={scroller}
      onkeydown={onRootKey}
    >
      {#each ROOT_LIST as r, i (r)}
        <button
          class="root-pill"
          class:selected={r === root}
          type="button"
          role="radio"
          aria-checked={r === root}
          tabindex={r === root ? 0 : -1}
          bind:this={rootButtons[i]}
          onclick={() => pickRoot(r)}
        >
          {r}
        </button>
      {/each}
    </div>
  </div>

  <!-- VARIATIONS grid -->
  <div class="region region-vars">
    {#each groups as g (g.group)}
      <div class="var-group">
        <h3 class="group-head">{g.label}</h3>
        <div class="var-grid" role="radiogroup" aria-label={g.label} dir="ltr">
          {#each g.items as v (v.id)}
            <button
              class="var-cell"
              class:selected={v.id === variation}
              type="button"
              role="radio"
              aria-checked={v.id === variation}
              onclick={() => pickVariation(v.id)}
            >
              {v.label}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- SLASH BASS -->
  <div class="region region-bass">
    <h3 class="group-head">בס (slash)</h3>
    <div class="bass-row" role="radiogroup" aria-label="בחירת תו בס" dir="ltr">
      <button
        class="bass-pill"
        class:selected={bass === undefined}
        type="button"
        role="radio"
        aria-checked={bass === undefined}
        onclick={() => pickBass(undefined)}
      >
        ללא
      </button>
      {#each bassOptions as b (b)}
        <button
          class="bass-pill"
          class:selected={bass === b}
          type="button"
          role="radio"
          aria-checked={bass === b}
          onclick={() => pickBass(b)}
        >
          /{b}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .chord-panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    padding: var(--sp-5);
    min-width: 0;
  }

  /* ---- Preview bar ---- */
  .preview-bar {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }
  .preview-label {
    font-size: var(--text-xs);
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .preview-symbol {
    flex: 1;
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--accent);
    text-align: start;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .remove {
    flex: none;
    background: transparent;
    border: 1px solid color-mix(in oklch, var(--danger) 40%, transparent);
    border-radius: var(--r-sm);
    color: var(--danger);
    font-size: var(--text-sm);
    padding: var(--sp-2) var(--sp-4);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }
  .remove:hover {
    background: color-mix(in oklch, var(--danger) 16%, transparent);
    border-color: var(--danger);
  }
  .remove:active {
    background: color-mix(in oklch, var(--danger) 24%, transparent);
  }

  /* ---- Typed chord entry ---- */
  .chord-input {
    width: 100%;
    height: 40px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--text-base);
    padding: 0 var(--sp-4);
    transition:
      border-color var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast) var(--ease-out);
  }
  .chord-input::placeholder {
    color: var(--ink-3);
    font-family: var(--font-sans, inherit);
  }
  .chord-input:focus-visible {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }
  .chord-input.bad {
    border-color: color-mix(in oklch, var(--danger) 55%, transparent);
  }

  /* ---- Regions ---- */
  .region {
    min-width: 0;
  }
  .group-head {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-block-end: var(--sp-3);
  }

  /* ---- Root scroller ---- */
  .root-scroller {
    display: flex;
    gap: var(--sp-2);
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    padding-block-end: var(--sp-3);
    scrollbar-width: thin;
    scrollbar-color: var(--border-2) transparent;
  }
  .root-scroller::-webkit-scrollbar {
    height: 6px;
  }
  .root-scroller::-webkit-scrollbar-thumb {
    background: var(--border-2);
    border-radius: var(--r-full);
  }
  .root-scroller::-webkit-scrollbar-track {
    background: transparent;
  }
  .root-pill {
    flex: none;
    scroll-snap-align: center;
    min-width: 48px;
    height: 48px;
    padding: 0 var(--sp-4);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--text-md);
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .root-pill:hover {
    background: var(--surface-3);
    border-color: var(--border-2);
  }
  .root-pill:active {
    background: var(--surface-3);
  }
  .root-pill.selected {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
  }
  .root-pill.selected:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  /* ---- Variations grid ---- */
  .region-vars {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
  }
  .var-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: var(--sp-2);
  }
  .var-cell {
    height: 40px;
    padding: 0 var(--sp-3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .var-cell:hover {
    background: var(--surface-3);
    border-color: var(--border-2);
  }
  .var-cell:active {
    background: var(--surface-3);
  }
  .var-cell.selected {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .var-cell.selected:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  /* ---- Slash bass ---- */
  .bass-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .bass-pill {
    height: 34px;
    min-width: 42px;
    padding: 0 var(--sp-3);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    color: var(--ink-2);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .bass-pill:hover {
    background: var(--surface-3);
    border-color: var(--border-2);
    color: var(--ink);
  }
  .bass-pill:active {
    background: var(--surface-3);
  }
  .bass-pill.selected {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .bass-pill.selected:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
</style>
