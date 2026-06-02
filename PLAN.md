# Stage Prompter — Plan & Spec

A live-performance **lyrics + chords prompter** for bands. Runs **locally and fully offline** on a
computer. Two stages: an **Edit** stage to build/arrange songs, and a **Performance** stage to play
the set live with auto-scroll and a visual metronome. Hebrew and English supported.

Status: **Design approved — ready to build.** Date: 2026-06-02.

---

## 1. Locked decisions

| Decision | Choice |
|---|---|
| Hosting | **None.** Runs locally, fully offline. No Cloudflare, no backend, no login. |
| Delivery | **Local web app** — Vite dev/preview server, started with one command. |
| Storage | **Local-first** (IndexedDB) + **Export/Import** sets as `.json`. |
| Scope | **Full feature set** in the first build. |
| Metronome | **Visual lights + optional audible click.** Runs in **edit and performance** modes. |
| Between songs | Auto-scroll **auto-advances** to the next song at the end; manual prev/next anytime. |
| Languages | Hebrew (RTL) + English (LTR), per-song direction, mixed lines supported. |

---

## 2. Tech stack

- **Vite + Svelte + TypeScript** — small, fast, great for a stateful editor; reflows cleanly.
- **`vite-plugin-pwa`** — service worker precaches the whole app → works offline after first load.
- **IndexedDB** via **`idb`** — songs, sets, and settings stored locally on the machine.
- **Web Audio API** — sample-accurate metronome scheduling (lookahead scheduler), click synthesis.
- No external runtime network calls. Fonts bundled locally (Hebrew + Latin).
- Tooling: Vitest (unit) + Playwright (a few smoke tests), ESLint + Prettier.

Run: `npm install` → `npm run dev` (edit) / `npm run build && npm run preview` (offline build).

---

## 3. Data model

```ts
type ChordVariation =
  | 'maj' | 'min' | '5' | '6' | 'm6' | '7' | 'maj7' | 'm7' | 'm7b5'
  | 'dim' | 'dim7' | 'aug' | 'sus2' | 'sus4' | '9' | 'm9' | 'maj9'
  | 'add9' | '7sus4' /* extensible */;

interface Chord {
  root: 'C'|'C#'|'Db'|'D'|'D#'|'Eb'|'E'|'F'|'F#'|'Gb'|'G'|'G#'|'Ab'|'A'|'A#'|'Bb'|'B'|'Cb';
  variation: ChordVariation;
  bass?: string; // optional slash chord, e.g. C/G
}

// A line is split into SEGMENTS. A chord pins to the START of a segment.
// Splitting at a selected letter/word creates a segment boundary there.
// This makes chords stay above the correct syllable at ANY font size / orientation
// (no pixel positioning, no drift).
interface Segment {
  text: string;
  chord?: Chord;
}

// A note is a character RANGE within a line: a highlight color + a label above.
interface Note {
  start: number;        // char index in the line's full text
  end: number;          // exclusive
  label: string;        // e.g. "Guitar solo"
  highlight: string;    // color for the highlighted text
}

interface Line {
  segments: Segment[];
  notes: Note[];
  section?: 'verse'|'chorus'|'bridge'|'intro'|'outro'|'solo'|string; // optional label
}

interface SongTheme {            // per-song overrides; falls back to global defaults
  bg?: string; text?: string; chord?: string; note?: string;
  lyricSize?: number; chordSize?: number; noteSize?: number;
}

interface Song {
  id: string;
  title: string;
  dir: 'rtl' | 'ltr' | 'auto';
  lines: Line[];
  timeSig: { beats: number; unit: number }; // 4/4, 3/4, 6/8...
  bpm: number;
  capo?: number;
  transpose?: number;            // semitones, applied to displayed chords
  theme?: SongTheme;
  scrollSpeed?: number;          // remembered per song
}

interface SetList { id: string; name: string; songIds: string[]; } // ordered

interface AppSettings {
  defaultTheme: Required<SongTheme>;
  accidentalPref: 'sharps' | 'flats';
  clickEnabled: boolean;
  countInBars: number;           // 0 = off
}
```

Export/Import = JSON of `{ songs, sets, settings, version }`.

---

## 4. Edit stage

- **Lyrics editor** — type/edit Hebrew or English; per-song direction (rtl/ltr/auto); paste plain text.
- **Place a chord** — select letter(s)/word(s) → open the **Chord Panel** → chord pins above the
  selection start (segment split). Re-selecting an existing chord lets you change or remove it.
- **Chord Panel** (Apple *Chords*-style, two regions):
  - **Top:** horizontal scroller of roots — `C C# Db D D# Eb E F F# Gb G G# Ab A A# Bb B Cb`.
  - **Bottom:** variations grid for the chosen root (maj, min, 7, m7, maj7, sus4, dim, aug, …).
  - Optional **slash bass** selector.
- **Notes / highlights** — select a range → write a note label (shown above the line) → pick a
  **highlight color** for that text. For solo reminders etc.
- **Theming** — color pickers for **background / text / chord / note**; independent **font-size**
  sliders for **lyrics / chords / notes**. Global defaults + per-song overrides.
