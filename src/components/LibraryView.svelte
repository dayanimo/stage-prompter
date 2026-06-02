<script lang="ts">
  import { songs, addSong, openSong, duplicateSong, deleteSong } from '$stores/app';
  import { seedSamples } from '$lib/samples';
  import Button from '$components/common/Button.svelte';
  import SetListPanel from '$components/common/SetListPanel.svelte';
  import ImportDialog from '$components/ImportDialog.svelte';

  let query = $state('');
  let seeding = $state(false);
  let importing = $state(false);

  async function loadSamples() {
    seeding = true;
    try {
      await seedSamples();
    } finally {
      seeding = false;
    }
  }

  const filtered = $derived(
    $songs
      .filter((s) => s.title.toLowerCase().includes(query.toLowerCase()))
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt),
  );

  async function newSong() {
    const song = await addSong();
    openSong(song.id);
  }
</script>

<div class="library">
  <header class="topbar">
    <div class="brand">
      <span class="dot" aria-hidden="true"></span>
      <h1>Stage Prompter</h1>
    </div>
    <div class="topbar-actions">
      <Button variant="subtle" size="md" onclick={() => (importing = true)}>⤓ ייבוא שיר</Button>
      <Button variant="filled" size="md" onclick={newSong}>+ שיר חדש</Button>
    </div>
  </header>

  <div class="cols">
    <section class="songs" aria-label="Song library">
      <div class="section-head">
        <h2>שירים</h2>
        <input
          class="search"
          type="search"
          placeholder="חיפוש שיר…"
          bind:value={query}
          aria-label="Search songs"
        />
      </div>

      {#if filtered.length === 0}
        <div class="empty">
          <p>אין שירים עדיין.</p>
          <div class="empty-actions">
            <Button variant="filled" onclick={newSong}>צור את השיר הראשון</Button>
            <Button variant="subtle" onclick={() => (importing = true)}>⤓ ייבוא מטקסט</Button>
            <Button variant="subtle" onclick={loadSamples} disabled={seeding}>
              {seeding ? 'טוען…' : 'טען שירי דוגמה'}
            </Button>
          </div>
          <p class="empty-hint">שירי דוגמה: אדון עולם, הבה נגילה, הבאנו שלום עליכם, דוד מלך ישראל — עם אקורדים וסט מוכן.</p>
        </div>
      {:else}
        <ul class="song-list">
          {#each filtered as song (song.id)}
            <li class="song-row">
              <button class="open" onclick={() => openSong(song.id)}>
                <span class="title">{song.title}</span>
                <bdi class="meta tnum" dir="ltr">{song.bpm} BPM · {song.timeSig.beats}/{song.timeSig.unit}</bdi>
              </button>
              <div class="row-actions">
                <Button variant="ghost" size="sm" onclick={() => duplicateSong(song.id)}>שכפל</Button>
                <Button variant="danger" size="sm" onclick={() => deleteSong(song.id)}>מחק</Button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <aside class="sets" aria-label="Set lists">
      <SetListPanel />
    </aside>
  </div>
</div>

{#if importing}
  <ImportDialog onclose={() => (importing = false)} />
{/if}

<style>
  .library {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-4) var(--sp-6);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .topbar-actions {
    display: flex;
    gap: var(--sp-3);
  }
  .brand h1 {
    font-size: var(--text-lg);
    letter-spacing: -0.01em;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--r-full);
    background: var(--accent);
    box-shadow: 0 0 12px var(--accent);
  }
  .cols {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr minmax(300px, 360px);
    gap: 1px;
    background: var(--border);
    min-height: 0;
  }
  .songs,
  .sets {
    background: var(--bg);
    padding: var(--sp-6);
    overflow: auto;
  }
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-4);
    margin-bottom: var(--sp-5);
  }
  .section-head h2 {
    font-size: var(--text-md);
  }
  .search {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink);
    padding: var(--sp-3) var(--sp-4);
    font: inherit;
    font-size: var(--text-sm);
    min-width: 200px;
  }
  .empty {
    display: grid;
    place-items: center;
    gap: var(--sp-5);
    padding: var(--sp-9) 0;
    color: var(--ink-3);
  }
  .empty-actions {
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
    justify-content: center;
  }
  .empty-hint {
    margin: 0;
    max-width: 42ch;
    text-align: center;
    font-size: var(--text-sm);
    color: var(--ink-3);
  }
  .song-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .song-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface);
    transition: border-color var(--dur-fast) var(--ease-out);
  }
  .song-row:hover {
    border-color: var(--border-2);
  }
  .open {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: var(--sp-4) var(--sp-5);
    background: none;
    border: none;
    cursor: pointer;
    text-align: start;
  }
  .title {
    font-weight: 500;
    color: var(--ink);
  }
  .meta {
    font-size: var(--text-xs);
    color: var(--ink-3);
  }
  .row-actions {
    display: flex;
    gap: var(--sp-2);
    padding-inline-end: var(--sp-4);
  }
  @media (max-width: 760px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }
</style>
