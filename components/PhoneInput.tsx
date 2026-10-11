import React, { useLayoutEffect, useRef } from 'react';
import { formatWhatsApp } from '../src/utils/phone-input';

// Keep the caret tied to digits, so deleting a mask character deletes the
// intended digit instead of immediately recreating the separator.
export function PhoneInput({ value, onValueChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onValueChange: (digits: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const restoreCaret = () => {
    if (!ref.current || caret.current === null) return;
    const text = ref.current.value;
    let position = 0, digits = 0;
    while (position < text.length && digits < caret.current) {
      if (/\d/.test(text[position])) digits++;
      position++;
    }
    ref.current.setSelectionRange(position, position);
    caret.current = null;
  };
  useLayoutEffect(restoreCaret, [value]);
  return <input {...props} ref={ref} type="tel" inputMode="tel" autoComplete="tel" value={formatWhatsApp(value)} onChange={event => {
    let position = event.target.value.slice(0, event.target.selectionStart ?? 0).replace(/\D/g, '').length;
    let next = event.target.value.replace(/\D/g, '').slice(0, 13);
    const previous = value.replace(/\D/g, '');
    const inputType = (event.nativeEvent as InputEvent).inputType;
    // Mobile keyboards can delete separators without firing a Backspace key.
    if (next === previous && event.target.value !== formatWhatsApp(value)) {
      if (inputType === 'deleteContentBackward' && position > 0) {
        position--; next = previous.slice(0, position) + previous.slice(position + 1);
      } else if (inputType === 'deleteContentForward') {
        next = previous.slice(0, position) + previous.slice(position + 1);
      }
    }
    caret.current = position;
    onValueChange(next);
    requestAnimationFrame(restoreCaret);
  }} onKeyDown={event => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || (event.key !== 'Backspace' && event.key !== 'Delete')) return;
    const input = event.currentTarget, text = input.value;
    let start = text.slice(0, input.selectionStart ?? 0).replace(/\D/g, '').length;
    let end = text.slice(0, input.selectionEnd ?? 0).replace(/\D/g, '').length;
    const digits = value.replace(/\D/g, '');
    if (start === end) {
      if (event.key === 'Backspace') start = Math.max(0, start - 1);
      else end = Math.min(digits.length, end + 1);
    }
    event.preventDefault(); caret.current = start;
    onValueChange(digits.slice(0, start) + digits.slice(end));
    requestAnimationFrame(restoreCaret);
  }} />;
}
