/**
 * PLACEHOLDER — Track E replaces this. Export/import local data as JSON.
 */
import { exportSnapshot, importSnapshot, type Snapshot } from './db';
import { loadAll } from '$stores/app';

function save(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadSnapshot(): Promise<void> {
  save(await exportSnapshot(), 'stage-prompter-backup.json');
}

export async function downloadSet(setId: string): Promise<void> {
  const snap = await exportSnapshot();
  const set = snap.sets.find((s) => s.id === setId);
  if (!set) return;
  const songs = snap.songs.filter((s) => set.songIds.includes(s.id));
  save({ ...snap, sets: [set], songs }, `${set.name || 'set'}.json`);
}

export async function importFromFile(file: File, mode: 'merge' | 'replace' = 'merge'): Promise<void> {
  const snap = JSON.parse(await file.text()) as Snapshot;
  await importSnapshot(snap, mode);
  await loadAll();
}
