<script lang="ts">
  // PLACEHOLDER — Track F replaces this (auto-hide bottom bar).
  interface Props {
    playing: boolean;
    speed: number;
    onToggle: () => void;
    onSpeed: (n: number) => void;
    onNext: () => void;
    onPrev: () => void;
    onExit: () => void;
    songIndex: number;
    songCount: number;
    songTitle: string;
  }
  let { playing, speed, onToggle, onSpeed, onNext, onPrev, onExit, songIndex, songCount, songTitle }: Props = $props();
</script>

<div class="bar">
  <button onclick={onExit}>✕</button>
  <button onclick={onPrev} disabled={songIndex <= 0}>⏮</button>
  <span class="title">{songTitle} <span class="tnum">{songIndex + 1}/{songCount}</span></span>
  <button onclick={onNext} disabled={songIndex >= songCount - 1}>⏭</button>
  <button class="play" onclick={onToggle}>{playing ? '⏸' : '▶'}</button>
  <input type="range" min="0" max="200" value={speed} oninput={(e) => onSpeed(+(e.target as HTMLInputElement).value)} />
</div>

<style>
  .bar { position: fixed; inset-inline: 0; bottom: 0; display: flex; align-items: center; gap: 12px; padding: 12px 20px; background: oklch(0.14 0 0 / 0.86); backdrop-filter: blur(8px); border-top: 1px solid var(--border); z-index: var(--z-sticky); }
  button { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; color: var(--ink); width: 40px; height: 40px; cursor: pointer; }
  .play { background: var(--accent); color: var(--accent-ink); }
  .title { flex: 1; color: var(--ink); }
  input[type='range'] { accent-color: var(--accent); width: 160px; }
</style>
