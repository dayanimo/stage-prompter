<script lang="ts">
  /**
   * Lyrics editing surface. Each line shows a live SongLine preview (editable
   * mode: chords are clickable to remove, selections place chords) plus a raw
   * text input for typing. Handles line split/merge, section tags, and notes.
   *
   * All model writes go through `updateSong` + the pure helpers in $lib/edits.
   */
  import type { Song, Note, SectionKind } from '$lib/model';
  import { lineText, createLine, resolveTheme } from '$lib/model';
  import { updateSong, setSelection, session, settings } from '$stores/app';
  import { editLineText, applyNote, removeChord, removeNote } from '$lib/edits';
  import SongLine from '$components/common/SongLine.svelte';
  import NotePopover from './NotePopover.svelte';

  interface Props {
    song: Song;
  }
  let { song }: Props = $props();

  const theme = $derived(resolveTheme(song, $settings));
  const accidental = $derived($settings.accidentalPref);
  const transpose = $derived(song.transpose ?? 0);
  const selection = $derived($session.selection);

  /** Which line currently has its note popover open, if any. */
  let notePopoverLine = $state<string | null>(null);
  /** Note being edited in the popover (null = creating new). */
  let editingNote = $state<{ lineId: string; index: number } | null>(null);

  const SECTIONS: { id: SectionKind; label: string }[] = [
    { id: '', label: '—' },
    { id: 'intro', label: 'אינטרו' },
    { id: 'verse', label: 'בית' },
    { id: 'prechorus', label: 'טרום-פזמון' },
    { id: 'chorus', label: 'פזמון' },
    { id: 'bridge', label: 'גשר' },
    { id: 'solo', label: 'סולו' },
    { id: 'outro', label: 'אאוטרו' },
  ];

  const lineDir = $derived(song.dir === 'ltr' ? 'ltr' : song.dir === 'rtl' ? 'rtl' : 'auto');

  function onInput(lineId: string, e: Event) {
    const text = (e.target as HTMLInputElement).value;
    updateSong(song.id, (s) => editLineText(s, lineId, text));
  }

  /** Report a text selection so the ChordPanel can place a chord above it. */
  function onSelect(lineId: string, e: Event) {
    const el = e.target as HTMLInputElement;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start != null && end != null && end > start) {
      setSelection({ lineId, start, end });
    }
  }

  /** SongLine reports a drag-select inside the preview text. */
  function onPreviewSelect(range: { lineId: string; start: number; end: number }) {
    setSelection(range);
  }

  /** Clicking a rendered chord removes it. */
  function onChordClick(lineId: string, segmentIndex: number) {
    updateSong(song.id, (s) => removeChord(s, lineId, segmentIndex));
  }

  function setSection(lineId: string, section: SectionKind) {
    updateSong(song.id, (s) => {
      const line = s.lines.find((l) => l.id === lineId);
      if (!line) return;
      if (section) line.section = section;
      else delete line.section;
    });
  }

  function addLineAfter(lineId: string) {
    updateSong(song.id, (s) => {
      const idx = s.lines.findIndex((l) => l.id === lineId);
      const newLine = createLine('');
      s.lines.splice(idx + 1, 0, newLine);
    });
  }

  function addLineEnd() {
    updateSong(song.id, (s) => s.lines.push(createLine('')));
  }

  function removeLine(lineId: string) {
    updateSong(song.id, (s) => {
      if (s.lines.length <= 1) {
        // Never leave zero lines — clear the last one instead.
        s.lines = [createLine('')];
        return;
      }
      s.lines = s.lines.filter((l) => l.id !== lineId);
    });
    if (selection?.lineId === lineId) setSelection(null);
  }

  /** Enter splits the line at the caret; Backspace at start merges up. */
  function onKeydown(lineId: string, idx: number, e: KeyboardEvent) {
    const el = e.target as HTMLInputElement;
    if (e.key === 'Enter') {
      e.preventDefault();
      const caret = el.selectionStart ?? el.value.length;
      const before = el.value.slice(0, caret);
      const after = el.value.slice(caret);
      const newLine = createLine(after);
      updateSong(song.id, (s) => {
        editLineText(s, lineId, before);
        const at = s.lines.findIndex((l) => l.id === lineId);
        s.lines.splice(at + 1, 0, newLine);
      });
      queueFocus(newLine.id, 0);
    } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0 && idx > 0) {
      e.preventDefault();
      const prev = song.lines[idx - 1];
      const prevText = lineText(prev);
      const curText = el.value;
      updateSong(song.id, (s) => {
        editLineText(s, prev.id, prevText + curText);
        s.lines = s.lines.filter((l) => l.id !== lineId);
      });
      if (selection?.lineId === lineId) setSelection(null);
      queueFocus(prev.id, prevText.length);
    }
  }

  /** After a structural change, move the caret into the right input. */
  let pendingFocus: { lineId: string; caret: number } | null = $state(null);
  function queueFocus(lineId: string, caret: number) {
    pendingFocus = { lineId, caret };
  }
  $effect(() => {
    if (!pendingFocus) return;
    const { lineId, caret } = pendingFocus;
    const el = inputs[lineId];
    if (el) {
      el.focus();
      const pos = Math.min(caret, el.value.length);
      el.setSelectionRange(pos, pos);
    }
    pendingFocus = null;
  });

  let inputs: Record<string, HTMLInputElement> = {};

  // ---- Notes -----------------------------------------------------------------

  function openNotePopover(lineId: string) {
    editingNote = null;
    notePopoverLine = lineId;
  }
  function openEditNote(lineId: string, index: number) {
    editingNote = { lineId, index };
    notePopoverLine = lineId;
  }
  function closeNotePopover() {
    notePopoverLine = null;
    editingNote = null;
  }

  function saveNote(lineId: string, data: { label: string; highlight: string }) {
    if (editingNote && editingNote.lineId === lineId) {
      // Editing an existing note keeps its range.
      const line = song.lines.find((l) => l.id === lineId);
      const existing = line?.notes[editingNote.index];
      if (existing) {
        const updated: Note = { ...existing, label: data.label, highlight: data.highlight };
        updateSong(song.id, (s) => applyNote(s, lineId, updated));
      }
    } else if (selection && selection.lineId === lineId) {
      const note: Note = {
        start: selection.start,
        end: selection.end,
        label: data.label,
        highlight: data.highlight,
      };
      updateSong(song.id, (s) => applyNote(s, lineId, note));
    }
    closeNotePopover();
  }

  function deleteNote(lineId: string, index: number) {
    updateSong(song.id, (s) => removeNote(s, lineId, index));
  }

  /** Can we add a note to this line? Need a non-empty selection on it. */
  function canAddNote(lineId: string): boolean {
    return !!selection && selection.lineId === lineId && selection.end > selection.start;
  }

  const currentEditingNote = $derived.by(() => {
    if (!editingNote) return null;
    const line = song.lines.find((l) => l.id === editingNote!.lineId);
    return line?.notes[editingNote!.index] ?? null;
  });
