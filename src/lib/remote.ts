/**
 * Internal remote-control channel — pure same-origin, no server.
 *
 * The performance Stage (the "system") and a lightweight Remote page talk over
 * a `BroadcastChannel`, which delivers messages between tabs/windows of the same
 * origin on the same machine. A `localStorage` event fallback keeps it working
 * where BroadcastChannel is unavailable. Everything stays local and offline.
 *
 * Protocol: the Remote sends `cmd` (and a `hello` on open to request the current
 * state); the Stage sends `state` snapshots. Each side ignores its own message
 * kinds, so there is no feedback loop.
 */

export type RemoteCommand =
  | 'toggle' // play / pause (or metronome in 2-line mode)
  | 'next' // next song
  | 'prev' // previous song
  | 'speedUp'
  | 'speedDown'
  | 'fontUp'
  | 'fontDown'
  | 'restart' // jump to top and play
  | 'lineNext' // 2-line mode: advance one line
  | 'linePrev';

/** Snapshot the Stage broadcasts so the Remote can mirror it. */
export interface RemoteState {
  songTitle: string;
  songIndex: number; // 0-based
  songCount: number;
  playing: boolean;
  countingIn: boolean;
  speed: number;
  lineView: boolean;
  lineIndex: number; // active line in 2-line mode (−1 when scrolling)
  lineCount: number;
  lines: string[]; // plain text of every line, for the lyrics mirror
  dir: 'rtl' | 'ltr';
  ts: number;
}

export type RemoteMessage =
  | { kind: 'cmd'; cmd: RemoteCommand }
  | { kind: 'state'; state: RemoteState }
  | { kind: 'hello' }; // remote → stage: please send current state

const CHANNEL_NAME = 'stage-prompter-remote';
const LS_KEY = 'sp.remote.msg';

export interface RemoteChannel {
  send(msg: RemoteMessage): void;
  onMessage(cb: (msg: RemoteMessage) => void): () => void;
  close(): void;
}

export function createRemoteChannel(): RemoteChannel {
  const listeners = new Set<(m: RemoteMessage) => void>();
  const hasBC = typeof BroadcastChannel !== 'undefined';
  const bc = hasBC ? new BroadcastChannel(CHANNEL_NAME) : null;

  const emit = (m: RemoteMessage) => {
    for (const cb of listeners) cb(m);
  };

  if (bc) {
    bc.onmessage = (e) => emit(e.data as RemoteMessage);
  }

  // localStorage fallback: a write fires `storage` in other documents.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LS_KEY || !e.newValue) return;
    try {
      emit(JSON.parse(e.newValue).msg as RemoteMessage);
    } catch {
      /* ignore malformed */
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);

  return {
    send(msg) {
      if (bc) {
        bc.postMessage(msg);
        return; // BroadcastChannel is enough — don't also fire the storage path
        // (double delivery would run every command twice).
      }
      // Fallback only when BroadcastChannel is unavailable. Stamp it so identical
      // consecutive messages still trigger a `storage` event in other documents.
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ msg, n: Math.random() }));
      } catch {
        /* storage unavailable too; nothing more we can do */
      }
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    close() {
      listeners.clear();
      bc?.close();
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    },
  };
}
