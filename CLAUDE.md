# CLAUDE.md — Stage Prompter

Guidance for Claude Code working in this repo. Read this first.

## What this is

An **offline, local-first lyrics & chords prompter** for live bands. Hebrew (RTL) + English
(LTR). Two stages: **Edit** (write lyrics, place chords/notes, theme, tempo) and **Perform**
(full-screen auto-scroll or 2-line teleprompter, visual metronome). No backend, no accounts —
everything lives in the browser (IndexedDB) and works with the network off.

See `PLAN.md` (spec), `PRODUCT.md` (purpose/register), `DESIGN.md` (visual system),
`CONTRACTS.md` (internal module interfaces).

## Stack

Vite + **Svelte 5 (runes)** + TypeScript · IndexedDB via `idb` · Web Audio metronome ·
`vite-plugin-pwa` service worker (full offline) · no server.

## Run / verify

```bash
npm install
npm run dev        # http://localhost:5173 (editing)
npm run build      # runs svelte-check THEN vite build; must be 0 errors / 0 warnings
npm run preview    # serve the offline production build
npm run check      # svelte-check only
```

Always finish a change with `npm run check` (or `npm run build`) — the bar is **0 errors,
0 warnings**. `tsconfig` has `noUnusedLocals`/`noUnusedParameters`, so remove dead code.

## Architecture / where things live

```
src/
  app.css                 # design tokens (dark pro-audio, mineral-teal accent). NEVER hardcode colors.
  App.svelte              # router: library | edit | perform (session.view)
  lib/
    model.ts              # domain types + factories. SINGLE SOURCE OF TRUTH for data shapes.
    db.ts                 # IndexedDB CRUD (songs/sets/settings) + export/import snapshot
    chords.ts             # roots, variations, transpose, formatChord
    edits.ts              # PURE segment/note edit ops (applyChord/applyNote/splitAt/editLineText)
    metronome.ts          # Web Audio lookahead scheduler (onBeat callback)
    autoscroll.ts         # rAF scroll engine (play/pause/setSpeed/onEnd)
    shortcuts.ts          # perform-mode keyboard shortcuts
    samples.ts            # public-domain Hebrew sample songs (Adon Olam, Hava Nagila, ...)
  stores/app.ts           # Svelte stores + actions (songs/sets/settings/session). SHARED CONTRACT.
  components/
    LibraryView / EditView / PerformView   # the three view shells (integration layer)
    edit/   ChordPanel, LyricsEditor, NotePopover, ThemeControls, TempoControls
    common/ SongLine, ColorPicker, SizeSlider, SetListPanel, Button
    perf/   Stage, Metronome, ScrollControls
```

Edit a song only via `updateSong(id, s => { ...mutate draft... })` from `stores/app.ts` — it
clones, persists to IndexedDB, and refreshes the store. Don't write `db` directly from components.

## Conventions

- **Svelte 5 runes only:** `$state`, `$props`, `$derived`, `$effect`. Classic `svelte/store`
  for shared state, read as `$store` in components.
- **RTL + LTR everywhere.** Use logical CSS (`padding-inline`, `inset-inline`, `text-align: start`).
  Test Hebrew. The app's primary direction is RTL.
- **Use CSS tokens** from `app.css` (`var(--bg)`, `var(--accent)`, `var(--ink)`, `--sp-*`, `--r-*`,
  `--ease-out`, …). No hardcoded hex for chrome.
- **WCAG AA** contrast; visible focus rings; honor `@media (prefers-reduced-motion: reduce)`.
- Hebrew UI labels are the norm (match existing copy).

## Gotchas learned the hard way (don't regress these)

- **Bidi chord rendering (`SongLine.svelte`):** a line is split into flex "cells"; each cell sets
  its own `dir` from its lyric text (not the Latin chord symbol), and the line gets an *explicit*
  base `dir` (never `dir="auto"`, which breaks once cells carry direction). This is what keeps
  chords above the right letter for mixed Hebrew + Latin/numbers. Re-verify by measuring with a
  Range if you touch it.
- **Svelte reactivity short-circuit:** `scroller?.setSpeed(speed)` in an `$effect` *fails to track*
  `speed` when `scroller` is momentarily null (optional chain short-circuits before reading speed).
  Always read reactive deps **unconditionally** first: `const s = speed; scroller?.setSpeed(s)`.
- **Auto-scroll end:** `autoscroll.play()` fires `onEnd` (deferred) when there's nothing to scroll,
  so songs that fit the screen still auto-advance. Don't restore a silent early-return.
- **Per-song scroll speed** is saved on `song.scrollSpeed` and restored on song change; changing BPM
  scales it proportionally (tempo↔speed link) in `TempoControls.commitBpm`.
- **Metronome** needs a user gesture to resume its AudioContext; it forwards beats via an `onBeat`
  prop used for the count-in countdown and 2-line beat-paced advance.
- **Chord symbols are LTR:** a chord like `C#`/`Bbm7/D` must keep the accidental to the RIGHT
  of the letter even inside an RTL line. Rendered chords (`SongLine .chord`), the panel preview,
  root scroller, variation grid and bass row all carry `dir="ltr"` (+ `unicode-bidi: isolate` on
  `.chord`). Don't let an RTL container reorder them into `#C`.
- **Performance transport is LTR:** the prev·play·next block is forced `dir="ltr"` (standard
  media-player convention) so the glyphs read the same regardless of the app's RTL chrome — do
  NOT re-add the old `scaleX(-1)` chevron mirroring.
- **Undo/redo:** per-song snapshot stacks live in `stores/app.ts`; `updateSong` records by default.
  Performance-chrome writes (live scroll-speed persistence, in-stage font bumps) pass
  `{ record: false }` so they don't pollute the editor's undo history. `undoState` is the derived
  can-undo/can-redo flag. Editor binds Cmd/Ctrl+Z and Shift/Y.
- **Chord panel reset:** the panel is wrapped in `{#key selectionKey}` in EditView so moving the
  selection re-mounts it (seeded from any chord already at that spot), instead of carrying the last
  chord onto the next word. Typed entry (`parseChord` in chords.ts) lets you key in `C#m7/G`.
- **Scroll lead:** after count-in, the stage holds the scroll for `SCROLL_LEAD_BARS` (4) bars so the
  opening line doesn't slide off early. Lead timer is cleared on pause/transition/exit like the others.
- **Notes are also colour marks:** `Note.label` is optional and `Note.color` (text colour) was added
  alongside `highlight` (background, `''` = none). An empty-label note is a pure colouring of the run.
  `SongLine` renders the label only when non-empty and applies `color`/`highlight` to the lyric run.
- **Sections render everywhere:** `Line.section` is a free string (preset id like `chorus` → Hebrew via
  `sectionLabel()`, or any custom text). `SongLine` draws a `.section-badge` row above the line in BOTH
  editor preview and performance, styled by per-line `sectionColor`/`sectionBg`. The editor field is a
  `<input list="section-presets">` so users can pick a preset or type their own.
- **Line ops** (`edits.ts`): `addLineRelative` (above/below), `moveLine` (±1), `duplicateLine` (deep
  clone incl. chords/notes/section). All run inside `updateSong`, so they're undoable.

## Data & offline

All data is local (IndexedDB, origin-scoped). It does NOT travel with the code. Move songs between
machines with **ייצוא / ייבוא** (export/import JSON) in the library. Served over http(s)/localhost
only (service worker + IndexedDB don't work from `file://`).

## Copyright

Sample songs are **public domain** (traditional/liturgical). Do not commit copyrighted song
lyrics/charts into the repo; users add those themselves via the editor or import.
