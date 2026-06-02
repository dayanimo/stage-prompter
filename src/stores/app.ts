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

/** Apply a mutation to a song and persist. Pass a function that mutates in place. */
export async function updateSong(id: string, mutate: (s: Song) => void): Promise<void> {
  const list = get(songs);
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const next = structuredClone(list[idx]);
  mutate(next);
  next.updatedAt = Date.now();
  const copy = [...list];
  copy[idx] = next;
  songs.set(copy);
  await db.putSong(next);
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