- **Tempo & meter** — set **time signature** + **BPM**; **Tap Tempo**; live metronome preview.
- **Transpose / Capo** — shift displayed chords by semitones; show capo; sharps/flats preference.
- **Sections** — tag lines (Verse/Chorus/…) for quick navigation.
- **Undo/redo**; autosave to IndexedDB.

## 5. Set lists

- Create **multiple set lists**; add songs; **drag-reorder**; duplicate/remove; **search** songs.
- The performance order = the set list order.

## 6. Performance stage

- Full-screen render of the song: lyrics + chords (segment stack) + notes/highlights + theme.
- **Portrait or landscape** (responsive layout, orientation toggle).
- **Auto-scroll** with a **speed** slider + **stop/play**; per-song speed remembered.
- **Auto-advance** to the next song at end of scroll; **manual prev/next** anytime.
- **Visual metronome** — counts the time signature at BPM: **red light = beat 1 (downbeat)**,
  **blue = other beats**; optional **audible click**; optional **count-in** bar before scroll starts.
- **Keyboard shortcuts** — `Space` play/pause scroll, `←/→` prev/next song, `+/-` font size,
  `↑/↓` scroll speed, `F` fullscreen.

## 7. Offline & storage

- Service worker precaches app shell + assets → fully usable with no network.
- All data in IndexedDB; nothing leaves the machine.
- **Export** (all or one set) → `.json`; **Import** merges/replaces. This is the backup + transfer path.

---

## 8. Architecture / file layout

```
stage-prompter/
  index.html
  vite.config.ts            # + vite-plugin-pwa
  src/
    main.ts
    App.svelte              # router: edit | performance
    lib/
      db.ts                 # idb wrapper: songs/sets/settings CRUD
      model.ts              # types + factory/helpers
      chords.ts             # roots, variations, transpose, formatting
      metronome.ts          # Web Audio lookahead scheduler + click synth
      autoscroll.ts         # rAF scroll engine (speed/pause/advance)
      exporter.ts           # export/import JSON
      shortcuts.ts          # keyboard handling
    stores/                 # Svelte stores: songs, sets, settings, session
    components/
      edit/
        LyricsEditor.svelte
        ChordPanel.svelte   # roots scroller + variations grid
        NotePopover.svelte
        ThemeControls.svelte
        TempoControls.svelte # time sig, BPM, tap tempo
        SectionTag.svelte
      perf/
        Stage.svelte        # full-screen render + orientation
        Metronome.svelte    # red/blue lights
        ScrollControls.svelte
      common/
        ColorPicker.svelte
        SizeSlider.svelte
        SongLine.svelte      # renders segments(+chords) + notes/highlights
        SetListPanel.svelte
  tests/
```

---

## 9. Build orchestration (parallel agents + worktrees)

Built with `/impeccable:impeccable` for design quality. Work fans out across **parallel subagents in
isolated git worktrees** to avoid file conflicts, then merges.

**Phase 0 — Scaffold (serial, on main):** Vite+Svelte+TS, PWA plugin, ESLint/Prettier, base routing,
design tokens/theme system, the `model.ts` types + `db.ts` contract. Establishes the shared contracts
every parallel agent codes against.

**Phase 1 — Parallel feature tracks (worktree per track):**
1. **Chords engine + Chord Panel** — `chords.ts` (roots, variations, transpose) + `ChordPanel.svelte`.
2. **Lyrics editor + segment/notes model** — `LyricsEditor.svelte`, `SongLine.svelte`, `NotePopover`.
3. **Theming + font sizing** — `ThemeControls`, `ColorPicker`, `SizeSlider`, token wiring.
4. **Metronome + tempo** — `metronome.ts`, `Metronome.svelte`, `TempoControls` (tap tempo, count-in).
5. **Set lists + storage + export/import** — `db.ts`, `SetListPanel`, `exporter.ts`, search/reorder.
6. **Performance stage** — `Stage.svelte`, `autoscroll.ts`, orientation, shortcuts, auto-advance.

**Phase 2 — Integration (serial):** merge worktrees, wire edit↔performance, end-to-end pass.

**Phase 3 — Review & verify:** parallel review agents (correctness, a11y/RTL, offline). Adversarially
verify findings, fix. Smoke-test the offline build (`build` + `preview`, airplane mode).

---

## 10. Acceptance criteria

- Create a song with Hebrew + English lines; place chords by selecting letters/words; chords stay
  aligned when font size and orientation change.
- Add a note + colored highlight over a range; it renders above the line.
- Set bg/text/chord/note colors and three independent font sizes; per-song overrides persist.
- Set 4/4 and 3/4 at a BPM; metronome shows red on beat 1, blue otherwise; optional click works.
- Build a set list, reorder; performance mode plays in order; auto-scroll speed adjustable + stop;
  auto-advances between songs.
- Transpose changes displayed chords; sharps/flats preference respected.
- Reload with network off → app + data fully available (offline). Export → reimport restores a set.

## 11. Out of scope (v1)

Cloud sync / accounts, teleprompter mirror-flip, audio playback of backing tracks, MIDI, mobile app
packaging (Tauri/Electron), collaborative editing.
