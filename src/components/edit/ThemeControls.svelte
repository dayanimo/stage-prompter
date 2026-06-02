<script lang="ts">
  // PLACEHOLDER — Track C replaces this.
  import type { Song } from '$lib/model';
  import { resolveTheme } from '$lib/model';
  import { settings, updateSong } from '$stores/app';
  import ColorPicker from '$components/common/ColorPicker.svelte';
  import SizeSlider from '$components/common/SizeSlider.svelte';

  interface Props { song: Song }
  let { song }: Props = $props();
  const theme = $derived(resolveTheme(song, $settings));

  function setTheme(key: string, val: string | number) {
    updateSong(song.id, (s) => { s.theme = { ...(s.theme ?? {}), [key]: val }; });
  }
</script>

<div class="ph">
  <ColorPicker label="רקע" value={theme.bg} onchange={(c) => setTheme('bg', c)} />
  <ColorPicker label="טקסט" value={theme.text} onchange={(c) => setTheme('text', c)} />
  <ColorPicker label="אקורד" value={theme.chord} onchange={(c) => setTheme('chord', c)} />
  <ColorPicker label="הערה" value={theme.note} onchange={(c) => setTheme('note', c)} />
  <SizeSlider label="גודל מילים" min={16} max={120} value={theme.lyricSize} onchange={(n) => setTheme('lyricSize', n)} />
  <SizeSlider label="גודל אקורד" min={12} max={96} value={theme.chordSize} onchange={(n) => setTheme('chordSize', n)} />
  <SizeSlider label="גודל הערה" min={10} max={64} value={theme.noteSize} onchange={(n) => setTheme('noteSize', n)} />
</div>

<style>
  .ph { display: flex; flex-direction: column; gap: 12px; }
</style>
