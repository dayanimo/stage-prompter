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
  import {
    resolveTheme,
    resolveSectionStyle,
    lineText,
    type Song,
    type Line,
    type SongTheme,
  } from '$lib/model';
  import SongLine from '$components/common/SongLine.svelte';
  import TabView from '$components/common/TabView.svelte';
  import NotationView from '$components/common/NotationView.svelte';
  import Metronome from '$components/perf/Metronome.svelte';
  import ScrollControls from '$components/perf/ScrollControls.svelte';
  import { createAutoScroller, type AutoScroller } from '$lib/autoscroll';
  import { installShortcuts } from '$lib/shortcuts';
  import type { BeatInfo } from '$lib/metronome';
  import {
    createRemoteChannel,
    type RemoteChannel,
    type RemoteCommand,
    type RemoteMessage,
  } from '$lib/remote';
  import { createStagePeer, type StagePeer } from '$lib/peer';
  import RemotePairing from '$components/perf/RemotePairing.svelte';
  import { untrack, onMount } from 'svelte';

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

  // Bars to keep the song still after it starts (past any count-in) before the
  // auto-scroll begins, so the opening line doesn't slide off too early.
  const SCROLL_LEAD_BARS = 4;

  let playing = $state(false);
  let speed = $state(DEFAULT_SPEED);
  let countingIn = $state(false);
  let scrollStartedAt = 0;
  let advanceTimer: ReturnType<typeof setTimeout> | null = null;
  let leadTimer: ReturnType<typeof setTimeout> | null = null;

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

  // Count-in display: the big number currently shown (beats remaining), and a
  // tick that re-keys the entrance animation on every count-in beat.
  let countInNum = $state(0);
  let countInTick = $state(0);
  let countInDown = $state(false);

  // Called on every metronome beat. Drives the count-in countdown (both modes)
  // and, in 2-line mode, advances one line every `lineBars` bars so the view
  // follows the song's tempo hands-free.
  function handleBeat(info: BeatInfo): void {
    if (info.countingIn) {
      const beats = Math.max(1, song?.timeSig.beats ?? 4);
      const total = Math.max(1, ($settings.countInBars ?? 0) * beats);
      const idx = info.bar * beats + info.beat; // 0-based position within the count-in
      countInNum = Math.max(1, total - idx); // beats remaining: e.g. 4,3,2,1
      countInDown = info.beat === 0; // accent the downbeat of each count-in bar
      countInTick += 1;
      return;
    }
    if (!lineView || !playing || lineBars <= 0) return;
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

  /** Wall-clock ms for a number of bars at the song's tempo. */
  function barsToMs(bars: number): number {
    if (!song) return 0;
    const beats = bars * Math.max(1, song.timeSig.beats);
    return (60 / Math.max(1, song.bpm)) * 1000 * beats;
  }

  function beginPlay(): void {
    if (!song) return;
    beatTick = 0;
    const bars = $settings.countInBars ?? 0;
    if (bars > 0) {
      countingIn = true;
      playing = true; // metronome runs during count-in; scroll waits
      clearCountIn();
      countInTimer = setTimeout(() => {
        countingIn = false;
        countInTimer = null;
        if (playing) startScrollAfterLead();
      }, barsToMs(bars));
    } else {
      countingIn = false;
      playing = true;
      startScrollAfterLead();
    }
  }

  // Mark the song as "started" now (for dwell timing), then hold the scroll for
  // SCROLL_LEAD_BARS so the first line stays put before motion kicks in.
  function startScrollAfterLead(): void {
    scrollStartedAt = performance.now();
    clearLead();
    const leadMs = barsToMs(SCROLL_LEAD_BARS);
    if (leadMs <= 0) {
      scroller?.play();
      return;
    }
    leadTimer = setTimeout(() => {
      leadTimer = null;
      if (playing && !countingIn) scroller?.play();
    }, leadMs);
  }

  function clearLead(): void {
    if (leadTimer) {
      clearTimeout(leadTimer);
      leadTimer = null;
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
      clearLead();
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
    clearLead();
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
      updateSong(
        id,
        (s) => {
          s.scrollSpeed = value;
        },
        { record: false },
      );
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
    updateSong(
      id,
      (s) => {
        s.theme = {
          ...(s.theme ?? {}),
          lyricSize: nextLyric,
          chordSize: nextChord,
          noteSize: nextNote,
        };
      },
      { record: false },
    );
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
    clearLead();
    clearAdvance();
    scroller?.pause();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    goLibrary();
  }

  // Metronome runs while playing (incl. count-in).
  const metroRunning = $derived(playing);

  // ---- Internal remote control (BroadcastChannel; no server) -----------------
  function remoteRestart(): void {
    clearAdvance();
    clearLead();
    if (scrollEl) scrollEl.scrollTop = 0;
    lineIndex = 0;
    if (!playing) beginPlay();
  }

  function handleRemoteCommand(cmd: RemoteCommand): void {
    switch (cmd) {
      case 'toggle': togglePlay(); break;
      case 'next': go(1); break;
      case 'prev': go(-1); break;
      case 'speedUp': bumpSpeed(SPEED_STEP); break;
      case 'speedDown': bumpSpeed(-SPEED_STEP); break;
      case 'fontUp': bumpFont(FONT_STEP); break;
      case 'fontDown': bumpFont(-FONT_STEP); break;
      case 'restart': remoteRestart(); break;
      case 'lineNext': nextLineStep(); break;
      case 'linePrev': prevLineStep(); break;
    }
  }

  let remote: RemoteChannel | null = null;

  // Cross-device (phone over WiFi) host — created lazily when the user opens
  // pairing, so we never touch the network unless remote control is wanted.
  let stagePeer: StagePeer | null = null;
  let pairing = $state(false);
  let peerId = $state('');
  let peerReady = $state(false);
  let peerCount = $state(0);
  const remoteUrl = $derived(
    peerId ? `${location.origin}${location.pathname}#remote?p=${peerId}` : '',
  );

  function handleRemoteMessage(m: RemoteMessage): void {
    if (m.kind === 'cmd') handleRemoteCommand(m.cmd);
    else if (m.kind === 'hello') publishState();
  }

  function publishState(): void {
    if (!song) return;
    const msg = {
      kind: 'state' as const,
      state: {
        songTitle: song.title,
        songIndex: index,
        songCount: songCount,
        playing,
        countingIn,
        speed,
        lineView,
        lineIndex: lineView ? lineIndex : -1,
        lineCount,
        lines: song.lines.map((l) =>
          l.kind === 'tab' ? '🎸 טאבים' : l.kind === 'notation' ? '🎼 תווים' : lineText(l),
        ),
        dir: dir as 'rtl' | 'ltr',
        ts: 0,
      },
    };
    remote?.send(msg);
    stagePeer?.send(msg);
  }

  function ensureStagePeer(): void {
    if (stagePeer) return;
    const sp = createStagePeer();
    stagePeer = sp;
    sp.onMessage((m) => handleRemoteMessage(m));
    sp.onStatus((open, peers) => {
      peerReady = open;
      peerCount = peers;
      peerId = sp.id();
    });
  }

  function togglePairing(): void {
    pairing = !pairing;
    if (pairing) ensureStagePeer();
  }

  onMount(() => {
    const ch = createRemoteChannel();
    remote = ch;
    const off = ch.onMessage((m) => handleRemoteMessage(m));
    return () => {
      off();
      ch.close();
      remote = null;
    };
  });

  // Close the cross-device host when the stage unmounts.
  $effect(() => () => {
    stagePeer?.close();
    stagePeer = null;
  });

  // Re-publish whenever anything a remote mirrors changes.
  $effect(() => {
    // Touch the reactive deps so this re-runs on change.
    void [song?.id, index, songCount, playing, countingIn, speed, lineView, lineIndex, lineCount, dir, peerCount];
    publishState();
  });

  function openRemote(): void {
    const url = location.href.split('#')[0] + '#remote';
    window.open(url, 'sp-remote', 'width=420,height=760');
  }
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
      <div class="countin" role="status" aria-live="assertive" aria-label={`ספירה לאחור ${countInNum}`}>
        {#key countInTick}
          <span class="cd-ring" class:down={countInDown} aria-hidden="true"></span>
          <span class="cd-ring cd-ring-2" class:down={countInDown} aria-hidden="true"></span>
          <span class="cd-num" class:down={countInDown}>{countInNum}</span>
        {/key}
        <span class="cd-dots" aria-hidden="true">
          {#each Array(Math.max(1, song.timeSig.beats)) as _, i (i)}
            <span class="cd-dot" class:filled={i < song.timeSig.beats - countInNum + 1}></span>
          {/each}
        </span>
      </div>
    {/if}

    {#snippet lineAt(line: Line, lt: Required<SongTheme>)}
      {#if line.kind === 'tab' && line.tab}
        <div class="special-line">
          <TabView tab={line.tab} color={lt.chord} size={Math.round(lt.lyricSize * 0.5)} />
        </div>
      {:else if line.kind === 'notation' && line.notation}
        <div class="special-line">
          <NotationView notation={line.notation} color={lt.text} size={Math.round(lt.lyricSize * 0.3)} />
        </div>
      {:else}
        <SongLine
          {line}
          theme={lt}
          transpose={song?.transpose ?? 0}
          accidental={$settings.accidentalPref}
          dir={song?.dir ?? 'auto'}
          sectionStyle={song ? resolveSectionStyle(song, line) : undefined}
        />
      {/if}
    {/snippet}

    {#if lineView && focusTheme}
      <!-- 2-line focus: big active line + dimmed preview; tap/Space advances. -->
      <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
      <div class="focus" {dir} onclick={nextLineStep} role="presentation">
        {#if activeLine && focusTheme}
          <div class="focus-line active">
            {@render lineAt(activeLine, focusTheme)}
          </div>
        {/if}
        {#if nextLine && focusTheme}
          <div class="focus-line preview" aria-hidden="true">
            {@render lineAt(nextLine, focusTheme)}
          </div>
        {/if}
        <div class="focus-pos tnum" aria-hidden="true">{lineIndex + 1}/{lineCount}</div>
      </div>
    {:else}
      <div class="scroll" bind:this={scrollEl}>
        <div class="content" {dir}>
          {#each song.lines as line (line.id)}
            {#if line.kind === 'tab' && line.tab}
              <div class="special-line">
                <TabView tab={line.tab} color={theme.chord} size={Math.round(theme.lyricSize * 0.6)} />
              </div>
            {:else if line.kind === 'notation' && line.notation}
              <div class="special-line">
                <NotationView
                  notation={line.notation}
                  color={theme.text}
                  size={Math.round(theme.lyricSize * 0.34)}
                />
              </div>
            {:else}
              <SongLine
                {line}
                {theme}
                transpose={song.transpose ?? 0}
                accidental={$settings.accidentalPref}
                dir={song.dir}
                sectionStyle={resolveSectionStyle(song, line)}
              />
            {/if}
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
      onFontUp={() => bumpFont(FONT_STEP)}
      onFontDown={() => bumpFont(-FONT_STEP)}
      onRemote={togglePairing}
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

    {#if pairing}
      <RemotePairing
        url={remoteUrl}
        ready={peerReady}
        peers={peerCount}
        onOpenLocal={openRemote}
        onClose={() => (pairing = false)}
      />
    {/if}
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

  /* ---- Count-in countdown ---- */
  .countin {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: none;
    z-index: var(--z-dropdown);
  }
  /* Soft vignette so the number reads over any stage background. */
  .countin::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at center,
      color-mix(in oklch, var(--stage-bg) 78%, transparent) 0%,
      color-mix(in oklch, var(--stage-bg) 30%, transparent) 38%,
      transparent 60%
    );
  }
  .cd-num {
    grid-area: 1 / 1;
    position: relative;
    font-size: clamp(140px, 34vh, 380px);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    color: var(--accent);
    text-shadow: 0 0 60px color-mix(in oklch, var(--accent) 55%, transparent);
    animation: cd-pop 640ms var(--ease-out) both;
  }
  .cd-num.down {
    color: var(--beat-down);
    text-shadow: 0 0 70px color-mix(in oklch, var(--beat-down) 60%, transparent);
  }
  .cd-ring {
    grid-area: 1 / 1;
    align-self: center;
    justify-self: center;
    width: clamp(200px, 46vh, 520px);
    aspect-ratio: 1;
    border-radius: var(--r-full);
    border: 3px solid color-mix(in oklch, var(--accent) 70%, transparent);
    animation: cd-ring 660ms var(--ease-out) both;
  }
  .cd-ring.down {
    border-color: color-mix(in oklch, var(--beat-down) 75%, transparent);
  }
  .cd-ring-2 {
    animation-delay: 90ms;
    opacity: 0.6;
  }
  /* Progress dots: how far through the count-in bar we are. */
  .cd-dots {
    grid-area: 1 / 1;
    align-self: end;
    justify-self: center;
    display: flex;
    gap: var(--sp-3);
    margin-bottom: clamp(24px, 8vh, 90px);
  }
  .cd-dot {
    width: 12px;
    height: 12px;
    border-radius: var(--r-full);
    background: color-mix(in oklch, var(--stage-ink) 22%, transparent);
    transition: background var(--dur) var(--ease-out);
  }
  .cd-dot.filled {
    background: var(--accent);
    box-shadow: 0 0 12px color-mix(in oklch, var(--accent) 70%, transparent);
  }

  @keyframes cd-pop {
    0% {
      opacity: 0;
      transform: scale(1.55);
      filter: blur(14px);
    }
    45% {
      opacity: 1;
      transform: scale(1);
      filter: blur(0);
    }
    100% {
      opacity: 0.92;
      transform: scale(1);
      filter: blur(0);
    }
  }
  @keyframes cd-ring {
    0% {
      opacity: 0.55;
      transform: scale(0.42);
    }
    100% {
      opacity: 0;
      transform: scale(1.25);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cd-num,
    .cd-ring,
    .cd-ring-2 {
      animation: none;
    }
    .cd-num {
      opacity: 0.95;
    }
    .cd-ring,
    .cd-ring-2 {
      opacity: 0.25;
    }
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

  /* Tab / notation lines: let the block size to its content, scroll if wide. */
  .special-line {
    align-self: stretch;
    overflow-x: auto;
    padding-block: clamp(4px, 1vh, 12px);
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
