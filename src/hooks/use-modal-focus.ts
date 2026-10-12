import { useEffect, useRef, type RefObject } from 'react';
import { useBodyScrollLock } from './use-body-scroll-lock';
const dialogs: HTMLElement[] = [];

export function useModalFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useBodyScrollLock(open);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    dialogs.push(dialog);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
    )).filter(element => element.getClientRects().length > 0);
    (focusable()[0] || dialog).focus({ preventScroll: true });
    const handleKey = (event: KeyboardEvent) => {
      if (dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      } else if (event.key === 'Tab') {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); dialog.focus(); return; }
        if (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      const top = dialogs[dialogs.length - 1] === dialog;
      const index = dialogs.lastIndexOf(dialog);
      if (index >= 0) dialogs.splice(index,1);
      if (top && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
