import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import {
  putSong,
  putSet,
  putSettings,
  exportSnapshot,
  importSnapshot,
  getAllSongs,
  getAllSets,
  getSettings,
} from './db';
import {
  DEFAULT_SETTINGS,
  createTabContent,
  type Song,
  type SetList,
  type AppSettings,
} from './model';

/** A song that exercises every feature added to the model. */
function fullyFeaturedSong(): Song {
  const tab = createTabContent(8);
  tab.cols[0][0] = 3; // high e, fret 3
  tab.cols[1][5] = 12; // low E, fret 12
  return {
    id: 'sg_full',
    title: 'הכול ביחד',
    dir: 'rtl',
    timeSig: { beats: 4, unit: 4 },
    bpm: 96,
    transpose: 2,
    capo: 1,
    scrollSpeed: 35,
    theme: { bg: 'oklch(0.1 0 0)', text: 'oklch(0.95 0 0)', chordSize: 30 },
    sectionStyles: { chorus: { color: 'oklch(0.7 0.2 25)', bg: 'oklch(0.8 0.14 75 / 0.22)' } },
    createdAt: 1,
    updatedAt: 1,
    lines: [
      {
        id: 'ln_lyr',
        kind: 'lyrics',
        section: 'chorus',
        sectionColor: 'oklch(0.78 0.16 150)',
        segments: [
          { text: 'שורה ', chord: { root: 'C#', variation: 'm7', bass: 'G' } },
          { text: 'ראשונה' },
        ],
        notes: [{ start: 0, end: 5, label: 'סולו', highlight: 'oklch(0.7 0.13 250 / 0.32)', color: 'oklch(0.7 0.2 25)' }],
      },
      { id: 'ln_tab', kind: 'tab', segments: [{ text: '' }], notes: [], tab },
      {
        id: 'ln_not',
        kind: 'notation',
        segments: [{ text: '' }],
        notes: [],
        notation: {
          clef: 'treble',
          notes: [
            { step: 2, dur: 'q' },
            { step: 5, dur: '8', acc: '#' },
            { step: 7, dur: 'h', acc: null },
          ],
        },
      },
    ],
  };
}

function fullSet(): SetList {
  return { id: 'st_1', name: 'סט מלא', songIds: ['sg_full'], createdAt: 1, updatedAt: 1 };
}

function fullSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    accidentalPref: 'flats',
    clickEnabled: true,
    countInBars: 4,
    autoAdvance: false,
    lineView: true,
    lineBars: 3,
    favoriteChords: [
      { root: 'C#', variation: 'm7', bass: 'G' },
      { root: 'A', variation: 'sus4' },
    ],
  };
}

describe('backup / restore round-trips every feature', () => {
  it('exports the whole library and re-imports it byte-for-byte', async () => {
    const song = fullyFeaturedSong();
    const set = fullSet();
    const settings = fullSettings();

    await putSong(structuredClone(song));
    await putSet(structuredClone(set));
    await putSettings(settings);

    // Mirror the REAL backup path: the app serializes the snapshot to a JSON
    // file (JSON.stringify) and re-imports the parsed JSON. Round-trip through
    // JSON here so the test proves the actual on-disk format survives, not just
    // an in-memory structured clone.
    const snapRaw = await exportSnapshot();
    const snap = JSON.parse(JSON.stringify(snapRaw));

    // Wipe and restore from the JSON snapshot only.
    await importSnapshot(snap, 'replace');

    const [songs2, sets2, settings2] = await Promise.all([
      getAllSongs(),
      getAllSets(),
      getSettings(),
    ]);

    // Everything comes back exactly as exported.
    expect(songs2).toEqual(snap.songs);
    expect(sets2).toEqual(snap.sets);
    expect(settings2).toEqual(snap.settings);

    // Spot-check the feature-bearing fields explicitly.
    const s = songs2.find((x) => x.id === 'sg_full')!;
    expect(s.sectionStyles?.chorus).toEqual({
      color: 'oklch(0.7 0.2 25)',
      bg: 'oklch(0.8 0.14 75 / 0.22)',
    });
    const lyr = s.lines[0];
    expect(lyr.segments[0].chord).toEqual({ root: 'C#', variation: 'm7', bass: 'G' });
    expect(lyr.notes[0].color).toBe('oklch(0.7 0.2 25)');
    expect(lyr.sectionColor).toBe('oklch(0.78 0.16 150)');

    const tabLine = s.lines.find((l) => l.kind === 'tab')!;
    expect(tabLine.tab?.cols[0][0]).toBe(3);
    expect(tabLine.tab?.cols[1][5]).toBe(12);

    const notLine = s.lines.find((l) => l.kind === 'notation')!;
    expect(notLine.notation?.notes).toEqual([
      { step: 2, dur: 'q' },
      { step: 5, dur: '8', acc: '#' },
      { step: 7, dur: 'h', acc: null },
    ]);

    expect(settings2.favoriteChords).toHaveLength(2);
    expect(settings2.countInBars).toBe(4);
    expect(settings2.lineBars).toBe(3);
    expect(settings2.accidentalPref).toBe('flats');
  });
});
