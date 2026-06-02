# Product

## Register

product

## Users

Working musicians and band members during live performances and rehearsals. The primary user is a
band leader who builds and arranges songs ahead of a show; the secondary users are the players on
stage who read along during the performance. Context of use: a dark venue, a few meters from the
screen, hands busy with an instrument, no time to fuss, frequently **no internet**. Hebrew and
English speakers; lyrics may be right-to-left, left-to-right, or mixed.

## Product Purpose

A local, fully-offline lyrics-and-chords **prompter** for live shows. Two stages:
- **Edit** — write lyrics (Hebrew/English), pin chords above selected letters/words via an
  Apple-Chords-style panel, add solo/cue notes with colored highlights, set theme colors and three
  independent font sizes, set time signature + BPM, transpose/capo, and arrange songs into ordered
  set lists.
- **Perform** — full-screen, portrait or landscape, auto-scrolling lyrics with adjustable speed,
  a visual metronome (red downbeat, blue off-beats) with optional click, auto-advancing through the
  set in order.

Success looks like: a player glances up mid-song and instantly finds their place — the right word,
the right chord, the next cue — without the tool ever getting in the way, and the whole thing works
with the wifi off.

## Brand Personality

**Calm, focused, reliable.** The voice of dependable pro gear: a rack unit with one steady LED, not
a consumer gadget shouting for attention. Quiet confidence. The interface earns trust by being
predictable, legible, and instant. On stage it disappears into the task; in editing it feels precise
and unsurprising. Tone in copy: plain, direct, a touch utilitarian. No marketing gloss.

## Anti-references

- Bright, glary light-mode SaaS dashboards (blinding in a dark venue, killing night vision).
- Consumer-app playfulness: bouncy animations, oversized rounded cards, emoji, gradient confetti.
- Decorative motion or page-load choreography that makes a performer wait.
- Cramped, information-dense "power user" panels that require hunting during a show.
- Low-contrast muted-gray text "for elegance" — unreadable from a distance.

## Design Principles

1. **Legibility over everything.** On the performance stage, readability from a few meters in the
   dark is the product. Contrast, size, and spacing win every tradeoff against decoration.
2. **The tool disappears on stage.** Chrome recedes during performance; only lyrics, chords, notes,
   and the metronome are present. Controls are reachable but never in the way.
3. **Instant and offline-true.** Every action is immediate and works with no network. Data never
   leaves the machine. Nothing spins.
4. **Predictable, pro-gear consistency.** One component vocabulary everywhere. Same control behaves
   the same way in every panel. No invented affordances for standard tasks.
5. **The performer is hands-busy.** Big targets, strong keyboard shortcuts, glanceable state. Assume
   the user has one free hand and three seconds.

## Accessibility & Inclusion

- Target **WCAG 2.2 AA**. Performance-stage lyrics far exceed it (very large, very high contrast).
- Full **RTL + LTR** support, including mixed-direction lines; correct bidi for Hebrew + English.
- **Reduced-motion** honored everywhere; auto-scroll and metronome remain functional but un-fancy.
- Keyboard-operable throughout; visible focus rings; large hit targets for stage use.
- Color is never the only signal (metronome downbeat differs by position + brightness, not just hue,
  to remain usable for color-blind players).
