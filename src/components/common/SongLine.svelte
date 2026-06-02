<script lang="ts">
  // PLACEHOLDER — Track B replaces this. Pure line renderer (editor + stage).
  import type { Line, SongTheme, Direction } from '$lib/model';
  import type { SelectionRange } from '$stores/app';
  import { formatChord } from '$lib/chords';

  interface Props {
    line: Line;
    theme: Required<SongTheme>;
    transpose: number;
    accidental: 'sharps' | 'flats';
    dir: Direction;
    editable?: boolean;
    onselect?: (range: SelectionRange) => void;
    onchordclick?: (segmentIndex: number) => void;
  }
  let { line, theme, transpose, accidental, dir }: Props = $props();
</script>

<div class="line" dir={dir} style="--lyric: {theme.lyricSize}px; --chord: {theme.chordSize}px;">
  {#each line.segments as seg, i (i)}
    <span class="seg">
      {#if seg.chord}
        <span class="chord" style="color: {theme.chord}; font-size: var(--chord)"
          >{formatChord(seg.chord, { semitones: transpose, acc: accidental })}</span
        >
      {/if}
      <span class="lyric" style="color: {theme.text}; font-size: var(--lyric)">{seg.text}</span>
    </span>
  {/each}
</div>

<style>
  .line { display: flex; flex-wrap: wrap; align-items: flex-end; }
  .seg { display: inline-flex; flex-direction: column; }
  .chord { line-height: 1.1; font-weight: 600; }
  .lyric { white-space: pre-wrap; }
</style>
