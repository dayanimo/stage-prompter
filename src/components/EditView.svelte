<script lang="ts">
  import { currentSong, settings, session, updateSong, goLibrary, startPerformance, setSelection, sets, addSet, updateSet } from '$stores/app';
  import type { Chord } from '$lib/model';
  import { applyChord } from '$lib/edits';
  import Button from '$components/common/Button.svelte';
  import LyricsEditor from '$components/edit/LyricsEditor.svelte';
  import ChordPanel from '$components/edit/ChordPanel.svelte';
  import ThemeControls from '$components/edit/ThemeControls.svelte';
  import TempoControls from '$components/edit/TempoControls.svelte';

  type Tab = 'chords' | 'theme' | 'tempo';
  let tab = $state<Tab>('chords');

  const song = $derived($currentSong);
  const selection = $derived($session.selection);

  function onTitleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (song) updateSong(song.id, (s) => (s.title = value));
  }

  function pickChord(chord: Chord) {
    if (!song || !selection) return;
    updateSong(song.id, (s) => applyChord(s, selection.lineId, selection.start, chord));
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

{#if song}
  <div class="edit">
    <header class="topbar">
      <Button variant="ghost" size="sm" onclick={goLibrary}>→ ספרייה</Button>
      <input class="title-input" value={song.title} oninput={onTitleInput} aria-label="Song title" />
      <Button variant="filled" size="sm" onclick={performThisSong}>נגן ▶</Button>
    </header>

    <div class="body">
      <main class="editor" aria-label="Lyrics editor">
        <LyricsEditor {song} />
      </main>

      <aside class="panel" aria-label="Edit tools">
        <div class="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'chords'} class:active={tab === 'chords'} onclick={() => (tab = 'chords')}>אקורדים</button>
          <button role="tab" aria-selected={tab === 'theme'} class:active={tab === 'theme'} onclick={() => (tab = 'theme')}>עיצוב</button>
          <button role="tab" aria-selected={tab === 'tempo'} class:active={tab === 'tempo'} onclick={() => (tab = 'tempo')}>קצב</button>
        </div>
        <div class="panel-body">
          {#if tab === 'chords'}
            {#if selection}
              <ChordPanel accidental={$settings.accidentalPref} onpick={pickChord} onremove={() => setSelection(null)} />
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
    grid-template-columns: 1fr minmax(320px, 380px);
    gap: 1px;
    background: var(--border);
    min-height: 0;
  }
  .editor {
    background: var(--bg);
    overflow: auto;
    padding: var(--sp-6);
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
  }
</style>
