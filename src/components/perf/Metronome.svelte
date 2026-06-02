<script lang="ts">
  import type { TimeSignature } from '$lib/model';
  import { createMetronome, type MetronomeHandle } from '$lib/metronome';

  interface Props {
    bpm: number;
    timeSig: TimeSignature;
    running: boolean;
    click: boolean;
    countInBars?: number;
    compact?: boolean;
  }

  let {
    bpm,
    timeSig,
    running,
    click,
    countInBars = 0,
    compact = false,
  }: Props = $props();

  // Index of the currently-lit beat within the bar (-1 = none lit).
  let active = $state(-1);
  // Whether the active beat is part of the count-in (purely informational chrome).
  let counting = $state(false);

  let handle: MetronomeHandle | null = null;

  const beatCount = $derived(Math.max(1, Math.min(16, timeSig.beats)));

  // (Re)build the scheduler whenever the engine inputs change.
  $effect(() => {
    // Read deps so Svelte tracks them.
    const isRunning = running;
    const b = bpm;
    const ts = timeSig;
    const ci = countInBars;
    const clk = click;

    handle?.stop();
    handle = null;

    if (!isRunning) {
      active = -1;
      counting = false;
      return;
    }

    const h = createMetronome({
      bpm: b,
      timeSig: ts,
      click: clk,
      countInBars: ci,
      onBeat: (info) => {
        active = info.beat;
        counting = info.countingIn;
      },
    });
    handle = h;
    h.start();

    return () => {
      h.stop();
      active = -1;
      counting = false;
    };
  });
</script>

<div
  class="metro"
  class:compact
  class:counting
  role="img"
  aria-label={`מטרונום ${timeSig.beats}/${timeSig.unit}, ${bpm} BPM`}
>
  {#each Array(beatCount) as _, i (i)}
    <span
      class="light"
      class:on={active === i}
      class:down={i === 0}
      aria-hidden="true"
    ></span>
  {/each}
</div>

<style>
  .metro {
    display: flex;
    gap: var(--sp-3);
    align-items: center;
  }

  .metro {
    gap: var(--sp-4);
  }

  .light {
    width: 28px;
    height: 28px;
    border-radius: var(--r-full);
    background: var(--beat-idle);
    /* Brightness/scale encode the downbeat in addition to hue (color-blind safe). */
    transition:
      background var(--dur-fast) var(--ease-out),
      box-shadow var(--dur-fast) var(--ease-out),
      transform var(--dur-fast) var(--ease-out);
  }

  /* Downbeat cell is always larger so position+size mark beat 1 even unlit. */
  .light.down {
    width: 38px;
    height: 38px;
  }

  /* Off-beats: blue when lit. */
  .light.on {
    background: var(--beat-off);
    box-shadow: 0 0 10px color-mix(in oklch, var(--beat-off) 70%, transparent);
    transform: scale(1.12);
  }

  /* Downbeat: red + brighter glow when lit. */
  .light.down.on {
    background: var(--beat-down);
    box-shadow: 0 0 16px color-mix(in oklch, var(--beat-down) 80%, transparent);
    transform: scale(1.12);
  }

  /* Count-in: subtle outline so performers know it's a lead-in, not the song. */
  .counting .light.on {
    outline: 2px solid color-mix(in oklch, var(--ink) 60%, transparent);
    outline-offset: 2px;
  }

  .compact {
    gap: var(--sp-2);
  }
  .compact .light {
    width: 10px;
    height: 10px;
  }
  .compact .light.down {
    width: 14px;
    height: 14px;
  }

  /* Reduced motion: lights still toggle (functional), no scale/glow flourish. */
  @media (prefers-reduced-motion: reduce) {
    .light {
      transition: background var(--dur-fast) linear;
    }
    .light.on,
    .light.down.on {
      transform: none;
      box-shadow: none;
    }
  }
</style>
