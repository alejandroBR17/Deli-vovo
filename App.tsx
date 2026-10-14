import React, { useState, useEffect, lazy, Suspense } from 'react';
import Home from './pages/Home';
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const ResetPasswordPage=lazy(()=>import('./pages/ResetPasswordPage'));


export default function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setCurrentHash(hash);
      
      const privatePage = hash === '#vovo-secreta' || hash.startsWith('#recuperar-senha') || hash === '#entrar';
      document.querySelector('meta[name="robots"]')?.setAttribute('content', privatePage ? 'noindex,nofollow' : 'index,follow,max-image-preview:large');
      // Metadados de navegação; compartilhamento continua apontando à loja pública.
      if (hash === '#vovo-secreta') {
        document.title = "Painel Secreto da Vovó  | Gestão & KDS";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'Painel de gestão operacional, KDS de cozinha, pedidos e financeiro da Delícias da Vovó Grazy.');
      } else if (hash.startsWith('#recuperar-senha')) {
        document.title = 'Recuperar senha | Delícias da Vovó Grazy';
        document.querySelector('meta[name="description"]')?.setAttribute('content', 'Recupere o acesso à sua conta na Delícias da Vovó Grazy.');
      } else if (hash === '#termos' || hash === '#privacidade') {
        document.title = (hash === '#termos' ? 'Termos de Uso' : 'Política de Privacidade') + ' | Delícias da Vovó';
        document.querySelector('meta[name="description"]')?.setAttribute('content', 'Conheça os documentos de uso e privacidade da Delícias da Vovó Grazy.');
      } else {
        document.title = "Delícias da Vovó Grazy | Salgados e doces";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'Escolha seus salgados e doces no Delícias da Vovó Grazy. Consulte o frete, faça ou agende seu pedido e acompanhe o preparo pelo site.');
      }
    };
    
    handleHashChange(); // Executa na montagem
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isAdmin = currentHash === '#vovo-secreta';
  const legal = currentHash === '#termos' ? 'terms' : currentHash === '#privacidade' ? 'privacy' : null;

  return (
    <div data-surface={isAdmin ? "admin" : "customer"} className="min-h-screen app-shell selection:bg-vovoh-red selection:text-white">
      {currentHash.startsWith('#recuperar-senha')?<Suspense fallback={<p role="status" className="p-6">Abrindo recuperação...</p>}><ResetPasswordPage/></Suspense>:legal ? <Suspense fallback={<p role="status" className="p-6">Abrindo documento...</p>}><LegalPage document={legal}/></Suspense> : isAdmin ? (
        <div className="w-full min-h-screen bg-vovoh-dark text-white">
          <Suspense fallback={<p role="status" className="p-6 text-center">Abrindo o painel...</p>}><AdminPage /></Suspense>
        </div>
      ) : (
        <div className="w-full min-h-screen relative">
          <Home />
        </div>
      )}
    </div>
  );
}
