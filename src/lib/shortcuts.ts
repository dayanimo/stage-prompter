/**
 * Track F — keyboard shortcuts for performance mode.
 *
 * Mapping:
 *   Space            → toggle play / pause (or advance line in 2-line mode)
 *   ArrowUp/Down     → scroll up / down   (manual nudge of the auto-scroll)
 *   ArrowLeft/Right  → scroll speed down / up
 *   PageUp/PageDown  → previous / next song
 *   + / =            → font size up
 *   - / _            → font size down
 *   F                → toggle fullscreen
 *   Escape           → exit performance
 *
 * The caller (Stage) decides what each arrow does per mode — these are just the
 * raw arrow callbacks. Ignored when focus is inside an editable field so typing
 * never triggers transport. Returns an uninstaller.
 */
export interface ShortcutHandlers {
  toggleScroll(): void;
  arrowUp(): void;
  arrowDown(): void;
  arrowLeft(): void;
  arrowRight(): void;
  pageUp(): void;
  pageDown(): void;
  fontUp(): void;
  fontDown(): void;
  fullscreen(): void;
  exit(): void;
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

    switch (e.key) {
      case ' ':
      case 'Spacebar': // legacy key name
        e.preventDefault();
        handlers.toggleScroll();
        break;
      case 'ArrowUp':
        e.preventDefault();
        handlers.arrowUp();
        break;
      case 'ArrowDown':
        e.preventDefault();
        handlers.arrowDown();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        handlers.arrowLeft();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handlers.arrowRight();
        break;
      case 'PageUp':
        e.preventDefault();
        handlers.pageUp();
        break;
      case 'PageDown':
        e.preventDefault();
        handlers.pageDown();
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
