# Build Contracts — read before touching code

Frozen interfaces every parallel track builds against. **Do not change shared files**
(`src/lib/model.ts`, `src/lib/db.ts`, `src/stores/app.ts`, `src/lib/chords.ts`, `src/app.css`,
the three views, or other tracks' files). If you think a contract is wrong, stop and flag it — do
not unilaterally change it.

Stack: **Svelte 5 (runes: `$state`/`$props`/`$derived`/`$effect`) + TypeScript + Vite**. Stores are
classic `svelte/store` (`$store` auto-subscription in components). Aliases: `$lib`, `$stores`,
`$components`. Dark pro-audio theme; use CSS tokens from `app.css` (never hardcode colors). All
chrome text must hit WCAG AA. Honor `prefers-reduced-motion`.

## Shared API (already implemented)

- `$lib/model.ts` — types + `createSong/createLine/createSetList`, `uid`, `lineText(line)`,
  `resolveTheme(song, settings)`, `ROOTS`, `DEFAULT_THEME`, `DEFAULT_SETTINGS`.
- `$lib/chords.ts` — `VARIATIONS: VariationDef[]`, `ROOT_LIST`, `formatChord(chord,{semitones,acc})`,
  `transposeChord`, `transposeNote`, `spell`, `variationSuffix`.
- `$lib/db.ts` — persistence (used via stores; tracks normally don't call directly).
- `$stores/app.ts` — `songs`, `sets`, `settings`, `session`, derived `currentSong`, `currentSet`,
  `setSongs`; actions `addSong`, `updateSong(id, mutate)`, `deleteSong`, `duplicateSong`, `addSet`,
  `updateSet(id, mutate)`, `deleteSet`, `updateSettings(mutate)`, `openSong(id)`, `goLibrary()`,
  `startPerformance(setId, index)`, `setSelection(range|null)`. `SelectionRange = {lineId, start, end}`.

`updateSong(id, s => { ... })` is the canonical way to edit a song — mutate the draft in place; it
clones, persists, and refreshes the store.

## Track files & component prop contracts

### Track A — `src/components/edit/ChordPanel.svelte`

```ts
interface Props {
  value?: import('$lib/model').Chord | null; // currently-applied chord, if editing one
  accidental: 'sharps' | 'flats';
  onpick: (chord: import('$lib/model').Chord) => void;
  onremove?: () => void; // shown when value is set
}
```
Top: horizontal snap-scroll **root** picker (`ROOT_LIST`). Bottom: **variations** grid grouped by
`VariationDef.group`. Optional slash-bass selector. Selected root + variation use accent fill.

### Track B — lyrics editor & rendering

- `src/components/common/SongLine.svelte` — pure renderer used by editor AND stage:
```ts
interface Props {
  line: import('$lib/model').Line;
  theme: Required<import('$lib/model').SongTheme>;
  transpose: number;
  accidental: 'sharps' | 'flats';
  dir: import('$lib/model').Direction;
  editable?: boolean;             // editor mode shows affordances
  onselect?: (range: import('$stores/app').SelectionRange) => void;
  onchordclick?: (segmentIndex: number) => void;
}
```
Renders a two-row stack: chords (via `formatChord`) above their segment, lyric text below, notes as
colored highlights with a label above their range. Reflows at any font size (no pixel positioning).

- `src/components/edit/LyricsEditor.svelte` — `{ song: Song }`. Edit line text; manage selection via
  `setSelection`; apply chords/notes through `updateSong`. Add/remove/split lines, section tags.
- `src/components/edit/NotePopover.svelte` — internal; create/edit a `Note` (label + highlight color).

### Track C — theming & sizing

- `src/components/common/ColorPicker.svelte` — `{ value: string; label?: string; onchange: (c: string) => void }`.
- `src/components/common/SizeSlider.svelte` — `{ value: number; min: number; max: number; step?: number; label: string; onchange: (n: number) => void }`.
- `src/components/edit/ThemeControls.svelte` — `{ song: Song }`. Edits `song.theme` (bg/text/chord/note
  + lyric/chord/note sizes) via `updateSong`; "reset to defaults" pulls from `settings.defaultTheme`;
  a toggle to also save current as global default via `updateSettings`.

### Track D — metronome & tempo

- `src/lib/metronome.ts`:
```ts
export interface MetronomeHandle {
  start(): void; stop(): void;
  setTempo(bpm: number, timeSig: import('$lib/model').TimeSignature): void;
  setClick(on: boolean): void;
}
export function createMetronome(opts: {
  bpm: number;
  timeSig: import('$lib/model').TimeSignature;
  click?: boolean;
  countInBars?: number;
  onBeat: (info: { beat: number; bar: number; isDownbeat: boolean; countingIn: boolean }) => void;
}): MetronomeHandle;
```
Web Audio lookahead scheduler (25ms timer, ~100ms lookahead). Click = short synthesized blip,
accented on the downbeat.

- `src/components/perf/Metronome.svelte`:
```ts
interface Props {
  bpm: number;
  timeSig: import('$lib/model').TimeSignature;
  running: boolean;
  click: boolean;
  countInBars?: number;
  compact?: boolean; // small inline variant for the editor
}
```
A row of lights sized to `timeSig.beats`. Beat 1 = **red & larger** (`--beat-down`), others = **blue**
(`--beat-off`), unlit = `--beat-idle`. Drives audio via `createMetronome` when `running`.

- `src/components/edit/TempoControls.svelte` — `{ song: Song }`. Edit BPM (number + tap tempo),
  time signature (beats/unit), count-in (via `updateSettings`), click toggle; embeds a compact
  `Metronome` preview.

### Track E — set lists, storage UI, export/import

- `src/lib/exporter.ts`:
```ts
export function downloadSnapshot(): Promise<void>;       // exports all data as .json (uses db.exportSnapshot)
export function downloadSet(setId: string): Promise<void>; // one set + its songs
export function importFromFile(file: File, mode?: 'merge' | 'replace'): Promise<void>; // then loadAll()
```
- `src/components/common/SetListPanel.svelte` — `{}`. Lists sets; create/rename/delete; per set: add
  songs, drag-reorder (`svelte-dnd-action`), remove, duplicate; song search; "Perform" →
  `startPerformance(setId)`; export/import buttons.

### Track F — performance stage

- `src/lib/autoscroll.ts`:
```ts
export interface AutoScroller {
  play(): void; pause(): void; toggle(): void;
  setSpeed(px_per_sec: number): void;
  isPlaying(): boolean;
  atEnd(): boolean;
  destroy(): void;
}
export function createAutoScroller(el: HTMLElement, opts: {
  speed: number; onEnd?: () => void;
}): AutoScroller;
```
rAF-based, linear, `performance.now()` timing. `onEnd` fires when scrolled to the bottom.

- `src/lib/shortcuts.ts` — `export function installShortcuts(handlers): () => void;` mapping
  Space=toggle scroll, ArrowRight/Left=next/prev song (respecting RTL), +/-=font size, ArrowUp/Down=
  speed, F=fullscreen, Escape=exit. Returns an uninstaller.

- `src/components/perf/ScrollControls.svelte`:
```ts
interface Props {
  playing: boolean; speed: number;
  onToggle: () => void; onSpeed: (n: number) => void;
  onNext: () => void; onPrev: () => void; onExit: () => void;
  songIndex: number; songCount: number; songTitle: string;
}
```
Auto-hiding bottom bar (fades out after idle, returns on pointer move / key).

- `src/components/perf/Stage.svelte` — `{}`. Full-screen render of the active set's current song
  (`setSongs`, `session.perfIndex`): theme applied to a centered single column of `SongLine`s,
  `Metronome`, `autoscroll`, `ScrollControls`, `installShortcuts`. Auto-advance to next song on
  `onEnd`; portrait & landscape.

## Integration (owned by Phase 0 / Phase 2 — don't edit in tracks)

`src/App.svelte`, `src/components/LibraryView.svelte`, `EditView.svelte`, `PerformView.svelte`.
