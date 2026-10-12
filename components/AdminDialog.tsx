import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalFocus } from '../src/hooks/use-modal-focus';
import { formatMoneyInput } from '../src/utils/money-input';

export function AdminDialog({ title, onClose, children, footer, fullScreen = false }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; fullScreen?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  useModalFocus(ref, true, onClose);
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = old; };
  }, []);
  return createPortal(
    <div data-surface="admin" className={`admin-dialog fixed inset-0 z-[600] flex items-center justify-center text-white ${fullScreen ? 'p-0 sm:p-4' : 'p-2 sm:p-4'}`}>
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`relative flex flex-col w-full min-w-0 bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden ${fullScreen ? 'h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl' : 'max-w-xl max-h-[calc(100dvh-1rem)] sm:max-h-[90dvh] rounded-2xl'}`}>
        <header className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/10 shrink-0">
          <h2 id={titleId} className="text-xl font-bold min-w-0 break-words">{title}</h2>
          <button type="button" aria-label={`Fechar ${title}`} onClick={onClose} className="p-3 shrink-0 rounded-xl bg-white/5 focus-visible:outline focus-visible:outline-2"><X size={20} /></button>
        </header>
        <div className={`min-h-0 min-w-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5 ${fullScreen ? 'flex-1' : ''}`}>{children}</div>
        {footer && <footer className="p-4 sm:p-5 border-t border-white/10 shrink-0 flex gap-3 bg-zinc-900 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>, document.body,
  );
}

export function MoneyInput({ id, label, value, onChange, hint }: { id: string; label: string; value: unknown; onChange: (value: string) => void; hint?: string }) {
  const text = typeof value === 'number' ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(value ?? '');
  return <div className="space-y-2 min-w-0">
    <label htmlFor={id} className="block font-bold text-sm">{label}</label>
    <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 focus-within:border-vovoh-red">
      <span aria-hidden="true" className="text-zinc-400 shrink-0">R$</span>
      <input id={id} type="text" inputMode="decimal" placeholder="0,00" value={text} onChange={event => onChange(event.target.value.replace(/[^\d.,]/g, ''))} onBlur={() => {
        const formatted = formatMoneyInput(text);
        if (formatted) onChange(formatted);
      }} aria-describedby={hint ? id + '-hint' : undefined} className="w-full min-w-0 py-3 bg-transparent outline-none" />
    </div>
    {hint && <p id={id + '-hint'} className="text-xs text-zinc-400">{hint}</p>}
  </div>;
}
