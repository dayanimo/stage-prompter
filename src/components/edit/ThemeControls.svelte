<script lang="ts">
  import type { Song } from '$lib/model';
  import { resolveTheme, sectionLabel } from '$lib/model';
  import { settings, updateSong, updateSettings } from '$stores/app';
  import ColorPicker from '$components/common/ColorPicker.svelte';
  import SizeSlider from '$components/common/SizeSlider.svelte';
  import Button from '$components/common/Button.svelte';

  interface Props {
    song: Song;
  }
  let { song }: Props = $props();

  const theme = $derived(resolveTheme(song, $settings));

  // ---- Section-type badge colors --------------------------------------------
  // Distinct sections actually used in this song (order of first appearance).
  const usedSections = $derived.by(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const l of song.lines) {
      if (l.section && !seen.has(l.section)) {
        seen.add(l.section);
        out.push(l.section);
      }
    }
    return out;
  });

  const SEC_TEXT_SWATCHES = [
    'oklch(0.72 0.118 200)',
    'oklch(0.84 0.15 75)',
    'oklch(0.7 0.2 25)',
    'oklch(0.78 0.16 150)',
    'oklch(0.72 0.17 300)',
    'oklch(0.97 0 0)',
  ];
  const SEC_BG_SWATCHES = [
    '',
    'oklch(0.72 0.118 200 / 0.22)',
    'oklch(0.8 0.14 75 / 0.22)',
    'oklch(0.64 0.205 25 / 0.22)',
    'oklch(0.72 0.15 150 / 0.22)',
  ];

  function styleOf(section: string): { color?: string; bg?: string } {
    return song.sectionStyles?.[section] ?? {};
  }
  function setSectionTypeStyle(section: string, patch: { color?: string; bg?: string }) {
    updateSong(song.id, (s) => {
      const map = { ...(s.sectionStyles ?? {}) };
      const next = { ...(map[section] ?? {}), ...patch };
      // Drop empty keys so a cleared style doesn't linger.
      if (!next.color) delete next.color;
      if (!next.bg) delete next.bg;
      if (!next.color && !next.bg) delete map[section];
      else map[section] = next;
      s.sectionStyles = map;
    });
  }

  /** Whether this song carries any per-song theme overrides. */
  const hasOverrides = $derived(
    Boolean(song.theme) && Object.keys(song.theme ?? {}).length > 0,
  );

  function setTheme(key: keyof typeof theme, val: string | number) {
    updateSong(song.id, (s) => {
      s.theme = { ...(s.theme ?? {}), [key]: val };
    });
  }

  function reset() {
    updateSong(song.id, (s) => {
      delete s.theme;
    });
  }

  function saveAsGlobalDefault() {
    // Snapshot the current effective theme into the global default.
    const snapshot = { ...theme };
    updateSettings((s) => {
      s.defaultTheme = snapshot;
    });
  }
</script>

