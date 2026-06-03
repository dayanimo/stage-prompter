<script lang="ts">
  /**
   * Remote-control page (opened at #remote). Talks to the performance Stage over
   * the internal BroadcastChannel — no server, no cost. Shows the current song,
   * position and lyrics, and sends transport commands back. Any number of remote
   * windows can connect; every one can drive.
   */
  import { onMount } from 'svelte';
  import { createRemoteChannel, type RemoteState, type RemoteCommand } from '$lib/remote';

  let snap = $state<RemoteState | null>(null);
  let connected = $state(false);
  let channel: ReturnType<typeof createRemoteChannel> | null = null;

  function send(cmd: RemoteCommand) {
    channel?.send({ kind: 'cmd', cmd });
  }

  onMount(() => {
    const ch = createRemoteChannel();
    channel = ch;
    const off = ch.onMessage((m) => {
      if (m.kind === 'state') {
        snap = m.state;
        connected = true;
      }
    });
    // Ask the stage to announce itself, and keep nudging until it answers.
    ch.send({ kind: 'hello' });
    const hi = setInterval(() => {
      if (!connected) ch.send({ kind: 'hello' });
    }, 1000);
    return () => {
      clearInterval(hi);
      off();
      ch.close();
    };
  });

  const dir = $derived(snap?.dir ?? 'rtl');
</script>

<div class="remote" {dir}>
  <header class="head">
    <span class="dot" class:live={connected && (snap?.playing || snap?.countingIn)}></span>
    <div class="titles">
      <span class="title">{snap?.songTitle ?? 'שלט במה'}</span>
      {#if snap}
        <span class="pos tnum">שיר {snap.songIndex + 1}/{snap.songCount}</span>
      {/if}
    </div>
  </header>

  {#if !connected}
    <div class="hint">
      <p>ממתין לבמה…</p>
      <p class="sub">פתח את מצב הנגינה (▶) בחלון או טאב אחר באותו מחשב, ודף זה יתחבר אוטומטית.</p>
    </div>
  {:else}
    <!-- Lyrics mirror -->
    <div class="lyrics" aria-label="מילים">
      {#each snap?.lines ?? [] as line, i (i)}
        <p class="ln" class:active={i === snap?.lineIndex}>{line || '·'}</p>
      {/each}
    </div>
  {/if}

  <!-- Transport -->
  <div class="pad">
    <div class="row">
      <button class="key" onclick={() => send('prev')} aria-label="שיר קודם">⏮</button>
      <button class="key big" onclick={() => send('toggle')} aria-label="נגן / עצור">
        {snap?.playing ? '⏸' : '▶'}
      </button>
      <button class="key" onclick={() => send('next')} aria-label="שיר הבא">⏭</button>
    </div>

    {#if snap?.lineView}
      <div class="row">
        <button class="key wide" onclick={() => send('linePrev')} aria-label="שורה קודמת">↑ שורה</button>
        <button class="key wide" onclick={() => send('lineNext')} aria-label="שורה הבאה">שורה ↓</button>
      </div>
    {/if}

    <div class="row">
      <button class="key wide" onclick={() => send('speedDown')} aria-label="האט">– מהירות</button>
      <span class="readout tnum">{snap ? Math.round(snap.speed) : '—'}</span>
      <button class="key wide" onclick={() => send('speedUp')} aria-label="האץ">מהירות +</button>
    </div>

    <div class="row">
      <button class="key wide" onclick={() => send('fontDown')} aria-label="הקטן טקסט">A−</button>
      <button class="key wide" onclick={() => send('restart')} aria-label="התחל מחדש">↺ מהתחלה</button>
      <button class="key wide" onclick={() => send('fontUp')} aria-label="הגדל טקסט">A+</button>
    </div>
  </div>
</div>

<style>
  .remote {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--ink);
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    padding: var(--sp-4) var(--sp-5);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex: none;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: var(--r-full);
    background: var(--beat-idle, var(--border-2));
    flex: none;
  }
  .dot.live {
    background: var(--accent);
    box-shadow: 0 0 10px color-mix(in oklch, var(--accent) 75%, transparent);
  }
  .titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    font-size: var(--text-md);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pos {
    font-size: var(--text-sm);
    color: var(--ink-3);
  }
  .hint {
    flex: 1;
    display: grid;
    place-content: center;
    gap: var(--sp-3);
    text-align: center;
    padding: var(--sp-6);
  }
  .hint p {
    margin: 0;
    color: var(--ink-2);
    font-size: var(--text-md);
  }
  .hint .sub {
    color: var(--ink-3);
    font-size: var(--text-sm);
    line-height: 1.6;
    max-width: 40ch;
  }
  .lyrics {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-5);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .ln {
    margin: 0;
    font-size: var(--text-lg);
    line-height: 1.3;
    color: var(--ink-2);
    padding: var(--sp-1) var(--sp-3);
    border-radius: var(--r-sm);
  }
  .ln.active {
    color: var(--ink);
    background: var(--accent-soft);
    font-weight: 600;
  }
  .pad {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4) var(--sp-5) max(var(--sp-5), env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .key {
    flex: 1;
    height: 64px;
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface-2);
    color: var(--ink);
    font-size: var(--text-lg);
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
  }
  .key:active {
    background: var(--surface-3);
    transform: scale(0.97);
  }
  .key.big {
    flex: 1.4;
    background: var(--accent);
    color: var(--accent-ink);
    border-color: transparent;
    font-size: var(--text-xl, 28px);
  }
  .key.wide {
    font-size: var(--text-base);
  }
  .readout {
    flex: 0 0 auto;
    min-width: 3ch;
    text-align: center;
    font-size: var(--text-md);
    color: var(--ink-2);
  }
  .key:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
