<script lang="ts">
  // PLACEHOLDER — Track D replaces this (tap tempo, count-in, etc.).
  import type { Song } from '$lib/model';
  import { settings, updateSong, updateSettings } from '$stores/app';
  import Metronome from '$components/perf/Metronome.svelte';

  interface Props { song: Song }
  let { song }: Props = $props();
  let preview = $state(false);

  function setBpm(v: number) { updateSong(song.id, (s) => (s.bpm = v)); }
  function setBeats(v: number) { updateSong(song.id, (s) => (s.timeSig = { ...s.timeSig, beats: v })); }
  function setUnit(v: number) { updateSong(song.id, (s) => (s.timeSig = { ...s.timeSig, unit: v })); }
</script>

<div class="ph">
  <label>BPM <input class="tnum" type="number" min="30" max="300" value={song.bpm} oninput={(e) => setBpm(+(e.target as HTMLInputElement).value)} /></label>
  <label>משקל
    <input class="tnum" type="number" min="1" max="16" value={song.timeSig.beats} oninput={(e) => setBeats(+(e.target as HTMLInputElement).value)} />
    /
    <select value={song.timeSig.unit} onchange={(e) => setUnit(+(e.target as HTMLSelectElement).value)}>
      <option value={2}>2</option><option value={4}>4</option><option value={8}>8</option>
    </select>
  </label>
  <label><input type="checkbox" checked={$settings.clickEnabled} onchange={(e) => updateSettings((s) => (s.clickEnabled = (e.target as HTMLInputElement).checked))} /> קליק</label>
  <button onclick={() => (preview = !preview)}>{preview ? 'עצור' : 'נגן'} מטרונום</button>
  <Metronome bpm={song.bpm} timeSig={song.timeSig} running={preview} click={$settings.clickEnabled} compact />
</div>

<style>
  .ph { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
  label { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--ink-2); }
  input, select { background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; color: var(--ink); padding: 4px 8px; font: inherit; }
  input[type='number'] { width: 70px; }
  button { background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; color: var(--ink); padding: 6px 12px; cursor: pointer; }
</style>
