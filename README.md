# Stage Prompter

An offline, local-first **lyrics & chords prompter** for live bands. Write songs (Hebrew or English),
pin chords above words, add solo cue notes, set tempo and a visual metronome, arrange set lists, then
perform full-screen with auto-scrolling. Runs entirely on your machine — **no internet needed**.

## Requirements

| To… | You need |
|---|---|
| **Use** the app in a browser | A modern browser (Chrome, Edge, Firefox, or Safari — recent version). Once loaded it works **fully offline**. |
| **Build / serve** it | **Node.js 18+** (20+ recommended) and **npm**. Internet is needed **once**, only to download dependencies. |

No backend, database server, or account is required. All data is stored locally in the browser.

## Run it

```bash
npm install        # downloads dependencies (one-time, needs internet)
npm run dev        # http://localhost:5173  (editing / development)
```

For a fully-offline production build (the service worker precaches everything):

```bash
npm run build
npm run preview    # serves the offline-ready build at the printed localhost URL
```

> Open it via **`http://localhost`**, not by double-clicking `index.html`. The offline service
> worker and local database (IndexedDB) only work over `http(s)`/localhost, not `file://`.

## Build & run on another computer

The app isn't a double-click installer — it's a local web app you serve. Two ways:

**A — Build once, copy, serve (lightest).** On any machine with Node.js:

```bash
npm install
npm run build      # produces the static dist/ folder
```

Copy the **`dist/`** folder to the other computer and serve it there (needs Node.js):

```bash
npx serve dist     # or:  npm run preview
```

Then open the `http://localhost:…` URL it prints.

**B — Full project on the other computer.** Install Node.js, copy the whole project (or
`git clone` this repo), then:

```bash
npm install
npm run dev        # http://localhost:5173
```

Internet is only needed for `npm install`; after that it runs with no network.

## Moving your songs between computers

Songs and sets live in the **browser's local storage (IndexedDB)** on that machine — they don't
travel with the code. Use **ייצוא / ייבוא** (export / import) in the library to save all your data
to a `.json` file, copy it over, and import it on the other computer.

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
