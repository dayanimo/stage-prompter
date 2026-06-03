/**
 * App-wide reactive state. Classic Svelte stores (work everywhere, simple).
 * All mutations persist through db.ts. This is the shared contract every
 * feature track reads/writes — keep the public API stable.
 */
import { writable, derived, get } from 'svelte/store';
import {
  type Song,
  type SetList,
  type AppSettings,
  type Chord,
  DEFAULT_SETTINGS,
  createSong,
  createSetList,
} from '$lib/model';
import * as db from '$lib/db';

export type View = 'library' | 'edit' | 'perform';

export interface SelectionRange {
  lineId: string;
  start: number; // char index into line text
  end: number; // exclusive
}

export interface Session {
  view: View;
  currentSongId: string | null;
  currentSetId: string | null;
  /** Index into the active set's songIds during performance. */
  perfIndex: number;
  /** Active text selection in the editor (for chord/note placement). */
  selection: SelectionRange | null;
}

// ---- Stores ----------------------------------------------------------------

export const songs = writable<Song[]>([]);
export const sets = writable<SetList[]>([]);
export const settings = writable<AppSettings>({ ...DEFAULT_SETTINGS });
export const session = writable<Session>({
  view: 'library',
  currentSongId: null,
  currentSetId: null,
  perfIndex: 0,
  selection: null,
});

let loaded = false;

export async function loadAll(): Promise<void> {
  const [s, st, settingsVal] = await Promise.all([
    db.getAllSongs(),
    db.getAllSets(),
    db.getSettings(),
  ]);
  songs.set(s.sort((a, b) => a.createdAt - b.createdAt));
  sets.set(st.sort((a, b) => a.createdAt - b.createdAt));
  settings.set(settingsVal);
  loaded = true;
}

export const isLoaded = () => loaded;

// ---- Derived ---------------------------------------------------------------

export const currentSong = derived([songs, session], ([$songs, $session]) =>
  $session.currentSongId ? ($songs.find((s) => s.id === $session.currentSongId) ?? null) : null,
);

export const currentSet = derived([sets, session], ([$sets, $session]) =>
  $session.currentSetId ? ($sets.find((s) => s.id === $session.currentSetId) ?? null) : null,
);

/** Songs of the active set, in order (for performance). */
export const setSongs = derived([sets, songs, session], ([$sets, $songs, $session]) => {
  const set = $sets.find((s) => s.id === $session.currentSetId);
  if (!set) return [] as Song[];
  return set.songIds
    .map((id) => $songs.find((s) => s.id === id))
    .filter((s): s is Song => Boolean(s));
});

// ---- Song actions ----------------------------------------------------------

export async function addSong(title?: string): Promise<Song> {
  const song = createSong(title);
  await db.putSong(song);
  songs.update((list) => [...list, song]);
  return song;
}

/** Persist an already-built Song (e.g. from the chart importer). */
export async function importSong(song: Song): Promise<Song> {
  await db.putSong(song);
  songs.update((list) => [...list, song]);
  return song;
}

// ---- Undo / redo history ---------------------------------------------------
// Per-song snapshot stacks. Editor edits push the pre-edit state; performance
// chrome writes (scroll speed, live font bumps) opt out via { record: false }.

const MAX_HISTORY = 100;
const undoStack: Record<string, Song[]> = {};
const redoStack: Record<string, Song[]> = {};
/** Bumped on any history change so derived can/redo state recomputes. */
const historyVersion = writable(0);

export const undoState = derived([session, historyVersion], ([$session]) => {
  const id = $session.currentSongId;
  return {
    canUndo: !!id && (undoStack[id]?.length ?? 0) > 0,
    canRedo: !!id && (redoStack[id]?.length ?? 0) > 0,
  };
});

interface UpdateOpts {
  /** Record this change in undo history (default true). */
  record?: boolean;
}

/** Apply a mutation to a song and persist. Pass a function that mutates in place. */
export async function updateSong(
  id: string,
  mutate: (s: Song) => void,
  opts: UpdateOpts = {},
): Promise<void> {
  const list = get(songs);
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return;
  if (opts.record ?? true) {
    const stack = (undoStack[id] ??= []);
    stack.push(structuredClone(list[idx]));
    if (stack.length > MAX_HISTORY) stack.shift();
    redoStack[id] = [];
    historyVersion.update((v) => v + 1);
  }
  const next = structuredClone(list[idx]);
  mutate(next);
  next.updatedAt = Date.now();
  const copy = [...list];
  copy[idx] = next;
  songs.set(copy);
  await db.putSong(next);
}