</script>

<div class="editor" dir={song.dir === 'ltr' ? 'ltr' : 'rtl'}>
  {#each song.lines as line, idx (line.id)}
    {@const isSelected = selection?.lineId === line.id}
    <div class="line-block" class:active={isSelected}>
      <!-- Live preview: clickable chords + drag-select to place chords -->
      <div class="preview" style="background:{theme.bg};">
        <SongLine
          {line}
          {theme}
          {transpose}
          {accidental}
          dir={lineDir}
          editable
          onselect={onPreviewSelect}
          onchordclick={(seg) => onChordClick(line.id, seg)}
        />
      </div>

      <!-- Raw editable text + per-line controls -->
      <div class="controls">
        <select
          class="section"
          aria-label="תגית קטע"
          value={line.section ?? ''}
          onchange={(e) => setSection(line.id, (e.currentTarget as HTMLSelectElement).value)}
        >
          {#each SECTIONS as sec (sec.id)}
            <option value={sec.id}>{sec.label}</option>
          {/each}
        </select>

        <input
          class="line-input"
          bind:this={inputs[line.id]}
          dir={lineDir}
          value={lineText(line)}
          placeholder="מילות השורה…"
          oninput={(e) => onInput(line.id, e)}
          onselect={(e) => onSelect(line.id, e)}
          onkeydown={(e) => onKeydown(line.id, idx, e)}
          aria-label="טקסט שורה"
        />

        <div class="line-actions">
          <button
            type="button"
            class="icon"
            title="הוסף הערה על הבחירה"
            aria-label="הוסף הערה"
            disabled={!canAddNote(line.id)}
            onclick={() => openNotePopover(line.id)}
          >♪</button>
          <button
            type="button"
            class="icon"
            title="הוסף שורה למטה"
            aria-label="הוסף שורה"
            onclick={() => addLineAfter(line.id)}
          >+</button>
          <button
            type="button"
            class="icon danger"
            title="מחק שורה"
            aria-label="מחק שורה"
            onclick={() => removeLine(line.id)}
          >✕</button>
        </div>
      </div>

      <!-- Existing notes on this line: chips to edit/delete -->
      {#if line.notes.length > 0}
        <div class="note-chips">
          {#each line.notes as note, ni (ni)}
            <span class="chip" style="--hl:{note.highlight};">
              <button
                type="button"
                class="chip-label"
                onclick={() => openEditNote(line.id, ni)}
                title="ערוך הערה"
              >{note.label}</button>
              <button
                type="button"
                class="chip-x"
                aria-label="מחק הערה"
                onclick={() => deleteNote(line.id, ni)}
              >✕</button>
            </span>
          {/each}
        </div>
      {/if}

      {#if notePopoverLine === line.id}
        <div class="popover-wrap">
          <NotePopover
            note={currentEditingNote}
            onsave={(data) => saveNote(line.id, data)}
            oncancel={closeNotePopover}
          />
        </div>
      {/if}
    </div>
  {/each}

  <button type="button" class="add-line" onclick={addLineEnd}>+ שורה חדשה</button>
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    max-width: 80ch;
  }
  .line-block {
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface);
    padding: var(--sp-3);
    transition: border-color var(--dur-fast) var(--ease-out);
  }
  .line-block:hover {
    border-color: var(--border-2);
  }
  .line-block.active {
    border-color: var(--accent);
    background: var(--surface-2);
  }
  .preview {
    border-radius: var(--r-sm);
    padding: var(--sp-3) var(--sp-4);
    margin-bottom: var(--sp-3);
    overflow-x: auto;
    min-height: calc(2.4em);
  }
  .controls {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
  }
  .section {
    flex: 0 0 auto;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink-2);
    padding: var(--sp-2) var(--sp-3);
    font: inherit;
    font-size: var(--text-xs);
    height: 32px;
    cursor: pointer;
  }
  .section:hover {
    border-color: var(--border-2);
    color: var(--ink);
  }
  .line-input {
    flex: 1;
    min-width: 0;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink);
    padding: var(--sp-3) var(--sp-4);
    font: inherit;
    font-size: var(--text-base);
    height: 32px;
  }
  .line-input::placeholder {
    color: var(--ink-3);
  }
  .line-input:hover {
    border-color: var(--border-2);
  }
  .line-input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
    border-color: transparent;
  }
  .line-actions {
    display: flex;
    gap: var(--sp-2);
  }
  .icon {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink-2);
    font-size: var(--text-base);
    line-height: 1;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .icon:hover:not(:disabled) {
    background: var(--surface-3);
    border-color: var(--border-2);
    color: var(--ink);
  }
  .icon:active:not(:disabled) {
    background: var(--accent-soft);
  }
  .icon:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  .icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .icon.danger {
    color: var(--danger);
  }
  .icon.danger:hover:not(:disabled) {
    background: color-mix(in oklch, var(--danger) 16%, transparent);
    border-color: color-mix(in oklch, var(--danger) 40%, transparent);
    color: var(--danger);
  }
  .note-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    background: var(--hl);
    border: 1px solid var(--border-2);
    border-radius: var(--r-full);
    padding-inline-start: var(--sp-3);
    padding-inline-end: var(--sp-1);
    height: 26px;
  }
  .chip-label {
    background: none;
    border: none;
    color: var(--ink);
    font-size: var(--text-xs);
    font-weight: 500;
    cursor: pointer;
    padding: 0;
  }
  .chip-label:hover {
    text-decoration: underline;
  }
  .chip-x {
    width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--r-full);
    color: var(--ink-2);
    font-size: 10px;
    cursor: pointer;
  }
  .chip-x:hover {
    background: oklch(0 0 0 / 0.3);
    color: var(--ink);
  }
  .chip-label:focus-visible,
  .chip-x:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  .popover-wrap {
    margin-top: var(--sp-3);
  }
  .add-line {
    align-self: flex-start;
    margin-top: var(--sp-2);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink-2);
    padding: var(--sp-3) var(--sp-5);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 500;
    cursor: pointer;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .add-line:hover {
    background: var(--surface-3);
    color: var(--ink);
  }
  .add-line:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
