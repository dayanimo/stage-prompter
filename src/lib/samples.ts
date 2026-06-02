/**
 * Public-domain sample songs (traditional Hebrew folk) with standard chord
 * arrangements, used to seed an empty library for first-run testing.
 * All three songs are traditional / public domain — no copyright concerns.
 */
import {
  type Song,
  type SetList,
  type Line,
  type Chord,
  type Root,
  type Variation,
  uid,
} from './model';
import * as db from './db';
import { loadAll, sets as setsStore } from '$stores/app';
import { get } from 'svelte/store';

type Seg = [string, Chord | null];

function c(root: Root, variation: Variation, bass?: string): Chord {
  return bass ? { root, variation, bass } : { root, variation };
}

function line(segs: Seg[], opts: { section?: string; notes?: Line['notes'] } = {}): Line {
  return {
    id: uid('ln_'),
    segments: segs.map(([text, chord]) => (chord ? { text, chord } : { text })),
    notes: opts.notes ?? [],
    ...(opts.section ? { section: opts.section } : {}),
  };
}

function song(title: string, bpm: number, beats: number, lines: Line[]): Song {
  const now = Date.now();
  return {
    id: uid('sg_'),
    title,
    dir: 'rtl',
    lines,
    timeSig: { beats, unit: 4 },
    bpm,
    capo: 0,
    transpose: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function buildSamples(): { songs: Song[]; set: SetList } {
  const Am = c('A', 'min');
  const Dm = c('D', 'min');
  const E7 = c('E', '7');
  const G = c('G', 'maj');
  const D7 = c('D', '7');

  // הבה נגילה — traditional hora, key Am (Am / Dm / E7)
  const hava = song('הבה נגילה', 120, 4, [
    line([['הבה נגילה הבה נגילה', Am]], { section: 'verse' }),
    line([['הבה נגילה ', Dm], ['ונשמחה', Am]]),
    line([['הבה נגילה הבה נגילה', Am]]),
    line([['הבה נגילה ', Dm], ['ונשמחה', Am]]),
    line([['הבה נרננה הבה נרננה', Am]], { section: 'chorus' }),
    line([['הבה נרננה ', Dm], ['ונשמחה', E7]]),
    line([['הבה נרננה הבה נרננה', Am]]),
    line([['הבה נרננה ', Dm], ['ונשמחה', Am]]),
    line([['עורו עורו אחים', E7]], {
      section: 'solo',
      notes: [
        { start: 0, end: 9, label: 'להאיץ את הקצב!', highlight: 'oklch(0.72 0.118 200 / 0.35)' },
      ],
    }),
    line([['עורו אחים ', Dm], ['בלב שמח', Am]]),
    line([['עורו עורו אחים', E7]]),
    line([['עורו אחים ', Dm], ['בלב שמח', Am]]),
    line([['עורו אחים ', E7], ['עורו אחים', Am]]),
    line([['בלב ', E7], ['שמח', Am]]),
  ]);

  // הבאנו שלום עליכם — traditional, key Am (Am / E7)
  const hevenu = song('הבאנו שלום עליכם', 104, 4, [
    line([['הבאנו שלום ', Am], ['עליכם', E7]], { section: 'verse' }),
    line([['הבאנו שלום ', Am], ['עליכם', E7]]),
    line([['הבאנו שלום ', Am], ['עליכם', E7]]),
    line([['הבאנו שלום שלום שלום ', Am], ['עליכם', E7]], { section: 'chorus' }),
  ]);

  // דוד מלך ישראל — traditional, key G (G / D7)
  const david = song('דוד מלך ישראל', 112, 4, [
    line([['דוד מלך ', G], ['ישראל', D7]], { section: 'verse' }),
    line([['חי חי ו', D7], ['קיים', G]]),
    line([['דוד מלך ', G], ['ישראל', D7]]),
    line([['חי חי ו', D7], ['קיים', G]]),
  ]);

  const songs = [hava, hevenu, david];
  const now = Date.now();
  const set: SetList = {
    id: uid('st_'),
    name: 'סט לדוגמה',
    songIds: songs.map((s) => s.id),
    createdAt: now,
    updatedAt: now,
  };
  return { songs, set };
}

/** Seed the sample songs + set. Idempotent: skips if the sample set already exists. */
export async function seedSamples(): Promise<void> {
  if (get(setsStore).some((s) => s.name === 'סט לדוגמה')) return;
  const { songs, set } = buildSamples();
  await Promise.all(songs.map((s) => db.putSong(s)));
  await db.putSet(set);
  await loadAll();
}