async function restoreSong(id: string, song: Song): Promise<void> {
  const list = get(songs);
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const copy = [...list];
  copy[idx] = song;
  songs.set(copy);
  await db.putSong(song);
}

export async function undo(): Promise<void> {
  const id = get(session).currentSongId;
  if (!id) return;
  const stack = undoStack[id];
  if (!stack?.length) return;
  const current = get(songs).find((s) => s.id === id);
  if (!current) return;
  (redoStack[id] ??= []).push(structuredClone(current));
  await restoreSong(id, stack.pop()!);
  historyVersion.update((v) => v + 1);
}

export async function redo(): Promise<void> {
  const id = get(session).currentSongId;
  if (!id) return;
  const stack = redoStack[id];
  if (!stack?.length) return;
  const current = get(songs).find((s) => s.id === id);
  if (!current) return;
  (undoStack[id] ??= []).push(structuredClone(current));
  await restoreSong(id, stack.pop()!);
  historyVersion.update((v) => v + 1);
}

export async function deleteSong(id: string): Promise<void> {
  await db.deleteSong(id);
  songs.update((list) => list.filter((s) => s.id !== id));
  // Remove from any sets that reference it.
  const affected = get(sets).filter((s) => s.songIds.includes(id));
  for (const set of affected) {
    await updateSet(set.id, (s) => {
      s.songIds = s.songIds.filter((sid) => sid !== id);
    });
  }
}

export async function duplicateSong(id: string): Promise<Song | null> {
  const original = get(songs).find((s) => s.id === id);
  if (!original) return null;
  const copy = structuredClone(original);
  const now = Date.now();
  copy.id = `sg_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  copy.title = `${original.title} (copy)`;
  copy.createdAt = now;
  copy.updatedAt = now;
  await db.putSong(copy);
  songs.update((list) => [...list, copy]);
  return copy;
}

// ---- Set actions -----------------------------------------------------------

export async function addSet(name?: string): Promise<SetList> {
  const set = createSetList(name);
  await db.putSet(set);
  sets.update((list) => [...list, set]);
  return set;
}

export async function updateSet(id: string, mutate: (s: SetList) => void): Promise<void> {
  const list = get(sets);
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const next = structuredClone(list[idx]);
  mutate(next);
  next.updatedAt = Date.now();
  const copy = [...list];
  copy[idx] = next;
  sets.set(copy);
  await db.putSet(next);
}

export async function deleteSet(id: string): Promise<void> {
  await db.deleteSet(id);
  sets.update((list) => list.filter((s) => s.id !== id));
}

// ---- Settings --------------------------------------------------------------

export async function updateSettings(mutate: (s: AppSettings) => void): Promise<void> {
  const next = structuredClone(get(settings));
  mutate(next);
  settings.set(next);
  await db.putSettings(next);
}

// ---- Favorite chords -------------------------------------------------------

const MAX_FAVORITES = 24;
const chordKey = (c: Chord) => `${c.root}|${c.variation}|${c.bass ?? ''}`;

/** Add a chord to the front of the favorites quick-pick (most-recent first). */
export async function addFavoriteChord(chord: Chord): Promise<void> {
  await updateSettings((s) => {
    const key = chordKey(chord);
    const list = (s.favoriteChords ?? []).filter((c) => chordKey(c) !== key);
    list.unshift({ ...chord });
    s.favoriteChords = list.slice(0, MAX_FAVORITES);
  });
}

export async function removeFavoriteChord(chord: Chord): Promise<void> {
  await updateSettings((s) => {
    const key = chordKey(chord);
    s.favoriteChords = (s.favoriteChords ?? []).filter((c) => chordKey(c) !== key);
  });
}

// ---- Navigation helpers ----------------------------------------------------

export function openSong(id: string): void {
  session.update((s) => ({ ...s, view: 'edit', currentSongId: id, selection: null }));
}

export function goLibrary(): void {
  session.update((s) => ({ ...s, view: 'library', selection: null }));
}

export function startPerformance(setId: string, index = 0): void {
  session.update((s) => ({
    ...s,
    view: 'perform',
    currentSetId: setId,
    perfIndex: index,
  }));
}

export function setSelection(sel: SelectionRange | null): void {
  session.update((s) => ({ ...s, selection: sel }));
}
