import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import AdminPage from './pages/AdminPage';
import { ChefHat, ShoppingBag, ShieldCheck } from 'lucide-react';

export default function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      setCurrentHash(hash);
      
      // Atualização dinâmica de Metadados
      if (hash === '#vovo-secreta') {
        document.title = "Painel Secreto da Vovó 👵🔒 | Gestão & KDS";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'Painel de gestão operacional, KDS de cozinha, pedidos e financeiro da Delícias da Vovó Grazy.');
      } else {
        document.title = "Delícias da Vovó Grazy 🥟 | Salgados, Empanadas & Doces";
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', 'O melhor tempero da cidade! Salgados fritos na hora, empanadas autênticas e Massa com tempero de Mãe.');
      }
    };
    
    handleHashChange(); // Executa na montagem
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const isAdmin = currentHash === '#vovo-secreta';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-900 selection:bg-vovoh-red selection:text-white">
      {/* Barra de atalho de portfólio no Desktop */}
      <div className="hidden desktop:flex fixed top-3 right-4 z-[9999] bg-zinc-900/90 backdrop-blur-md border border-white/10 text-white rounded-full px-4 py-2 shadow-2xl items-center gap-3 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-zinc-400">
          <ChefHat size={15} className="text-vovoh-red" />
          Portfólio:
        </span>
        <button
          onClick={() => { window.location.hash = isAdmin ? '' : '#vovo-secreta'; }}
          className="px-3 py-1 bg-vovoh-red hover:bg-red-600 text-white font-extrabold rounded-full transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-red-900/30"
        >
          {isAdmin ? (
            <>
              <ShoppingBag size={13} />
              Ver Cardápio (Cliente)
            </>
          ) : (
            <>
              <ShieldCheck size={13} />
              Ver Painel Admin / KDS
            </>
          )}
        </button>
      </div>

      {isAdmin ? (
        <div className="w-full min-h-screen bg-vovoh-dark text-white">
          <AdminPage />
        </div>
      ) : (
        <div className="w-full min-h-screen desktop:max-w-[480px] desktop:mx-auto desktop:shadow-[0_0_60px_rgba(0,0,0,0.6)] desktop:border-x desktop:border-zinc-800 bg-[#F9F9F9] relative">
          <Home />
        </div>
      )}
    </div>
  );
}
