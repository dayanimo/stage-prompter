<script lang="ts">
  // PLACEHOLDER — Track E replaces this (drag reorder, search, full management).
  import { sets, songs, addSet, updateSet, deleteSet, startPerformance } from '$stores/app';
  import { downloadSnapshot, importFromFile } from '$lib/exporter';
  import Button from '$components/common/Button.svelte';

  let activeSetId = $state<string | null>(null);
  const activeSet = $derived($sets.find((s) => s.id === activeSetId) ?? null);

  function titleOf(id: string) { return $songs.find((s) => s.id === id)?.title ?? '—'; }
  async function onImport(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) await importFromFile(file, 'merge');
  }
</script>

<div class="ph">
  <div class="head">
    <h2>סטים</h2>
    <Button size="sm" onclick={() => addSet('סט חדש')}>+ סט</Button>
  </div>

  <ul class="sets">
    {#each $sets.filter((s) => s.name !== '__scratch__') as set (set.id)}
      <li class:active={set.id === activeSetId}>
        <button class="name" onclick={() => (activeSetId = set.id)}>{set.name} ({set.songIds.length})</button>
        <Button size="sm" variant="filled" onclick={() => startPerformance(set.id, 0)}>▶</Button>
        <Button size="sm" variant="danger" onclick={() => deleteSet(set.id)}>✕</Button>
      </li>
    {/each}
  </ul>

  {#if activeSet}
    <div class="detail">
      <h3>{activeSet.name}</h3>
      <ol>
        {#each activeSet.songIds as id (id)}<li>{titleOf(id)}</li>{/each}
      </ol>
      <div class="add-songs">
        {#each $songs as song (song.id)}
          <Button size="sm" variant="ghost" onclick={() => updateSet(activeSet!.id, (s) => s.songIds.push(song.id))}>+ {song.title}</Button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="io">
    <Button size="sm" variant="ghost" onclick={downloadSnapshot}>ייצוא</Button>
    <label class="import"><input type="file" accept="application/json" onchange={onImport} />ייבוא</label>
  </div>
</div>

<style>
  .ph { display: flex; flex-direction: column; gap: 16px; }
  .head { display: flex; align-items: center; justify-content: space-between; }
  .head h2 { font-size: var(--text-md); }
  .sets { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .sets li { display: flex; align-items: center; gap: 6px; padding: 6px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
  .sets li.active { border-color: var(--accent); }
  .name { flex: 1; background: none; border: none; color: var(--ink); text-align: start; cursor: pointer; }
  .detail ol { padding-inline-start: 20px; color: var(--ink-2); }
  .add-songs { display: flex; flex-wrap: wrap; gap: 4px; }
  .io { display: flex; gap: 8px; align-items: center; }
  .import { font-size: var(--text-sm); color: var(--ink-2); cursor: pointer; }
  .import input { display: none; }
</style>
