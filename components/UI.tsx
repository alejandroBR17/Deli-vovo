import { useTheme } from '../src/theme/ThemeProvider';
import React, { useEffect, useState, useRef } from 'react';
import { Heart, Zap, Bell, X, ChefHat, CreditCard, Copy, Check, Smartphone, ShieldCheck, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PaymentElement, useStripe, useElements, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { generatePixPayload } from '../utils/pix';

const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onCancel} />
      
      <div className="relative w-full max-w-md bg-white rounded-t-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full overflow-hidden">
        
        {/* Drag Handle Mobile */}
        <div className="w-full flex justify-center items-center h-6 bg-white shrink-0 cursor-pointer" onClick={onCancel}>
           <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
        </div>

        <div className="p-8 text-center space-y-6 relative z-10">
          <div className="w-20 h-20 bg-vovoh-red/10 text-vovoh-red rounded-[1.5rem] flex items-center justify-center mx-auto mb-2 shadow-inner">
            <AlertTriangle size={36} strokeWidth={2.5} />
          </div>
          
          <div>
            <h3 className="text-2xl font-black text-vovoh-dark tracking-tight leading-none">{title}</h3>
            <p className="text-gray-500 font-medium mt-3 text-sm leading-relaxed">{message}</p>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button 
              onClick={onConfirm} 
              className="w-full py-4 bg-vovoh-red text-white rounded-2xl font-black text-sm uppercase shadow-xl shadow-red-200 hover:bg-red-600 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Confirmar
            </button>
            <button 
              onClick={onCancel} 
              className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-black text-sm uppercase hover:bg-gray-100 active:scale-95 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export const GrandmaLoader = () => (
  <div className="flex flex-col items-center justify-center p-20 gap-6">
    <div className="relative">
      <div className="w-20 h-20 bg-vovoh-red/10 rounded-full animate-ping absolute inset-0"></div>
      <ChefHat size={60} className="text-vovoh-red animate-bounce relative z-10" />
    </div>
    <p className="text-vovoh-red font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">Preparando no Capricho...</p>
  </div>
);

