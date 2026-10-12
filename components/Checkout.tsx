import { customerName, validCustomerName } from '../src/utils/customer-name';
import React, { useEffect, useState, useRef } from 'react';
import { X, ShoppingCart, Trash2, ArrowRight, User, MapPin, Zap, CheckCircle2, Bike, ChefHat, Flame, Heart, PackageCheck, Award, Star, Clock, LogIn, AlertTriangle, CreditCard, Check, ArrowLeft, RefreshCw, Loader2, MessageSquare, Phone } from 'lucide-react';
import { Banknote, Bell } from 'lucide-react';
import { PixBox } from './UI';
import {CardPaymentBox} from './CardPayment';
import { PLACEHOLDER_IMG, GAS_API_URL } from '../constants/index';
import { subscribeToPush } from '../src/utils/push';
import { lookupCep, formatCep } from '../src/utils/cep';
import { formatWhatsApp } from '../src/utils/phone-input';
import { PhoneInput } from './PhoneInput';
import {shopDate,validateSchedule} from '../src/utils/order-schedule';
import {storeAvailability} from '../src/utils/store-hours';
import {useModalFocus} from '../src/hooks/use-modal-focus';
import { addressParts, emptyCustomer, readSavedCustomers, rememberCustomer, SavedCustomer, CustomerDetails } from '../src/utils/saved-checkout';

