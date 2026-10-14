import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/theme.css';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { AppInstallProvider } from './components/AppInstall';
import { ensureServiceWorker } from './src/utils/service-worker';
import { initializeAppInstall } from './src/utils/app-install';

initializeAppInstall();

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

// Os avisos precisam estar disponíveis mesmo com imagens ainda carregando.
if ('serviceWorker' in navigator) {
  void ensureServiceWorker().catch(() => {
    // O botão de ativar tenta novamente e apresenta a falha ao usuário.
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
      <ThemeProvider><AppInstallProvider><App /></AppInstallProvider></ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
