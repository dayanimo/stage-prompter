/**
 * IndexedDB persistence via `idb`. All app data lives locally on the machine.
 * Finalized contract: stores read/write through these functions only.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  type Song,
  type SetList,
  type AppSettings,
  DEFAULT_SETTINGS,
} from './model';

interface PrompterDB extends DBSchema {
  songs: { key: string; value: Song };
  sets: { key: string; value: SetList };
  meta: { key: string; value: unknown };
}

const DB_NAME = 'stage-prompter';
const DB_VERSION = 1;
const SETTINGS_KEY = 'settings';

let dbp: Promise<IDBPDatabase<PrompterDB>> | null = null;

function db(): Promise<IDBPDatabase<PrompterDB>> {
  if (!dbp) {
    dbp = openDB<PrompterDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('songs')) {
          database.createObjectStore('songs', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('sets')) {
          database.createObjectStore('sets', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta');
        }
      },
    });
  }
  return dbp;
}

// ---- Songs -----------------------------------------------------------------

export async function getAllSongs(): Promise<Song[]> {
  return (await db()).getAll('songs');
}

export async function getSong(id: string): Promise<Song | undefined> {
  return (await db()).get('songs', id);
}

export async function putSong(song: Song): Promise<void> {
  song.updatedAt = Date.now();
  await (await db()).put('songs', song);
}

export async function deleteSong(id: string): Promise<void> {
  await (await db()).delete('songs', id);
}

// ---- Sets ------------------------------------------------------------------

export async function getAllSets(): Promise<SetList[]> {
  return (await db()).getAll('sets');
}

export async function putSet(set: SetList): Promise<void> {
  set.updatedAt = Date.now();
  await (await db()).put('sets', set);
}

export async function deleteSet(id: string): Promise<void> {
  await (await db()).delete('sets', id);
}

// ---- Settings --------------------------------------------------------------

export async function getSettings(): Promise<AppSettings> {
  const stored = (await (await db()).get('meta', SETTINGS_KEY)) as AppSettings | undefined;
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS };
}

export async function putSettings(settings: AppSettings): Promise<void> {
  await (await db()).put('meta', settings, SETTINGS_KEY);
}

// ---- Bulk (export/import) --------------------------------------------------

export interface Snapshot {
  version: number;
  exportedAt: number;
  songs: Song[];
  sets: SetList[];
  settings: AppSettings;
  /** Device-local UI prefs kept in localStorage (panel width, panel position…). */
  prefs?: Record<string, string>;
}

export async function exportSnapshot(): Promise<Snapshot> {
  const [songs, sets, settings] = await Promise.all([
    getAllSongs(),
    getAllSets(),
    getSettings(),
  ]);
  return { version: DB_VERSION, exportedAt: Date.now(), songs, sets, settings };
}

/** Import a snapshot. mode 'replace' clears existing data first; 'merge' upserts. */
export async function importSnapshot(
  snap: Snapshot,
  mode: 'replace' | 'merge' = 'merge',
): Promise<void> {
  const database = await db();
  const tx = database.transaction(['songs', 'sets', 'meta'], 'readwrite');
  if (mode === 'replace') {
    await Promise.all([tx.objectStore('songs').clear(), tx.objectStore('sets').clear()]);
  }
  for (const song of snap.songs) await tx.objectStore('songs').put(song);
  for (const set of snap.sets) await tx.objectStore('sets').put(set);
  if (snap.settings) await tx.objectStore('meta').put(snap.settings, SETTINGS_KEY);
  await tx.done;
}
