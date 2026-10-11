import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { storeSetup, type SetupTarget } from '../src/utils/store-setup';

export function StoreSetupChecklist({ configs, productCount, onConfigure }: {
  configs: Record<string, unknown>; productCount: number; onConfigure: (target: SetupTarget) => void;
}) {
  const checks = storeSetup(configs, productCount);
  const pending = checks.filter(check => !check.ready).length;
  if (!pending) return null;
  return <details className="bg-zinc-900 border border-amber-400/25 rounded-2xl p-5" aria-label="Preparar a loja">
    <summary className="font-bold cursor-pointer min-h-11 flex items-center justify-between gap-3">
      <span>Preparar a loja</span><span className="text-sm text-amber-300">{pending} pendente{pending > 1 ? 's' : ''}</span>
    </summary>
    <p className="text-sm text-zinc-400 mt-2 mb-4">Revise antes de divulgar. Esta lista confere os dados salvos; não substitui um pedido de teste.</p>
    <ul className="space-y-3">
      {checks.map(check => <li key={check.id} className="flex items-start gap-3 border-t border-white/5 pt-3">
        {check.ready ? <CheckCircle2 size={20} className="text-green-400 shrink-0 mt-1" aria-hidden="true" /> : <Circle size={20} className="text-amber-300 shrink-0 mt-1" aria-hidden="true" />}
        <div className="min-w-0 flex-1"><p className="font-bold text-sm">{check.label}<span className="sr-only">: {check.ready ? 'Salvo' : 'Pendente'}</span></p><p className="text-sm text-zinc-400 mt-1">{check.detail}</p>
          {!check.ready && <button type="button" onClick={() => onConfigure(check.target)} className="min-h-11 text-amber-300 font-bold text-sm inline-flex items-center gap-2" aria-label={`Configurar ${check.label}`}>Configurar <ArrowRight size={16} aria-hidden="true" /></button>}
        </div>
      </li>)}
    </ul>
  </details>;
}
