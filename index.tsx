import './utils/logger'; // Inicializa a interceptação de logs o quanto antes
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Força a atualização do cache para todos os usuários
const APP_VERSION = '1.1.0-urgent-update';
if (localStorage.getItem('vovoh_app_version') !== APP_VERSION) {
  localStorage.setItem('vovoh_app_version', APP_VERSION);
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (let name of names) caches.delete(name);
    });
  }
  // Evita reload infinito verificando se já recarregou recentemente (opcional, mas seguro)
  if (!sessionStorage.getItem('just_reloaded')) {
    sessionStorage.setItem('just_reloaded', 'true');
    window.location.reload();
  } else {
    sessionStorage.removeItem('just_reloaded');
  }
}

// Ativando a magia do Aplicativo (PWA) e garantindo atualizações
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Verifica ativamente se há atualizações no Service Worker
      registration.update();
      
      // Tenta atualizar sempre que a aba ficar visível novamente
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update();
        }
      });
    }).catch((err) => {
      console.log('SW falhou, mas a vovó garante que o site funciona: ', err);
    });

    // Atualiza a página automaticamente quando um novo Service Worker assumir o controle
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        // window.location.reload(); // Desativado temporariamente para evitar loops em produção
        console.log("Nova versão disponível. Recarregue para atualizar.");
      }
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, fontFamily: 'sans-serif', color: '#333' }}>
          <h1 style={{ color: '#e11d48' }}>Ops! Algo deu errado.</h1>
          <p>A vovó encontrou um problema técnico.</p>
          <pre style={{ background: '#f1f5f9', padding: 10, borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, padding: '10px 20px', background: '#e11d48', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold' }}
          >
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);