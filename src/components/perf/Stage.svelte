<script lang="ts">
  // PLACEHOLDER — Track F replaces this with the full performance stage.
  import { setSongs, session, settings, goLibrary, currentSong } from '$stores/app';
  import { resolveTheme } from '$lib/model';
  import SongLine from '$components/common/SongLine.svelte';
  import Metronome from '$components/perf/Metronome.svelte';
  import ScrollControls from '$components/perf/ScrollControls.svelte';

  const songs = $derived($setSongs);
  const index = $derived($session.perfIndex);
  const song = $derived(songs[index] ?? $currentSong ?? null);
  const theme = $derived(song ? resolveTheme(song, $settings) : null);

  let playing = $state(false);
  let speed = $state(40);

  function go(delta: number) {
    const next = index + delta;
    if (next >= 0 && next < songs.length) session.update((s) => ({ ...s, perfIndex: next }));
  }
</script>

{#if song && theme}
  <div class="stage" style="--bg: {theme.bg}">
    <div class="metro-wrap"><Metronome bpm={song.bpm} timeSig={song.timeSig} running={playing} click={$settings.clickEnabled} /></div>
    <div class="scroll">
      <div class="content" dir={song.dir === 'ltr' ? 'ltr' : 'rtl'}>
        {#each song.lines as line (line.id)}
          <SongLine {line} {theme} transpose={song.transpose ?? 0} accidental={$settings.accidentalPref} dir={song.dir} />
        {/each}
      </div>
    </div>
    <ScrollControls
      {playing}
      {speed}
      onToggle={() => (playing = !playing)}
      onSpeed={(n) => (speed = n)}
      onNext={() => go(1)}
      onPrev={() => go(-1)}
      onExit={goLibrary}
      songIndex={index}
      songCount={songs.length}
      songTitle={song.title}
    />
  </div>
{:else}
  <div class="empty"><p>אין שירים בסט.</p><button onclick={goLibrary}>חזרה</button></div>
{/if}

<style>
  .stage { position: fixed; inset: 0; background: var(--bg); display: flex; flex-direction: column; }
  .metro-wrap { display: flex; justify-content: center; padding: 16px; }
  .scroll { flex: 1; overflow: auto; }
  .content { max-width: 1100px; margin: 0 auto; padding: 40px 24px 160px; display: flex; flex-direction: column; gap: 14px; }
  .empty { position: fixed; inset: 0; display: grid; place-content: center; gap: 16px; text-align: center; }
</style>
