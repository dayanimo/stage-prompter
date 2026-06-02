# Stage Prompter

An offline, local-first **lyrics & chords prompter** for live bands. Write songs (Hebrew or English),
pin chords above words, add solo cue notes, set tempo and a visual metronome, arrange set lists, then
perform full-screen with auto-scrolling. Runs entirely on your machine — **no internet needed**.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173  (editing)
```

For a fully-offline build (service worker precaches everything):

```bash
npm run build
npm run preview    # serves the offline-ready build
```

Your songs and sets live in the browser (IndexedDB) on that computer. Use **ייצוא / ייבוא**
(export / import) in the library to back up or move a set to another computer as a `.json` file.

## What's inside

- **Edit:** lyrics editor (RTL/LTR), Apple-Chords-style chord panel (roots × variations + slash bass,
  transpose), solo/cue notes with colored highlights, per-song theme (4 colors) and three independent
  font sizes, time signature + BPM with tap-tempo.
- **Perform:** full-screen portrait/landscape stage, auto-scroll with speed control and auto-advance
  between songs, visual metronome (red downbeat / blue off-beats) with optional click and count-in,
  keyboard shortcuts (Space play/pause, ←/→ prev/next, ↑/↓ speed, +/- font, F fullscreen, Esc exit).

## Stack

Vite + Svelte 5 + TypeScript · IndexedDB (`idb`) · Web Audio metronome · PWA service worker
(`vite-plugin-pwa`) · no backend, no accounts.

See [PLAN.md](PLAN.md) for the full spec, [DESIGN.md](DESIGN.md) for the visual system, and
[CONTRACTS.md](CONTRACTS.md) for the internal module interfaces.
