/**
 * Track F — keyboard shortcuts for performance mode.
 *
 * Mapping (per CONTRACTS.md):
 *   Space          → toggle auto-scroll
 *   ArrowRight/Left → next / prev song (respecting RTL: in RTL, Right = prev)
 *   ArrowUp/Down    → scroll speed up / down
 *   + / =           → font size up
 *   - / _           → font size down
 *   F               → toggle fullscreen
 *   Escape          → exit performance
 *
 * Ignored when focus is inside an editable field (input/textarea/select/
 * contenteditable) so typing never triggers transport. Returns an uninstaller.
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
  /** When true, horizontal arrows are mirrored (Right = prev, Left = next). */
  rtl?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function installShortcuts(handlers: ShortcutHandlers): () => void {
  function onKey(e: KeyboardEvent): void {
    // Never hijack keys while the user is typing or using modifier combos.
    if (isEditableTarget(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const rtl = handlers.rtl ?? false;

    switch (e.key) {
      case ' ':
      case 'Spacebar': // legacy key name
        e.preventDefault();
        handlers.toggleScroll();
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (rtl) handlers.prev();
        else handlers.next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (rtl) handlers.next();
        else handlers.prev();
        break;
      case 'ArrowUp':
        e.preventDefault();
        handlers.speedUp();
        break;
      case 'ArrowDown':
        e.preventDefault();
        handlers.speedDown();
        break;
      case '+':
      case '=':
        e.preventDefault();
        handlers.fontUp();
        break;
      case '-':
      case '_':
        e.preventDefault();
        handlers.fontDown();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        handlers.fullscreen();
        break;
      case 'Escape':
        e.preventDefault();
        handlers.exit();
        break;
      default:
        break;
    }
  }

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
