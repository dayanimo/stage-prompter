/**
 * Guitar-tab helpers: render the grid model to classic ASCII tablature and a few
 * pure column ops. Kept separate so both the editor and the performance view
 * (and the remote mirror) share one source of truth.
 */
import type { TabContent } from './model';

/** One column cell: '--' when empty, else the fret padded to 2 chars with a dash. */
function cell(fret: number | null): string {
  if (fret === null || fret === undefined) return '--';
  const s = String(fret);
  return s.length >= 2 ? s : '-' + s;
}

/** Render to one ASCII line per string (top→bottom), e.g. `e|-3---5--12-|`. */
export function tabToAscii(tab: TabContent): string[] {
  const n = tab.strings.length;
  return tab.strings.map((label, s) => {
    const body = tab.cols.map((col) => cell(col[s] ?? null)).join('-');
    return `${label}|-${body}-|`;
  }).slice(0, n);
}

/** A single multi-line string for plain-text contexts (remote mirror, export). */
export function tabToText(tab: TabContent): string {
  return tabToAscii(tab).join('\n');
}

/** Append `count` empty columns. Returns a new cols array. */
export function withAddedColumns(tab: TabContent, count = 4): (number | null)[][] {
  const extra = Array.from(
    { length: count },
    () => Array(tab.strings.length).fill(null) as (number | null)[],
  );
  return [...tab.cols, ...extra];
}