export const Toast = ({ message, type, onClose, notification }: { notification?: object, message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [expanded, setExpanded] = useState(false);
  const [paused, setPaused] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const [hasDetails, setHasDetails] = useState(false);
  useEffect(() => {
    if (expanded) return;
    const element = messageRef.current;
    if (!element) return;
    const check = () => setHasDetails(element.scrollHeight > element.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(element);
    return () => observer.disconnect();
  }, [message, expanded]);
  useEffect(() => { setExpanded(false); }, [message, type, notification]);
  useEffect(() => {
    if (paused || expanded) return;
    const delay = Math.min(12000, Math.max(type === 'error' ? 8000 : 4000, message.length * 45));
    const timer = setTimeout(() => closeRef.current(), delay);
    return () => clearTimeout(timer);
  }, [message, type, paused, expanded, notification]);
  const color = type === 'success' ? 'bg-green-50 text-green-700' : type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700';
  const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? AlertTriangle : Info;
  return (
    <div className="fixed top-[calc(4.75rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}>
      <div className="bg-white text-vovoh-dark border border-gray-200 rounded-2xl p-3 flex items-start gap-3 shadow-lg">
        <span className={'w-9 h-9 shrink-0 rounded-xl flex items-center justify-center '+color}><Icon size={19} aria-hidden="true" /></span>
        <div className="flex-1 min-w-0 pt-1">
          <p ref={messageRef} role={type === 'error' ? 'alert' : 'status'} aria-atomic="true" className={'text-sm font-medium leading-relaxed break-words '+(expanded ? 'max-h-48 overflow-y-auto' : 'line-clamp-2')}>{message}</p>
          {(hasDetails || message.length > 120) && <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="text-xs text-vovoh-red font-semibold min-h-9 underline underline-offset-2">{expanded ? 'Recolher detalhes' : 'Mostrar detalhes'}</button>}
        </div>
        <button type="button" aria-label="Fechar aviso" onClick={onClose} className="w-11 h-11 -m-1 shrink-0 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vovoh-red"><X size={18} /></button>
      </div>
    </div>
  );
};

export const StripePaymentBox = ({ onComplete, total, customer, checkout }: { onComplete: (paymentDetails?: any) => Promise<boolean> | boolean | void, total: number, customer?: any, checkout: any }) => {
  const {resolved} = useTheme();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [orderId, setOrderId] = useState('');
  const checkoutBody = JSON.stringify(checkout);

  const customerZip = customer?.address ? (customer.address.match(/\d{5}-?\d{3}/)?.[0] || '') : '';

  useEffect(() => {
    const controller = new AbortController();
    setClientSecret(null); setError(null);
    if (!stripePromise) {
      setError("Configuração de pagamento incompleta (Chave Stripe ausente).");
      return;
    }

    fetch('/api/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: checkoutBody,
      signal: controller.signal,
    })
      .then(async (res) => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Falha ao iniciar pagamento seguro');
        return result;
      })
      .then((data) => { setClientSecret(data.clientSecret); setOrderId(data.orderId); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [checkoutBody]);

  if (error) {
    return (
      <div className="p-8 bg-red-50 border-2 border-red-100 rounded-[2.5rem] text-vovoh-red text-center space-y-4">
        <AlertTriangle size={40} className="mx-auto" />
        <p className="font-black text-sm">{error}</p>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Tente novamente ou use outro método</p>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="p-12 bg-white rounded-[2.5rem] border-2 border-blue-500/10 shadow-xl flex flex-col items-center justify-center gap-4 animate-pulse">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Criptografando Conexão...</p>
      </div>
    );
  }

  if (!stripePromise) return null;

  return (
    <Elements key={clientSecret} stripe={stripePromise} options={{
      clientSecret, 
      appearance: { 
        theme: resolved === 'dark' ? 'night' : 'stripe',
        variables: {
          colorPrimary: '#2563eb',
          fontFamily: 'Quicksand, sans-serif',
          borderRadius: '16px',
        }
      } 
    }}>
      <StripeForm onComplete={details => onComplete({ ...details, orderId })} total={total} customer={customer} />
    </Elements>
  );
};

const StripeForm = ({ onComplete, total, customer }: { onComplete: (paymentDetails?: any) => Promise<boolean> | boolean | void, total: number, customer?: any }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const customerZip = customer?.address ? (customer.address.match(/\d{5}-?\d{3}/)?.[0] || '') : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let paymentId = confirmedPayment;
      if (!paymentId) {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements, confirmParams: { return_url: window.location.origin }, redirect: 'if_required',
        });
        if (error) throw new Error(error.message || 'Erro no processamento.');
        if (!paymentIntent || paymentIntent.status !== 'succeeded') throw new Error('O pagamento ainda não foi confirmado.');
        paymentId = paymentIntent.id; setConfirmedPayment(paymentId);
      }
      const saved = await onComplete({ method: 'cartao_online', id: paymentId });
      if (saved === false) setErrorMessage('Pagamento confirmado, mas o pedido ainda não foi salvo. Tente enviar novamente. Você não será cobrado de novo por este botão.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível concluir.');
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-6  border-2 border-blue-500/10 shadow-xl space-y-6 animate-in zoom-in-95 text-left">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 text-blue-500 rounded-xl flex items-center justify-center">
          <CreditCard size={20} />
        </div>
        <div>
          <p className="font-black text-vovoh-dark text-sm">Cartão de Crédito ou Débito</p>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Apple Pay, Google Pay & Link</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-4">Dados do Pagamento</label>
          <PaymentElement options={{ 
            layout: 'tabs',
            defaultValues: {
              billingDetails: {
                address: {
                  postal_code: customerZip,
                  country: 'BR'
                },
                name: customer?.name || '',
                email: customer?.email || '',
                phone: customer?.phone || ''
              }
            }
          } as any} />
        </div>
        
        <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold justify-center">
          <ShieldCheck size={14} className="text-green-500" />
          Pagamento 100% Seguro via Stripe
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-vovoh-red text-[10px] font-bold text-center">
            {errorMessage}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isProcessing || !stripe} 
          className="w-full py-5 bg-blue-600 text-white font-black rounded-[2rem] shadow-xl shadow-blue-200 hover:scale-105 transition-transform flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          {isProcessing ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Processando...</>
          ) : (
            confirmedPayment ? 'Enviar pedido já pago' : `Pagar R$ ${total.toFixed(2)}`
          )}
        </button>
      </form>
    </div>
  );
};

export const PixBox = ({ onComplete, pixKey, total }: { onComplete: () => void, pixKey: string, total: number }) => {
  const [copied, setCopied] = useState(false);
  
  // Gera o payload PIX Copia e Cola válido
  const pixPayload = generatePixPayload(pixKey, total, "Delicias da Vovo", "Colombo");

  const handleCopy = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-8 border-2 border-vovoh-gold/10 shadow-xl space-y-6 text-center animate-in zoom-in-95">
      <div className="pix-qr w-48 h-48 mx-auto rounded-3xl flex items-center justify-center border-2 border-dashed border-vovoh-gold/20 p-4">
        <QRCodeSVG value={pixPayload} size={160} level="M" includeMargin={true} />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Chave Pix</p>
        <p className="text-sm font-black text-vovoh-dark mb-1">{pixKey}</p>
        <p className="text-[10px] font-bold text-gray-500 mb-4">Valor: R$ {total.toFixed(2)}</p>
        <button onClick={handleCopy} className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-xs transition-all ${copied ? 'bg-green-500 text-white' : 'bg-vovoh-gold text-white shadow-lg shadow-amber-200'}`}>
          {copied ? <><Check size={16}/> Copiado!</> : <><Copy size={16}/> Copiar Pix Copia e Cola</>}
        </button>
      </div>
      <p className="text-sm text-gray-600">A loja vai conferir o pagamento antes de iniciar o preparo.</p>
      <button onClick={onComplete} className="w-full py-6 bg-vovoh-red text-white font-black rounded-[2rem] shadow-xl hover:scale-105 transition-transform">
        Já fiz o Pix — enviar pedido
      </button>
    </div>
  );
};
