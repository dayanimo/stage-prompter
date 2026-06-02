<script lang="ts">
  import { importSong, openSong } from '$stores/app';
  import { parseChart, songFromChart } from '$lib/importer';
  import { plural, NOUNS } from '$lib/i18n';
  import Button from '$components/common/Button.svelte';

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let title = $state('');
  let chart = $state('');
  let bpm = $state(100);
  let beats = $state(4);
  let busy = $state(false);

  // Live feedback so the user can see the parser found their chords.
  const stats = $derived.by(() => {
    if (!chart.trim()) return { lines: 0, chords: 0 };
    const { lines, chordCount } = parseChart(chart);
    const lyricLines = lines.filter((l) => l.segments.some((s) => s.text.trim())).length;
    return { lines: lyricLines, chords: chordCount };
  });

  async function doImport() {
    if (!chart.trim() || busy) return;
    busy = true;
    try {
      const song = songFromChart(title, chart, { bpm, beats });
      await importSong(song);
      onclose();
      openSong(song.id);
    } finally {
      busy = false;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div
  class="backdrop"
  role="button"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(e) => e.key === 'Enter' && onclose()}
></div>

<div class="dialog" role="dialog" aria-modal="true" aria-label="ייבוא שיר">
  <header>
    <h2>ייבוא שיר מטקסט</h2>
    <button class="x" onclick={onclose} aria-label="סגור">✕</button>
  </header>

  <div class="body">
    <label class="field">
      <span>שם השיר</span>
      <input type="text" bind:value={title} placeholder="לדוגמה: הבה נגילה" />
    </label>

    <div class="row">
      <label class="field small">
        <span>BPM</span>
        <input type="number" min="20" max="300" bind:value={bpm} />
      </label>
      <label class="field small">
        <span>פעימות בתיבה</span>
        <input type="number" min="1" max="12" bind:value={beats} />
      </label>
    </div>

    <label class="field">
      <span>הדבק את האקורדים והמילים</span>
      <textarea
        bind:value={chart}
        spellcheck="false"
        placeholder={`אקורדים מעל המילים, או [Am] בתוך השורה.\n\nAm\nהבה נגילה הבה נגילה\n        Dm        Am\nהבה נגילה ונשמחה`}
      ></textarea>
    </label>

    <p class="stat" aria-live="polite">
      זוהו {plural(stats.chords, NOUNS.chord)} על פני {plural(stats.lines, NOUNS.line)}.
    </p>

    <p class="legal">
      הייבוא ממיר טקסט שאתה מדביק בלבד. הדבק רק תכנים שמותר לך להשתמש בהם
      (תמלולים שלך, נחלת הכלל, או חומר ברישיון).
    </p>
  </div>

  <footer>
    <Button variant="ghost" onclick={onclose}>ביטול</Button>
    <Button variant="filled" onclick={doImport} disabled={!chart.trim() || busy}>
      {busy ? 'מייבא…' : 'ייבא ופתח'}
    </Button>
  </footer>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: oklch(0 0 0 / 0.6);
    z-index: 50;
    border: none;
  }
  .dialog {
    position: fixed;
    z-index: 51;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, 92vw);
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    box-shadow: 0 24px 64px oklch(0 0 0 / 0.5);
  }
  header,
  footer {
    display: flex;
    align-items: center;
    padding: var(--sp-4) var(--sp-5);
  }
  header {
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
  }
  header h2 {
    font-size: var(--text-md);
  }
  .x {
    background: none;
    border: none;
    color: var(--ink-3);
    cursor: pointer;
    font-size: var(--text-md);
  }
  .body {
    padding: var(--sp-5);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--sp-4);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .field > span {
    font-size: var(--text-sm);
    color: var(--ink-2);
  }
  .row {
    display: flex;
    gap: var(--sp-4);
  }
  .field.small {
    flex: 1;
  }
  input,
  textarea {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink);
    padding: var(--sp-3) var(--sp-4);
    font: inherit;
  }
  textarea {
    min-height: 220px;
    resize: vertical;
    font-family: var(--font-mono, monospace);
    line-height: 1.5;
    white-space: pre;
    direction: ltr;
    text-align: start;
  }
  .stat {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--ink-2);
  }
  .legal {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--ink-3);
    line-height: 1.5;
  }
  footer {
    justify-content: flex-end;
    gap: var(--sp-3);
    border-top: 1px solid var(--border);
  }
</style>
