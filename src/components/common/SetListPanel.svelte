<script lang="ts">
  /**
   * Track E — Set list manager.
   * Lists set lists, supports create / rename / delete, expands a selected set
   * to show its ordered songs with drag-reorder (svelte-dnd-action), add/remove,
   * "perform" launch, and whole-backup / per-set export plus file import.
   */
  import {
    sets,
    songs,
    addSet,
    updateSet,
    deleteSet,
    startPerformance,
  } from '$stores/app';
  import {
    downloadSnapshot,
    downloadSet,
    importFromFile,
  } from '$lib/exporter';
  import Button from '$components/common/Button.svelte';
  import { dndzone, type DndEvent } from 'svelte-dnd-action';
  import { flip } from 'svelte/animate';
  import type { SetList, Song } from '$lib/model';

  const SCRATCH = '__scratch__';
  const flipMs = 160;

  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = mq.matches;
    const on = () => (reduceMotion = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  });
  const flipDuration = $derived(reduceMotion ? 0 : flipMs);

  // ---- Visible sets (hide the scratch set) -------------------------------
  const visibleSets = $derived($sets.filter((s) => s.name !== SCRATCH));

  // ---- Selection & inline rename -----------------------------------------
  let activeSetId = $state<string | null>(null);
  const activeSet = $derived<SetList | null>(
    visibleSets.find((s) => s.id === activeSetId) ?? null,
  );

  let renamingId = $state<string | null>(null);
  let renameValue = $state('');

  function toggleSet(id: string) {
    if (renamingId) return;
    activeSetId = activeSetId === id ? null : id;
  }

  function startRename(set: SetList) {
    renamingId = set.id;
    renameValue = set.name;
  }
  async function commitRename() {
    const id = renamingId;
    if (!id) return;
    const name = renameValue.trim();
    renamingId = null;
    if (name) await updateSet(id, (s) => (s.name = name));
  }
  function cancelRename() {
    renamingId = null;
  }
  function onRenameKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  }

  async function createSet() {
    const set = await addSet('סט חדש');
    activeSetId = set.id;
    startRename(set);
  }

  async function removeSet(set: SetList) {
    const count = set.songIds.length;
    const msg =
      count > 0
        ? `למחוק את הסט "${set.name}"? (${count} שירים לא יימחקו)`
        : `למחוק את הסט "${set.name}"?`;
    if (!confirm(msg)) return;
    if (activeSetId === set.id) activeSetId = null;
    await deleteSet(set.id);
  }

  // ---- Songs in the active set (as dnd items) -----------------------------
  interface SongItem {
    id: string;
    title: string;
  }

  // Local working copy the dnd action mutates during a drag.
  let dndItems = $state<SongItem[]>([]);

  function titleOf(id: string): string {
    return $songs.find((s) => s.id === id)?.title ?? 'שיר חסר';
  }

  // Keep dndItems in sync with the active set's order from the store,
  // except while a drag is mid-flight (handled by consider/finalize).
  let dragging = $state(false);
  $effect(() => {
    if (dragging) return;
    const set = activeSet;
    dndItems = set
      ? set.songIds.map((id) => ({ id, title: titleOf(id) }))
      : [];
  });

  function handleConsider(e: CustomEvent<DndEvent<SongItem>>) {
    dragging = true;
    dndItems = e.detail.items;
  }
  async function handleFinalize(e: CustomEvent<DndEvent<SongItem>>) {
    const set = activeSet;
    dndItems = e.detail.items;
    dragging = false;
    if (!set) return;
    const order = e.detail.items.map((i) => i.id);
    await updateSet(set.id, (s) => (s.songIds = order));
  }

  async function removeFromSet(songId: string) {
    const set = activeSet;
    if (!set) return;
    await updateSet(set.id, (s) => {
      const i = s.songIds.indexOf(songId);
      if (i !== -1) s.songIds.splice(i, 1);
    });
  }

  async function addToSet(song: Song) {
    const set = activeSet;
    if (!set || set.songIds.includes(song.id)) return;
    await updateSet(set.id, (s) => s.songIds.push(song.id));
  }

  // ---- Add-songs search ---------------------------------------------------
  let songQuery = $state('');
  const addableSongs = $derived(() => {
    const set = activeSet;
    if (!set) return [] as Song[];
    const inSet = new Set(set.songIds);
    const q = songQuery.trim().toLowerCase();
    return $songs
      .filter((s) => !inSet.has(s.id))
      .filter((s) => (q ? s.title.toLowerCase().includes(q) : true))
      .sort((a, b) => a.title.localeCompare(b.title, 'he'));
  });

  // ---- Import / export feedback ------------------------------------------
  let fileInput = $state<HTMLInputElement | null>(null);
  let msg = $state<{ kind: 'ok' | 'err'; text: string } | null>(null);
  let msgTimer: ReturnType<typeof setTimeout> | null = null;

  function flash(kind: 'ok' | 'err', text: string) {
    msg = { kind, text };
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => (msg = null), 5000);
  }

  async function onExportBackup() {
    try {
      await downloadSnapshot();
      flash('ok', 'הגיבוי הורד.');
    } catch {
      flash('err', 'ייצוא הגיבוי נכשל.');
    }
  }

  async function onExportSet(set: SetList) {
    try {
      await downloadSet(set.id);
      flash('ok', `הסט "${set.name}" יוצא.`);
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'ייצוא הסט נכשל.');
    }
  }

  async function onImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await importFromFile(file, 'merge');
      flash('ok', 'הייבוא הושלם בהצלחה.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'הייבוא נכשל.');
    } finally {
      input.value = '';
    }
  }
