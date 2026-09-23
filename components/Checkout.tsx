import React, { useEffect, useState, useRef } from 'react';
import { X, ShoppingCart, Trash2, ArrowRight, User, MapPin, Zap, CheckCircle2, Bike, ChefHat, Flame, Heart, PackageCheck, Award, Star, Clock, LogIn, AlertTriangle, CreditCard, Check, ArrowLeft, RefreshCw, Loader2, MessageSquare, Phone } from 'lucide-react';
import { PixBox, StripePaymentBox } from './UI';
import { PLACEHOLDER_IMG } from '../constants/index';
import { normalizeCoordinate } from '../utils/geo';
import { subscribeToPush } from '../src/utils/push';

export const Checkout = ({ isOpen, onClose, cart, setCart, customer, setCustomer, method, setMethod, changeFor, setChangeFor, onOrder, pixKey, user, openAuth, coupons, dynamicConfigs, showMsg }: any) => {
  const [fidelidade, setFidelidade] = useState(0);
  const [step, setStep] = useState('cart');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryDistance, setDeliveryDistance] = useState(0);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [feeCalculated, setFeeCalculated] = useState(false);
  const [addressError, setAddressError] = useState('');
  
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const [cep, setCep] = useState('');
  const [searchingCep, setSearchingCep] = useState(false);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const numberRef = useRef<HTMLInputElement>(null);
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (customer.address && !street && !city) {
      // Tenta fazer um parse básico se já vier preenchido do banco
      const parts = customer.address.split(',');
      if (parts.length > 1) {
        setStreet(parts[0].trim());
        const numAndRest = parts[1].split('-');
        if (numAndRest.length > 0) setNumber(numAndRest[0].trim());
      } else {
        setStreet(customer.address);
      }
    }
  }, []);

  useEffect(() => {
    if (street && number && city) {
      const newAddress = `${street}, ${number} - ${neighborhood}, ${city} - ${state}, ${cep}`;
      setCustomer((prev: any) => ({ ...prev, address: newAddress }));
    }
  }, [street, number, neighborhood, city, state, cep]);

  const searchCep = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      setAddressError("CEP inválido. Digite 8 números.");
      return;
    }
    setAddressError('');
    setSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        setAddressError("CEP não encontrado.");
        return;
      }
      setStreet(data.logradouro || '');
      setNeighborhood(data.bairro || '');
      setCity(data.localidade || '');
      setState(data.uf || '');
      setFeeCalculated(false);
      
      // Foca no número automaticamente para agilizar
      setTimeout(() => numberRef.current?.focus(), 100);
    } catch (e) {
      setAddressError("Erro ao buscar CEP.");
    } finally {
      setSearchingCep(false);
    }
  };

  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setAddressError("Geolocalização não suportada pelo seu navegador.");
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await res.json();
        
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
        }
      } catch (e) {
        setAddressError("Erro ao obter endereço pela localização.");
      } finally {
        setIsGettingLocation(false);
      }
    }, () => {
      setAddressError("Permissão de localização negada.");
      setIsGettingLocation(false);
    });
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
    if (!customer.address) {
      setAddressError("Por favor, preencha seu endereço completo primeiro.");
      return;
    }
    if (!dynamicConfigs?.store_lat || !dynamicConfigs?.store_lng) {
      setAddressError("A loja ainda não configurou o endereço de entrega.");
      return;
    }

    setCalculatingFee(true);
    try {
      // Busca mais precisa usando os campos separados
      const params = new URLSearchParams({
        format: 'json',
        street: `${number} ${street}`,
        city: city,
        state: state,
        country: 'Brazil',
        postalcode: cep.replace(/\D/g, '')
      });

      let res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
      let data = await res.json();
      
      // Fallback para busca genérica se a estruturada falhar
      if (!data || data.length === 0) {
        const searchQuery = `${street}, ${number}, ${city}, ${state}, Brasil`;
        res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
        data = await res.json();
      }
      
      if (data && data.length > 0) {
        const customerLat = parseFloat(data[0].lat);
        const customerLng = parseFloat(data[0].lon);
        const storeLat = normalizeCoordinate(dynamicConfigs.store_lat);
        const storeLng = normalizeCoordinate(dynamicConfigs.store_lng);

        const R = 6371; // Radius of the earth in km
        const dLat = (customerLat - storeLat) * (Math.PI/180);
        const dLon = (customerLng - storeLng) * (Math.PI/180);
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(storeLat * (Math.PI/180)) * Math.cos(customerLat * (Math.PI/180)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const distance = R * c; // Distance in km

        const freeRadius = parseFloat(dynamicConfigs.free_delivery_radius || '0');
        const feePerKm = parseFloat(dynamicConfigs.fee_per_km || '0');
        const maxRadius = parseFloat(dynamicConfigs.max_delivery_radius || '999');

        if (distance > maxRadius) {
          setAddressError(`Desculpe, só entregamos até ${maxRadius}km. Sua distância é de ${distance.toFixed(1)}km.`);
          setFeeCalculated(false);
          setDeliveryFee(0);
        } else {
          let fee = 0;
          if (distance > freeRadius) {
            fee = (distance - freeRadius) * feePerKm;
          }
          setDeliveryDistance(distance);
          setDeliveryFee(fee);
          setFeeCalculated(true);
        }
      } else {
        setAddressError("Não conseguimos encontrar seu endereço. Por favor, seja mais específico (Rua, Número, Cidade).");
      }
    } catch (e) {
      setAddressError("Erro ao calcular o frete. Tente novamente.");
    } finally {
      setCalculatingFee(false);
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

  const handleOrder = () => {
    let scheduledTo = undefined;
    if (isScheduled && scheduledDate && scheduledTime) {
      scheduledTo = `${scheduledDate}T${scheduledTime}:00`;
    }
    onOrder({ finalTotal: total, coupon: appliedCoupon?.code, deliveryFee, deliveryDistance, scheduledTo });
  };

  return (
    <div className="fixed inset-0 z-[400] flex flex-col justify-end items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full desktop:max-w-[480px] h-[90vh] bg-[#F9F9F9] shadow-3xl flex flex-col rounded-t-[2.5rem] animate-sheet overflow-hidden">
        
        <div className="w-full flex justify-center items-center h-8 bg-white shrink-0 cursor-pointer" onClick={onClose}>
           <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
        </div>

        <header className="px-6 py-4  flex justify-between items-center bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-vovoh-red text-white rounded-[1rem] flex items-center justify-center shadow-lg shadow-red-100"><ShoppingCart size={20}/></div>
            <h3 className="text-xl font-black text-vovoh-dark">Sua Sacola</h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-dark hover:bg-gray-100 transition-colors"><X size={20}/></button>
        </header>

        <div ref={scrollRef} className="flex-grow overflow-y-auto p-6  space-y-8 bg-[#F9F9F9] no-scrollbar pb-32 ">
          
          {(step === 'cart' || step === 'details' || step === 'payment') && (
            <div className="bg-gradient-to-br from-vovoh-gold to-amber-600 p-6  rounded-[2rem] text-white shadow-lg relative overflow-hidden shrink-0">
               <div className="absolute -top-4 -right-4 opacity-10 rotate-12"><Award size={100} /></div>
               <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-black text-[10px]  uppercase tracking-widest">Cartão Fidelidade</h4>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black">{fidelidade}/10</span>
                  </div>
                  <div className="flex gap-1.5 ">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className={`w-6 h-6   rounded-full border-2 border-white/30 flex items-center justify-center transition-all ${i < fidelidade ? 'bg-white text-vovoh-gold scale-110 shadow-lg' : 'bg-transparent text-white/30'}`}>
                        {i < fidelidade ? <Heart size={12} fill="currentColor" /> : <Star size={10} />}
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] [10px] font-bold opacity-80 leading-tight">Complete seu cartão e ganhe um lanche grátis! 🥟</p>
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
                      <div key={`${item.id}-${index}`} className="bg-white p-4 rounded-[1.5rem] flex items-center gap-4 shadow-sm border border-gray-100">
                        <img src={item.image || PLACEHOLDER_IMG} className="w-16 h-16 rounded-xl object-cover bg-vovoh-cream" />
                        <div className="flex-grow">
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
                        <div className="flex flex-col items-center justify-center gap-2">
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
                            className="flex-grow p-4 bg-white rounded-xl border border-gray-200 font-bold text-xs uppercase outline-none focus:border-vovoh-red transition-all"
                          />
                          <button onClick={handleApplyCoupon} className="px-6 bg-vovoh-dark text-white font-black rounded-xl text-[10px] uppercase tracking-widest active:scale-95 transition-all">Aplicar</button>
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
                       {deliveryFee > 0 && (
                         <div className="flex justify-between text-xs font-bold text-gray-400">
                            <span>Taxa de Entrega</span>
                            <span>R$ {deliveryFee.toFixed(2)}</span>
                         </div>
                       )}
                       {appliedCoupon && (
                         <div className="flex justify-between text-xs font-bold text-green-600">
                            <span>Desconto</span>
                            <span>- R$ {discount.toFixed(2)}</span>
                         </div>
                       )}
                       <div className="flex justify-between items-end pt-2">
                          <span className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Total a Pagar</span>
                          <span className="text-3xl  font-black text-vovoh-dark tracking-tighter leading-none">R$ {total.toFixed(2)}</span>
                       </div>
                    </div>
                  </div>
                  
                  <button onClick={() => setStep('details')} className="w-full py-5 bg-vovoh-red text-white font-black rounded-2xl shadow-xl shadow-red-200 flex items-center justify-center gap-3 text-base active:scale-95 transition-all mt-4">
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
                <label className="flex items-center gap-2 font-black text-vovoh-dark px-1 text-sm"><User size={16} className="text-vovoh-red"/> Nome Completo</label>
                <input 
                  type="text" 
                  placeholder="Ex: João da Silva"
                  className="w-full p-5 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm" 
                  value={customer.name} 
                  onChange={e => setCustomer({...customer, name: e.target.value})} 
                />
                
                <label className="flex items-center gap-2 font-black text-vovoh-dark px-1 text-sm pt-2"><Zap size={16} className="text-vovoh-red"/> WhatsApp</label>
                <input 
                  type="tel" 
                  placeholder="Ex: 41999999999 (Apenas números)"
                  className="w-full p-5 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm" 
                  value={customer.phone} 
                  onChange={e => setCustomer({...customer, phone: e.target.value.replace(/\D/g, '')})} 
                />
                
                <label className="flex items-center gap-2 font-black text-vovoh-dark px-1 text-sm pt-2"><MapPin size={16} className="text-vovoh-red"/> Endereço de Entrega Completo</label>
                
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input type="text" placeholder="CEP (Apenas números)" maxLength={8} className="w-full /3 p-5 bg-white rounded-2xl border border-gray-200 font-bold outline-none focus:border-vovoh-red transition-colors text-sm" value={cep} onChange={e => setCep(e.target.value)} />
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
                
                <button onClick={calculateDeliveryFee} disabled={calculatingFee || !street || !number || !city} className="w-full py-4 bg-vovoh-dark text-white rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50">
                  {calculatingFee ? 'Calculando...' : 'Calcular Frete'}
                </button>

                {addressError && <p className="text-[10px] font-bold text-vovoh-red px-1">{addressError}</p>}
                
                <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-4">
                  <div className="flex gap-2 p-1 bg-gray-50 rounded-xl">
                    <button 
                      onClick={() => setIsScheduled(false)}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isScheduled ? 'bg-white text-vovoh-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Entrega Agora
                    </button>
                    <button 
                      onClick={() => setIsScheduled(true)}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isScheduled ? 'bg-white text-vovoh-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      Agendar Entrega
                    </button>
                  </div>

                  {isScheduled && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Data</label>
                        <input 
                          type="date" 
                          className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:border-vovoh-gold text-gray-600"
                          value={scheduledDate}
                          onChange={e => setScheduledDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">Horário</label>
                        <input 
                          type="time" 
                          className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:border-vovoh-gold text-gray-600"
                          value={scheduledTime}
                          onChange={e => setScheduledTime(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {feeCalculated && (
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Distância: {deliveryDistance.toFixed(1)}km</p>
                      <p className="text-xs font-bold text-green-700">Taxa de Entrega: {deliveryFee === 0 ? 'Grátis!' : `R$ ${deliveryFee.toFixed(2)}`}</p>
                    </div>
                    <CheckCircle2 size={24} className="text-green-500" />
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                 <button onClick={() => setStep('cart')} className="px-6 py-5 bg-white border border-gray-200 text-gray-500 font-black rounded-2xl text-sm active:scale-95 transition-all">Voltar</button>
                 <button 
                   onClick={() => {
                     if (!customer.name || customer.name.trim().length < 3) {
                       setAddressError("Por favor, digite seu nome completo, meu anjo.");
                       return;
                     }
                     if (!customer.phone || customer.phone.length < 10) {
                       setAddressError("Por favor, digite um WhatsApp válido com DDD (apenas números).");
                       return;
                     }
                     if (!feeCalculated) {
                       setAddressError("Por favor, calcule o frete antes de prosseguir para o pagamento.");
                       return;
                     }
                     setStep('payment');
                   }} 
                   className="flex-grow py-5 bg-vovoh-red text-white font-black rounded-2xl shadow-lg shadow-red-200 text-sm active:scale-95 transition-all"
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
                      <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${method === 'pix' ? 'text-vovoh-gold' : 'text-gray-400'}`}>Aprovação na hora</p>
                    </div>
                  </div>
                  {method === 'pix' && <CheckCircle2 size={20} className="text-vovoh-gold" />}
                </button>
                
                <button onClick={() => setMethod('cartao_online')} className={`p-5 rounded-2xl border-2 flex items-center justify-between transition-all ${method === 'cartao_online' ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-200 bg-white opacity-60'}`}>
                   <div className="flex items-center gap-4 text-left">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${method === 'cartao_online' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}><CreditCard size={20}/></div>
                    <div>
                      <p className="font-black text-vovoh-dark text-sm leading-tight">Cartão de Crédito ou Débito (Online)</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${method === 'cartao_online' ? 'text-blue-500' : 'text-gray-400'}`}>Pague agora via Stripe</p>
                    </div>
                  </div>
                  {method === 'cartao_online' && <CheckCircle2 size={20} className="text-blue-500" />}
                </button>
              </div>

              <div className="pt-4">
                 {method === 'pix' ? (
                   <PixBox pixKey={pixKey} total={total} onComplete={handleOrder} />
                 ) : method === 'cartao_online' ? (
                   <StripePaymentBox onComplete={handleOrder} total={total} customer={customer} />
                 ) : (
                   <button onClick={handleOrder} className="w-full py-5 bg-vovoh-red text-white font-black rounded-2xl shadow-xl shadow-red-200 text-base active:scale-95 transition-all">
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
      return `Agendado: ${scheduledDate.toLocaleDateString('pt-BR')} às ${scheduledDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
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
    <div className="fixed inset-0 z-[400] flex flex-col justify-end items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="relative w-full desktop:max-w-[480px] h-[92vh] bg-[#F5F5F7] shadow-3xl flex flex-col rounded-t-[2.5rem] animate-sheet overflow-hidden">
        
        <div className="w-full flex justify-center items-center h-8 bg-white shrink-0 cursor-pointer" onClick={onClose}>
           <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
        </div>

        <header className="px-6 py-4  flex justify-between items-center bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-vovoh-gold text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-100"><Clock size={24}/></div>
            <div>
              <h3 className="text-xl font-black text-vovoh-dark leading-tight">Rastreio</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acompanhe seu pedido</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => {
              if (typeof Notification !== 'undefined' && 'Notification' in window) {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                  const userId = selectedOrder?.userId;
                  const subscribed = await subscribeToPush(userId, 'customer');
                  if (subscribed) alert("Notificações ativadas! Você será avisado sobre seus pedidos.");
                }
              } else {
                alert("Seu navegador não suporta notificações.");
              }
            }} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-gold hover:bg-amber-50 transition-colors active:scale-90">
              <Zap size={20} />
            </button>
            <button onClick={onRefresh} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-gold hover:bg-amber-50 transition-colors active:rotate-180 duration-500">
              <RefreshCw size={20} />
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-vovoh-dark transition-colors active:scale-90"><X size={20}/></button>
          </div>
        </header>

        <div className="flex-grow overflow-y-auto p-6  space-y-8 bg-[#F5F5F7] no-scrollbar pb-32 ">
            
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
                          <p className="text-xs font-bold text-gray-400">{o.items?.length || 0} itens • {o.payment?.method === 'pix' ? 'Pix' : 'Cartão'}</p>
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
                  {selectedOrder.status === 'pendente' && (
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
