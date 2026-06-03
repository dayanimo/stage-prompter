/**
 * Cross-device remote transport over WebRTC (PeerJS).
 *
 * The Stage hosts a peer with a short id; a phone opens `#remote?p=<id>` (via a
 * scanned QR) and connects directly to it. PeerJS's free public server is used
 * only for the initial handshake — once connected, command/state data flows
 * peer-to-peer between the devices (great on the same WiFi). No app, no account.
 *
 * Both sides speak the same `RemoteMessage` protocol as the BroadcastChannel
 * transport, so the Stage and Remote UIs are identical regardless of transport.
 */
import { Peer, type DataConnection } from 'peerjs';
import type { RemoteMessage } from './remote';

/** Minimal shared shape: send/receive messages and tear down. */
export interface Link {
  send(msg: RemoteMessage): void;
  onMessage(cb: (m: RemoteMessage) => void): () => void;
  close(): void;
}

export interface StagePeer extends Link {
  /** The current peer id (empty until the signaling socket opens). */
  id(): string;
  /** Subscribe to (open, connectedRemotes) status changes. */
  onStatus(cb: (open: boolean, peers: number) => void): () => void;
}

export interface RemotePeer extends Link {
  /** Subscribe to connection-open changes. */
  onStatus(cb: (connected: boolean) => void): () => void;
}

function shortId(): string {
  // PeerJS ids must be URL-safe; keep them short so the QR stays low-density.
  return 'sp' + Math.random().toString(36).slice(2, 8);
}

/** Host side (the Stage): accepts many phone connections, broadcasts to all. */
export function createStagePeer(): StagePeer {
  const listeners = new Set<(m: RemoteMessage) => void>();
  const statusCbs = new Set<(open: boolean, peers: number) => void>();
  const conns = new Set<DataConnection>();
  let peer: Peer | null = null;
  let myId = '';
  let opened = false;

  const notify = () => statusCbs.forEach((cb) => cb(opened, conns.size));

  function init(id: string) {
    const p = new Peer(id);
    peer = p;
    p.on('open', (pid) => {
      myId = pid;
      opened = true;
      notify();
    });
    p.on('connection', (conn) => {
      conn.on('open', () => {
        conns.add(conn);
        notify();
      });
      conn.on('data', (data) => listeners.forEach((cb) => cb(data as RemoteMessage)));
      conn.on('close', () => {
        conns.delete(conn);
        notify();
      });
      conn.on('error', () => {
        conns.delete(conn);
        notify();
      });
    });
    p.on('error', (err: { type?: string }) => {
      // Collisions on the chosen id are rare; just try a fresh one.
      if (err?.type === 'unavailable-id') {
        try {
          p.destroy();
        } catch {
          /* ignore */
        }
        init(shortId());
      }
    });
  }

  init(shortId());

  return {
    id: () => myId,
    send(msg) {
      for (const c of conns) if (c.open) c.send(msg);
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onStatus(cb) {
      statusCbs.add(cb);
      cb(opened, conns.size);
      return () => statusCbs.delete(cb);
    },
    close() {
      listeners.clear();
      statusCbs.clear();
      for (const c of conns) {
        try {
          c.close();
        } catch {
          /* ignore */
        }
      }
      conns.clear();
      try {
        peer?.destroy();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Phone side: connects to the Stage's id, with light auto-reconnect. */
export function createRemotePeer(stageId: string): RemotePeer {
  const listeners = new Set<(m: RemoteMessage) => void>();
  const statusCbs = new Set<(connected: boolean) => void>();
  let peer: Peer | null = null;
  let conn: DataConnection | null = null;
  let connected = false;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const notify = () => statusCbs.forEach((cb) => cb(connected));

  function scheduleRetry() {
    if (closed || retry) return;
    retry = setTimeout(() => {
      retry = null;
      if (!closed && !connected) connect();
    }, 2000);
  }

  function connect() {
    if (closed) return;
    const c = peer!.connect(stageId, { reliable: true });
    conn = c;
    c.on('open', () => {
      connected = true;
      notify();
    });
    c.on('data', (d) => listeners.forEach((cb) => cb(d as RemoteMessage)));
    c.on('close', () => {
      connected = false;
      notify();
      scheduleRetry();
    });
    c.on('error', () => {
      connected = false;
      notify();
      scheduleRetry();
    });
  }

  const p = new Peer();
  peer = p;
  p.on('open', () => connect());
  p.on('error', () => {
    connected = false;
    notify();
    scheduleRetry();
  });

  return {
    send(msg) {
      if (conn && connected) conn.send(msg);
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onStatus(cb) {
      statusCbs.add(cb);
      cb(connected);
      return () => statusCbs.delete(cb);
    },
    close() {
      closed = true;
      if (retry) clearTimeout(retry);
      listeners.clear();
      statusCbs.clear();
      try {
        conn?.close();
      } catch {
        /* ignore */
      }
      try {
        peer?.destroy();
      } catch {
        /* ignore */
      }
    },
  };
}
