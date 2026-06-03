<script lang="ts">
  import {
    currentSong,
    settings,
    session,
    updateSong,
    goLibrary,
    startPerformance,
    setSelection,
    sets,
    addSet,
    updateSet,
    undo,
    redo,
    undoState,
    addFavoriteChord,
    removeFavoriteChord,
  } from '$stores/app';
  import type { Chord } from '$lib/model';
  import { applyChord } from '$lib/edits';
  import Button from '$components/common/Button.svelte';
  import LyricsEditor from '$components/edit/LyricsEditor.svelte';
  import ChordPanel from '$components/edit/ChordPanel.svelte';
  import ThemeControls from '$components/edit/ThemeControls.svelte';
  import TempoControls from '$components/edit/TempoControls.svelte';
  import FavoritesPanel from '$components/edit/FavoritesPanel.svelte';
  import { downloadSnapshot, importFromFile } from '$lib/exporter';

  type Tab = 'chords' | 'theme' | 'tempo';
  let tab = $state<Tab>('chords');

  const song = $derived($currentSong);
  const selection = $derived($session.selection);

  // Re-seed the chord panel whenever the selection moves to a fresh spot, so a
  // previously-picked chord doesn't linger on the next word.
  const selectionKey = $derived(
    selection ? `${selection.lineId}:${selection.start}:${selection.end}` : 'none',
  );

  // The chord (if any) already pinned at the selection's start — seeds the panel.
  const selectionChord = $derived.by<Chord | null>(() => {
    if (!song || !selection) return null;
    const line = song.lines.find((l) => l.id === selection.lineId);
    if (!line) return null;
    let acc = 0;
    for (const seg of line.segments) {
      if (acc === selection.start) return seg.chord ?? null;
      acc += seg.text.length;
    }
    return null;
  });

  function onTitleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (song) updateSong(song.id, (s) => (s.title = value));
  }

  function pickChord(chord: Chord) {
    if (!song || !selection) return;
    updateSong(song.id, (s) => applyChord(s, selection.lineId, selection.start, chord));
    addFavoriteChord(chord);
  }

  // ---- Favorites floating panel ----------------------------------------------
  let showFavorites = $state(false);
  const favorites = $derived($settings.favoriteChords ?? []);

  // ---- Undo / redo -----------------------------------------------------------
  function onWindowKey(e: KeyboardEvent) {
    if (!song) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (k === 'y') {
      e.preventDefault();
      redo();
    }
  }

  // ---- Resizable tool panel --------------------------------------------------
  const PANEL_KEY = 'sp.panelWidth';
  const PANEL_MIN = 280;
  const PANEL_MAX = 760;

  function loadPanelW(): number {
    const raw = Number(localStorage.getItem(PANEL_KEY));
    return Number.isFinite(raw) && raw >= PANEL_MIN && raw <= PANEL_MAX ? raw : 360;
  }

  let panelW = $state(loadPanelW());
  let bodyEl = $state<HTMLDivElement | null>(null);

  function startResize(e: PointerEvent) {
    if (e.button !== 0 || !bodyEl) return;
    e.preventDefault();
    const rtl = getComputedStyle(bodyEl).direction === 'rtl';
    const startX = e.clientX;
    const startW = panelW;
    function move(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      // Panel is the inline-end column: in LTR it grows as the pointer moves
      // left (negative dx); in RTL it grows as the pointer moves right.
      const w = rtl ? startW + dx : startW - dx;
      panelW = Math.max(PANEL_MIN, Math.min(PANEL_MAX, w));
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      localStorage.setItem(PANEL_KEY, String(Math.round(panelW)));
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---- Backup / restore (also available here, not just the library) ----------
  let fileInput = $state<HTMLInputElement | null>(null);
  let flashMsg = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  function flash(kind: 'ok' | 'err', text: string) {
    flashMsg = { kind, text };
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flashMsg = null), 4000);
  }
  async function onExportBackup() {
    try {
      await downloadSnapshot();
      flash('ok', 'הגיבוי הורד.');
    } catch {
      flash('err', 'ייצוא הגיבוי נכשל.');
    }
  }
  async function onImportFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await importFromFile(file, 'merge');
      flash('ok', 'הייבוא הושלם.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'הייבוא נכשל.');
    } finally {
      input.value = '';
    }
  }

  // Quick-perform: drop the song into a scratch set and play it solo.
  async function performThisSong() {
    if (!song) return;
    let scratch = $sets.find((s) => s.name === '__scratch__');
    if (!scratch) scratch = await addSet('__scratch__');
    await updateSet(scratch.id, (s) => (s.songIds = [song!.id]));
    startPerformance(scratch.id, 0);
  }
