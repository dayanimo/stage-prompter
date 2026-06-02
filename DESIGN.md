# Design

Visual system for **Stage Prompter**. Dark, pro-audio register (think rack gear / Ableton in a dark
venue). Calm, focused, reliable. The app chrome uses a fixed dark theme; the **performance content**
(background, lyrics, chords, notes) is user-configurable per song, shipped with stage-ready defaults.

All colors in OKLCH. Brand anchor hue: **200° mineral teal**.

## Color

### App chrome (fixed dark theme — tokens)

```css
:root {
  /* Surfaces — neutral charcoal, no decorative tint */
  --bg:        oklch(0.135 0 0);   /* app background */
  --surface:   oklch(0.175 0 0);   /* panels, toolbars, chord panel */
  --surface-2: oklch(0.215 0 0);   /* raised: popovers, selected rows */
  --border:    oklch(0.275 0 0);   /* hairlines */
  --border-2:  oklch(0.330 0 0);   /* stronger dividers */

  /* Ink — cool near-white, AA+ on --bg */
  --ink:       oklch(0.965 0.004 230);  /* primary text */
  --ink-2:     oklch(0.780 0.006 230);  /* secondary text (>=4.5:1 on surfaces) */
  --ink-3:     oklch(0.640 0.008 230);  /* tertiary/labels (large/again >=3:1) */

  /* Brand — mineral teal: primary actions, selection, focus */
  --accent:        oklch(0.720 0.118 200);
  --accent-hover:  oklch(0.770 0.122 200);
  --accent-press:  oklch(0.670 0.115 200);
  --accent-ink:    oklch(0.180 0.020 200); /* text on accent fills */
  --focus-ring:    oklch(0.800 0.120 200);

  /* Semantic states */
  --danger:   oklch(0.640 0.205 25);
  --warning:  oklch(0.800 0.140 75);
  --success:  oklch(0.720 0.150 150);
  --info:     oklch(0.700 0.130 250);

  /* Metronome lights */
  --beat-down: oklch(0.640 0.220 25);   /* RED  — beat 1 (downbeat) */
  --beat-off:  oklch(0.680 0.150 250);  /* BLUE — other beats */
  --beat-idle: oklch(0.300 0.010 250);  /* unlit */
}
```

### Performance content (user-configurable; stage-ready defaults)

```css
:root {
  --perf-bg:     oklch(0.080 0 0);          /* near-black, protects night vision */
  --perf-lyric:  oklch(0.970 0 0);          /* off-white, max legibility */
  --perf-chord:  oklch(0.800 0.130 75);     /* warm amber — pops, never competes w/ teal */
  --perf-note:   oklch(0.720 0.118 200);    /* teal note label + highlight base */
}
```

Defaults chosen for a dark stage: near-black field, bright lyrics, **warm amber chords** (high
contrast and distinct from the teal chrome), teal cue notes. Every value overridable per song via
color pickers.

Contrast: `--ink` on `--bg` ≈ 16:1; `--ink-2` on `--surface` ≥ 4.7:1; amber chord on perf-bg ≥ 9:1.
Color strategy: **Restrained** — neutral charcoal surfaces + a single teal accent for actions and
selection only. Color is never the sole signal.

## Typography

- **One family: Inter** (variable), system-ui fallback. Tabular numerals for BPM/time fields.
- Hebrew: **Heebo** (or Rubik) bundled locally for matching weight/rhythm in RTL. `font-synthesis: none`.
- **Mono: JetBrains Mono** only for chord-symbol rendering where alignment helps (optional).
- **Product scale (fixed rem, ratio ~1.2):** 12 / 13 / 15(base) / 18 / 22 / 28 px. No fluid clamp in
  chrome — users view at consistent DPI.
- **Performance text is the exception:** lyrics/chords/notes sizes are user-driven sliders (large,
  e.g. 24–120px), independent per element. Line length uncapped on stage (single-column, centered).
- Chrome body line length capped 65–75ch. Weight contrast carries hierarchy (400 / 500 / 600 / 700).

## Components

Single vocabulary, every interactive element ships all states (default / hover / focus / active /
disabled / loading / error / selected):

- **Buttons:** filled (accent, primary action), subtle (surface-2), ghost (text). Radius 8px. 36px
  base height; 44px for stage-touch targets.
- **Chord Panel:** two regions — top horizontal **root scroller** (snap, pill buttons, C…Cb), bottom
  **variations grid** (maj/min/7/m7/maj7/sus4/dim/aug/…), optional slash-bass selector. Selected root
  + variation use accent fill. Tactile, Ableton-like, dense but legible.
- **Color pickers / size sliders:** consistent surface-2 controls, live preview swatch.
- **Set list:** drag-reorderable rows, current song marked with accent left indicator via full
  selected-row background tint (not a side-stripe), search field, duplicate/remove.
- **Metronome:** a row of dots sized to the time signature; beat 1 = red and larger, off-beats =
  blue, unlit = idle gray. Position + brightness encode the downbeat, not hue alone.
- **Inputs/selects/toggles:** standard, 8px radius, accent focus ring (2px, `--focus-ring`).
- **Empty states** teach (e.g. "No songs yet — create your first to start a set"). **No spinners**;
  data is local and instant.

z-index scale: dropdown 10 → sticky 20 → modal-backdrop 30 → modal 40 → toast 50 → tooltip 60.

## Layout

- **App shell:** left rail (set list / song list), center editor or stage, right contextual panel
  (chord panel / theme / tempo in edit mode). Rail collapses at narrow widths (structural, not fluid).
- **Performance stage:** single centered column, chrome auto-hides, controls in a bottom bar that
  fades out and returns on pointer move / key. Portrait and landscape both first-class.
- Spacing scale (px): 2 4 8 12 16 24 32 48 64. Vary for rhythm; generous around stage content.
- Flexbox for 1D toolbars/rows; Grid for the variations panel and shell. Auto-fit grids where lists
  reflow.

## Motion

- 150–250ms, ease-out (quart/expo). Conveys state only: panel open, selection, beat pulse, scroll.
- **Metronome pulse** is the one expressive beat — a crisp light flash synced to Web Audio, no decay
  bounce. **Auto-scroll** is linear and smooth (rAF), speed user-set.
- Full `prefers-reduced-motion` path: instant panel transitions, metronome lights still toggle
  (functional), scroll remains but without easing flourishes.
- No page-load choreography. The app loads straight into the task.
