<script lang="ts">
  /**
   * Track F — full-screen performance stage.
   *
   * Renders the active set's current song as a centered single column of
   * non-editable SongLines on the song's resolved theme background. Drives the
   * visual metronome, rAF auto-scroll, the auto-hiding transport bar, and the
   * keyboard shortcuts. On reaching the bottom it auto-advances to the next
   * song (resetting scroll); at the last song it simply stops. Portrait and
   * landscape are both first-class — the column adapts to viewport width.
   */
  import {
    setSongs,
    session,
    settings,
    currentSong,
    goLibrary,
    updateSong,
    updateSettings,
  } from '$stores/app';
  import { resolveTheme, type Song } from '$lib/model';
  import SongLine from '$components/common/SongLine.svelte';
  import Metronome from '$components/perf/Metronome.svelte';
  import ScrollControls from '$components/perf/ScrollControls.svelte';
  import { createAutoScroller, type AutoScroller } from '$lib/autoscroll';
  import { installShortcuts } from '$lib/shortcuts';
  import type { BeatInfo } from '$lib/metronome';
  import { untrack } from 'svelte';

  // ---- Active song resolution ------------------------------------------------
  const songs = $derived($setSongs);
  const index = $derived(
    songs.length ? Math.min(Math.max($session.perfIndex, 0), songs.length - 1) : 0,
  );
  const song = $derived<Song | null>(songs[index] ?? $currentSong ?? null);
  const theme = $derived(song ? resolveTheme(song, $settings) : null);
  const dir = $derived(song?.dir === 'ltr' ? 'ltr' : 'rtl');
  const isRtl = $derived(dir === 'rtl');

  const songCount = $derived(songs.length || ($currentSong ? 1 : 0));

  // ---- Transport state -------------------------------------------------------
  const FONT_STEP = 4;
  const FONT_MIN = 16;
  const FONT_MAX = 160;
  const SPEED_STEP = 5;
  const SPEED_MIN = 0;
  const SPEED_MAX = 200;
  const DEFAULT_SPEED = 40;

  // Minimum time a song stays on screen before auto-advancing, so short songs
  // that don't need scrolling are still readable in continuous play.
  const MIN_DWELL_MS = 7000;
  const ADVANCE_GAP_MS = 700;

  let playing = $state(false);
  let speed = $state(DEFAULT_SPEED);
  let countingIn = $state(false);
  let scrollStartedAt = 0;
  let advanceTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- 2-line focus mode -----------------------------------------------------
  const lineView = $derived($settings.lineView);
  // How much bigger lyrics/chords/notes get in focus mode.
  const FOCUS_SCALE = 1.7;
  const FOCUS_CAP = 132;
  let lineIndex = $state(0);
  const lineCount = $derived(song?.lines.length ?? 0);
  const activeLine = $derived(song?.lines[lineIndex] ?? null);
  const nextLine = $derived(song?.lines[lineIndex + 1] ?? null);
  const focusTheme = $derived(
    theme
      ? {
          ...theme,
          lyricSize: Math.min(FOCUS_CAP, Math.round(theme.lyricSize * FOCUS_SCALE)),
          chordSize: Math.min(FOCUS_CAP, Math.round(theme.chordSize * FOCUS_SCALE)),
          noteSize: Math.min(FOCUS_CAP, Math.round(theme.noteSize * FOCUS_SCALE)),
        }
      : null,
  );

  // Bars to hold each line before the beat auto-advances it (0 = manual only).
  const lineBars = $derived($settings.lineBars);
  // Beats counted since the current line appeared (for tempo-synced advancing).
  let beatTick = 0;

  function nextLineStep(): void {
    if (!song) return;
    beatTick = 0;
    if (lineIndex < song.lines.length - 1) {
      lineIndex += 1;
    } else if (index < songs.length - 1) {
      // Past the last line: roll to the next song.
      transitionTo(index + 1);
    }
  }

  function prevLineStep(): void {
    beatTick = 0;
    if (lineIndex > 0) lineIndex -= 1;
    else if (index > 0) go(-1);
  }

  // Called on every metronome beat. In 2-line mode it advances one line every
  // `lineBars` bars so the view follows the song's tempo hands-free.
  function handleBeat(info: BeatInfo): void {
    if (!lineView || !playing || info.countingIn || lineBars <= 0) return;
    beatTick += 1;
    const perLine = Math.max(1, lineBars * Math.max(1, song?.timeSig.beats ?? 4));
    if (beatTick >= perLine) {
      beatTick = 0;
      autoAdvanceLine();
    }
  }

  function autoAdvanceLine(): void {
    if (!song) return;
    if (lineIndex < song.lines.length - 1) {
      lineIndex += 1;
    } else if ($settings.autoAdvance && index < songs.length - 1) {
      // End of song: roll into the next one and keep the beat going.
      transitionTo(index + 1);
      clearAdvance();
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        beginPlay();
      }, 500);
    } else {
      // End of the set: stop.
      playing = false;
    }
  }

  let scrollEl: HTMLDivElement | null = $state(null);
  let scroller: AutoScroller | null = null;

  // Pending speed persist (debounced) to avoid writing on every slider tick.
  let speedSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- Auto-scroller lifecycle ----------------------------------------------
  // Create the scroller once the scroll element exists; recreate if it changes.
  $effect(() => {
    const el = scrollEl;
    if (!el) return;
    // Seed with the current speed WITHOUT tracking it, so live speed changes
    // don't tear down and recreate the scroller (which would halt scrolling).
    // Speed updates flow through the dedicated setSpeed effect below.
    const s = createAutoScroller(el, {
      speed: untrack(() => speed),
      onEnd: handleEnd,
    });
    if (untrack(() => playing)) s.play();
    scroller = s;
    return () => {
      s.destroy();
      if (scroller === s) scroller = null;
    };
  });

  // Keep the engine's speed in sync with the reactive value.
  // Read `speed` UNCONDITIONALLY first: `scroller?.setSpeed(speed)` alone would
  // short-circuit on `scroller` when it's momentarily null, so `speed` would
  // never be tracked and live slider changes would never reach the engine.
  $effect(() => {
    const nextSpeed = speed;
    scroller?.setSpeed(nextSpeed);
  });

  // When the song changes, adopt its remembered speed and reset transport.
  let lastSongId: string | null = null;
  $effect(() => {
    const id = song?.id ?? null;
    if (id === lastSongId) return;
    lastSongId = id;
    // Pull persisted per-song speed, falling back to the default.
    if (song && typeof song.scrollSpeed === 'number') speed = song.scrollSpeed;
    else speed = DEFAULT_SPEED;
    // Fresh song: stop and return to top.
    playing = false;
    countingIn = false;
    lineIndex = 0;
    beatTick = 0;
    if (scrollEl) scrollEl.scrollTop = 0;
  });

  // ---- Keyboard shortcuts ----------------------------------------------------
  $effect(() => {
    const rtl = isRtl;
    const focus = lineView;
    const uninstall = installShortcuts({
      // In focus mode, Space and the vertical arrows page lines instead of
      // toggling/scrolling; song nav stays on the horizontal arrows.
      toggleScroll: focus ? nextLineStep : togglePlay,
      next: () => go(1),
      prev: () => go(-1),
      fontUp: () => bumpFont(FONT_STEP),
      fontDown: () => bumpFont(-FONT_STEP),
      speedUp: focus ? prevLineStep : () => bumpSpeed(SPEED_STEP),
      speedDown: focus ? nextLineStep : () => bumpSpeed(-SPEED_STEP),
      fullscreen: toggleFullscreen,
      exit: exit,
      rtl,
    });
    return uninstall;
  });

  // ---- Count-in then scroll --------------------------------------------------
  let countInTimer: ReturnType<typeof setTimeout> | null = null;

  function beginPlay(): void {
    if (!song) return;
    beatTick = 0;
    const bars = $settings.countInBars ?? 0;
    if (bars > 0) {
      countingIn = true;
      playing = true; // metronome runs during count-in; scroll waits
      const beats = bars * Math.max(1, song.timeSig.beats);
      const ms = (60 / Math.max(1, song.bpm)) * 1000 * beats;
      clearCountIn();
      countInTimer = setTimeout(() => {
        countingIn = false;
        countInTimer = null;
        if (playing) {
          scrollStartedAt = performance.now();
          scroller?.play();
        }
      }, ms);
    } else {
      countingIn = false;
      playing = true;
      scrollStartedAt = performance.now();
      scroller?.play();
    }
  }

  function clearCountIn(): void {
    if (countInTimer) {
      clearTimeout(countInTimer);
      countInTimer = null;
    }
  }

  function togglePlay(): void {
    clearAdvance();
    if (playing) {
      playing = false;
      countingIn = false;
      clearCountIn();
      scroller?.pause();
    } else {
      // If parked at the bottom, restart from the top.
      if (scroller?.atEnd() && scrollEl) scrollEl.scrollTop = 0;
      beginPlay();
    }
  }

  // ---- Navigation ------------------------------------------------------------
  function go(delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= songs.length) return;
    transitionTo(target);
  }

  function transitionTo(target: number): void {
    playing = false;
    countingIn = false;
    clearCountIn();
    clearAdvance();
    scroller?.pause();
    if (scrollEl) scrollEl.scrollTop = 0;
    session.update((s) => ({ ...s, perfIndex: target }));
  }

  function clearAdvance(): void {
    if (advanceTimer) {
      clearTimeout(advanceTimer);
      advanceTimer = null;
    }
  }

  function handleEnd(): void {
    // Continuous play is opt-in. When off, stop at the end of each song.
    if (!$settings.autoAdvance || index >= songs.length - 1) {
      playing = false;
      countingIn = false;
      return;
    }
    // Keep short songs on screen for a minimum readable dwell before advancing.
    const elapsed = performance.now() - scrollStartedAt;
    const wait = Math.max(ADVANCE_GAP_MS, MIN_DWELL_MS - elapsed);
    clearAdvance();
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      transitionTo(index + 1);
      // Brief beat, then resume playback on the new song.
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        beginPlay();
      }, 500);
    }, wait);
  }

  // ---- Speed -----------------------------------------------------------------
  function setSpeed(n: number): void {
    speed = Math.min(SPEED_MAX, Math.max(SPEED_MIN, n));
    persistSpeed();
  }

  function bumpSpeed(delta: number): void {
    setSpeed(speed + delta);
  }

  function persistSpeed(): void {
    if (!song) return;
    const id = song.id;
    const value = speed;
    if (speedSaveTimer) clearTimeout(speedSaveTimer);
    speedSaveTimer = setTimeout(() => {
      speedSaveTimer = null;
      updateSong(id, (s) => {
        s.scrollSpeed = value;
      });
    }, 400);
  }

  // ---- Font sizing (scales the song theme sizes) -----------------------------
  function bumpFont(delta: number): void {
    if (!song || !theme) return;
    const id = song.id;
    const baseLyric = theme.lyricSize;
    const nextLyric = Math.min(FONT_MAX, Math.max(FONT_MIN, baseLyric + delta));
    if (nextLyric === baseLyric) return;
    const ratio = nextLyric / baseLyric;
    const nextChord = Math.round(Math.min(FONT_MAX, Math.max(FONT_MIN, theme.chordSize * ratio)));
    const nextNote = Math.round(Math.min(FONT_MAX, Math.max(FONT_MIN, theme.noteSize * ratio)));
    updateSong(id, (s) => {
      s.theme = {
        ...(s.theme ?? {}),
        lyricSize: nextLyric,
        chordSize: nextChord,
        noteSize: nextNote,
      };
    });
  }

  // ---- Fullscreen ------------------------------------------------------------
  function toggleFullscreen(): void {
    const doc = document;
    if (doc.fullscreenElement) {
      doc.exitFullscreen?.();
    } else {
      doc.documentElement.requestFullscreen?.();
    }
  }

  // ---- Exit ------------------------------------------------------------------
  function exit(): void {
    playing = false;
    countingIn = false;
    clearCountIn();
    clearAdvance();
    scroller?.pause();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    goLibrary();
  }

  // Metronome runs while playing (incl. count-in).
  const metroRunning = $derived(playing);
