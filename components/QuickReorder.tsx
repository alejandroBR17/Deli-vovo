import React, { useEffect, useState } from 'react';
import { ShoppingBag, Clock, ArrowRight, RotateCcw } from 'lucide-react';
import { GAS_API_URL } from '../constants/index';

interface APIOrder {
  id: string;
  items: any[];
  itemsSummary: string;
  total: number;
  date: string;
  status: string;
}

interface QuickReorderProps {
  user: any;
  onReorder: (items: any[]) => void;
}

export const QuickReorder: React.FC<QuickReorderProps> = ({ user, onReorder }) => {
  const [lastOrder, setLastOrder] = useState<APIOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetch(`${GAS_API_URL}/orders/user/${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            const validOrder = data.find((o: any) => o.items && o.items.length > 0);
            setLastOrder(validOrder || null);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading || !lastOrder) return null;

  return (
    <div className="mb-6 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col  items-center justify-between gap-4 relative overflow-hidden group hover:shadow-md transition-all">
      <div className="absolute top-0 right-0 w-24 h-24 bg-vovoh-gold/5 rounded-full blur-2xl -z-0 pointer-events-none"></div>
      
      <div className="flex items-center gap-4 w-full  relative z-10">
        <div className="w-10 h-10 bg-vovoh-gold/10 text-vovoh-gold rounded-xl flex items-center justify-center shrink-0">
          <RotateCcw size={20} />
        </div>
        <div className="flex-grow min-w-0">
          <h3 className="text-sm font-black text-vovoh-dark leading-tight">Pedir de novo?</h3>
          <p className="text-xs text-gray-500 truncate mt-0.5 max-w-[200px] ">{lastOrder.itemsSummary}</p>
        </div>
      </div>

      <button 
        onClick={() => onReorder(lastOrder.items || [])}
        className="w-full  px-5 py-2.5 bg-vovoh-dark text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm hover:bg-black shrink-0 relative z-10"
      >
        <ShoppingBag size={14} />
        <span>Adicionar (R$ {Number(lastOrder.total).toFixed(2)})</span>
      </button>
    </div>
  );
};
