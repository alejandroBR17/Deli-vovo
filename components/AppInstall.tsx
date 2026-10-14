import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, Share, Monitor, Check, X } from 'lucide-react';
import { useModalFocus } from '../src/hooks/use-modal-focus';
import {reportAppInstallation} from '../src/utils/install-tracking';
import {getInstallPrompt, subscribeInstallPrompt, takeInstallPrompt} from '../src/utils/app-install';

const InstallContext = createContext<{ open: () => void; standalone: boolean; busy: boolean }>({ open: () => {}, standalone: false, busy: false });
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

export function AppInstallProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [standalone, setStandalone] = useState(isStandalone);
  const [prompt, setPrompt] = useState(getInstallPrompt);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'android' | 'ios' | 'pc'>(() => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'pc');
  const ref = useRef<HTMLDivElement>(null);
  const installing = useRef(false);
  const titleId = React.useId();
  useModalFocus(ref, visible, () => setVisible(false));
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const change = () => {setStandalone(isStandalone());if(isStandalone())void reportAppInstallation();};
    const updatePrompt = () => setPrompt(getInstallPrompt());
    const unsubscribe = subscribeInstallPrompt(updatePrompt);
    updatePrompt();
    const installed = () => { setMessage('Instalado! Abra pelo ícone na tela inicial ou na lista de aplicativos.');void reportAppInstallation(); change(); };
    const online=()=>{if(isStandalone())void reportAppInstallation();};
    online();window.addEventListener('online',online);
    window.addEventListener('appinstalled', installed);
    media.addEventListener('change', change);
    return () => {unsubscribe(); window.removeEventListener('online',online); window.removeEventListener('appinstalled', installed); media.removeEventListener('change', change); };
  }, []);
  const install = useCallback(async () => {
    if (installing.current) return;
    const event = takeInstallPrompt();
    if (!event) { setVisible(true); return; }
    installing.current = true;
    setBusy(true); setMessage('');
    try {
      // Call before the first await, in the original button's user gesture.
      await event.prompt();
      const { outcome } = await event.userChoice;
      setMessage(outcome === 'accepted' ? 'Instalação solicitada. Quando terminar, abra pelo ícone do app.' : 'Você pode instalar depois pelo menu do navegador.');
    } catch { setMessage('Não foi possível abrir a instalação. Tente pelo menu do navegador.'); setVisible(true); }
    finally { installing.current = false; setBusy(false); }
  }, []);
  const open = useCallback(() => {
    if (installing.current) return;
    setMessage('');
    if (!isStandalone() && getInstallPrompt()) void install();
    else setVisible(true);
  }, [install]);
  const context = useMemo(() => ({ open, standalone, busy }), [open, standalone, busy]);
  const preview = window.location.hostname.endsWith('.vercel.app') && window.location.hostname !== 'delivovo.vercel.app';
  return <InstallContext.Provider value={context}>
    {children}
    {visible && createPortal(<div className="install-overlay">
      <div className="install-backdrop" onClick={() => setVisible(false)} />
      <div ref={ref} className="install-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header><div className="install-heading"><Smartphone size={24} aria-hidden="true" /><h2 id={titleId}>O app da Vovó, sempre à mão</h2></div><button type="button" aria-label="Fechar instalação" onClick={() => setVisible(false)}><X size={22} /></button></header>
        <div className="install-body">
          {standalone ? <p className="install-notice"><Check size={20} aria-hidden="true" /> Você já está usando o aplicativo.</p> : <><p>Tenha um ícone para abrir a loja e acompanhar os pedidos, sem procurar o link novamente.</p>{prompt && <button type="button" className="install-primary" onClick={install} disabled={busy}><Download size={20} aria-hidden="true" />{busy ? 'Abrindo instalação…' : 'Instalar aplicativo'}</button>}</>}
          {message && <p role="status" className="install-notice">{message}</p>}
          <div className="install-tabs" role="group" aria-label="Instruções por dispositivo">{(['android','ios','pc'] as const).map(value => <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'pc' ? <Monitor size={18} aria-hidden="true" /> : <Smartphone size={18} aria-hidden="true" />}{value === 'ios' ? 'iPhone / iPad' : value === 'pc' ? 'PC / Mac' : 'Android'}</button>)}</div>
          <section className="install-instructions" aria-label="Como instalar">
            {tab === 'ios' ? <><h3>No iPhone ou iPad</h3><ol><li>Abra este endereço no Safari.</li><li>Toque em <strong>Compartilhar</strong> <Share size={16} aria-label="ícone de compartilhar" />, depois em <strong>Adicionar à Tela de Início</strong>.</li><li>Confirme em <strong>Adicionar</strong> e abra pelo novo ícone.</li></ol><p>Para receber avisos, use iOS 16.4 ou superior e permita as notificações dentro do app instalado.</p></> : tab === 'android' ? <><h3>No Android</h3><ol><li>Abra este endereço no Chrome, fora do navegador do WhatsApp ou Instagram.</li><li>Toque em <strong>Instalar aplicativo</strong>, quando disponível, ou abra o menu do Chrome e procure <strong>Instalar app</strong> / <strong>Adicionar à tela inicial</strong>.</li><li>Abra pelo ícone criado na tela inicial.</li></ol></> : <><h3>No computador</h3><ol><li>Abra este endereço no Chrome ou Edge.</li><li>Use o botão de instalar, quando disponível, ou a opção de aplicativos no menu do navegador.</li><li>No Safari do Mac compatível, use <strong>Arquivo → Adicionar ao Dock</strong>.</li></ol></>}
          </section>
          {!standalone && <p className="install-note"><strong>Já instalou?</strong> Abra pelo ícone na tela inicial, no Dock ou na lista de aplicativos. O navegador não permite que este botão abra uma instalação existente em todos os dispositivos.</p>}
          <p className="install-note">Os avisos de pedidos são exclusivos do painel da Vovó. A loja pode ativá-los no painel depois de instalar; com a tela bloqueada, dependem da permissão do aparelho e de conexão com a internet. Clientes acompanham o andamento na tela Pedidos.</p>
          {preview && <p className="install-note">Esta é uma prévia de testes. Se aparecer “não foi possível instalar”, a proteção de acesso pode estar bloqueando a instalação. Um novo endereço de prévia exige instalar e ativar os avisos novamente.</p>}
          <button type="button" className="install-secondary" onClick={() => setVisible(false)}>{standalone ? 'Continuar no aplicativo' : 'Continuar pelo navegador'}</button>
        </div>
      </div>
    </div>, document.body)}
  </InstallContext.Provider>;
}

export function AppInstallButton({ compact = false }: { compact?: boolean }) {
  const { open, standalone, busy } = useContext(InstallContext);
  const label = standalone ? 'Sobre o aplicativo' : busy ? 'Abrindo instalação…' : 'Instalar aplicativo';
  return <button type="button" onClick={open} disabled={busy} aria-busy={busy} className={compact ? 'install-trigger' : 'install-entry'} aria-label={label} title={label}><Smartphone size={20} aria-hidden="true" />{!compact && <span>{standalone ? 'Você está no aplicativo' : label}</span>}</button>;
}
