import React, { useState, useEffect, lazy, Suspense } from 'react';
import Home from './pages/Home';
const AdminPage = lazy(() => import('./pages/AdminPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));


export default function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setCurrentHash(hash);
      
      // Atualização dinâmica de Metadados
      if (hash === '#vovo-secreta') {
        document.title = "Painel Secreto da Vovó  | Gestão & KDS";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'Painel de gestão operacional, KDS de cozinha, pedidos e financeiro da Delícias da Vovó Grazy.');
      } else {
        document.title = "Delícias da Vovó Grazy  | Salgados, Empanadas & Doces";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'O melhor tempero da cidade! Salgados fritos na hora, empanadas autênticas e Massa com tempero de Mãe.');
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
      {legal ? <Suspense fallback={<p role="status" className="p-6">Abrindo documento...</p>}><LegalPage document={legal}/></Suspense> : isAdmin ? (
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
