<script lang="ts">
  /**
   * Lightweight SVG music staff. Renders a treble/bass staff and a left-to-right
   * sequence of notes positioned by diatonic `step` (0 = bottom line). Pure SVG,
   * no engraving library, so it stays small and works offline. When `onPick` /
   * `onNoteClick` are supplied it becomes an editor surface (click empty space to
   * add a note at that pitch; click a note to remove it).
   */
  import type { StaffNote } from '$lib/model';
  import { durMeta } from '$lib/notation';

  interface Props {
    notes: StaffNote[];
    clef?: 'treble' | 'bass';
    size?: number; // staff line gap in px
    color?: string;
    /** Beats per bar (song time signature numerator); 0 disables barlines. */
    beatsPerBar?: number;
    onPick?: (step: number) => void;
    onNoteClick?: (index: number) => void;
  }
  let {
    notes,
    clef = 'treble',
    size = 14,
    color = 'currentColor',
    beatsPerBar = 0,
    onPick,
    onNoteClick,
  }: Props = $props();

  const interactive = $derived(!!onPick);

  // Geometry. G = gap between staff lines; a diatonic step is G/2.
  const G = $derived(size);
  const PAD_TOP = $derived(G * 4); // room for ledger lines above
  const PAD_BOT = $derived(G * 4);
  const bottomLineY = $derived(PAD_TOP + 4 * G);
  const height = $derived(bottomLineY + PAD_BOT);
  const CLEF_X = $derived(G * 1.2);
  const START_X = $derived(G * 3.4);
  const NOTE_DX = $derived(G * 2.4);
  const BAR_GAP = $derived(G * 1.0);

  const stepY = (step: number) => bottomLineY - step * (G / 2);
  const staffLineY = $derived([0, 1, 2, 3, 4].map((i) => PAD_TOP + i * G));

  interface Rendered {
    x: number;
    y: number;
    filled: boolean;
    stemUp: boolean;
    stemX: number;
    stemY1: number;
    stemY2: number;
    flags: number;
    ledgers: number[];
    acc?: '#' | 'b' | null;
    index: number;
  }

  // Place notes left to right, inserting a barline + gap whenever the running
  // beat count fills a measure (per the song's time signature).
  const layout = $derived.by(() => {
    const beats = beatsPerBar && beatsPerBar > 0 ? beatsPerBar : 0;
    const items: Rendered[] = [];
    const barlines: number[] = [];
    let x = START_X;
    let cum = 0;
    notes.forEach((n, i) => {
      const y = stepY(n.step);
      const m = durMeta(n.dur);
      const stemUp = n.step <= 4;
      const stemX = x + (stemUp ? G * 0.58 : -G * 0.58);
      const stemLen = G * 3.3;
      const ledgers: number[] = [];
      if (n.step > 8) for (let e = 10; e <= n.step; e += 2) ledgers.push(stepY(e));
      if (n.step < 0) for (let e = -2; e >= n.step; e -= 2) ledgers.push(stepY(e));
      items.push({
        x,
        y,
        filled: m.filled,
        stemUp,
        stemX,
        stemY1: y,
        stemY2: stemUp ? y - stemLen : y + stemLen,
        flags: m.flags,
        ledgers,
        acc: n.acc,
        index: i,
      });
      x += NOTE_DX;
      cum += m.beats;
      if (beats > 0 && cum >= beats - 1e-6 && i < notes.length - 1) {
        barlines.push(x - NOTE_DX * 0.45);
        x += BAR_GAP;
        cum -= beats;
        if (cum < 1e-6) cum = 0;
      }
    });
    const width = Math.max(x + G, G * 10);
    return { items, barlines, width };
  });
  const width = $derived(layout.width);

  function onStaffClick(e: MouseEvent) {
    if (!onPick) return;
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const step = Math.round((bottomLineY - y) / (G / 2));
    onPick(Math.max(-6, Math.min(16, step)));
  }
</script>

<svg
  class="staff"
  class:interactive
  width={width}
  {height}
  viewBox={`0 0 ${width} ${height}`}
  style="color:{color}"
  role={interactive ? 'application' : 'img'}
  aria-label="חמשה"
  onclick={onStaffClick}
>
  <!-- staff lines -->
  {#each staffLineY as ly (ly)}
    <line x1="0" y1={ly} x2={width} y2={ly} stroke="currentColor" stroke-width="1" opacity="0.6" />
  {/each}

  <!-- clef -->
  <text x={CLEF_X} y={clef === 'treble' ? bottomLineY - G * 0.2 : PAD_TOP + G * 1.2} class="clef"
    style="font-size:{G * (clef === 'treble' ? 5.2 : 3.4)}px">{clef === 'treble' ? '𝄞' : '𝄢'}</text>

  <!-- barlines (per the song's time signature) -->
  {#each layout.barlines as bx (bx)}
    <line x1={bx} y1={staffLineY[0]} x2={bx} y2={staffLineY[4]} stroke="currentColor" stroke-width="1.3" opacity="0.85" />
  {/each}

  {#each layout.items as r (r.index)}
    <!-- ledger lines -->
    {#each r.ledgers as ly (ly)}
      <line x1={r.x - G * 0.95} y1={ly} x2={r.x + G * 0.95} y2={ly} stroke="currentColor" stroke-width="1.2" />
    {/each}

    <!-- stem -->
    <line x1={r.stemX} y1={r.stemY1} x2={r.stemX} y2={r.stemY2} stroke="currentColor" stroke-width="1.4" />

    <!-- flags -->
    {#each Array(r.flags) as _, fi (fi)}
      <path
        d={`M${r.stemX} ${r.stemY2 + (r.stemUp ? fi * G * 0.7 : -fi * G * 0.7)} q ${G * 1.1} ${r.stemUp ? G * 0.5 : -G * 0.5} ${G * 0.9} ${r.stemUp ? G * 1.5 : -G * 1.5}`}
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
      />
    {/each}

    <!-- accidental (snug to the left of its note head) -->
    {#if r.acc}
      <text x={r.x - G * 0.95} y={r.y + G * 0.32} class="acc" style="font-size:{G * 1.5}px"
        >{r.acc === '#' ? '♯' : '♭'}</text>
    {/if}

    <!-- note head -->
    <ellipse
      cx={r.x}
      cy={r.y}
      rx={G * 0.66}
      ry={G * 0.48}
      transform={`rotate(-20 ${r.x} ${r.y})`}
      fill={r.filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width={r.filled ? 0 : 1.6}
      class="head"
      class:clickable={!!onNoteClick}
      role={onNoteClick ? 'button' : undefined}
      onclick={(e) => {
        if (onNoteClick) {
          e.stopPropagation();
          onNoteClick(r.index);
        }
      }}
    />
  {/each}
</svg>

<style>
  .staff {
    display: block;
    max-width: 100%;
    overflow: visible;
  }
  .staff.interactive {
    cursor: copy;
  }
  .clef,
  .acc {
    fill: currentColor;
    font-family: serif;
    dominant-baseline: alphabetic;
  }
  .head.clickable {
    cursor: pointer;
  }
  .head.clickable:hover {
    fill: var(--danger, red);
    stroke: var(--danger, red);
  }
</style>