</script>

<section class="panel" aria-label="סטים">
  <header class="head">
    <h2>סטים</h2>
    <Button size="sm" variant="filled" onclick={createSet}>+ סט חדש</Button>
  </header>

  {#if visibleSets.length === 0}
    <div class="empty">
      <p>אין סטים עדיין.</p>
      <p class="hint">צור סט כדי לסדר שירים לרצף הופעה.</p>
      <Button variant="filled" onclick={createSet}>צור את הסט הראשון</Button>
    </div>
  {:else}
    <ul class="set-list">
      {#each visibleSets as set (set.id)}
        <li class="set-item" class:open={set.id === activeSetId}>
          <div class="set-row">
            {#if renamingId === set.id}
              <!-- svelte-ignore a11y_autofocus -->
              <input
                class="rename"
                bind:value={renameValue}
                onkeydown={onRenameKey}
                onblur={commitRename}
                autofocus
                aria-label="שם הסט"
              />
            {:else}
              <button
                class="set-name"
                onclick={() => toggleSet(set.id)}
                aria-expanded={set.id === activeSetId}
              >
                <span class="caret" aria-hidden="true">{set.id === activeSetId ? '▾' : '▸'}</span>
                <span class="name-text">{set.name}</span>
                <span class="count tnum">{set.songIds.length}</span>
              </button>
            {/if}

            <div class="set-actions">
              <Button
                size="sm"
                variant="filled"
                onclick={() => startPerformance(set.id, 0)}
                disabled={set.songIds.length === 0}
                title="נגן את הסט"
              >
                נגן
              </Button>
              <Button size="sm" variant="ghost" onclick={() => startRename(set)} title="שנה שם">
                שנה שם
              </Button>
              <Button size="sm" variant="ghost" onclick={() => onExportSet(set)} title="ייצא סט">
                ייצא
              </Button>
              <Button size="sm" variant="danger" onclick={() => removeSet(set)} title="מחק סט">
                מחק
              </Button>
            </div>
          </div>

          {#if set.id === activeSetId}
            <div class="detail">
              {#if dndItems.length === 0}
                <p class="detail-empty">אין שירים בסט. הוסף שירים מהרשימה למטה.</p>
              {:else}
                <ul
                  class="song-order"
                  use:dndzone={{ items: dndItems, flipDurationMs: flipDuration, type: 'set-songs' }}
                  onconsider={handleConsider}
                  onfinalize={handleFinalize}
                >
                  {#each dndItems as item, i (item.id)}
                    <li class="song-row" animate:flip={{ duration: flipDuration }}>
                      <span class="grip" aria-hidden="true">⋮⋮</span>
                      <span class="idx tnum">{i + 1}</span>
                      <span class="song-title">{item.title}</span>
                      <button
                        class="remove"
                        onclick={() => removeFromSet(item.id)}
                        aria-label={`הסר את ${item.title} מהסט`}
                        title="הסר מהסט"
                      >
                        ✕
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}

              <div class="add-block">
                <input
                  class="song-search"
                  type="search"
                  placeholder="הוסף שיר…"
                  bind:value={songQuery}
                  aria-label="חיפוש שיר להוספה"
                />
                {#if addableSongs().length === 0}
                  <p class="add-empty">
                    {songQuery.trim() ? 'אין שירים תואמים.' : 'כל השירים כבר בסט.'}
                  </p>
                {:else}
                  <ul class="add-list">
                    {#each addableSongs() as song (song.id)}
                      <li>
                        <button class="add-song" onclick={() => addToSet(song)}>
                          <span class="plus" aria-hidden="true">+</span>
                          <span class="add-title">{song.title}</span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <footer class="io">
    <div class="io-row">
      <Button size="sm" variant="subtle" onclick={onExportBackup}>ייצוא גיבוי מלא</Button>
      <Button size="sm" variant="subtle" onclick={() => fileInput?.click()}>ייבוא מקובץ</Button>
      <input
        bind:this={fileInput}
        class="file-input"
        type="file"
        accept="application/json,.json"
        onchange={onImport}
      />
    </div>
    {#if msg}
      <p class="msg" class:err={msg.kind === 'err'} role="status">{msg.text}</p>
    {/if}
  </footer>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    min-height: 0;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-4);
  }
  .head h2 {
    font-size: var(--text-md);
  }

  /* ---- Empty state ---- */
  .empty {
    display: grid;
    place-items: center;
    gap: var(--sp-4);
    padding: var(--sp-8) var(--sp-4);
    text-align: center;
    color: var(--ink-2);
  }
  .empty .hint {
    color: var(--ink-3);
    font-size: var(--text-sm);
    margin: 0;
  }
  .empty p {
    margin: 0;
  }

  /* ---- Set list ---- */
  .set-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .set-item {
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface);
    overflow: hidden;
    transition: border-color var(--dur-fast) var(--ease-out);
  }
  .set-item:hover {
    border-color: var(--border-2);
  }
  .set-item.open {
    background: var(--surface-2);
    border-color: var(--border-2);
  }
  .set-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    flex-wrap: wrap;
  }
  .set-name {
    flex: 1 1 140px;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    background: none;
    border: none;
    cursor: pointer;
    text-align: start;
    padding: var(--sp-2);
    border-radius: var(--r-sm);
    color: var(--ink);
    min-width: 0;
  }
  .set-name:hover {
    color: var(--ink);
  }
  .caret {
    color: var(--ink-3);
    font-size: var(--text-xs);
    flex: none;
  }
  .name-text {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    margin-inline-start: auto;
    font-size: var(--text-xs);
    color: var(--ink-3);
    background: var(--surface-3);
    padding: 1px var(--sp-3);
    border-radius: var(--r-full);
    flex: none;
  }
  .rename {
    flex: 1 1 140px;
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: var(--r-sm);
    color: var(--ink);
    font: inherit;
    padding: var(--sp-2) var(--sp-3);
    min-width: 0;
  }
  .set-actions {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }

  /* ---- Detail ---- */
  .detail {
    border-top: 1px solid var(--border);
    padding: var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .detail-empty,
  .add-empty {
    margin: 0;
    color: var(--ink-3);
    font-size: var(--text-sm);
  }

  .song-order {
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
    padding: var(--sp-3);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  .grip {
    color: var(--ink-3);
    cursor: grab;
    font-size: var(--text-sm);
    letter-spacing: -2px;
    flex: none;
    user-select: none;
  }
  .song-row:active .grip {
    cursor: grabbing;
  }
  .idx {
    color: var(--ink-3);
    font-size: var(--text-xs);
    min-width: 1.4em;
    text-align: end;
    flex: none;
  }
  .song-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink);
  }
  .remove {
    flex: none;
    background: none;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    color: var(--ink-3);
    width: 26px;
    height: 26px;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition:
      color var(--dur-fast) var(--ease-out),
      background var(--dur-fast) var(--ease-out);
  }
  .remove:hover {
    color: var(--danger);
    background: color-mix(in oklch, var(--danger) 16%, transparent);
  }

  /* ---- Add songs ---- */
  .add-block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding-top: var(--sp-3);
    border-top: 1px dashed var(--border);
  }
  .song-search {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink);
    padding: var(--sp-3) var(--sp-4);
    font: inherit;
    font-size: var(--text-sm);
  }
  .add-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    max-height: 220px;
    overflow: auto;
  }
  .add-song {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    background: none;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    color: var(--ink-2);
    padding: var(--sp-2) var(--sp-3);
    cursor: pointer;
    text-align: start;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .add-song:hover {
    background: var(--surface-3);
    color: var(--ink);
  }
  .plus {
    color: var(--accent);
    font-weight: 600;
    flex: none;
  }
  .add-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- IO footer ---- */
  .io {
    margin-top: auto;
    padding-top: var(--sp-4);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .io-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }
  .msg {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--success);
  }
  .msg.err {
    color: var(--danger);
  }
</style>
