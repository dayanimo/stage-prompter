<script lang="ts">
  import type { Song } from '$lib/model';
  import { resolveTheme } from '$lib/model';
  import { settings, updateSong, updateSettings } from '$stores/app';
  import ColorPicker from '$components/common/ColorPicker.svelte';
  import SizeSlider from '$components/common/SizeSlider.svelte';
  import Button from '$components/common/Button.svelte';

  interface Props {
    song: Song;
  }
  let { song }: Props = $props();

  const theme = $derived(resolveTheme(song, $settings));

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
