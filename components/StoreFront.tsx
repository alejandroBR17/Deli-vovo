import { startVisiblePolling } from '../src/utils/visible-polling';
import React, { useState, useEffect, useRef } from 'react';
import { useModalFocus } from '../src/hooks/use-modal-focus';
import { Star, Plus, ChefHat, Loader2, Clock, Heart, ShieldCheck, MessageSquare, ChevronDown, Instagram, Facebook, Flame, X, Check, Timer, Search, MapPin } from 'lucide-react';
import { CATEGORIES, PLACEHOLDER_IMG, STORE_NAME, GAS_API_URL } from '../constants/index';
import { GrandmaLoader } from './UI';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (value: number) => currencyFormatter.format(value);
const searchText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export const StoreFront = ({ products, isLoading, onAddToCart, logo, dynamicConfigs, isClosed }: any) => {
  const [activeCat, setActiveCat] = useState('todos');
  const [search, setSearch] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariation, setSelectedVariation] = useState<any>(null);
  const [selectedAdditionals, setSelectedAdditionals] = useState<any[]>([]);
  const [observation, setObservation] = useState("");
  const [prepTime, setPrepTime] = useState<any>(null);
  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
  const productDialog = useRef<HTMLDivElement>(null);
  const imageDialog = useRef<HTMLDivElement>(null);
  useModalFocus(productDialog, Boolean(selectedProduct), () => setSelectedProduct(null));
  useModalFocus(imageDialog, Boolean(selectedZoomImage), () => setSelectedZoomImage(null));

  const FAQS = [
    { q: "Como consulto o frete?", a: "Informe seu endereço na sacola e toque em Calcular Frete para conferir a disponibilidade e o valor antes de pagar." },
    { q: "Posso agendar um pedido?", a: "Sim. Nos detalhes da sacola, escolha Agendar Entrega e informe uma data e um horário dentro do expediente da loja." },
    { q: "Quais formas de pagamento estão disponíveis?", a: "As opções disponíveis aparecem na etapa de pagamento, antes de enviar seu pedido." },
    { q: "Como acompanho meu pedido?", a: "Abra Pedidos para consultar o andamento e entrar em contato com a loja." }
  ];

  const testimonials = dynamicConfigs?.testimonials 
    ? (() => {
        try {
          const parsed = JSON.parse(dynamicConfigs.testimonials);
          return Array.isArray(parsed) ? parsed.filter(t => typeof t?.name === 'string' && typeof t?.text === 'string') : [];
        } catch (e) {
          return [];
        }
      })()
    : [];

  const faqs = dynamicConfigs?.faqs
    ? (() => {
        try {
          const parsed = JSON.parse(dynamicConfigs.faqs);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : FAQS;
        } catch (e) {
          return FAQS;
        }
      })()
    : FAQS;

  useEffect(() => {
    const fetchPrepTime = async () => {
      try {
        const res = await fetch(`${GAS_API_URL}/stats/prep-time`);
        if (res.ok) {
          const data = await res.json();

          setPrepTime(data);
        } else {
          return false;
        }
      } catch (e) {
        return false;
      }
    };
    return startVisiblePolling(fetchPrepTime, 600000);
  }, []);

  const visibleCategories = CATEGORIES.filter(cat => 
    cat.id === 'todos' || products.some((p: any) => p.category === cat.id)
  );
  const currentCat = visibleCategories.some(cat => cat.id === activeCat) ? activeCat : 'todos';
  const query = searchText(search.trim());
  const filteredProducts = products.filter((product: any) => (currentCat === 'todos' || product.category === currentCat) && searchText(`${product.name || ''} ${product.description || ''}`).includes(query));

  return (
    <>
      <header className="max-w-7xl mx-auto px-4 md:px-6 pt-3 md:pt-8 pb-5">
        <div className="rounded-3xl bg-[#FFF5E9] border border-orange-100 p-4 md:p-8 grid md:grid-cols-[1.5fr_1fr] gap-4 md:gap-10 items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-vovoh-red/5 flex items-center justify-center">
                <ChefHat size={32} className="text-vovoh-red" aria-hidden="true" />
                {!logoFailed && <img src={logo} width={80} height={80} alt="Logo Delícias da Vovó" onError={() => setLogoFailed(true)} className="absolute inset-0 w-full h-full object-contain" />}
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-vovoh-gold text-vovoh-dark px-2 py-1 rounded-full text-[10px] font-bold shadow-sm">Artesanal</span>
              </div>
              <div className="min-w-0"><p className="text-xs md:text-sm font-semibold text-vovoh-red mb-1">Da cozinha da vovó para você</p><h1 className="font-sans text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-vovoh-dark leading-tight">{String(dynamicConfigs?.store_name || dynamicConfigs?.shop_name || STORE_NAME).replace(/<[^>]*>/g, ' ').trim()}</h1></div>
            </div>
            <p className="text-sm md:text-base text-gray-600 mt-3 max-w-lg leading-relaxed">{dynamicConfigs?.store_subtitle || 'Escolha seus salgados, confira o frete e faça seu pedido.'}</p>
            <a href="#menu" className="hidden md:inline-flex items-center gap-2 min-h-11 mt-1 md:mt-4 text-sm font-bold text-vovoh-red underline underline-offset-4">Escolher meus salgados <Plus size={16} aria-hidden="true" /></a>
          </div>
          <div className="min-w-0 rounded-2xl bg-white/80 p-3 md:p-4 border border-white space-y-3">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className={'w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 '+(isClosed ? 'bg-amber-500' : 'bg-green-600')} />
              <div><p className="text-sm font-bold text-vovoh-dark">{!dynamicConfigs ? 'Consultando atendimento' : isClosed ? 'Fechado agora · você pode agendar' : 'Aberto para pedidos'}</p><p className="hidden md:block text-xs text-gray-600 mt-1">{isClosed ? 'Escolha uma data e um horário dentro do expediente.' : 'Monte sua sacola e confira as opções ao finalizar.'}</p></div>
            </div>
            <div className="border-t border-orange-100 pt-3 grid grid-cols-2 gap-3 text-xs md:text-sm">
              {prepTime?.forecast && <div className="flex gap-2 items-center"><Clock size={17} className="text-vovoh-red shrink-0" aria-hidden="true" /><div><span className="block text-[10px] md:text-xs text-gray-500">Previsão da cozinha</span><span className="font-semibold text-vovoh-dark">{prepTime.forecast}</span></div></div>}
              <div className="flex gap-2 items-center"><MapPin size={17} className="text-vovoh-red shrink-0" aria-hidden="true" /><div><span className="block text-xs text-gray-500">Entrega</span><span className="font-semibold text-vovoh-dark">Frete pelo seu endereço</span></div></div>
            </div>
          </div>
        </div>
      </header>

      <main id="menu" className="pb-12 max-w-7xl mx-auto px-4 md:px-6 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
          <div><h2 className="font-sans text-2xl font-bold text-vovoh-dark">Cardápio</h2><p className="text-sm text-gray-600 mt-1">Escolha o que vai na sua sacola.</p></div>
          <div className="relative w-full sm:max-w-sm">
            <label htmlFor="menu-search" className="sr-only">Buscar no cardápio</label>
            <Search size={19} aria-hidden="true" className="absolute left-4 top-3.5 text-gray-500" />
            <input id="menu-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Busque um salgado ou sabor" className="w-full h-12 pl-11 pr-12 rounded-2xl border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-vovoh-red/30 focus:border-vovoh-red [&::-webkit-search-cancel-button]:hidden" />
            {search && <button type="button" aria-label="Limpar busca" onClick={() => setSearch('')} className="absolute right-1 top-1 w-10 h-10 flex items-center justify-center text-gray-600 rounded-xl hover:bg-gray-100"><X size={18} /></button>}
          </div>
        </div>
        
        <nav aria-label="Categorias do cardápio" className="sticky top-[64px] z-[190] bg-[#F9F9F9]/95 backdrop-blur-xl py-3 -mx-4 px-4 md:mx-0 md:px-0 mb-4 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-200/50 scroll-pl-4">
          {visibleCategories.map(c => (
            <button type="button" aria-pressed={currentCat === c.id} key={c.id} onClick={() => setActiveCat(c.id)} className={`min-h-11 px-5 rounded-full font-semibold text-sm whitespace-nowrap transition-colors flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vovoh-red ${currentCat === c.id ? 'bg-vovoh-red text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-vovoh-red'}`}>
              {c.label}
            </button>
          ))}
        </nav>
        {!isLoading && products.length > 0 && <p role="status" className="text-xs text-gray-500 mb-3">{filteredProducts.length} {filteredProducts.length === 1 ? 'opção disponível' : 'opções disponíveis'}</p>}

        {isLoading ? <GrandmaLoader /> : products.length === 0 ? (
          <div role="status" className="bg-white rounded-3xl border border-gray-100 p-8 md:p-12 text-center">
            <ChefHat size={36} className="mx-auto mb-4 text-vovoh-gold" />
            <h2 className="text-xl font-black text-vovoh-dark">O cardápio está sendo preparado</h2>
            <p className="mt-2 text-sm text-gray-500">Assim que os produtos estiverem disponíveis, você poderá escolher e fazer seu pedido por aqui.</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div role="status" className="bg-white p-8 rounded-2xl border border-gray-200 text-center"><Search size={28} className="mx-auto text-gray-400 mb-3" aria-hidden="true" /><h3 className="font-sans text-lg font-bold">Nenhum produto encontrado</h3><p className="text-sm text-gray-600 mt-2">Tente outro nome ou escolha uma categoria diferente.</p><button type="button" onClick={() => {setSearch('');setActiveCat('todos');}} className="min-h-11 mt-4 px-5 rounded-xl bg-vovoh-red text-white text-sm font-semibold">Limpar filtros</button></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {filteredProducts.map((p: any) => (
              <div key={p.id} className="group bg-white rounded-2xl md:rounded-3xl p-3 md:p-4 shadow-sm border border-gray-100 flex gap-3.5 hover:border-vovoh-red/30 hover:shadow-xl transition-all duration-300 items-stretch">
                <button type="button" aria-label={`Ampliar foto de ${p.name}`}
                  className="w-24 h-24 md:w-28 md:h-28 flex-shrink-0 rounded-xl md:rounded-2xl overflow-hidden bg-vovoh-cream relative cursor-zoom-in group/img self-center"
                  onClick={() => setSelectedZoomImage(p.image || PLACEHOLDER_IMG)}
                >
                   <img loading="lazy" decoding="async" src={p.image || PLACEHOLDER_IMG} className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-700" alt={p.name} />
                </button>
                
                <div 
                  className="flex flex-col flex-grow justify-between py-0.5 md:py-1 cursor-pointer min-w-0"
                  onClick={() => {
                    setSelectedProduct(p);
                    if (p.variations && p.variations.length > 0) {
                      setSelectedVariation(p.variations[0]);
                    } else {
                      setSelectedVariation(null);
                    }
                    setSelectedAdditionals([]);
                    setObservation("");
                  }}
                >
                   <div className="flex flex-col h-full">
                     <div className="flex justify-between items-start gap-2">
                        <h3 className="font-sans text-base font-bold text-vovoh-dark leading-tight line-clamp-2"><button type="button" aria-label={`Ver opções de ${p.name}`} className="text-left min-h-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vovoh-red">{p.name}</button></h3>
                        {p.oldPrice && (
                          <span className="bg-vovoh-gold text-white px-1.5 py-0.5 rounded-md text-[8px] md:text-[9px] font-black uppercase tracking-wider shadow-sm shrink-0">Promo</span>
                        )}
                     </div>
                     {p.description && <p className="text-xs md:text-sm text-gray-600 line-clamp-2 mt-1 mb-3 leading-relaxed">{p.description}</p>}
                     
                     <div className="mt-auto flex items-end justify-between gap-2 pt-1">
                        <div className="flex flex-col">
                          {p.oldPrice && <span className="text-xs text-gray-500 line-through">{money(Number(p.oldPrice))}</span>}
                          {(p.variations?.length > 0) && <span className="text-[11px] text-gray-500">Preço base</span>}
                          <span className="text-base font-bold text-vovoh-dark">{money(Number(p.price))}</span>
                        </div>
                        <button aria-label={`Adicionar ${p.name} à sacola`} onClick={(e) => {
                          e.stopPropagation();
                          if (p.variations?.length || p.additionals?.length) {
                            setSelectedProduct(p);
                            setSelectedVariation(p.variations?.[0] || null);
                            setSelectedAdditionals([]);
                            setObservation("");
                          } else {
                            onAddToCart(p, null, [], "", e);
                          }
                        }} className="w-11 h-11 shrink-0 bg-red-50 text-vovoh-red rounded-xl flex items-center justify-center hover:bg-vovoh-red hover:text-white transition-colors active:scale-95 border border-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vovoh-red">
                          <Plus size={16} strokeWidth={3} />
                        </button>
                     </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedZoomImage && (
        <div ref={imageDialog} role="dialog" aria-modal="true" aria-label="Foto ampliada do produto" tabIndex={-1}
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300"
          onClick={() => setSelectedZoomImage(null)}
        >
          <button 
            aria-label="Fechar foto ampliada"
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white0 text-white rounded-full flex items-center justify-center transition-all z-[301]"
            onClick={() => setSelectedZoomImage(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={selectedZoomImage} 
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl" 
            alt="Zoom" 
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-[500] flex flex-col justify-end md:justify-center items-center p-0 md:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedProduct(null)} />
          
          <div ref={productDialog} role="dialog" aria-modal="true" aria-labelledby="product-options-title" tabIndex={-1} className="relative w-full md:max-w-xl bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full md:zoom-in-95 max-h-[90dvh] md:max-h-[85dvh] overflow-hidden z-10">
            
            {/* Drag Handle for Mobile */}
            <div className="w-full flex md:hidden justify-center items-center h-6 bg-white shrink-0 cursor-pointer" onClick={() => setSelectedProduct(null)}>
               <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
            </div>

            <div className="relative shrink-0">
               <div className="h-48 md:h-56 w-full bg-vovoh-cream relative">
                  <img src={selectedProduct.image || PLACEHOLDER_IMG} className="w-full h-full object-cover" alt={selectedProduct.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <button aria-label="Fechar opções do produto" onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 bg-black/30 backdrop-blur-md p-2 rounded-full hover:bg-black/50 text-white transition-all"><X size={20} /></button>
               </div>
               <div className="absolute bottom-0 left-0 w-full p-6 text-white">
                  <h3 id="product-options-title" className="text-2xl md:text-3xl font-black leading-tight shadow-black drop-shadow-md">{selectedProduct.name}</h3>
                  <p className="text-xs md:text-sm font-medium opacity-90 line-clamp-2 mt-1 drop-shadow-sm">{selectedProduct.description}</p>
               </div>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-white no-scrollbar pb-24">
              {selectedProduct.variations && selectedProduct.variations.length > 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <span className="w-1 h-4 bg-vovoh-red rounded-full"></span>
                    Escolha uma opção
                  </label>
                  <div role="radiogroup" aria-label="Escolha uma opção" className="space-y-2">
                    {selectedProduct.variations.map((v: any, idx: number) => (
                      <label key={idx} className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-vovoh-red ${selectedVariation?.name === v.name ? 'border-vovoh-red bg-red-50 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedVariation?.name === v.name ? 'border-vovoh-red' : 'border-gray-300'}`}>
                            {selectedVariation?.name === v.name && <div className="w-2.5 h-2.5 bg-vovoh-red rounded-full" />}
                          </div>
                          <span className={`font-bold text-sm ${selectedVariation?.name === v.name ? 'text-vovoh-dark' : 'text-gray-600'}`}>{v.name}</span>
                        </div>
                        {v.price !== 0 && <span className="text-xs font-black text-vovoh-red">{v.price > 0 ? '+' : '-'} {money(Math.abs(Number(v.price)))}</span>}
                        <input 
                          type="radio" 
                          name="variation" 
                          className="sr-only"
                          checked={selectedVariation?.name === v.name}
                          onChange={() => setSelectedVariation(v)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct.additionals && selectedProduct.additionals.length > 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <span className="w-1 h-4 bg-vovoh-gold rounded-full"></span>
                    Turbine seu pedido
                  </label>
                  <div className="space-y-2">
                    {selectedProduct.additionals.map((add: any, idx: number) => {
                      const isSelected = selectedAdditionals.some(a => a.name === add.name);
                      return (
                        <label key={idx} className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-vovoh-gold ${isSelected ? 'border-vovoh-gold bg-amber-50 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-vovoh-gold bg-vovoh-gold' : 'border-gray-300'}`}>
                              {isSelected && <Check size={14} className="text-white" />}
                            </div>
                            <span className={`font-bold text-sm ${isSelected ? 'text-vovoh-dark' : 'text-gray-600'}`}>{add.name}</span>
                          </div>
                          {add.price !== 0 && <span className="text-xs font-black text-vovoh-gold">{add.price > 0 ? '+' : '-'} {money(Math.abs(Number(add.price)))}</span>}
                          <input 
                            type="checkbox" 
                            className="sr-only"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAdditionals([...selectedAdditionals, add]);
                              } else {
                                setSelectedAdditionals(selectedAdditionals.filter(a => a.name !== add.name));
                              }
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                   <span className="w-1 h-4 bg-gray-300 rounded-full"></span>
                   Alguma observação?
                </label>
                <textarea 
                  placeholder="Ex: Tirar cebola, ponto da carne, etc..." 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 font-medium outline-none h-24 focus:border-vovoh-red focus:bg-white transition-all text-sm resize-none" 
                  value={observation} 
                  onChange={e => setObservation(e.target.value)} 
                />
              </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full p-4  bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
              <button 
                onClick={(e) => {
                  onAddToCart(selectedProduct, selectedVariation, selectedAdditionals, observation, e);
                  setSelectedProduct(null);
                }} 
                className="w-full py-4  bg-vovoh-dark text-white rounded-2xl font-black text-sm uppercase shadow-xl shadow-black/10 flex items-center justify-between px-6 active:scale-95 transition-all hover:bg-black"
              >
                <span className="flex items-center gap-2"><Plus size={18} /> Adicionar à Sacola</span>
                <span className="bg-white0 px-3 py-1 rounded-lg">{money(Number(selectedProduct.price) + (selectedVariation ? Number(selectedVariation.price) : 0) + selectedAdditionals.reduce((acc, add) => acc + Number(add.price), 0))}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="py-16 md:py-24 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="w-full relative max-w-md mx-auto md:max-w-none">
              <div className="aspect-square bg-vovoh-cream rounded-3xl md:rounded-[3rem] overflow-hidden shadow-2xl">
                <img 
                  src={dynamicConfigs?.story_image || "https://imgur.com/lrKC57Q.png"} 
                  className="w-full h-full object-cover hover:scale-105 transition-all duration-700" 
                  alt="Nossa História" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div className="w-full space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-vovoh-cream text-vovoh-gold rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest">
                Nossa História
              </div>
              <h3 className="text-3xl md:text-5xl font-black text-vovoh-dark tracking-tighter leading-tight">
                Da nossa cozinha <br/>
                <span className="text-vovoh-red font-serif italic">para a sua mesa.</span>
              </h3>
              <div className="text-gray-500 font-medium text-sm md:text-base leading-relaxed whitespace-pre-line">
                {dynamicConfigs?.story_text || `A Delícias da Vovó nasceu do desejo de compartilhar o sabor autêntico da comida caseira. Tudo começou na cozinha da Vovó Grazy, onde cada salgado era feito com um cuidado que só quem ama cozinhar entende.

Com o tempo, o Vovô (que é argentino!) trouxe suas famosas receitas de empanadas, criando uma mistura única de sabores que conquistou toda a vizinhança de Colombo. Hoje, mantemos a mesma essência: massa fresca, recheio generoso e muito capricho.`}
              </div>
              <div className="pt-4 flex items-center gap-4">
                <Heart size={28} className="text-vovoh-red shrink-0" aria-hidden="true" />
                <p className="text-xs md:text-sm font-bold text-vovoh-dark">
                  Receitas de família, preparadas com carinho
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {testimonials.length > 0 && <section className="py-16 md:py-24 max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h3 className="text-3xl md:text-4xl font-black text-vovoh-dark tracking-tighter mb-3">O que dizem os netinhos...</h3>
          <p className="text-xs md:text-sm font-bold text-gray-400 uppercase tracking-widest">Avaliações reais de clientes da região</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t: any, i: number) => (
            <div key={i} className="bg-white p-7 md:p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all flex flex-col justify-between">
              <div>
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: Math.max(0, Math.min(5, Math.round(Number(t.rating ?? t.stars) || 0))) }).map((_, i) => <Star key={i} size={15} className="text-vovoh-gold fill-current" />)}
                </div>
                <p className="text-gray-600 font-medium italic mb-6 text-sm md:text-base leading-relaxed">"{t.text}"</p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                <div className="w-10 h-10 rounded-full bg-vovoh-cream flex items-center justify-center font-black text-vovoh-gold text-sm shadow-inner">
                  {t.name.charAt(0)}
                </div>
                <p className="font-black text-vovoh-dark text-sm">{t.name}</p>
              </div>
            </div>
          ))}
        </div>
      </section>}

      <section className="py-16 md:py-24 bg-vovoh-dark relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-10 left-10 w-64 h-64 bg-vovoh-red rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-vovoh-gold rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-6 relative z-10">
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 text-vovoh-gold rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest mb-4 border border-white/10">
              Central de Ajuda
            </div>
            <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-4">Dúvidas Frequentes</h3>
            <p className="text-gray-400 font-bold text-xs md:text-sm uppercase tracking-widest">Tudo o que você precisa saber sobre as delícias</p>
          </div>

          <div className="grid gap-4">
            {faqs.map((faq: any, i: number) => (
              <div 
                key={i} 
                className={`group rounded-2xl md:rounded-3xl border transition-all duration-300 overflow-hidden ${
                  openFaq === i 
                    ? 'bg-white/10 border-white/20 shadow-2xl' 
                    : 'bg-white/5 border-white/5 hover:bg-white/[0.08] hover:border-white/10'
                }`}
              >
                <button 
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-5 md:p-6 text-left flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition-colors shrink-0 ${
                      openFaq === i ? 'bg-vovoh-red text-white' : 'bg-white/10 text-vovoh-gold'
                    }`}>
                      {i + 1}
                    </div>
                    <span className="font-black text-white text-sm md:text-base tracking-tight">{faq.q}</span>
                  </div>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center bg-white/5 text-white/40 group-hover:text-white transition-all shrink-0 ${
                    openFaq === i ? 'rotate-180 bg-vovoh-red text-white' : ''
                  }`}>
                    <ChevronDown size={18} />
                  </div>
                </button>
                <div id={`faq-answer-${i}`} hidden={openFaq !== i}>
                  <div className="px-6 pb-6 md:pb-8 ml-12">
                    <div className="h-px w-12 bg-vovoh-red/30 mb-4"></div>
                    <p className="text-gray-300 font-medium text-xs md:text-sm leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
