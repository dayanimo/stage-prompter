/**
 * Track E — export/import of local data as JSON.
 *
 * All data stays on the machine. These helpers serialize a `Snapshot`
 * (whole library or a single set) to a download, and import a snapshot
 * file back into IndexedDB, defensively validating the parsed shape.
 */
import { exportSnapshot, importSnapshot, type Snapshot } from './db';
import { loadAll } from '$stores/app';

/** Device-local UI prefs (kept in localStorage, not IndexedDB). */
const PREF_KEYS = ['sp.panelWidth', 'sp.favPos'];

function collectPrefs(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof localStorage === 'undefined') return out;
  for (const k of PREF_KEYS) {
    const v = localStorage.getItem(k);
    if (v != null) out[k] = v;
  }
  return out;
}

function restorePrefs(prefs: Record<string, string> | undefined): void {
  if (!prefs || typeof localStorage === 'undefined') return;
  for (const k of PREF_KEYS) {
    if (typeof prefs[k] === 'string') localStorage.setItem(k, prefs[k]);
  }
}

/** Trigger a browser download of `data` serialized as pretty JSON. */
function save(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Make a filesystem-safe filename fragment from an arbitrary label. */
function safeName(name: string): string {
  const trimmed = (name ?? '').trim();
  const cleaned = trimmed
    .replace(/[\\/:*?"<>|]+/g, '-') // illegal path chars
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'set';
}

/** Export the entire library (songs, sets, settings) as a backup file. */
export async function downloadSnapshot(): Promise<void> {
  const snap = await exportSnapshot();
  snap.prefs = collectPrefs();
  save(snap, 'stage-prompter-backup.json');
}

/**
 * Export a single set together with only the songs it references.
 * Throws if the set does not exist.
 */
export async function downloadSet(setId: string): Promise<void> {
  const snap = await exportSnapshot();
  const set = snap.sets.find((s) => s.id === setId);
  if (!set) {
    throw new Error('הסט לא נמצא לייצוא.');
  }
  const ids = new Set(set.songIds);
  const songs = snap.songs.filter((s) => ids.has(s.id));
  const out: Snapshot = {
    ...snap,
    exportedAt: Date.now(),
    sets: [set],
    songs,
  };
  save(out, `stage-prompter-${safeName(set.name)}.json`);
}

/** Type guard: does `value` look like a valid persisted Snapshot? */
function isSnapshot(value: unknown): value is Snapshot {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.songs) || !Array.isArray(v.sets)) return false;
  // Each song must at least carry an id + lines array.
  const songsOk = v.songs.every(
    (s) =>
      s !== null &&
      typeof s === 'object' &&
      typeof (s as { id?: unknown }).id === 'string' &&
      Array.isArray((s as { lines?: unknown }).lines),
  );
  if (!songsOk) return false;
  // Each set must at least carry an id + songIds array.
  const setsOk = v.sets.every(
    (s) =>
      s !== null &&
      typeof s === 'object' &&
      typeof (s as { id?: unknown }).id === 'string' &&
      Array.isArray((s as { songIds?: unknown }).songIds),
  );
  return setsOk;
}

/**
 * Parse a JSON snapshot from a user-selected file and import it.
 * `mode` 'merge' (default) upserts; 'replace' clears existing data first.
 * Throws a clear Error on unreadable or malformed files.
 */
export async function importFromFile(
  file: File,
  mode: 'merge' | 'replace' = 'merge',
): Promise<void> {
  let raw: string;
  try {
    raw = await file.text();
  } catch {
    throw new Error('לא ניתן לקרוא את הקובץ.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('הקובץ אינו JSON תקין.');
  }

  if (!isSnapshot(parsed)) {
    throw new Error('הקובץ אינו גיבוי תקין של Stage Prompter.');
  }

  await importSnapshot(parsed, mode);
  restorePrefs(parsed.prefs);
  await loadAll();
}
