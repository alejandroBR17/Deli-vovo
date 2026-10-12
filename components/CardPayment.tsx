import React, {useEffect, useRef, useState} from 'react';
import {CreditCard, Loader2, RefreshCw, X} from 'lucide-react';
import {StripePaymentBox} from './UI';
import {useModalFocus} from '../src/hooks/use-modal-focus';
import type {Order} from '../types';

const pendingKey='vovoh_pending_card_checkout';
type Pending={id:string;key:string;paymentId?:string};
function pendingPayment():Pending|null {
  try {const data=JSON.parse(localStorage.getItem(pendingKey)||'null');return data && /^[a-zA-Z0-9-]{8,64}$/.test(data.id) && /^[a-zA-Z0-9-]{32,64}$/.test(data.key)?data:null;} catch{return null;}
}
export function CardPaymentBox({onComplete,total,customer,checkout}:any) {
  const [config,setConfig]=useState<{provider:string;mode:string}|null>(null);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const lock=useRef(false);
  useEffect(()=>{
    const abort=new AbortController();
    fetch('/api/payments/config',{signal:abort.signal}).then(async response=>{if(!response.ok)throw new Error();return response.json();})
      .then(setConfig).catch(()=>{if(!abort.signal.aborted)setError('Não foi possível carregar o cartão. Use Pix ou reabra a sacola.');});
    return()=>abort.abort();
  },[]);
  async function start() {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    const pending={id:crypto.randomUUID(),key:crypto.randomUUID()};
    try {
      const previous=pendingPayment();
      if(previous)throw new Error('Existe um pagamento anterior. Volte ao início para consultar antes de pagar novamente.');
      const response=await fetch('/api/payments/mercado-pago/checkout',{method:'POST',headers:{'Content-Type':'application/json','X-Order-Request':pending.key},body:JSON.stringify({...checkout,id:pending.id})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Não foi possível abrir o pagamento.');
      const url=new URL(data.checkoutUrl);
      if(url.protocol!=='https:' || url.hostname!=='www.mercadopago.com.br')throw new Error('Endereço de pagamento inválido.');
      // Before redirect only: a failed initiation cannot leave a stuck local bag.
      // Save opaque keys, never card or customer details.
      localStorage.setItem(pendingKey,JSON.stringify(pending));
      window.location.assign(url.href);
    } catch(error) {setError(error instanceof Error?error.message:'Não foi possível abrir o pagamento.');}
    finally {lock.current=false;setBusy(false);}
  }
  if(config?.provider==='stripe')return <StripePaymentBox {...{onComplete,total,customer,checkout}}/>;
  return <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-3">
    <p className="font-bold text-blue-900">Cartão pelo Mercado Pago</p>
    <p className="text-sm text-blue-800">Pague com cartão na página segura do Mercado Pago e volte para acompanhar o pedido. O Mercado Pago também oferece saldo da conta.</p>
    {config?.mode==='test' && <p role="note" className="text-sm font-semibold text-blue-800">Modo de teste. Nenhuma cobrança real.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="button" onClick={start} disabled={!config||busy} className="w-full rounded-xl bg-blue-600 text-white font-bold p-4 flex justify-center items-center gap-2 disabled:opacity-60">
      {busy||!config?<Loader2 size={20} className="animate-spin"/>:<CreditCard size={20}/>}
      {busy?'Abrindo pagamento…':config?.mode==='test'?'Testar pagamento no Mercado Pago':`Pagar R$ ${total.toFixed(2)}`}
    </button>
  </section>;
}

export function CardPaymentReturn({onApproved}:{onApproved:(order:Order)=>void}) {
  const [pending]=useState(()=>{
    const value=pendingPayment();if(!value)return null;
    const query=new URLSearchParams(window.location.search);
    const id=query.get('payment_id')||query.get('collection_id');
    if(query.get('payment_return')===value.id && id && /^\d{1,32}$/.test(id))value.paymentId=id;
    return value;
  });
  const [open,setOpen]=useState(!!pending);const [finished,setFinished]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('Consultando seu pagamento…');
  const [checkoutUrl,setCheckoutUrl]=useState('');const dialog=useRef<HTMLDivElement>(null);const lock=useRef(false);
  const mounted=useRef(true);const approved=useRef(onApproved);approved.current=onApproved;
  useModalFocus(dialog,open,()=>setOpen(false));
  async function check(signal?:AbortSignal) {
    if(!pending||lock.current)return;lock.current=true;setBusy(true);
    try {
      const response=await fetch(`/api/payments/mercado-pago/${pending.id}/status`,{method:'POST',headers:{'Content-Type':'application/json','X-Order-Request':pending.key},body:JSON.stringify({paymentId:pending.paymentId}),signal});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível consultar.');
      if(signal?.aborted || !mounted.current)return;
      if(result.status==='approved') {
        localStorage.removeItem(pendingKey);
        const url=new URL(window.location.href);['payment_return','payment_id','collection_id','collection_status','status','preference_id','external_reference','merchant_order_id','site_id','processing_mode','merchant_account_id'].forEach(key=>url.searchParams.delete(key));
        window.history.replaceState(null,'',url.href);
        setFinished(true);setOpen(false);approved.current(result.order);
      } else {
        setMessage(['rejected','cancelled'].includes(result.paymentState)?'O pagamento foi recusado ou cancelado. Você pode tentar novamente no Mercado Pago.':
          ['refunded','charged_back'].includes(result.paymentState)?'Este pagamento foi devolvido ou contestado. Fale com a loja antes de enviar outro pedido.':
          'O pagamento ainda não foi confirmado. Se você já pagou, consulte novamente.');
        setCheckoutUrl(['refunded','charged_back'].includes(result.paymentState)?'':result.checkoutUrl||'');
      }
    } catch(error) {if(!signal?.aborted)setMessage(error instanceof Error?error.message:'Não foi possível consultar o pagamento.');}
    finally {lock.current=false;if(!signal?.aborted)setBusy(false);}
  }
  useEffect(()=>{
    mounted.current=true;
    if(!pending)return;
    localStorage.setItem(pendingKey,JSON.stringify(pending));
    void check(AbortSignal.timeout(15000));
    return()=>{mounted.current=false;};
  },[pending]);
  if(!pending || finished)return null;
  if(!open)return <button onClick={()=>setOpen(true)} className="fixed bottom-24 right-4 z-[250] rounded-xl bg-blue-600 text-white shadow-lg px-4 py-3 font-bold text-sm flex items-center gap-2"><CreditCard size={18}/>Consultar cartão pendente</button>;
  return <div className="fixed inset-0 z-[10000] bg-black/60 p-4 flex items-center justify-center"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="card-return-title" className="w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-contain rounded-3xl bg-white p-6 shadow-2xl space-y-4">
    <div className="flex justify-between items-center gap-3"><h2 id="card-return-title" className="font-bold text-lg text-vovoh-dark">Seu pagamento</h2><button onClick={()=>setOpen(false)} aria-label="Fechar consulta de pagamento"><X/></button></div>
    <p role="status" className="text-sm text-gray-600">{message}</p>
    <button onClick={()=>void check()} disabled={busy} className="w-full p-3 rounded-xl bg-blue-600 text-white font-bold flex justify-center items-center gap-2 disabled:opacity-60">{busy?<Loader2 className="animate-spin" size={18}/>:<RefreshCw size={18}/>}Consultar pagamento</button>
    {checkoutUrl && <a className="block rounded-xl border border-blue-300 p-3 text-center font-semibold text-blue-700" href={checkoutUrl}>Continuar no Mercado Pago</a>}
    <p className="text-xs text-gray-500">O pedido só chega à cozinha após a confirmação do pagamento. Não pague novamente se já recebeu a confirmação do Mercado Pago.</p>
  </div></div>;
}