</script>

{#if song && theme}
  <div
    class="stage"
    style="--stage-bg: {theme.bg}; --stage-ink: {theme.text}; --stage-note: {theme.note};"
  >
    <div class="metro-wrap" aria-hidden={!metroRunning}>
      <Metronome
        bpm={song.bpm}
        timeSig={song.timeSig}
        running={metroRunning}
        click={$settings.clickEnabled}
        countInBars={$settings.countInBars}
        onBeat={handleBeat}
      />
    </div>

    {#if countingIn}
      <div class="countin" role="status">ספירה לתוך…</div>
    {/if}

    {#if lineView && focusTheme}
      <!-- 2-line focus: big active line + dimmed preview; tap/Space advances. -->
      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
      <div class="focus" {dir} onclick={nextLineStep} role="presentation">
        {#if activeLine}
          <div class="focus-line active">
            <SongLine
              line={activeLine}
              theme={focusTheme}
              transpose={song.transpose ?? 0}
              accidental={$settings.accidentalPref}
              dir={song.dir}
            />
          </div>
        {/if}
        {#if nextLine}
          <div class="focus-line preview" aria-hidden="true">
            <SongLine
              line={nextLine}
              theme={focusTheme}
              transpose={song.transpose ?? 0}
              accidental={$settings.accidentalPref}
              dir={song.dir}
            />
          </div>
        {/if}
        <div class="focus-pos tnum" aria-hidden="true">{lineIndex + 1}/{lineCount}</div>
      </div>
    {:else}
      <div class="scroll" bind:this={scrollEl}>
        <div class="content" {dir}>
          {#each song.lines as line (line.id)}
            <SongLine
              {line}
              {theme}
              transpose={song.transpose ?? 0}
              accidental={$settings.accidentalPref}
              dir={song.dir}
            />
          {/each}
          <div class="tail" aria-hidden="true"></div>
        </div>
      </div>
    {/if}

    <ScrollControls
      {playing}
      {speed}
      onToggle={togglePlay}
      onSpeed={setSpeed}
      onNext={() => go(1)}
      onPrev={() => go(-1)}
      onExit={exit}
      songIndex={index}
      songCount={songCount}
      songTitle={song.title}
      autoAdvance={$settings.autoAdvance}
      onToggleAutoAdvance={() =>
        updateSettings((s) => {
          s.autoAdvance = !s.autoAdvance;
        })}
      {lineView}
      onToggleLineView={() =>
        updateSettings((s) => {
          s.lineView = !s.lineView;
        })}
      lineIndex={lineIndex}
      lineCount={lineCount}
      lineBars={$settings.lineBars}
      onLineBars={(n) =>
        updateSettings((s) => {
          s.lineBars = n;
        })}
    />
  </div>
{:else}
  <div class="empty">
    <p>אין שירים בסט.</p>
    <button class="back" onclick={goLibrary}>חזרה לספרייה</button>
  </div>
{/if}

<style>
  .stage {
    position: fixed;
    inset: 0;
    background: var(--stage-bg);
    color: var(--stage-ink);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .metro-wrap {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--sp-5) var(--sp-5) var(--sp-3);
    flex: none;
  }

  .countin {
    position: absolute;
    inset-inline: 0;
    top: 50%;
    transform: translateY(-50%);
    text-align: center;
    font-size: clamp(28px, 6vw, 56px);
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--stage-ink);
    opacity: 0.85;
    pointer-events: none;
    z-index: var(--z-dropdown);
  }

  .scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    min-height: 0;
    /* Smooth-but-functional; the rAF engine handles motion. Hide scrollbar. */
    scrollbar-width: none;
  }
  .scroll::-webkit-scrollbar {
    display: none;
  }

  .content {
    width: min(1100px, 92vw);
    margin-inline: auto;
    padding-block: clamp(24px, 8vh, 80px) 0;
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 1.6vh, 20px);
    text-align: start;
  }

  /* Trailing space so the last line can scroll clear of the transport bar. */
  .tail {
    flex: none;
    height: 50vh;
    min-height: 200px;
  }

  /* ---- 2-line focus mode ---- */
  .focus {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(20px, 6vh, 64px);
    padding: clamp(24px, 6vh, 80px) clamp(20px, 5vw, 72px) 12vh;
    cursor: pointer;
    position: relative;
    text-align: center;
    user-select: none;
  }
  .focus-line {
    width: min(1200px, 94vw);
    display: flex;
    justify-content: center;
  }
  .focus-line.active {
    color: var(--stage-ink);
  }
  /* Upcoming line: dimmed and a touch smaller so the eye knows what's current. */
  .focus-line.preview {
    opacity: 0.4;
    transform: scale(0.82);
    transform-origin: center;
  }
  .focus-pos {
    position: absolute;
    bottom: clamp(12px, 3vh, 28px);
    inset-inline-end: clamp(16px, 4vw, 40px);
    font-size: var(--text-sm);
    color: var(--stage-ink);
    opacity: 0.4;
  }
  @media (prefers-reduced-motion: reduce) {
    .focus-line.preview {
      transform: none;
    }
  }

  .empty {
    position: fixed;
    inset: 0;
    display: grid;
    place-content: center;
    gap: var(--sp-5);
    text-align: center;
    background: var(--bg);
    color: var(--ink);
  }
  .empty p {
    margin: 0;
    font-size: var(--text-md);
    color: var(--ink-2);
  }
  .back {
    justify-self: center;
    height: 44px;
    padding-inline: var(--sp-6);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface-2);
    color: var(--ink);
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }
  .back:hover {
    background: var(--surface-3);
    border-color: var(--border-2);
  }
  .back:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  /* Landscape on short viewports: tighten the top chrome to maximize lyrics. */
  @media (orientation: landscape) and (max-height: 560px) {
    .metro-wrap {
      padding: var(--sp-3) var(--sp-4) var(--sp-2);
    }
    .content {
      padding-block-start: clamp(12px, 4vh, 32px);
    }
  }
</style>
