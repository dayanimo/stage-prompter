<script lang="ts">
  /**
   * Pairing overlay shown on the Stage. Renders a QR encoding the remote URL
   * (#remote?p=<peerId>) so a phone on the same WiFi can scan it and connect
   * over WebRTC. Also offers a same-machine remote window (BroadcastChannel).
   */
  import QRCode from 'qrcode';

  interface Props {
    url: string; // full remote URL to encode, '' until the peer id is ready
    ready: boolean; // signaling socket open (peer id assigned)
    peers: number; // connected remotes
    onOpenLocal: () => void;
    onClose: () => void;
  }
  let { url, ready, peers, onOpenLocal, onClose }: Props = $props();

  let qr = $state('');

  $effect(() => {
    if (!url) {
      qr = '';
      return;
    }
    QRCode.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: 'M' })
      .then((d) => (qr = d))
      .catch(() => (qr = ''));
  });
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>

<div class="sheet" role="dialog" aria-modal="true" aria-label="חיבור שלט">
  <header>
    <h2>שלט מהטלפון</h2>
    <button class="x" onclick={onClose} aria-label="סגור">✕</button>
  </header>

  <div class="body">
    {#if !ready || !qr}
      <div class="qr placeholder" aria-busy="true"><span>מכין חיבור…</span></div>
    {:else}
      <img class="qr" src={qr} alt="קוד QR לחיבור הטלפון" width="320" height="320" />
    {/if}

    <ol class="steps">
      <li>סרוק את הקוד מהטלפון (מצלמה רגילה).</li>
      <li>הטלפון יפתח את השלט בדפדפן ויתחבר אוטומטית.</li>
      <li>ודאו ששני המכשירים על אותה רשת WiFi.</li>
    </ol>

    {#if url}
      <code class="url" aria-label="כתובת השלט">{url.replace(/^https?:\/\//, '')}</code>
    {/if}

    <div class="status" aria-live="polite">
      <span class="dot" class:on={peers > 0}></span>
      {#if peers > 0}
        מחוברים: {peers}
      {:else if ready}
        ממתין לטלפון…
      {:else}
        מתחבר לשרת האיתות…
      {/if}
    </div>

    <button class="local" onclick={onOpenLocal}>או פתח שלט בחלון על מחשב זה</button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: oklch(0 0 0 / 0.65);
    z-index: var(--z-modal-backdrop, 60);
  }
  .sheet {
    position: fixed;
    z-index: var(--z-modal, 61);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, 92vw);
    background: var(--surface);
    border: 1px solid var(--border-2);
    border-radius: var(--r-lg);
    box-shadow: 0 24px 64px oklch(0 0 0 / 0.5);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sp-4) var(--sp-5);
    border-bottom: 1px solid var(--border);
  }
  header h2 {
    margin: 0;
    font-size: var(--text-md);
  }
  .x {
    background: none;
    border: none;
    color: var(--ink-3);
    cursor: pointer;
    font-size: var(--text-md);
  }
  .x:hover {
    color: var(--ink);
  }
  .body {
    padding: var(--sp-5);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-4);
  }
  .qr {
    width: 280px;
    height: 280px;
    border-radius: var(--r-md);
    background: #fff;
    padding: var(--sp-3);
  }
  .qr.placeholder {
    display: grid;
    place-items: center;
    background: var(--surface-2);
    color: var(--ink-3);
    font-size: var(--text-sm);
  }
  .steps {
    margin: 0;
    padding-inline-start: var(--sp-5);
    color: var(--ink-2);
    font-size: var(--text-sm);
    line-height: 1.7;
    align-self: stretch;
  }
  .url {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-3);
    word-break: break-all;
    text-align: center;
    direction: ltr;
  }
  .status {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    font-size: var(--text-sm);
    color: var(--ink-2);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--r-full);
    background: var(--beat-idle, var(--border-2));
  }
  .dot.on {
    background: var(--accent);
    box-shadow: 0 0 10px color-mix(in oklch, var(--accent) 75%, transparent);
  }
  .local {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--ink-2);
    font: inherit;
    font-size: var(--text-sm);
    padding: var(--sp-3) var(--sp-4);
    cursor: pointer;
  }
  .local:hover {
    background: var(--surface-3);
    color: var(--ink);
  }
  .x:focus-visible,
  .local:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
