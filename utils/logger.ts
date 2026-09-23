export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'system';
  args: string;
}

type LogListener = (logs: LogEntry[]) => void;

class LoggerManager {
  private logs: LogEntry[] = [];
  private listeners: LogListener[] = [];
  private maxLogs = 500;
  private originalConsole: Record<string, any> = {};

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Evitar inicialização dupla
    if ((window as any).__vovo_logger_initialized) {
      this.logs = (window as any).__vovo_logs || [];
      return;
    }
    (window as any).__vovo_logger_initialized = true;
    (window as any).__vovo_logs = this.logs;

    const self = this;
    const types: ('log' | 'info' | 'warn' | 'error')[] = ['log', 'info', 'warn', 'error'];

    types.forEach(type => {
      const orig = (console as any)[type];
      this.originalConsole[type] = orig;

      (console as any)[type] = function (...args: any[]) {
        // Chamar console original primeiro
        if (orig) {
          try {
            orig.apply(console, args);
          } catch (e) {
            // Ignorar possíveis erros na chamada original do console
          }
        }
        
        self.addLog(type, args);
      };
    });

    // Erros globais não capturados
    window.addEventListener('error', (event) => {
      self.addLog('error', [`Erro não tratado: ${event.message}`, `no arquivo ${event.filename}:${event.lineno}:${event.colno}`]);
    });

    // Rejeições de Promessa não tratadas (ex: falhas de requisição fetch sem .catch)
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : '';
      self.addLog('error', [`Promessa rejeitada não tratada: ${msg}`, stack].filter(Boolean));
    });

    this.addLog('system', ['Log interceptor inicializado. Monitorando conexões e erros.']);
  }

  private addLog(type: 'log' | 'info' | 'warn' | 'error' | 'system', args: any[]) {
    const serializedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    const date = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`;

    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp,
      type,
      args: serializedArgs
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notificar assinantes
    this.listeners.forEach(l => {
      try {
        l([...this.logs]);
      } catch (e) {
        // Ignorar falhas na renderização de callbacks
      }
    });
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.push(listener);
    listener([...this.logs]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public clear() {
    this.logs.length = 0;
    this.addLog('system', ['Console de depuração limpo.']);
  }

  public getCopyableText(): string {
    return this.logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.args}`).join('\n');
  }
}

export const logger = new LoggerManager();