export const Checkout = ({ isOpen, onClose, cart, setCart, customer, setCustomer, method, setMethod, changeFor, setChangeFor, onOrder, pixKey, user, openAuth, coupons, dynamicConfigs, onRefreshConfigs, showMsg }: any) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef,isOpen,onClose);
  const [configStatus, setConfigStatus] = useState<'loading'|'ready'|'error'>('loading');
  const [configRetry, setConfigRetry] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setConfigStatus('loading');
    onRefreshConfigs().then((configs: any) => {
      if (!cancelled) {
        setConfigStatus(configs ? 'ready' : 'error');
        if (configs) {
          quoteSequence.current++;
          quoteAbort.current?.abort();
          setCalculatingFee(false);
          setFeeCalculated(false); setDeliveryProof('');
          setDeliveryFee(0); setDeliveryDistance(0);
        }
      }
    });
    return () => { cancelled = true; };
  }, [isOpen, onRefreshConfigs, configRetry]);
  const cashEnabled = dynamicConfigs?.cash_enabled === 'true';
  useEffect(() => {
    if (!cashEnabled && method === 'dinheiro') setMethod('pix');
  }, [cashEnabled, method, setMethod]);
  const [fidelidade, setFidelidade] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [step, setStep] = useState('cart');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryDistance, setDeliveryDistance] = useState(0);
  const [deliveryProof, setDeliveryProof] = useState('');
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [feeCalculated, setFeeCalculated] = useState(false);
  const [addressError, setAddressError] = useState('');
  const quoteSequence = useRef(0);
  const quoteAbort = useRef<AbortController | null>(null);
  const addressSearchSequence = useRef(0);
  const addressSearchAbort = useRef<AbortController | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const immediateAvailable = !!dynamicConfigs && storeAvailability(dynamicConfigs).open;
  useEffect(() => {
    if (isOpen && dynamicConfigs && !immediateAvailable && step !== 'payment') setIsScheduled(true);
  }, [isOpen, dynamicConfigs, immediateAvailable, step]);

  const [cep, setCep] = useState(() => addressParts(customer).cep);
  const [searchingCep, setSearchingCep] = useState(false);
  const [street, setStreet] = useState(() => addressParts(customer).street);
  const [number, setNumber] = useState(() => addressParts(customer).number);
  const numberRef = useRef<HTMLInputElement>(null);
  const [neighborhood, setNeighborhood] = useState(() => addressParts(customer).neighborhood);
  const [city, setCity] = useState(() => addressParts(customer).city);
  const [state, setState] = useState(() => addressParts(customer).state);
  const [savedCustomers, setSavedCustomers] = useState<SavedCustomer[]>([]);
  const applyCustomer = (details: CustomerDetails) => {
    const parts = addressParts(details);
    setCustomer({...details, name:customerName(details.name), phone: details.phone.replace(/\D/g, '')}); setStreet(parts.street); setNumber(parts.number);
    setNeighborhood(parts.neighborhood); setCity(parts.city); setState(parts.state); setCep(parts.cep);
    setAddressError('');
  };
  useEffect(() => {
    if (isOpen) { setSavedCustomers(readSavedCustomers()); applyCustomer(customer); }
  }, [isOpen]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const deliveryResultRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if (isOpen && feeCalculated) deliveryResultRef.current?.scrollIntoView({block:'nearest',behavior:'auto'});
  },[feeCalculated,isOpen]);



  useEffect(() => {
    quoteSequence.current++;
    quoteAbort.current?.abort();
    setCalculatingFee(false);
    setDeliveryFee(0); setDeliveryDistance(0);
    addressSearchSequence.current++;
    addressSearchAbort.current?.abort();
    setSearchingCep(false); setIsGettingLocation(false);
    const newAddress = street && number && city ? `${street}, ${number} - ${neighborhood}, ${city} - ${state}, ${cep}` : '';
    setCustomer((prev: any) => ({ ...prev, address: newAddress, deliveryAddress: {street,number,neighborhood,city,state,cep} }));
    setFeeCalculated(false); setDeliveryProof('');
    return () => {
      quoteSequence.current++; quoteAbort.current?.abort();
      addressSearchSequence.current++; addressSearchAbort.current?.abort();
    };
  }, [street, number, neighborhood, city, state, cep]);

  const searchCep = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setAddressError("CEP inválido. Digite 8 números.");
      return;
    }
    setAddressError('');
    setSearchingCep(true);
    setIsGettingLocation(false);
    const sequence = ++addressSearchSequence.current;
    addressSearchAbort.current?.abort();
    const controller = new AbortController();
    addressSearchAbort.current = controller;
    try {
      const data = await lookupCep(cleanCep, controller.signal);
      if (sequence !== addressSearchSequence.current || controller.signal.aborted) return;
      setStreet(data.street);
      setNeighborhood(data.neighborhood);
      setCity(data.city);
      setState(data.state);
      setFeeCalculated(false);
      
      // Foca no número automaticamente para agilizar
      numberRef.current?.focus();
    } catch (e) {
      if (sequence !== addressSearchSequence.current) return;
      setAddressError(e instanceof Error ? e.message : 'Preencha o endereço manualmente ou tente novamente.');
    } finally {
      if (sequence === addressSearchSequence.current) setSearchingCep(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setAddressError("Geolocalização não suportada pelo seu navegador.");
      return;
    }

    setIsGettingLocation(true);
    setSearchingCep(false); setAddressError('');
    const sequence = ++addressSearchSequence.current;
    addressSearchAbort.current?.abort();
    const controller = new AbortController();
    addressSearchAbort.current = controller;
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (sequence !== addressSearchSequence.current) return;
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const { latitude, longitude } = position.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Localização indisponível');
        const data = await res.json();
        if (sequence !== addressSearchSequence.current || controller.signal.aborted) return;
        
        if (data.address) {
          const addr = data.address;
          setStreet(addr.road || addr.street || '');
          setNumber(addr.house_number || '');
          setNeighborhood(addr.suburb || addr.neighbourhood || '');
          setCity(addr.city || addr.town || addr.village || '');
          setState(addr.state_code || '');
          setCep(addr.postcode || '');
          setFeeCalculated(false);
          showMsg?.("Localização encontrada!", "success");
        } else setAddressError('Não encontramos o endereço desta localização. Preencha manualmente.');
      } catch (e) {
        if (sequence !== addressSearchSequence.current) return;
        setAddressError(controller.signal.aborted ? 'A busca da localização demorou demais. Preencha o endereço ou tente novamente.' : 'Erro ao obter endereço pela localização. Você pode preencher manualmente.');
      } finally {
        clearTimeout(timeout);
        if (sequence === addressSearchSequence.current) setIsGettingLocation(false);
      }
    }, (error) => {
      if (sequence !== addressSearchSequence.current) return;
      setAddressError(error.code === 1 ? 'Permissão de localização negada. Você pode preencher o endereço manualmente.' : 'Não foi possível obter sua localização. Você pode preencher o endereço manualmente.');
      setIsGettingLocation(false);
    }, { timeout: 15000, maximumAge: 60000 });
  };

  useEffect(() => {
    const saved = localStorage.getItem('vovoh_fidelidade');
    if (saved) setFidelidade(parseInt(saved));
    if (isOpen) setStep('cart');
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

  if (!isOpen) return null;
  const subtotal = (cart || []).reduce((acc:any, item:any) => {
    let itemPrice = parseFloat(item.price) + (item.variation ? parseFloat(item.variation.price) : 0);
    if (item.additionals && Array.isArray(item.additionals)) {
      itemPrice += item.additionals.reduce((sum: number, add: any) => sum + parseFloat(add.price), 0);
    }
    return acc + (itemPrice * item.quantity);
  }, 0);
  
  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percent') {
      const multiplier = appliedCoupon.discount > 1 ? appliedCoupon.discount / 100 : appliedCoupon.discount;
      discount = subtotal * multiplier;
    } else {
      discount = appliedCoupon.discount;
    }
  }
  
  const total = Math.max(0, subtotal - discount) + deliveryFee;

  const calculateDeliveryFee = async () => {
    setAddressError('');
    if (!street.trim() || !number.trim() || !city.trim()) {
      setAddressError("Por favor, preencha seu endereço completo primeiro.");
      return;
    }
    setCalculatingFee(true);
    const sequence = ++quoteSequence.current;
    quoteAbort.current?.abort();
    const controller = new AbortController();
    quoteAbort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const quote = await fetch(`${GAS_API_URL}/delivery/quote`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: customer.address }),
        signal: controller.signal,
      });
      const result = await quote.json().catch(() => ({}));
      if (sequence !== quoteSequence.current) return;
      if (controller.signal.aborted) throw new Error('O cálculo do frete demorou demais. Tente novamente.');
      if (!quote.ok) throw new Error(result.error || 'Não foi possível calcular o frete.');
      if (!Number.isFinite(result.fee) || result.fee < 0 || !Number.isFinite(result.distance) || result.distance < 0 || typeof result.token !== 'string' || !result.token) throw new Error('Não foi possível confirmar o frete. Tente novamente.');
      setDeliveryDistance(result.distance); setDeliveryFee(result.fee);
      setDeliveryProof(result.token); setFeeCalculated(true);
    } catch (e) {
      if (sequence !== quoteSequence.current) return;
      setFeeCalculated(false); setDeliveryFee(0);
      setAddressError(controller.signal.aborted ? 'O cálculo do frete demorou demais. Tente novamente.' : e instanceof Error ? e.message : 'Erro ao calcular o frete. Tente novamente.');
    } finally {
      clearTimeout(timeout);
      if (sequence === quoteSequence.current) setCalculatingFee(false);
    }
  };

  const handleApplyCoupon = () => {
    setCouponError('');
    const coupon = (coupons || []).find((c: any) => c.code.toUpperCase() === couponCode.toUpperCase());
    if (coupon) {
      setAppliedCoupon(coupon);
      setCouponCode('');
    } else {
      setCouponError('Cupom inválido ou expirado, meu anjo.');
    }
  };

  const handleOrder = async (paymentDetails?: any) => {
    if (submitLock.current) return false;
    submitLock.current = true; setSubmitting(true);
    try {
    if (!validCustomerName(customer.name)) { showMsg('Informe seu nome antes de enviar o pedido.', 'error'); setStep('details'); return false; }
    let scheduledTo = undefined;
    if (isScheduled) {
      try {
        if (!scheduledDate || !scheduledTime) throw new Error('Escolha a data e o horário da entrega agendada.');
        scheduledTo = validateSchedule(`${scheduledDate}T${scheduledTime}:00`,dynamicConfigs);
      } catch(error) {
        showMsg(error instanceof Error ? error.message : 'Confira o agendamento.', 'error'); return false;
      }
    }
    if (method === 'dinheiro' && (!cashEnabled || (changeFor !== '' && (!Number.isFinite(Number(changeFor)) || Number(changeFor) < total)))) {
      showMsg('Confira a forma de pagamento e o valor para troco.', 'error');
      return false;
    }
    return await onOrder({ ...paymentDetails, ...(method === 'dinheiro' ? { method, changeFor: changeFor === '' ? undefined : Number(changeFor) } : {}), finalTotal: total, coupon: appliedCoupon?.code, deliveryFee, deliveryDistance, deliveryToken: deliveryProof, scheduledTo });
    } finally { submitLock.current = false; setSubmitting(false); }
  };

  return (
    <div className="checkout-overlay fixed inset-0 z-[400] flex flex-col justify-end md:items-end overscroll-none">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Sua sacola" tabIndex={-1} className="relative w-full md:max-w-md lg:max-w-lg h-[92dvh] md:h-full bg-[#F9F9F9] shadow-3xl flex flex-col rounded-t-[2.5rem] md:rounded-none md:rounded-l-[2.5rem] animate-sheet md:animate-drawer overflow-hidden z-10">
        
        <div className="w-full flex md:hidden justify-center items-center h-8 bg-white shrink-0 cursor-pointer" onClick={onClose}>
           <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
        </div>

        <header className="px-4 sm:px-6 py-4 md:py-5 flex flex-wrap gap-3 justify-between items-center bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-vovoh-red text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-100"><ShoppingCart size={20}/></div>
            <h3 className="text-xl md:text-2xl font-black text-vovoh-dark">Sua Sacola</h3>
          </div>
          <button aria-label="Fechar sacola" onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-dark hover:bg-gray-100 transition-colors"><X size={20}/></button>
        </header>

        <div ref={scrollRef} className="checkout-scroll flex-grow overflow-y-auto overscroll-contain touch-pan-y min-h-0 p-4 sm:p-6 space-y-8 bg-[#F9F9F9] no-scrollbar pb-32">
          {configStatus !== 'ready' && (
            <div role={configStatus === 'error' ? 'alert' : 'status'} className="p-4 rounded-2xl border border-gray-200 bg-white text-sm text-gray-700">
              {configStatus === 'loading' ? <span className="flex items-center gap-2"><Loader2 size={18} className="animate-spin shrink-0" /> Conferindo as opções da loja...</span> : <>
                <p>Não conseguimos atualizar as opções da loja. Seus dados continuam preenchidos.</p>
                <button type="button" onClick={() => setConfigRetry(value => value + 1)} className="mt-3 font-bold text-vovoh-red underline">Tentar novamente</button>
              </>}
            </div>
          )}
          
          {(step === 'cart' || step === 'details' || step === 'payment') && (
            <div className="bg-gradient-to-br from-vovoh-gold to-amber-600 p-4 sm:p-6  rounded-[2rem] text-white shadow-lg relative overflow-hidden shrink-0">
               <div className="absolute -top-4 -right-4 opacity-10 rotate-12"><Award size={100} /></div>
               <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-black text-[10px]  uppercase tracking-widest">Cartão Fidelidade</h4>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black">{fidelidade}/10</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1.5">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className={`w-full aspect-square rounded-full border-2 border-white/30 flex items-center justify-center transition-all ${i < fidelidade ? 'bg-white text-vovoh-gold scale-110 shadow-lg' : 'bg-transparent text-white/30'}`}>
                        {i < fidelidade ? <Heart size={12} fill="currentColor" /> : <Star size={10} />}
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] [10px] font-bold opacity-80 leading-tight">Complete seu cartão e ganhe um lanche grátis! </p>
               </div>
            </div>
          )}

          {step === 'cart' && (
            <div className="space-y-6">
              {cart.length === 0 ? (
                <div className="py-20 text-center space-y-6 opacity-30">
                  <ShoppingCart size={60} className="mx-auto" />
                  <p className="text-sm  font-black uppercase tracking-widest">Sua sacola está vazia!</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map((item:any, index: number) => (
                      <div key={`${item.id}-${index}`} className="bg-white p-3 sm:p-4 rounded-[1.5rem] flex flex-wrap min-[400px]:flex-nowrap items-center gap-2 sm:gap-4 shadow-sm border border-gray-100">
                        <img src={item.image || PLACEHOLDER_IMG} className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 rounded-xl object-cover bg-vovoh-cream" />
                        <div className="flex-1 min-w-0 basis-24 break-words">
                          <h4 className="font-black text-sm text-vovoh-dark leading-tight mb-1">{item.name}</h4>
                          {item.variation && <p className="text-[10px] font-bold text-gray-500 mb-1">Opção: {item.variation.name}</p>}
                          {item.additionals && item.additionals.length > 0 && (
                            <p className="text-[10px] font-bold text-gray-500 mb-1">
                              Adicionais: {item.additionals.map((a:any) => a.name).join(', ')}
                            </p>
                          )}
                          {item.observation && <p className="text-[10px] font-bold text-gray-400 italic mb-1">Obs: {item.observation}</p>}
                          <p className="text-vovoh-red font-black text-sm">R$ {(parseFloat(item.price) + (item.variation ? parseFloat(item.variation.price) : 0) + (item.additionals ? item.additionals.reduce((sum:number, a:any) => sum + parseFloat(a.price), 0) : 0)).toFixed(2)}</p>
                        </div>
                        <div className="flex shrink-0 ml-auto flex-col items-center justify-center gap-2">
                           <div className="flex items-center gap-3 bg-[#F9F9F9] px-3 py-1.5 rounded-xl border border-gray-100">
                             <button onClick={() => setCart((prev:any) => prev.map((i:any, idx:number) => idx === index ? {...i, quantity: Math.max(1, i.quantity - 1)} : i))} className="font-black text-vovoh-gold text-sm px-1">-</button>
                             <span className="font-black text-xs w-2 text-center">{item.quantity}</span>
                             <button onClick={() => setCart((prev:any) => prev.map((i:any, idx:number) => idx === index ? {...i, quantity: i.quantity + 1} : i))} className="font-black text-vovoh-red text-sm px-1">+</button>
                           </div>
                           <button onClick={() => setCart((prev:any) => prev.filter((_:any, idx:number) => idx !== index))} className="text-gray-300 hover:text-vovoh-red text-[10px] font-bold flex items-center gap-1"><Trash2 size={12}/> Remover</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-6 border-t border-gray-200 space-y-4">
                    <div className="flex flex-col gap-2">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tem um cupom?</p>
                       <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={couponCode}
                            onChange={e => setCouponCode(e.target.value)}
                            placeholder="Ex: PROMO10"
                            className="flex-1 min-w-0 p-4 bg-white rounded-xl border border-gray-200 font-bold text-xs uppercase outline-none focus:border-vovoh-red transition-all"
                          />
                          <button onClick={handleApplyCoupon} className="checkout-action px-5 font-bold rounded-xl text-sm active:scale-95 transition-all">Aplicar</button>
                       </div>
                       {couponError && <p className="text-[9px] font-bold text-vovoh-red px-1">{couponError}</p>}
                       {appliedCoupon && (
                         <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl border border-green-100">
                            <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Cupom Ativo: {appliedCoupon.code}</span>
                            <button onClick={() => setAppliedCoupon(null)} className="text-green-600 hover:text-red-500"><Trash2 size={14}/></button>
                         </div>
                       )}
                    </div>

                     <div className="space-y-2 pt-2">
                       <div className="flex justify-between text-xs font-bold text-gray-400">
                          <span>Subtotal</span>
                          <span>R$ {subtotal.toFixed(2)}</span>
                       </div>
                       {feeCalculated ? (
                         <div className="flex justify-between text-xs font-bold text-gray-400">
                            <span>Taxa de entrega</span>
                            <span>{deliveryFee === 0 ? 'Grátis' : 'R$ ' + deliveryFee.toFixed(2)}</span>
                         </div>
                       ) : <p className="text-sm text-gray-600">A taxa de entrega será calculada pelo endereço no próximo passo.</p>}
                       {appliedCoupon && (
                         <div className="flex justify-between text-xs font-bold text-green-600">
                            <span>Desconto</span>
                            <span>- R$ {discount.toFixed(2)}</span>
                         </div>
                       )}
                       <div className="flex justify-between items-end pt-2">
                          <span className="text-gray-400 font-black uppercase tracking-widest text-[10px]">{feeCalculated ? 'Total a pagar' : 'Itens da sacola'}</span>
                          <span className="text-3xl  font-black text-vovoh-dark tracking-tighter leading-none">R$ {total.toFixed(2)}</span>
                       </div>
                    </div>
                  </div>
                  
                  <button disabled={configStatus !== 'ready'} onClick={() => setStep('details')} className="w-full py-5 bg-vovoh-red text-white font-black rounded-2xl shadow-xl shadow-red-200 flex items-center justify-center gap-3 text-base active:scale-95 transition-all mt-4 disabled:opacity-50">
                    Continuar Pedido <ArrowRight size={20}/>
                  </button>
                </>
              )}
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              
              {!user && (
                 <div className="bg-amber-50 border border-vovoh-gold/20 p-5 rounded-[1.5rem] flex flex-col gap-3">
                    <p className="text-xs font-bold text-vovoh-dark leading-tight">Já é de casa? Faça login para preencher tudo mais rápido!</p>
                    <button onClick={openAuth} className="w-full py-3 bg-white text-vovoh-gold font-black border border-vovoh-gold/20 rounded-xl text-xs uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 active:scale-95">
                      <LogIn size={14} /> Entrar na conta
                    </button>
                 </div>
              )}

              <div className="space-y-4">
                {savedCustomers.length > 0 && <details className="p-4 rounded-2xl bg-white border border-gray-200 space-y-3">
                  <summary className="font-bold cursor-pointer">Usar dados salvos</summary>
                  <p className="text-xs text-gray-500">Salvos somente neste navegador. Escolha um cadastro completo ou troque apenas um dado.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['Cadastro completo','Pessoa salva','WhatsApp salvo','Endereço salvo'] as const).map(label => <label className="block min-w-0 text-sm font-bold" key={label}>{label}<select aria-label={label} value="" className="w-full min-w-0 p-3 mt-1 rounded-xl border border-gray-200 bg-white" onChange={event => {
                      const saved = savedCustomers.find(item => item.id === event.target.value); if (!saved) return;
                      if (label === 'Cadastro completo') applyCustomer(saved);
                      else if (label === 'Endereço salvo') applyCustomer({...customer,address:saved.address,deliveryAddress:saved.deliveryAddress});
                      else setCustomer({...customer,...(label === 'Pessoa salva' ? {name:customerName(saved.name)} : {phone:saved.phone})});
                    }}><option value="">Escolher</option>{savedCustomers.map(item => <option key={item.id} value={item.id}>{label === 'Endereço salvo' ? item.address : label === 'WhatsApp salvo' ? formatWhatsApp(item.phone) : label === 'Pessoa salva' ? item.name : `${item.name} — ${formatWhatsApp(item.phone)}`}</option>)}</select></label>)}
                  </div>
                  <button type="button" onClick={() => applyCustomer({...emptyCustomer})} className="text-vovoh-red font-bold text-sm py-2">Trocar todos os dados</button>
                </details>}
                <label className="flex items-center gap-2 font-black text-vovoh-dark px-1 text-sm"><User size={16} className="text-vovoh-red"/> Nome Completo</label>
                <input 
                  type="text" 
                  placeholder="Ex: João da Silva"
                  className="w-full p-5 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm" 
                  value={customer.name} 
                  onChange={e => setCustomer({...customer, name: e.target.value})} 
                />
                
                <label htmlFor="checkout-whatsapp" className="flex items-center gap-2 font-black text-vovoh-dark px-1 text-sm pt-2"><Zap size={16} className="text-vovoh-red"/> WhatsApp</label>
                <PhoneInput
                  type="tel" 
                  id="checkout-whatsapp"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="(41) 99999-9999"
                  className="w-full p-5 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm" 
                  value={customer.phone || ''}
                  onValueChange={phone => setCustomer({...customer, phone})}
                />
                
                <label className="flex items-center gap-2 font-black text-vovoh-dark px-1 text-sm pt-2"><MapPin size={16} className="text-vovoh-red"/> Endereço de Entrega Completo</label>
                
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input type="text" inputMode="numeric" aria-label="CEP de entrega" placeholder="CEP (Apenas números)" maxLength={9} className="w-full min-w-0 p-4 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm" value={cep} onChange={e => setCep(formatCep(e.target.value))} />
                    <button onClick={searchCep} disabled={searchingCep} className="px-4 bg-gray-100 text-vovoh-dark rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all whitespace-nowrap shrink-0 disabled:opacity-50">
                      {searchingCep ? 'Buscando...' : 'Buscar CEP'}
                    </button>
                  </div>
                  <button onClick={useCurrentLocation} disabled={isGettingLocation} className="flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all border border-blue-100 disabled:opacity-50">
                    {isGettingLocation ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />} 
                    {isGettingLocation ? 'Buscando...' : 'Usar minha localização atual'}
                  </button>
                </div>
                
                <div className="flex gap-2">
                  <input type="text" placeholder="Rua / Avenida" className="flex-grow p-5 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm w-full" value={street} onChange={e => { setStreet(e.target.value); setFeeCalculated(false); setAddressError(''); }} />
                  <input ref={numberRef} type="text" placeholder="Nº" className="w-20  p-5 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm shrink-0" value={number} onChange={e => { setNumber(e.target.value); setFeeCalculated(false); setAddressError(''); }} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Bairro" className="p-5 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm w-full" value={neighborhood} onChange={e => { setNeighborhood(e.target.value); setFeeCalculated(false); setAddressError(''); }} />
                  <input type="text" placeholder="Cidade" className="p-5 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm w-full" value={city} onChange={e => { setCity(e.target.value); setFeeCalculated(false); setAddressError(''); }} />
                </div>
                
                <button onClick={calculateDeliveryFee} disabled={calculatingFee || !street || !number || !city} className="checkout-action w-full py-4 rounded-2xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50">
                  {calculatingFee ? 'Calculando...' : 'Calcular Frete'}
                </button>

                {addressError && <p className="text-[10px] font-bold text-vovoh-red px-1">{addressError}</p>}
                {feeCalculated && (
                  <div ref={deliveryResultRef} role="status" aria-live="polite" className="delivery-result p-4 rounded-2xl flex items-center gap-3">
                    <CheckCircle2 size={24} className="shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-bold text-sm">Taxa de Entrega: {deliveryFee === 0 ? 'Grátis!' : `R$ ${deliveryFee.toFixed(2)}`}</p>
                      <p className="text-xs mt-1">Frete calculado · distância de {deliveryDistance.toFixed(1)} km</p>
                    </div>
                  </div>
                )}
                
                <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4">
                  {!immediateAvailable && <p className="text-sm text-gray-600">A loja está fechada agora. Escolha uma entrega agendada dentro do expediente.</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setIsScheduled(false)}
                      disabled={!immediateAvailable}
                      aria-pressed={!isScheduled}
                      className="delivery-choice min-w-0 px-2 py-3 rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Bike size={20} aria-hidden="true" /> Entrega Agora
                    </button>
                    <button 
                      onClick={() => setIsScheduled(true)}
                      aria-pressed={isScheduled}
                      className="delivery-choice min-w-0 px-2 py-3 rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-2"
                    >
                      <Clock size={20} aria-hidden="true" /> Agendar Entrega
                    </button>
                  </div>

                  {isScheduled && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1 min-w-0">
                        <label htmlFor="scheduled-date" className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Data</label>
                        <input 
                          id="scheduled-date"
                          type="date" 
                          className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:border-vovoh-gold text-gray-600"
                          value={scheduledDate}
                          onChange={e => setScheduledDate(e.target.value)}
                          min={shopDate()}
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <label htmlFor="scheduled-time" className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Horário</label>
                        <input 
                          id="scheduled-time"
                          type="time" 
                          className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:border-vovoh-gold text-gray-600"
                          value={scheduledTime}
                          onChange={e => setScheduledTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  {isScheduled && <p className="text-xs text-gray-500">Escolha um dia e horário do expediente da loja. Usamos o horário de Brasília.</p>}
                </div>

              </div>
              
              <div className="flex gap-3 pt-4">
                 <button onClick={() => setStep('cart')} className="px-6 py-5 bg-white border border-gray-200 text-gray-500 font-black rounded-2xl text-sm active:scale-95 transition-all">Voltar</button>
                 <button 
                   onClick={() => {
                     if (!validCustomerName(customer.name)) {
                       setAddressError("Por favor, digite seu nome completo, meu anjo.");
                       return;
                     }
                     if (!/^(?:\d{10,11}|55\d{10,11})$/.test(customer.phone || '')) {
                       setAddressError("Digite um WhatsApp válido com DDD, como (41) 99999-9999.");
                       return;
                     }
                     if (!feeCalculated) {
                       setAddressError("Por favor, calcule o frete antes de prosseguir para o pagamento.");
                       return;
                     }
                     if (!isScheduled && !storeAvailability(dynamicConfigs || {}).open) {
                       setIsScheduled(true);
                       setAddressError('A loja fechou. Escolha a data e o horário da entrega agendada.');
                       return;
                     }
                     if (isScheduled) {
                       try {
                         if (!scheduledDate || !scheduledTime) throw new Error('Escolha a data e o horário da entrega agendada.');
                         validateSchedule(`${scheduledDate}T${scheduledTime}:00`,dynamicConfigs);
                       } catch(error) { setAddressError(error instanceof Error ? error.message : 'Confira o agendamento.'); return; }
                     }
                     rememberCustomer(customer);
                     setStep('payment');
                   }} 
                   disabled={configStatus !== 'ready'}
                   className="flex-grow py-5 bg-vovoh-red text-white font-black rounded-2xl shadow-lg shadow-red-200 text-sm active:scale-95 transition-all disabled:opacity-50"
                 >
                   Ir para Pagamento
                 </button>
              </div>
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 pb-10">
              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => setMethod('pix')} className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${method === 'pix' ? 'border-vovoh-gold bg-amber-50/50 shadow-sm' : 'border-gray-200 bg-white opacity-60'}`}>
                  <div className="flex items-center gap-4 text-left">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${method === 'pix' ? 'bg-vovoh-gold text-white' : 'bg-gray-100 text-gray-400'}`}><Zap size={20}/></div>
                    <div>
                      <p className="font-black text-vovoh-dark text-sm leading-tight">Pix Instantâneo</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${method === 'pix' ? 'text-vovoh-gold' : 'text-gray-400'}`}>Pagamento conferido pela loja</p>
                    </div>
                  </div>
                  {method === 'pix' && <CheckCircle2 size={20} className="text-vovoh-gold" />}
                </button>
                
                <button onClick={() => setMethod('cartao_online')} className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${method === 'cartao_online' ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-200 bg-white opacity-60'}`}>
                   <div className="flex items-center gap-4 text-left">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${method === 'cartao_online' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}><CreditCard size={20}/></div>
                    <div>
                      <p className="font-black text-vovoh-dark text-sm leading-tight">Cartão online</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${method === 'cartao_online' ? 'text-blue-500' : 'text-gray-400'}`}>Pagamento seguro</p>
                    </div>
                  </div>
                  {method === 'cartao_online' && <CheckCircle2 size={20} className="text-blue-500" />}
                </button>
              </div>

              {cashEnabled && (
                <button type="button" aria-pressed={method === 'dinheiro'} onClick={() => setMethod('dinheiro')} className={`w-full p-5 rounded-2xl border-2 flex items-center justify-between text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${method === 'dinheiro' ? 'border-green-600 bg-green-50' : 'border-gray-200 bg-white'}`}>
                  <span className="flex items-center gap-4"><Banknote size={24} aria-hidden="true" /><span><span className="block font-black text-sm">Dinheiro na entrega</span><span className="block text-xs text-gray-600">Pague quando receber</span></span></span>
                  {method === 'dinheiro' && <CheckCircle2 size={20} aria-hidden="true" />}
                </button>
              )}
              {cashEnabled && method === 'dinheiro' && (
                <div className="space-y-2">
                  <label htmlFor="cash-change-for" className="block text-sm font-bold">Precisa de troco para quanto?</label>
                  <input id="cash-change-for" type="number" inputMode="decimal" min={total} step="0.01" value={changeFor} onChange={event => setChangeFor(event.target.value)} aria-describedby="cash-change-hint" className="w-full p-4 border border-gray-300 rounded-2xl" />
                  <p id="cash-change-hint" className="text-xs text-gray-600">Deixe em branco se pagar o valor exato. O valor informado deve cobrir o total do pedido.</p>
                </div>
              )}
              <section aria-label="Resumo do pedido" className="bg-white p-5 rounded-2xl border border-gray-200 space-y-2 text-sm">
                <h4 className="font-bold text-base">Confira antes de pagar</h4>
                <p>{customer.address}</p>
                <div className="flex justify-between"><span>Itens</span><span>R$ {subtotal.toFixed(2)}</span></div>
                {discount > 0 && <div className="flex justify-between"><span>Desconto</span><span>− R$ {discount.toFixed(2)}</span></div>}
                <div className="flex justify-between"><span>Entrega</span><span>{deliveryFee === 0 ? 'Grátis' : 'R$ ' + deliveryFee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total a pagar</span><span>R$ {total.toFixed(2)}</span></div>
              </section>
              <div className="pt-4 relative" aria-busy={submitting}>
                 {submitting && <div role="status" className="absolute inset-0 z-20 bg-white/95 rounded-2xl flex items-center justify-center gap-2"><Loader2 className="animate-spin" /> Enviando pedido...</div>}
                 {method === 'pix' ? (
                   <PixBox pixKey={pixKey} total={total} onComplete={handleOrder} />
                 ) : method === 'cartao_online' ? (
                   <CardPaymentBox onComplete={handleOrder} total={total} customer={customer} checkout={{ items: cart, total, coupon: appliedCoupon?.code, deliveryToken: deliveryProof, type: 'entrega', customer, ...(isScheduled ? {scheduledTo:`${scheduledDate}T${scheduledTime}:00-03:00`} : {}) }} />
                 ) : (
                   <button onClick={() => handleOrder()} className="w-full py-5 bg-vovoh-red text-white font-black rounded-2xl shadow-xl shadow-red-200 text-base active:scale-95 transition-all">
                     Confirmar e Enviar Pedido
                   </button>
                 )}
                 <button onClick={() => setStep('details')} className="w-full mt-4 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-vovoh-dark transition-colors">Voltar para Detalhes</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const TrackingModal = ({ isOpen, onClose, orders = [], onClearOrder, onCancelOrder, onReceiveOrder, onReorder, onRetryPayment, onRefresh, dynamicConfigs }: any) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(dialogRef,isOpen,onClose);
  const [activatingNotices, setActivatingNotices] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const prevOrdersLength = useRef(orders.length);

  useEffect(() => {
    if (orders.length > prevOrdersLength.current) {
      setSelectedOrder(orders[0]);
    }
    prevOrdersLength.current = orders.length;

    if (isOpen && orders && orders.length > 0 && !selectedOrder) {
      setSelectedOrder(orders[0]);
    }
    
    if (!orders || orders.length === 0) {
      setSelectedOrder(null);
    }
    
    if (selectedOrder && orders) {
      const updated = orders.find((o: any) => o.id === selectedOrder.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedOrder)) {
        setSelectedOrder(updated);
      }
    }
  }, [orders, isOpen]);

  if (!isOpen) return null;

  const getArrivalWindow = (order: any) => {
    if (!order) return "--:--";
    
    if (order.scheduledTo) {
      const scheduledDate = new Date(order.scheduledTo);
      return `Agendado: ${scheduledDate.toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo'})} às ${scheduledDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit',timeZone:'America/Sao_Paulo'})}`;
    }

    let minDelay = 0; let maxDelay = 0;
    switch (order.status) {
      case 'pendente': minDelay = 45; maxDelay = 60; break;
      case 'preparando': minDelay = 30; maxDelay = 45; break;
      case 'forno': minDelay = 15; maxDelay = 25; break;
      case 'entrega': minDelay = 5; maxDelay = 15; break;
      case 'concluido': return "Pedido Entregue!";
      default: minDelay = 45; maxDelay = 60;
    }
    const now = new Date();
    const minTime = new Date(now.getTime() + minDelay * 60000);
    const maxTime = new Date(now.getTime() + maxDelay * 60000);
    const formatTime = (date: Date) => {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    };
    return `${formatTime(minTime)} - ${formatTime(maxTime)}`;
  };

  return (
    <div className="fixed inset-0 z-[400] flex flex-col justify-end md:items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Rastreio" tabIndex={-1} className="relative w-full md:max-w-md lg:max-w-lg h-[92dvh] md:h-full bg-[#F5F5F7] shadow-3xl flex flex-col rounded-t-[2.5rem] md:rounded-none md:rounded-l-[2.5rem] animate-sheet md:animate-drawer overflow-hidden z-10">
        
        <div className="w-full flex md:hidden justify-center items-center h-8 bg-white shrink-0 cursor-pointer" onClick={onClose}>
           <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        <header className="px-6 py-4 md:py-5 flex justify-between items-center bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-vovoh-gold text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100"><Clock size={24}/></div>
            <div>
              <h3 className="text-xl font-black text-vovoh-dark leading-tight">Rastreio</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acompanhe seu pedido</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Ativar avisos do pedido" title="Ativar avisos do pedido" disabled={activatingNotices} onClick={async () => {
              setActivatingNotices(true); setNoticeMessage('');
              try {
                if (!orders.some((order: any) => order.userId) || (selectedOrder && !selectedOrder.userId)) throw new Error('Avisos automáticos exigem um pedido feito com conta. Para este pedido, use Atualizar rastreio.');
                if (typeof Notification === 'undefined') throw new Error('No iPhone, adicione à Tela de Início e abra pelo ícone (iOS 16.4 ou superior). Você também pode usar Atualizar rastreio.');
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') throw new Error('Avisos não permitidos. Libere as notificações nas configurações do navegador para ativar.');
                await subscribeToPush(selectedOrder?.userId, 'customer');
                setNoticeMessage('Avisos cadastrados neste aparelho.');
              } catch (error) { setNoticeMessage(error instanceof Error ? error.message : 'Não foi possível ativar os avisos.'); }
              finally {setActivatingNotices(false);}
            }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-gold hover:bg-amber-50 transition-colors active:scale-90 disabled:opacity-50">
              {activatingNotices ? <Loader2 size={20} className="animate-spin" /> : <Bell size={20} />}
            </button>
            <button aria-label="Atualizar rastreio" title="Atualizar rastreio" onClick={onRefresh} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-gold hover:bg-amber-50 transition-colors active:rotate-180 duration-500">
              <RefreshCw size={20} />
            </button>
            <button aria-label="Fechar sacola" onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-dark transition-colors active:scale-90"><X size={20}/></button>
          </div>
        </header>

        <div className="flex-grow overflow-y-auto overscroll-contain touch-pan-y min-h-0 p-4 sm:p-6 space-y-8 bg-[#F5F5F7] no-scrollbar pb-32">
            
            {noticeMessage && <p role="status" className="p-4 rounded-2xl bg-white border border-gray-200 text-sm text-gray-700">{noticeMessage}</p>}
            {!selectedOrder ? (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-vovoh-dark px-2">Seus Pedidos Ativos</h3>
                {orders && orders.length > 0 ? (
                  orders.map((o: any) => (
                    <div key={o.id} onClick={() => setSelectedOrder(o)} className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm cursor-pointer hover:border-vovoh-gold transition-all active:scale-95 group">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">#{String(o.id || '').slice(-4)}</span>
                        <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full whitespace-nowrap shadow-sm ${o.status === 'concluido' ? 'bg-green-100 text-green-600' : o.status === 'cancelado' || o.status === 'pix_recusado' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                          {o.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-base font-black text-vovoh-dark mb-1">R$ {parseFloat(o.total || 0).toFixed(2)}</p>
                          <p className="text-xs font-bold text-gray-400">{o.items?.length || 0} itens • {o.payment?.method === 'pix' ? 'Pix' : o.payment?.method === 'dinheiro' ? 'Dinheiro na entrega' : 'Cartão'}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 group-hover:bg-vovoh-gold group-hover:text-white transition-colors">
                          <ArrowRight size={16} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4">
                    <PackageCheck size={64} className="text-gray-300" />
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nenhum pedido encontrado</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {orders && orders.length > 1 && (
                  <button onClick={() => setSelectedOrder(null)} className="text-xs font-black text-gray-400 flex items-center gap-2 hover:text-vovoh-dark p-2 -ml-2 transition-colors">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm"><ArrowLeft size={12}/></div>
                    Voltar para lista
                  </button>
                )}
                
                <div className="text-center space-y-4">
                  <div className="inline-flex flex-col items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Pedido #{String(selectedOrder.id || '').slice(-4)}</span>
                    <h3 className="text-2xl  font-black text-vovoh-dark tracking-tight">
                      {selectedOrder.status === 'concluido' ? 'Pedido Entregue!' : 'Acompanhe seu Pedido'}
                    </h3>
                  </div>
                  
                  <div className="bg-white p-6  rounded-[2.5rem] border border-gray-100 flex flex-col items-center gap-3 shadow-xl shadow-gray-200/50 mt-2 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-vovoh-gold via-amber-500 to-vovoh-red"></div>
                    <div className="flex items-center gap-2 text-vovoh-gold mb-1 bg-amber-50 px-3 py-1 rounded-full">
                        <Clock size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Previsão</span>
                    </div>
                    <p className="text-4xl  font-black text-vovoh-dark tracking-tighter text-center leading-none py-2">{getArrivalWindow(selectedOrder)}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Horário estimado de chegada</p>
                  </div>
                </div>

                <div className="relative space-y-8 px-2  py-4">
                  {selectedOrder.status === 'pendente' && selectedOrder.acknowledgedAt && <div role="status" className="delivery-result p-4 rounded-2xl text-sm font-bold">A loja confirmou seu pedido. {selectedOrder.scheduledTo ? 'O preparo será iniciado para o horário agendado.' : 'Aguardando o início do preparo.'}</div>}
                  {selectedOrder.status === 'pendente' && !selectedOrder.acknowledgedAt && (
                    <div className="bg-amber-50 p-5 rounded-[2rem] border border-amber-100 space-y-3 animate-in fade-in slide-in-from-top-4 shadow-sm">
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle size={18} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">A vovó ainda não viu?</span>
                      </div>
                      <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                        Se a vovó demorar para confirmar, você pode dar um "alô" no WhatsApp para ela não perder seu pedido!
                      </p>
                      <a 
                        href={`https://wa.me/${(dynamicConfigs?.whatsapp_number || '554195796370').replace(/\D/g, '')}?text=Olá vovó! Fiz o pedido #${String(selectedOrder.id).slice(-4)} e gostaria de confirmar se você recebeu.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3.5 bg-[#25D366] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-green-900/10 hover:brightness-110"
                      >
                        <MessageSquare size={16} />
                        Avisar a Vovó no WhatsApp
                      </a>
                    </div>
                  )}

                  {selectedOrder.status === 'cancelado' ? (
                    <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 flex flex-col items-center gap-4 text-center shadow-lg shadow-red-100/50">
                      <div className="w-20 h-20 bg-white text-red-500 rounded-3xl flex items-center justify-center shadow-md mb-2"><X size={40}/></div>
                      <div>
                        <h4 className="text-xl font-black text-red-600 mb-1">{selectedOrder.refusalReason ? "Agendamento Recusado" : "Pedido Cancelado"}</h4>
                        <p className="text-xs font-bold text-red-400">O pedido não pôde ser concluído.</p>
                      </div>
                      
                      {selectedOrder.refusalReason ? (
                        <div className="bg-white p-5 rounded-2xl border border-red-100 w-full shadow-sm">
                          <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Motivo da Vovó:</p>
                          <p className="text-sm font-bold text-red-600 italic leading-relaxed">"{selectedOrder.refusalReason}"</p>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-red-500/80 leading-relaxed">Poxa, que pena! Mas a vovó entende. Volte sempre que quiser um salgadinho quentinho.</p>
                      )}
                      
                      <div className="w-full space-y-3 mt-4">
                         <button onClick={() => onReorder(selectedOrder.items || [])} className="w-full py-4 bg-vovoh-red text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-red-200 active:scale-95 transition-all hover:brightness-110">
                           {selectedOrder.refusalReason ? 'Agendar para Outro Horário' : 'Refazer Pedido'}
                         </button>
                         <button onClick={() => {
                           onClearOrder(selectedOrder.id);
                           if(orders && orders.length <= 1) onClose();
                           else setSelectedOrder(null);
                         }} className="w-full py-4 bg-white text-gray-400 font-black rounded-2xl text-[10px] uppercase tracking-widest border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all">
                           Remover do Histórico
                         </button>
                      </div>
                    </div>
                  ) : selectedOrder.status === 'pix_recusado' ? (
                    <div className="bg-amber-50 p-8 rounded-[2.5rem] border border-amber-100 flex flex-col items-center gap-4 text-center shadow-lg shadow-amber-100/50">
                      <div className="w-20 h-20 bg-white text-amber-500 rounded-3xl flex items-center justify-center shadow-md mb-2"><AlertTriangle size={40}/></div>
                      <h4 className="text-xl font-black text-amber-600">Problema no Pagamento</h4>
                      <p className="text-sm font-bold text-amber-500/80 leading-relaxed">A vovó não encontrou o seu Pix! Por favor, verifique se o valor foi enviado corretamente ou tente novamente.</p>
                      <button onClick={() => onRetryPayment ? onRetryPayment(selectedOrder) : onReorder(selectedOrder.items || [])} className="mt-4 w-full py-4 bg-amber-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-amber-200 active:scale-95 transition-all hover:brightness-110">
                        Tentar Pagar Novamente
                      </button>
                    </div>
                  ) : (
                    <div className="relative pl-4">
                      {/* Linha do tempo contínua */}
                      <div className="absolute left-[2.35rem] top-8 bottom-8 w-0.5 bg-gray-200 rounded-full"></div>
                      
                      {[
                        { s: 'pendente', l: 'Pedido Recebido', i: <PackageCheck size={20}/>, m: "Aguardando a vovó confirmar..." },
                        { s: 'preparando', l: 'Preparando', i: <ChefHat size={20}/>, m: "A vovó já viu e está preparando!" },
                        { s: 'forno', l: 'No Forno', i: <Flame size={20}/>, m: "Salgados ficando douradinhos!" },
                        { s: 'entrega', l: 'A Caminho', i: <Bike size={20}/>, m: "Saindo quentinho pra você agora." },
                        { s: 'concluido', l: 'Entregue', i: <Heart size={20}/>, m: "Bom apetite, meu anjo!" }
                      ].map((st, i, arr) => {
                        const activeIdx = arr.findIndex(x => x.s === selectedOrder.status);
                        const isActive = i <= activeIdx;
                        const isCurrent = i === activeIdx;
                        
                        return (
                          <div key={st.s} className={`relative flex items-start gap-6 mb-8 last:mb-0 transition-all duration-700 ${isActive ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center z-10 shadow-lg transition-all duration-500 border-4 ${isActive ? 'bg-vovoh-red text-white border-white shadow-red-200 scale-110' : 'bg-gray-100 text-gray-400 border-white'}`}>
                              {st.i}
                            </div>
                            <div className={`flex-1 pt-2 p-4 rounded-2xl transition-all ${isCurrent ? 'bg-white shadow-md border border-gray-100 -ml-2 pl-6' : ''}`}>
                              <h4 className={`font-black text-lg leading-none ${isActive ? 'text-vovoh-dark' : 'text-gray-400'}`}>{st.l}</h4>
                              {isActive && <p className="text-vovoh-red text-xs font-bold mt-2 leading-tight">"{st.m}"</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                
                <div className="pt-4 pb-10 space-y-3">
                  {selectedOrder.status === 'concluido' || selectedOrder.status === 'cancelado' ? (
                    <button onClick={() => onReorder(selectedOrder.items || [])} className="w-full py-5 bg-vovoh-red text-white font-black rounded-2xl shadow-xl shadow-red-200 text-sm flex justify-center items-center gap-2 active:scale-95 transition-all hover:brightness-110">
                      Fazer Novo Pedido Igual <Heart size={16} className="fill-current"/>
                    </button>
                  ) : null}

                  {(selectedOrder.status === 'concluido' || selectedOrder.status === 'cancelado' || selectedOrder.status === 'pix_recusado') && (
                     <button onClick={() => { 
                       onClearOrder(selectedOrder.id); 
                       if(orders && orders.length <= 1) {
                         onClose();
                       } else {
                         setSelectedOrder(null);
                       }
                     }} className="w-full py-4 text-gray-400 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-gray-100 active:scale-95 transition-all">
                       Remover do Histórico
                     </button>
                  )}
                  
                  {selectedOrder.status !== 'concluido' && selectedOrder.status !== 'cancelado' && selectedOrder.status !== 'pix_recusado' && (
                    <>
                      {onReceiveOrder && selectedOrder.status === 'entrega' && (
                        <button onClick={() => onReceiveOrder(selectedOrder.id)} className="w-full py-5 bg-green-500 text-white font-black rounded-2xl shadow-xl shadow-green-200 text-sm flex justify-center items-center gap-2 active:scale-95 transition-all hover:brightness-110 animate-pulse">
                          Já Recebi o Pedido! <Check size={18} />
                        </button>
                      )}
                      
                      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Precisa de ajuda com o pedido?</p>
                        <div className="grid grid-cols-2 gap-3">
                          <a 
                            href={`https://wa.me/${(dynamicConfigs?.whatsapp_number || '554195796370').replace(/\D/g, '')}?text=Olá! Gostaria de falar sobre meu pedido #${String(selectedOrder.id).slice(-4)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center justify-center gap-2 p-4 bg-[#25D366]/10 text-[#25D366] rounded-2xl border border-[#25D366]/20 active:scale-95 transition-all hover:bg-[#25D366] hover:text-white group"
                          >
                            <MessageSquare size={20} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Mensagem</span>
                          </a>
                          <a 
                            href={`tel:${(dynamicConfigs?.whatsapp_number || '554195796370').replace(/\D/g, '')}`}
                            className="flex flex-col items-center justify-center gap-2 p-4 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 active:scale-95 transition-all hover:bg-blue-600 hover:text-white group"
                          >
                            <Phone size={20} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Ligar</span>
                          </a>
                        </div>
                        <p className="text-[9px] text-gray-400 font-bold text-center leading-tight">A vovó atende rapidinho se você chamar!</p>
                      </div>

                      <button onClick={onClose} className="w-full py-5 bg-white border border-gray-200 text-gray-500 font-black rounded-2xl text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:bg-gray-50">
                        Minimizar Detalhes
                      </button>
                      {selectedOrder.status === 'pendente' && onCancelOrder && (
                        <>
                          {!showCancelConfirm ? (
                            <button onClick={() => setShowCancelConfirm(true)} className="w-full py-4 text-vovoh-red font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-red-50 active:scale-95 transition-all">
                              Cancelar Pedido
                            </button>
                          ) : (
                            <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100 animate-in fade-in zoom-in-95 shadow-lg">
                              <p className="text-sm font-bold text-red-600 mb-4 text-center leading-relaxed">Tem certeza que deseja cancelar? A vovó já estava separando os ingredientes...</p>
                              <div className="flex gap-3">
                                <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-4 bg-white text-gray-500 font-black rounded-xl text-[10px] uppercase tracking-widest border border-gray-200 active:scale-95 transition-all hover:bg-gray-50">
                                  Não, manter
                                </button>
                                <button onClick={() => {
                                  setShowCancelConfirm(false);
                                  onCancelOrder(selectedOrder.id);
                                }} className="flex-1 py-4 bg-vovoh-red text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-red-200 active:scale-95 transition-all hover:brightness-110">
                                  Sim, cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
};
