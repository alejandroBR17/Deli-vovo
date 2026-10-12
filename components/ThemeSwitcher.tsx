import React, {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Sun, Moon, Monitor, Check} from 'lucide-react';
import {ThemeMode, useTheme} from '../src/theme/ThemeProvider';

const choices = [{mode:'system', name:'Dispositivo', note:'Acompanha o tema do seu aparelho', Icon:Monitor}, {mode:'light', name:'Claro', note:'Cores quentes e fundo claro', Icon:Sun}, {mode:'dark', name:'Escuro', note:'Mais conforto em ambientes escuros', Icon:Moon}] as const;

export function ThemeSwitcher() {
  const {mode, resolved, setMode} = useTheme();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({left:16, top:64});
  const menuId = useId();
  const Icon = mode === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun;
  useLayoutEffect(() => {
    if (!open || !trigger.current || !menu.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const size = menu.current.getBoundingClientRect();
    setPosition({left:Math.max(16, Math.min(anchor.right-size.width, window.innerWidth-size.width-16)), top:anchor.bottom+8+size.height <= window.innerHeight-16 ? anchor.bottom+8 : Math.max(16, anchor.top-size.height-8)});
  }, [open]);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus({preventScroll:true});
    const outside = (event: PointerEvent) => {if (!root.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);};
    const resize = () => setOpen(false);
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', resize);
    return () => {document.removeEventListener('pointerdown', outside);window.removeEventListener('resize', resize);};
  }, [open]);
  const choose = (next: ThemeMode) => {setMode(next);setOpen(false);trigger.current?.focus();};
  return <div ref={root} className="theme-switcher">
    <button ref={trigger} type="button" aria-label="Alterar tema" title="Tema claro, escuro ou do dispositivo" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen(!open)} className="theme-trigger"><Icon size={20} aria-hidden="true" /><span>Tema</span></button>
    {open && createPortal(<div ref={menu} id={menuId} role="menu" aria-label="Aparência" className="theme-menu" style={position} onKeyDown={event => {
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Escape') {event.preventDefault();setOpen(false);trigger.current?.focus();}
      if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {event.preventDefault();items[event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : (current+(event.key === 'ArrowDown' ? 1 : -1)+items.length)%items.length]?.focus();}
      if (event.key === 'Tab') {event.preventDefault();setOpen(false);trigger.current?.focus();}
    }}>
      <p className="theme-menu-title">Aparência</p>
      {choices.map(choice => <button key={choice.mode} type="button" role="menuitemradio" aria-label={choice.name} aria-checked={mode === choice.mode} onClick={() => choose(choice.mode)} className="theme-choice"><choice.Icon size={20} aria-hidden="true" /><span><strong>{choice.name}</strong><small>{choice.note}</small></span>{mode === choice.mode && <Check size={17} aria-hidden="true" />}</button>)}
      <p className="theme-menu-note">Ao abrir o app, usamos o tema do dispositivo.</p>
    </div>, document.body)}
  </div>;
}
