<script lang="ts">
  // PLACEHOLDER — Track B replaces this with full selection-driven editing.
  import type { Song } from '$lib/model';
  import { lineText } from '$lib/model';
  import { updateSong, setSelection } from '$stores/app';
  import { editLineText } from '$lib/edits';
  import { createLine } from '$lib/model';

  interface Props { song: Song }
  let { song }: Props = $props();

  function onInput(lineId: string, e: Event) {
    const text = (e.target as HTMLInputElement).value;
    updateSong(song.id, (s) => editLineText(s, lineId, text));
  }
  function onSelect(lineId: string, e: Event) {
    const el = e.target as HTMLInputElement;
    if (el.selectionStart != null && el.selectionEnd != null && el.selectionEnd > el.selectionStart) {
      setSelection({ lineId, start: el.selectionStart, end: el.selectionEnd });
    }
  }
  function addLine() {
    updateSong(song.id, (s) => s.lines.push(createLine('')));
  }
</script>

<div class="editor-ph">
  {#each song.lines as line (line.id)}
    <input
      class="line-input"
      dir={song.dir === 'ltr' ? 'ltr' : 'auto'}
      value={lineText(line)}
      oninput={(e) => onInput(line.id, e)}
      onselect={(e) => onSelect(line.id, e)}
    />
  {/each}
  <button class="add" onclick={addLine}>+ שורה</button>
</div>

<style>
  .editor-ph { display: flex; flex-direction: column; gap: 4px; max-width: 70ch; }
  .line-input { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; color: var(--ink); padding: 6px 10px; font: inherit; font-size: var(--text-md); }
  .add { align-self: flex-start; margin-top: 8px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; color: var(--ink-2); padding: 6px 12px; cursor: pointer; }
</style>