</script>

<svelte:window onkeydown={onWindowKey} />

{#if song}
  <div class="edit">
    <header class="topbar">
      <Button variant="ghost" size="sm" onclick={goLibrary}>→ ספרייה</Button>
      <div class="history">
        <button
          class="hist-btn"
          onclick={undo}
          disabled={!$undoState.canUndo}
          aria-label="בטל פעולה"
          title="בטל (Ctrl+Z)"
        >↶</button>
        <button
          class="hist-btn"
          onclick={redo}
          disabled={!$undoState.canRedo}
          aria-label="בצע שוב"
          title="בצע שוב (Ctrl+Shift+Z)"
        >↷</button>
      </div>
      <input class="title-input" value={song.title} oninput={onTitleInput} aria-label="Song title" />
      <button
        class="fav-toggle"
        class:on={showFavorites}
        role="switch"
        aria-checked={showFavorites}
        onclick={() => (showFavorites = !showFavorites)}
        title="אקורדים מועדפים צפים"
      >★ מועדפים</button>
      <input
        bind:this={fileInput}
        type="file"
        accept="application/json,.json"
        class="hidden-file"
        onchange={onImportFile}
        aria-hidden="true"
        tabindex="-1"
      />
      <button class="bak" onclick={() => fileInput?.click()} title="ייבוא גיבוי מקובץ">⤓ ייבוא</button>
      <button class="bak" onclick={onExportBackup} title="ייצוא גיבוי מלא לקובץ">⤒ גיבוי</button>
      <Button variant="filled" size="sm" onclick={performThisSong}>נגן ▶</Button>
    </header>

    {#if flashMsg}
      <div class="flash" class:err={flashMsg.kind === 'err'} role="status" aria-live="polite">
        {flashMsg.text}
      </div>
    {/if}

    <div class="body" bind:this={bodyEl} style="--panel-w:{panelW}px;">
      <main class="editor" aria-label="Lyrics editor">
        <LyricsEditor {song} />
      </main>

      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="שינוי רוחב חלונית הכלים"
        onpointerdown={startResize}
        ondblclick={() => {
          panelW = 360;
          localStorage.setItem(PANEL_KEY, '360');
        }}
      ></div>

      <aside class="panel" aria-label="Edit tools">
        <div class="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'chords'} class:active={tab === 'chords'} onclick={() => (tab = 'chords')}>אקורדים</button>
          <button role="tab" aria-selected={tab === 'theme'} class:active={tab === 'theme'} onclick={() => (tab = 'theme')}>עיצוב</button>
          <button role="tab" aria-selected={tab === 'tempo'} class:active={tab === 'tempo'} onclick={() => (tab = 'tempo')}>קצב</button>
        </div>
        <div class="panel-body">
          {#if tab === 'chords'}
            {#if selection}
              {#key selectionKey}
                <ChordPanel
                  value={selectionChord}
                  accidental={$settings.accidentalPref}
                  onpick={pickChord}
                  onremove={() => setSelection(null)}
                />
              {/key}
            {:else}
              <p class="hint">סמן אות או מילה בטקסט כדי למקם אקורד מעליה.</p>
            {/if}
          {:else if tab === 'theme'}
            <ThemeControls {song} />
          {:else}
            <TempoControls {song} />
          {/if}
        </div>
      </aside>
    </div>
  </div>

  {#if showFavorites}
    <FavoritesPanel
      chords={favorites}
      accidental={$settings.accidentalPref}
      armed={!!selection}
      onpick={pickChord}
      onremove={removeFavoriteChord}
      onclose={() => (showFavorites = false)}
    />
  {/if}
{:else}
  <div class="edit"><p class="hint" style="padding: var(--sp-6)">לא נבחר שיר.</p></div>
{/if}

<style>
  .edit {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-3) var(--sp-5);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .title-input {
    flex: 1;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--r-md);
    color: var(--ink);
    font: inherit;
    font-size: var(--text-md);
    font-weight: 600;
    padding: var(--sp-2) var(--sp-3);
  }
  .title-input:hover {
    border-color: var(--border);
  }
  .title-input:focus {
    background: var(--bg);
    border-color: var(--border-2);
    outline: none;
  }
  .body {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 7px var(--panel-w, 360px);
    min-height: 0;
    background: var(--border);
  }
  .editor {
    background: var(--bg);
    overflow: auto;
    padding: var(--sp-6);
  }
  /* Draggable divider between the editor and the tool panel. */
  .resizer {
    background: var(--border);
    cursor: col-resize;
    position: relative;
    touch-action: none;
    transition: background var(--dur-fast) var(--ease-out);
  }
  .resizer::before {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline: -3px;
  }
  .resizer:hover,
  .resizer:active {
    background: var(--accent);
  }
  .panel {
    background: var(--surface);
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
  }
  .tabs button {
    flex: 1;
    padding: var(--sp-4);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--ink-3);
    cursor: pointer;
    font-weight: 500;
    transition: color var(--dur-fast) var(--ease-out);
  }
  .tabs button.active {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }
  .panel-body {
    flex: 1;
    overflow: auto;
    padding: var(--sp-5);
  }
  .hint {
    color: var(--ink-3);
    font-size: var(--text-sm);
    line-height: 1.6;
  }
  @media (max-width: 860px) {
    .body {
      grid-template-columns: 1fr;
    }
    .resizer {
      display: none;
    }
  }

  /* ---- Undo/redo + favorites toggle ---- */
  .history {
    display: flex;
    gap: var(--sp-1);
  }
  .hist-btn {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink-2);
    font-size: var(--text-md);
    line-height: 1;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }
  .hist-btn:hover:not(:disabled) {
    background: var(--surface-3);
    border-color: var(--border-2);
    color: var(--ink);
  }
  .hist-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .hist-btn:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  .fav-toggle {
    height: 32px;
    padding-inline: var(--sp-3);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink-2);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }
  .fav-toggle:hover {
    background: var(--surface-3);
    border-color: var(--border-2);
    color: var(--ink);
  }
  .fav-toggle.on {
    color: var(--accent);
    border-color: color-mix(in oklch, var(--accent) 50%, transparent);
    background: var(--accent-soft);
  }
  .fav-toggle:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  @media (max-width: 560px) {
    .fav-toggle {
      display: none;
    }
  }
  .hidden-file {
    display: none;
  }
  .bak {
    height: 32px;
    padding-inline: var(--sp-3);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink-2);
    font: inherit;
    font-size: var(--text-sm);
    cursor: pointer;
    white-space: nowrap;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }
  .bak:hover {
    background: var(--surface-3);
    border-color: var(--border-2);
    color: var(--ink);
  }
  .bak:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  @media (max-width: 720px) {
    .bak {
      display: none;
    }
  }
  .flash {
    position: fixed;
    inset-inline: 0;
    bottom: var(--sp-5);
    margin-inline: auto;
    width: fit-content;
    max-width: 90vw;
    padding: var(--sp-3) var(--sp-5);
    background: var(--accent-soft);
    color: var(--accent);
    border: 1px solid color-mix(in oklch, var(--accent) 50%, transparent);
    border-radius: var(--r-full);
    font-size: var(--text-sm);
    font-weight: 600;
    z-index: var(--z-toast);
    box-shadow: 0 8px 24px oklch(0 0 0 / 0.4);
  }
  .flash.err {
    background: color-mix(in oklch, var(--danger) 18%, transparent);
    color: var(--danger);
    border-color: color-mix(in oklch, var(--danger) 50%, transparent);
  }
</style>
