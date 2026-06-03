<script lang="ts">
  /**
   * Pure line renderer — used by BOTH the lyrics editor (editable) and the
   * performance stage (static). Renders a per-line stack: a chord row above the
   * lyric row, with notes drawn as highlighted text runs carrying a label.
   *
   * Layout uses inline-flex column "cells" (chord stacked over its lyric text),
   * so everything reflows naturally at any font size and in RTL or LTR. No
   * absolute pixel positioning.
   */
  import type { Line, SongTheme, Direction, Note } from '$lib/model';
  import type { SelectionRange } from '$stores/app';
  import { lineText } from '$lib/model';
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

  let {
    line,
    theme,
    transpose,
    accidental,
    dir,
    editable = false,
    onselect,
    onchordclick,
  }: Props = $props();

  /**
   * A "cell" is the atomic render unit: a run of text that shares a uniform
   * note state, optionally carrying a chord at its start. We split the line's
   * segments at note boundaries so each cell is wholly inside or outside any
   * note. The chord stays attached to the cell that begins its segment.
   */
  interface Cell {
    /** absolute char offset of this cell's start in the concatenated line text */
    offset: number;
    text: string;
    chord?: import('$lib/model').Chord;
    /** index of the owning segment (for onchordclick) */
    segmentIndex: number;
    /** the note covering this cell, if any */
    note?: Note;
  }

  const full = $derived(lineText(line));

  /**
   * Resolve the writing direction of a text run from its first strong character.
   * Used per-cell so a chord anchors to the LOGICAL start of its word — the right
   * edge for Hebrew, the left edge for Latin/numbers — even when an LTR word sits
   * inside an RTL line (and vice-versa). The chord symbol itself (always Latin)
   * must NOT influence this, so we detect from the lyric text only.
   */
  function strongDir(text: string, fallback: 'ltr' | 'rtl'): 'ltr' | 'rtl' {
    for (const ch of text) {
      const c = ch.codePointAt(0)!;
      // Hebrew, Arabic and related RTL blocks.
      if ((c >= 0x0590 && c <= 0x08ff) || (c >= 0xfb1d && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff))
        return 'rtl';
      // Latin (basic + extended) → LTR.
      if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0x00c0 && c <= 0x024f))
        return 'ltr';
    }
    return fallback;
  }

  const baseDir = $derived<'ltr' | 'rtl'>(
    dir === 'ltr' ? 'ltr' : dir === 'rtl' ? 'rtl' : strongDir(full, 'rtl'),
  );

  /** Collect every boundary where a cell must break: segment edges + note edges. */
  const cells = $derived.by((): Cell[] => {
    const segs = line.segments;
    const notes = line.notes ?? [];

    // Boundaries within the text where a split must occur.
    const bounds = new Set<number>([0, full.length]);
    let acc = 0;
    for (const seg of segs) {
      bounds.add(acc);
      acc += seg.text.length;
      bounds.add(acc);
    }
    for (const n of notes) {
      if (n.start >= 0 && n.start <= full.length) bounds.add(n.start);
      if (n.end >= 0 && n.end <= full.length) bounds.add(n.end);
    }
    const sorted = [...bounds].filter((b) => b >= 0 && b <= full.length).sort((a, b) => a - b);

    // Per-segment metadata indexed by char range.
    const segRanges: { start: number; end: number; index: number; chord?: Cell['chord'] }[] = [];
    let s = 0;
    segs.forEach((seg, i) => {
      segRanges.push({ start: s, end: s + seg.text.length, index: i, chord: seg.chord });
      s += seg.text.length;
    });

    const findSeg = (pos: number) =>
      segRanges.find((r) => pos >= r.start && pos < r.end) ?? segRanges[segRanges.length - 1];
    const findNote = (start: number, end: number) =>
      notes.find((n) => n.start <= start && n.end >= end && n.end > n.start);

    const out: Cell[] = [];
    for (let k = 0; k < sorted.length - 1; k++) {
      const start = sorted[k];
      const end = sorted[k + 1];
      if (end <= start) continue;
      const owner = findSeg(start);
      // A chord belongs to a cell only when the cell starts exactly at the
      // segment start (chords pin to a segment's first character).
      const chord = owner && owner.start === start ? owner.chord : undefined;
      out.push({
        offset: start,
        text: full.slice(start, end),
        chord,
        segmentIndex: owner ? owner.index : 0,
        note: findNote(start, end),
      });
    }

    // Empty line: still render a single empty cell so chords/clicks have a home.
    if (out.length === 0) {
      const owner = segRanges[0];
      out.push({
        offset: 0,
        text: '',
        chord: owner?.chord,
        segmentIndex: 0,
      });
    }
    return out;
  });

  /** Note labels that begin at each cell offset (rendered above the run start). */
  function noteStartingAt(offset: number): Note | undefined {
    return (line.notes ?? []).find((n) => n.start === offset && n.end > n.start);
  }

  function handleChordClick(cell: Cell) {
    if (!editable || !cell.chord) return;
    onchordclick?.(cell.segmentIndex);
  }

  /** Map a click/selection inside the rendered text back to a char range. */
  function reportSelection() {
    if (!editable || !onselect) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    if (!rootEl) return;
    const range = sel.getRangeAt(0);
    if (!rootEl.contains(range.startContainer) || !rootEl.contains(range.endContainer)) return;

    const a = offsetOf(range.startContainer, range.startOffset);
    const b = offsetOf(range.endContainer, range.endOffset);
    if (a == null || b == null) return;
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (end > start) onselect({ lineId: line.id, start, end });
  }

  let rootEl: HTMLDivElement | undefined = $state();

  // In editable mode, listen for selection-end at the document level (scoped to
  // this line's root). Avoids putting interaction handlers on a static element.
  $effect(() => {
    if (!editable || !rootEl) return;
    const handler = () => reportSelection();
    document.addEventListener('mouseup', handler);
    document.addEventListener('touchend', handler);
    return () => {
      document.removeEventListener('mouseup', handler);
      document.removeEventListener('touchend', handler);
    };
  });

  /** Resolve a DOM (node, offset) into an absolute char offset in `full`. */
  function offsetOf(node: Node, nodeOffset: number): number | null {
    // Walk up to the nearest element carrying data-offset (a lyric run).
    let el: Node | null = node;
    if (el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    while (el && el !== rootEl) {
      const ds = (el as HTMLElement).dataset;
      if (ds && ds.offset != null) {
        return Number(ds.offset) + nodeOffset;
      }
      el = el.parentElement;
    }
    return null;
  }
</script>

<div
  class="line"
  class:editable
  bind:this={rootEl}
  dir={baseDir}
  style="--lyric:{theme.lyricSize}px; --chord:{theme.chordSize}px; --noteSize:{theme.noteSize}px; --note-color:{theme.note};"
>
  {#each cells as cell, i (i)}
    {@const startNote = noteStartingAt(cell.offset)}
    <span class="cell" dir={strongDir(cell.text, baseDir)}>
      <span class="top" aria-hidden={!cell.chord && !startNote}>
        {#if startNote}
          <span class="note-label" style="color:{theme.note}; font-size:var(--noteSize);"
            >{startNote.label}</span
          >
        {/if}
        {#if cell.chord}
          {#if editable}
            <button
              type="button"
              class="chord chord-btn"
              dir="ltr"
              style="color:{theme.chord}; font-size:var(--chord);"
              onclick={() => handleChordClick(cell)}
              title="לחץ להסרת אקורד"
            >
              {formatChord(cell.chord, { semitones: transpose, acc: accidental })}
            </button>
          {:else}
            <span class="chord" dir="ltr" style="color:{theme.chord}; font-size:var(--chord);">
              {formatChord(cell.chord, { semitones: transpose, acc: accidental })}
            </span>
          {/if}
        {/if}
      </span>
      <span
        class="lyric"
        class:noted={!!cell.note}
        data-offset={cell.offset}
        style="
          color:{theme.text};
          font-size:var(--lyric);
          {cell.note ? `background:${cell.note.highlight};` : ''}
        "
      >{cell.text}</span>
    </span>
  {/each}
</div>

<style>
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    text-align: start;
    line-height: 1.15;
  }
  .cell {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .top {
    /* Reserve the chord/note row height even when empty so lyric baselines align. */
    display: inline-flex;
    align-items: flex-end;
    gap: var(--sp-2);
    min-height: calc(var(--chord) * 1.2);
    line-height: 1.1;
    white-space: nowrap;
  }
  .top[aria-hidden='true'] {
    min-height: calc(var(--chord) * 1.2);
  }
  .chord {
    font-weight: 600;
    font-family: var(--font-mono);
    line-height: 1.1;
    letter-spacing: -0.01em;
    /* Chord symbols are always Latin (C#, Bbm7/D); isolate them as an LTR run so
       the accidental stays to the RIGHT of the letter even inside an RTL line. */
    unicode-bidi: isolate;
  }
  .chord-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    padding: 0 var(--sp-1);
    margin-inline: -2px;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out);
  }
  .chord-btn:hover {
    background: var(--accent-soft);
    border-color: var(--border-2);
  }
  .chord-btn:active {
    background: color-mix(in oklch, var(--accent) 24%, transparent);
  }
  .chord-btn:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  .note-label {
    font-weight: 600;
    line-height: 1.1;
    white-space: nowrap;
  }
  .lyric {
    white-space: pre-wrap;
    line-height: 1.15;
    border-radius: var(--r-sm);
  }
  .lyric.noted {
    /* Highlight background comes from the note color; keep text readable. */
    padding-inline: 1px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  /* In editable mode, let the user drag-select lyric text. */
  .editable .lyric {
    cursor: text;
  }
</style>
