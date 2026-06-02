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
- **RTL icons:** mirror skip-prev/next chevrons with `transform: scaleX(-1)` under `:dir(rtl)`;
  leave the play/pause glyph alone.

## Data & offline

All data is local (IndexedDB, origin-scoped). It does NOT travel with the code. Move songs between
machines with **ייצוא / ייבוא** (export/import JSON) in the library. Served over http(s)/localhost
only (service worker + IndexedDB don't work from `file://`).

## Copyright

Sample songs are **public domain** (traditional/liturgical). Do not commit copyrighted song
lyrics/charts into the repo; users add those themselves via the editor or import.
