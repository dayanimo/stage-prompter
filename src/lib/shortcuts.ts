/**
 * PLACEHOLDER — Track F replaces this. Keyboard shortcuts for performance mode.
 */
export interface ShortcutHandlers {
  toggleScroll(): void;
  next(): void;
  prev(): void;
  fontUp(): void;
  fontDown(): void;
  speedUp(): void;
  speedDown(): void;
  fullscreen(): void;
  exit(): void;
  rtl?: boolean;
}

export function installShortcuts(handlers: ShortcutHandlers): () => void {
  function onKey(e: KeyboardEvent) {
    const rtl = handlers.rtl ?? false;
    switch (e.key) {
      case ' ': e.preventDefault(); handlers.toggleScroll(); break;
      case 'ArrowRight': rtl ? handlers.prev() : handlers.next(); break;
      case 'ArrowLeft': rtl ? handlers.next() : handlers.prev(); break;
      case 'ArrowUp': handlers.speedUp(); break;
      case 'ArrowDown': handlers.speedDown(); break;
      case '+': case '=': handlers.fontUp(); break;
      case '-': case '_': handlers.fontDown(); break;
      case 'f': case 'F': handlers.fullscreen(); break;
      case 'Escape': handlers.exit(); break;
    }
  }
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
