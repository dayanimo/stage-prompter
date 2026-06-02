<script lang="ts">
  import type { Song } from '$lib/model';
  import { settings, updateSong, updateSettings } from '$stores/app';
  import Metronome from '$components/perf/Metronome.svelte';
  import Button from '$components/common/Button.svelte';

  interface Props {
    song: Song;
  }
  let { song }: Props = $props();

  let preview = $state(false);

  // --- BPM -------------------------------------------------------------------
  function commitBpm(raw: number) {
    if (!Number.isFinite(raw)) return;
    const bpm = Math.min(300, Math.max(30, Math.round(raw)));
    if (bpm === song.bpm) return;
    updateSong(song.id, (s) => {
      // Keep the auto-scroll speed correlated with tempo: when the BPM changes,
      // scale the saved scroll speed by the same ratio so a faster song scrolls
      // proportionally faster (and a slower one slower).
      if (typeof s.scrollSpeed === 'number' && s.bpm > 0) {
        s.scrollSpeed = Math.min(200, Math.max(0, Math.round(s.scrollSpeed * (bpm / s.bpm))));
      }
      s.bpm = bpm;
    });
  }

  function onBpmInput(e: Event) {
    commitBpm(+(e.target as HTMLInputElement).value);
  }

  // --- Tap tempo -------------------------------------------------------------
  let taps: number[] = [];
  let tapResetTimer: ReturnType<typeof setTimeout> | null = null;
  let tapHint = $state('');

  function tap() {
    const now = performance.now();
    // If the gap since the last tap is long, start a fresh series.
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now);
    if (taps.length > 5) taps = taps.slice(-5); // keep last ~4 intervals

    if (taps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avg > 0) {
        const bpm = Math.min(300, Math.max(30, Math.round(60000 / avg)));
        commitBpm(bpm);
        tapHint = `${bpm}`;
      }
    } else {
      tapHint = '…';
    }

    if (tapResetTimer) clearTimeout(tapResetTimer);
    tapResetTimer = setTimeout(() => {
      taps = [];
      tapHint = '';
    }, 2500);
  }

  $effect(() => () => {
    if (tapResetTimer) clearTimeout(tapResetTimer);
  });

  // --- Time signature --------------------------------------------------------
  function setBeats(e: Event) {
    const v = Math.min(16, Math.max(1, Math.round(+(e.target as HTMLInputElement).value)));
    if (v !== song.timeSig.beats)
      updateSong(song.id, (s) => (s.timeSig = { ...s.timeSig, beats: v }));
  }
  function setUnit(e: Event) {
    const v = +(e.target as HTMLSelectElement).value;
    updateSong(song.id, (s) => (s.timeSig = { ...s.timeSig, unit: v }));
  }

  // --- Count-in & click (global settings) ------------------------------------
  function setCountIn(e: Event) {
    const v = Math.min(2, Math.max(0, +(e.target as HTMLSelectElement).value));
    updateSettings((s) => (s.countInBars = v));
  }
  function setClick(e: Event) {
    const on = (e.target as HTMLInputElement).checked;
    updateSettings((s) => (s.clickEnabled = on));
  }
</script>

<div class="tempo">
  <h3>קצב וזמן</h3>

  <div class="field">
    <label for="bpm-input">BPM</label>
    <div class="bpm-row">
      <input
        id="bpm-input"
        class="num tnum"
        type="number"
        min="30"
        max="300"
        step="1"
        value={song.bpm}
        oninput={onBpmInput}
        aria-label="פעימות לדקה"
      />
      <Button variant="subtle" size="md" onclick={tap} aria-label="הקש קצב">
        הקש
        {#if tapHint}<span class="tap-hint tnum">{tapHint}</span>{/if}
      </Button>
    </div>
  </div>

  <div class="field">
    <span class="label">משקל</span>
    <div class="sig-row">
      <input
        class="num tnum"
        type="number"
        min="1"
        max="16"
        step="1"
        value={song.timeSig.beats}
        oninput={setBeats}
        aria-label="מספר פעימות בתיבה"
      />
      <span class="slash" aria-hidden="true">/</span>
      <select
        class="sel tnum"
        value={song.timeSig.unit}
        onchange={setUnit}
        aria-label="יחידת פעימה"
      >
        <option value={2}>2</option>
        <option value={4}>4</option>
        <option value={8}>8</option>
      </select>
    </div>
  </div>

  <div class="field">
    <label for="countin-sel">ספירה לפני (תיבות)</label>
    <select
      id="countin-sel"
      class="sel tnum"
      value={$settings.countInBars}
      onchange={setCountIn}
    >
      <option value={0}>ללא</option>
      <option value={1}>1</option>
      <option value={2}>2</option>
    </select>
  </div>

  <label class="toggle">
    <input type="checkbox" checked={$settings.clickEnabled} onchange={setClick} />
    <span>קליק מטרונום</span>
  </label>

  <div class="preview">
    <div class="preview-head">
      <Button
        variant={preview ? 'filled' : 'subtle'}
        size="sm"
        onclick={() => (preview = !preview)}
        aria-pressed={preview}
      >
        {preview ? 'עצור' : 'נגן'}
      </Button>
      <span class="preview-label">תצוגה מקדימה</span>
    </div>
    <Metronome
      bpm={song.bpm}
      timeSig={song.timeSig}
      running={preview}
      click={$settings.clickEnabled}
      countInBars={$settings.countInBars}
      compact
    />
  </div>
</div>

<style>
  .tempo {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    padding: var(--sp-5);
  }

  h3 {
    font-size: var(--text-base);
    font-weight: 600;
    color: var(--ink);
    margin: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }

  label,
  .label {
    font-size: var(--text-sm);
    color: var(--ink-2);
    font-weight: 500;
  }

  .bpm-row,
  .sig-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }

  .num,
  .sel {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink);
    padding: 0 var(--sp-4);
    height: 36px;
    font: inherit;
    font-size: var(--text-base);
    transition:
      border-color var(--dur-fast) var(--ease-out),
      background var(--dur-fast) var(--ease-out);
  }
  .num {
    width: 84px;
    text-align: start;
  }
  .sel {
    cursor: pointer;
  }

  .num:hover,
  .sel:hover {
    border-color: var(--border-2);
  }
  .num:focus-visible,
  .sel:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
    border-color: var(--accent);
  }

  .slash {
    color: var(--ink-3);
    font-size: var(--text-md);
  }

  .tap-hint {
    color: var(--accent);
    font-weight: 600;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    cursor: pointer;
    color: var(--ink);
    font-size: var(--text-base);
    font-weight: 400;
  }
  .toggle input {
    width: 16px;
    height: 16px;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
    padding: var(--sp-4);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }
  .preview-head {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .preview-label {
    font-size: var(--text-sm);
    color: var(--ink-3);
  }
</style>
