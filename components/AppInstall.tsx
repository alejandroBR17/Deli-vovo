import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Smartphone, Share, Monitor, Check, X } from 'lucide-react';
import { useModalFocus } from '../src/hooks/use-modal-focus';
import {reportAppInstallation} from '../src/utils/install-tracking';
import {getInstallPrompt, subscribeInstallPrompt, takeInstallPrompt} from '../src/utils/app-install';
import {detectInstalledApp, type RelatedApp} from '../src/utils/installed-app';

const InstallContext = createContext<{ open: () => void; standalone: boolean; installed: boolean; requested: boolean; busy: boolean }>({ open: () => {}, standalone: false, installed: false, requested: false, busy: false });
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

export function AppInstallProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [standalone, setStandalone] = useState(isStandalone);
  const [prompt, setPrompt] = useState(getInstallPrompt);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'android' | 'ios' | 'pc'>(() => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'pc');
  const ref = useRef<HTMLDivElement>(null);
  const installing = useRef(false);
  const mounted = useRef(false);
  const checking = useRef(false);
  const titleId = React.useId();
  const checkInstalled = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    const status = await detectInstalledApp(location.origin, navigator as Navigator & {getInstalledRelatedApps?: () => Promise<RelatedApp[]>});
    checking.current = false;
    if (!mounted.current) return;
    setInstalled(status === 'installed');
    if (status === 'installed') {setRequested(false); void reportAppInstallation();}
  }, []);
  useModalFocus(ref, visible, () => setVisible(false));
  useEffect(() => {
    mounted.current = true;
    const media = window.matchMedia('(display-mode: standalone)');
    const change = () => {setStandalone(isStandalone());if(isStandalone())void reportAppInstallation();};
    const updatePrompt = () => {setPrompt(getInstallPrompt()); if (getInstallPrompt()) {setInstalled(false); setRequested(false);}};
    const unsubscribe = subscribeInstallPrompt(updatePrompt);
    updatePrompt();
    const confirmed = () => {setRequested(true); setMessage('Instalação confirmada pelo navegador. Quando terminar, abra pelo ícone na tela inicial.');void reportAppInstallation(); change(); void checkInstalled();};
    const online=()=>{if(isStandalone())void reportAppInstallation();};
    online();window.addEventListener('online',online);
    window.addEventListener('appinstalled', confirmed);
    const recheck = () => {if (document.visibilityState === 'visible') void checkInstalled();};
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);
    void checkInstalled();
    media.addEventListener('change', change);
    return () => {mounted.current = false; unsubscribe(); window.removeEventListener('online',online); window.removeEventListener('appinstalled', confirmed); window.removeEventListener('focus',recheck); document.removeEventListener('visibilitychange',recheck); media.removeEventListener('change', change); };
  }, [checkInstalled]);
  useEffect(() => {
    if (!requested) return;
    // Bounded local checks while Android creates its WebAPK; never query the database.
    const timers = [2000, 8000, 20000].map(delay => setTimeout(() => void checkInstalled(), delay));
    return () => timers.forEach(clearTimeout);
  }, [requested, checkInstalled]);
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
      if (outcome === 'accepted') {setRequested(true); void checkInstalled();}
      setMessage(outcome === 'accepted' ? 'Instalação solicitada. Quando terminar, abra pelo ícone do app.' : 'Você pode instalar depois pelo menu do navegador.');
    } catch { setMessage('Não foi possível abrir a instalação. Tente pelo menu do navegador.'); setVisible(true); }
    finally { installing.current = false; setBusy(false); }
  }, [checkInstalled]);
  const open = useCallback(() => {
    if (installing.current) return;
    setMessage('');
    void checkInstalled();
    if (!isStandalone() && !installed && !requested && getInstallPrompt()) void install();
    else setVisible(true);
  }, [install, installed, requested, checkInstalled]);
  const context = useMemo(() => ({ open, standalone, installed, requested, busy }), [open, standalone, installed, requested, busy]);
  const preview = window.location.hostname.endsWith('.vercel.app') && window.location.hostname !== 'delivovo.vercel.app';
  return <InstallContext.Provider value={context}>
    {children}
    {visible && createPortal(<div className="install-overlay">
      <div className="install-backdrop" onClick={() => setVisible(false)} />
      <div ref={ref} className="install-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <header><div className="install-heading"><Smartphone size={24} aria-hidden="true" /><h2 id={titleId}>O app da Vovó, sempre à mão</h2></div><button type="button" aria-label="Fechar instalação" onClick={() => setVisible(false)}><X size={22} /></button></header>
        <div className="install-body">
          {standalone || installed ? <p role="status" className="install-notice"><Check size={20} aria-hidden="true" />{standalone ? 'Você já está usando o aplicativo.' : 'O aplicativo já está instalado neste aparelho. Abra pelo ícone na tela inicial ou na lista de aplicativos.'}</p> : requested ? <p role="status" className="install-notice">Instalação solicitada. O navegador pode levar alguns instantes para criar o app. Abra pelo ícone quando terminar.</p> : <><p>Tenha um ícone para abrir a loja e acompanhar os pedidos, sem procurar o link novamente.</p>{prompt && <button type="button" className="install-primary" onClick={install} disabled={busy}><Download size={20} aria-hidden="true" />{busy ? 'Abrindo instalação…' : 'Instalar aplicativo'}</button>}</>}
          {!standalone && (installed || requested) && <button type="button" className="install-secondary" onClick={() => void checkInstalled()}>Verificar instalação novamente</button>}
          {message && !installed && !standalone && !requested && <p role="status" className="install-notice">{message}</p>}
          {!standalone && !installed && !requested && !prompt && !busy && !message && <p role="status" className="install-notice">Não conseguimos confirmar se o app já está instalado. Se ele estiver na lista de aplicativos, abra por lá. Caso contrário, use as instruções abaixo.</p>}
          {!standalone && !installed && !requested && !prompt && !busy && <a href="/instalar.html" className="install-secondary">Abrir página de instalação</a>}
          {!standalone && !installed && !requested && <><div className="install-tabs" role="group" aria-label="Instruções por dispositivo">{(['android','ios','pc'] as const).map(value => <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === 'pc' ? <Monitor size={18} aria-hidden="true" /> : <Smartphone size={18} aria-hidden="true" />}{value === 'ios' ? 'iPhone / iPad' : value === 'pc' ? 'PC / Mac' : 'Android'}</button>)}</div>
          <section className="install-instructions" aria-label="Como instalar">
            {tab === 'ios' ? <><h3>No iPhone ou iPad</h3><ol><li>Abra este endereço no Safari.</li><li>Toque em <strong>Compartilhar</strong> <Share size={16} aria-label="ícone de compartilhar" />, depois em <strong>Adicionar à Tela de Início</strong>.</li><li>Confirme em <strong>Adicionar</strong> e abra pelo novo ícone.</li></ol><p>Para receber avisos, use iOS 16.4 ou superior e permita as notificações dentro do app instalado.</p></> : tab === 'android' ? <><h3>No Android</h3><ol><li>Abra este endereço no Chrome, fora do navegador do WhatsApp ou Instagram.</li><li>Toque em <strong>Instalar aplicativo</strong>, quando disponível, ou abra o menu do Chrome e procure <strong>Instalar app</strong> / <strong>Adicionar à tela inicial</strong>.</li><li>Abra pelo ícone criado na tela inicial.</li></ol></> : <><h3>No computador</h3><ol><li>Abra este endereço no Chrome ou Edge.</li><li>Use o botão de instalar, quando disponível, ou a opção de aplicativos no menu do navegador.</li><li>No Safari do Mac compatível, use <strong>Arquivo → Adicionar ao Dock</strong>.</li></ol></>}
          </section>
          </>}
          {!standalone && !installed && !requested && <p className="install-note"><strong>Já instalou?</strong> Abra pelo ícone na tela inicial, no Dock ou na lista de aplicativos. O navegador não permite que este botão abra uma instalação existente em todos os dispositivos.</p>}
          <p className="install-note">Os avisos de pedidos são exclusivos do painel da Vovó. A loja pode ativá-los no painel depois de instalar; com a tela bloqueada, dependem da permissão do aparelho e de conexão com a internet. Clientes acompanham o andamento na tela Pedidos.</p>
          {preview && <p className="install-note">Esta é uma prévia de testes. Se aparecer “não foi possível instalar”, a proteção de acesso pode estar bloqueando a instalação. Um novo endereço de prévia exige instalar e ativar os avisos novamente.</p>}
          <button type="button" className="install-secondary" onClick={() => setVisible(false)}>{standalone ? 'Continuar no aplicativo' : 'Continuar pelo navegador'}</button>
        </div>
      </div>
    </div>, document.body)}
  </InstallContext.Provider>;
}

export function AppInstallButton({ compact = false }: { compact?: boolean }) {
  const { open, standalone, installed, requested, busy } = useContext(InstallContext);
  const label = standalone ? 'Sobre o aplicativo' : busy ? 'Abrindo instalação…' : installed ? 'Aplicativo já instalado' : requested ? 'Instalação solicitada' : 'Instalar aplicativo';
  return <button type="button" onClick={open} disabled={busy} aria-busy={busy} className={compact ? 'install-trigger' : 'install-entry'} aria-label={label} title={label}>{standalone || installed ? <Check size={20} aria-hidden="true" /> : <Smartphone size={20} aria-hidden="true" />}{!compact && <span>{standalone ? 'Você está no aplicativo' : label}</span>}</button>;
}
