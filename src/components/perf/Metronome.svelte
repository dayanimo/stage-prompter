<script lang="ts">
  // PLACEHOLDER — Track D replaces this.
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
  let { bpm, timeSig, running, click, compact = false }: Props = $props();

  let active = $state(-1);
  let handle: MetronomeHandle | null = null;

  $effect(() => {
    handle?.stop();
    if (running) {
      handle = createMetronome({ bpm, timeSig, click, onBeat: (i) => (active = i.beat) });
      handle.start();
    } else {
      active = -1;
    }
    return () => handle?.stop();
  });
</script>

<div class="metro" class:compact>
  {#each Array(timeSig.beats) as _, i (i)}
    <span class="light" class:on={active === i} class:down={i === 0} aria-hidden="true"></span>
  {/each}
</div>

<style>
  .metro { display: flex; gap: 8px; align-items: center; }
  .light { width: 16px; height: 16px; border-radius: var(--r-full); background: var(--beat-idle); transition: background var(--dur-fast) var(--ease-out); }
  .light.down { width: 20px; height: 20px; }
  .light.on { background: var(--beat-off); }
  .light.down.on { background: var(--beat-down); }
  .compact .light { width: 10px; height: 10px; }
  .compact .light.down { width: 13px; height: 13px; }
</style>