<div class="theme-controls">
  <section class="group" aria-label="צבעים">
    <h3 class="group-title">צבעים</h3>
    <div class="grid">
      <ColorPicker label="רקע" value={theme.bg} onchange={(c) => setTheme('bg', c)} />
      <ColorPicker label="טקסט" value={theme.text} onchange={(c) => setTheme('text', c)} />
      <ColorPicker label="אקורד" value={theme.chord} onchange={(c) => setTheme('chord', c)} />
      <ColorPicker label="הערה" value={theme.note} onchange={(c) => setTheme('note', c)} />
    </div>
  </section>

  {#if usedSections.length > 0}
    <section class="group" aria-label="צבעי קטעים">
      <h3 class="group-title">צבעי קטעים (לפי סוג)</h3>
      <p class="hint">חל על כל השורות מאותו סוג. צבע ידני בשורה ספציפית גובר.</p>
      <div class="sec-list">
        {#each usedSections as sec (sec)}
          {@const st = styleOf(sec)}
          <div class="sec-row">
            <span
              class="sec-badge"
              style="color:{st.color || 'var(--accent)'}; {st.bg ? `background:${st.bg};` : ''}"
              >{sectionLabel(sec)}</span
            >
            <div class="sec-cols">
              <div class="sec-swatches" role="group" aria-label={`צבע טקסט — ${sectionLabel(sec)}`}>
                {#each SEC_TEXT_SWATCHES as c (c)}
                  <button
                    type="button"
                    class="sec-swatch"
                    class:sel={st.color === c}
                    style="background:{c};"
                    aria-label={`צבע ${c}`}
                    onclick={() => setSectionTypeStyle(sec, { color: c })}
                  ></button>
                {/each}
                <button
                  type="button"
                  class="sec-swatch none"
                  class:sel={!st.color}
                  aria-label="ברירת מחדל"
                  onclick={() => setSectionTypeStyle(sec, { color: '' })}>∅</button>
              </div>
              <div class="sec-swatches" role="group" aria-label={`רקע — ${sectionLabel(sec)}`}>
                {#each SEC_BG_SWATCHES as c (c)}
                  {#if c}
                    <button
                      type="button"
                      class="sec-swatch"
                      class:sel={st.bg === c}
                      style="background:{c};"
                      aria-label={`רקע ${c}`}
                      onclick={() => setSectionTypeStyle(sec, { bg: c })}
                    ></button>
                  {:else}
                    <button
                      type="button"
                      class="sec-swatch none"
                      class:sel={!st.bg}
                      aria-label="ללא רקע"
                      onclick={() => setSectionTypeStyle(sec, { bg: '' })}>∅</button>
                  {/if}
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <section class="group" aria-label="גדלים">
    <h3 class="group-title">גדלים</h3>
    <div class="sizes">
      <SizeSlider
        label="גודל מילים"
        min={16}
        max={120}
        value={theme.lyricSize}
        onchange={(n) => setTheme('lyricSize', n)}
      />
      <SizeSlider
        label="גודל אקורד"
        min={12}
        max={96}
        value={theme.chordSize}
        onchange={(n) => setTheme('chordSize', n)}
      />
      <SizeSlider
        label="גודל הערה"
        min={10}
        max={64}
        value={theme.noteSize}
        onchange={(n) => setTheme('noteSize', n)}
      />
    </div>
  </section>

  <section class="group" aria-label="תצוגה מקדימה">
    <h3 class="group-title">תצוגה מקדימה</h3>
    <div
      class="preview"
      style:background={theme.bg}
      style:color={theme.text}
    >
      <span
        class="pv-chord"
        style:color={theme.chord}
        style:font-size={`${theme.chordSize}px`}>Am</span
      >
      <span class="pv-lyric" style:font-size={`${theme.lyricSize}px`}>שורת מילים · Lyric line</span>
      <span
        class="pv-note"
        style:font-size={`${theme.noteSize}px`}
        style:background={`color-mix(in oklch, ${theme.note} 26%, transparent)`}
        style:color={theme.note}
        style:border-color={theme.note}>סולו גיטרה</span
      >
    </div>
  </section>

  <div class="actions">
    <Button variant="ghost" size="sm" onclick={reset} disabled={!hasOverrides}>
      אפס לברירת מחדל
    </Button>
    <Button variant="subtle" size="sm" onclick={saveAsGlobalDefault}>
      שמור כברירת מחדל גלובלית
    </Button>
  </div>
</div>

<style>
  .theme-controls {
    display: flex;
    flex-direction: column;
    gap: var(--sp-6);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .group-title {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink-3);
    text-transform: none;
    letter-spacing: 0.02em;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--sp-5);
  }
  .sizes {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
  }
  .hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--ink-3);
    line-height: 1.5;
  }
  .sec-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .sec-row {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    flex-wrap: wrap;
  }
  .sec-badge {
    flex: none;
    min-width: 64px;
    font-size: var(--text-xs);
    font-weight: 700;
    padding: 0.15em 0.5em;
    border-radius: var(--r-sm);
    text-align: center;
  }
  .sec-cols {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .sec-swatches {
    display: flex;
    gap: var(--sp-2);
  }
  .sec-swatch {
    width: 22px;
    height: 22px;
    border-radius: var(--r-full);
    border: 2px solid var(--border-2);
    cursor: pointer;
    padding: 0;
    transition:
      transform var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }
  .sec-swatch:hover {
    transform: scale(1.1);
  }
  .sec-swatch.sel {
    border-color: var(--accent);
  }
  .sec-swatch.none {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-3);
    font-size: 10px;
    background:
      linear-gradient(45deg, var(--surface-3) 25%, transparent 25%) 0 0 / 9px 9px,
      linear-gradient(-45deg, var(--surface-3) 25%, transparent 25%) 0 4.5px / 9px 9px;
  }
  .sec-swatch:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-6) var(--sp-5);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
    text-align: center;
    /* Keep oversized sample text from blowing out the panel. */
    max-height: 260px;
  }
  .pv-chord {
    font-family: var(--font-mono);
    font-weight: 600;
    line-height: 1.1;
  }
  .pv-lyric {
    font-weight: 500;
    line-height: 1.15;
  }
  .pv-note {
    padding: var(--sp-1) var(--sp-3);
    border: 1px solid;
    border-radius: var(--r-sm);
    line-height: 1.2;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    justify-content: flex-start;
    padding-top: var(--sp-2);
    border-top: 1px solid var(--border);
  }
</style>
