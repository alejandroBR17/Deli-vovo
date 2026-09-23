import React, { useState, useEffect } from 'react';
import { Star, Plus, Send, ChefHat, Loader2, Sparkles, Clock, Heart, ShieldCheck, MessageSquare, ChevronDown, Instagram, Facebook, Flame, X, Check, Timer, Search } from 'lucide-react';
import { CATEGORIES, PLACEHOLDER_IMG, STORE_NAME, GAS_API_URL } from '../constants/index';
import { GrandmaLoader } from './UI';
import ReactMarkdown from 'react-markdown';

const TESTIMONIALS = [
  { name: "Mariana Silva", text: "A melhor coxinha de Colombo! Massa fininha e recheio super temperado. Lembra muito a comida da minha avó.", rating: 5 },
  { name: "Ricardo Santos", text: "As empanadas argentinas são sensacionais! O vovô realmente sabe o que faz. Recomendo a de carne suave.", rating: 5 },
  { name: "Ana Paula", text: "Sempre peço os combos para as festinhas aqui em casa. Chega tudo quentinho e no horário combinado.", rating: 5 }
];

export const StoreFront = ({ products, isLoading, onAddToCart, onAddSuggestedItems, logo, dynamicConfigs }: any) => {
  const [activeCat, setActiveCat] = useState('todos');
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRes, setAiRes] = useState<any>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariation, setSelectedVariation] = useState<any>(null);
  const [selectedAdditionals, setSelectedAdditionals] = useState<any[]>([]);
  const [observation, setObservation] = useState("");
  const [prepTime, setPrepTime] = useState<any>(null);
  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);

  const FAQS = [
    { q: "Qual o tempo médio de entrega?", a: `Nosso tempo médio é de ${dynamicConfigs?.delivery_time || '40 a 60 minutos'}, pois fritamos tudo na hora para chegar bem quentinho!` },
    { q: "Vocês entregam em quais regiões?", a: "Entregamos em toda a região de Colombo e arredores do São Gabriel. Consulte a taxa no checkout." },
    { q: "Os salgados são fritos ou assados?", a: "Temos as duas opções! Nossas empanadas são assadas e nossos salgadinhos tradicionais são fritos na hora." },
    { q: "Como funciona o pagamento online?", a: "Usamos o Stripe, uma das plataformas mais seguras do mundo. Seus dados de cartão nunca ficam salvos conosco." }
  ];

  const testimonials = dynamicConfigs?.testimonials 
    ? (() => {
        try {
          const parsed = JSON.parse(dynamicConfigs.testimonials);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : TESTIMONIALS;
        } catch (e) {
          return TESTIMONIALS;
        }
      })()
    : TESTIMONIALS;

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
          console.log("DEBUG: fetchPrepTime data:", data);
          setPrepTime(data);
        } else {
          console.log("DEBUG: fetchPrepTime failed:", res.status);
        }
      } catch (e) {
        console.error("DEBUG: fetchPrepTime error:", e);
      }
    };
    fetchPrepTime();
    const interval = setInterval(fetchPrepTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const visibleCategories = CATEGORIES.filter(cat => 
    cat.id === 'todos' || products.some((p: any) => p.category === cat.id)
  );

  const askGrandma = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiRes(null);
    try {
      const res = await fetch(`${GAS_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiInput })
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "Erro desconhecido");
      }
      
      if (data.text) {
        let text = data.text;
        let suggestedItems = null;
        
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            const json = JSON.parse(jsonMatch[1]);
            if (json.suggestedItems) {
              suggestedItems = json.suggestedItems;
              text = text.replace(/```json\n[\s\S]*?\n```/, '').trim();
            }
          } catch (e) {
            console.error("Erro ao parsear sugestão:", e);
          }
        }
        setAiRes({ message: text, suggestedItems });
      }
    } catch (e: any) {
      console.error(e);
      setAiRes({ message: `A vovó está um pouco esquecida agora... (${e.message || "Erro desconhecido"})` });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddSuggestion = () => {
    if (!aiRes?.suggestedItems) return;
    
    const itemsToAdd: any[] = [];
    aiRes.suggestedItems.forEach((sug: any) => {
      const product = products.find((p: any) => p.name.toLowerCase().includes(sug.name.toLowerCase()));
      if (product) {
        itemsToAdd.push({ ...product, quantity: sug.quantity });
      }
    });

    if (itemsToAdd.length > 0) {
      onAddSuggestedItems(itemsToAdd);
    } else {
      alert("Vovó não encontrou esses produtos no cardápio exato, mas tente procurar manualmente!");
    }
  };

  return (
    <>
      <header className="pt-24 pb-10   px-4 container mx-auto text-center">
        <div className="relative inline-block mb-6 ">
          <img src={logo} className="w-48 [400px] drop-shadow-2xl animate-in zoom-in duration-700" alt="Logo" />
          <div className="absolute -bottom-2 -right-2   bg-vovoh-gold text-white px-3 py-1  rounded-full shadow-xl rotate-12 flex items-center gap-1  border-2 border-white">
            <Star size={10} fill="white" className=" " />
            <span className="text-[8px]  font-black uppercase tracking-widest">Artesanal</span>
          </div>
        </div>
        
        <h2 className="text-2xl  font-black text-vovoh-dark mb-3  tracking-tight leading-tight" dangerouslySetInnerHTML={{__html: dynamicConfigs?.store_name || `Comidinha de vó, <br/><span class="text-vovoh-red italic font-serif">feita com amor.</span>`}}>
        </h2>
        
        <p className="max-w-lg mx-auto text-gray-500 font-medium mb-6  text-xs  leading-relaxed px-4">
          {dynamicConfigs?.store_subtitle || "Salgados fritos na hora, empanadas autênticas e a verdadeira Massa com tempero de Mãe."}
        </p>

        <div className="flex gap-3 justify-center items-center px-4">
           <a href="#menu" className="flex-1   py-3.5   bg-vovoh-red text-white font-black rounded-full shadow-lg shadow-red-200 hover:brightness-110 active:scale-95 transition-all text-sm  text-center">
             Ver Cardápio
           </a>
           <button onClick={() => document.getElementById('vovoh-ai')?.scrollIntoView({behavior:'smooth'})} className="flex-1   py-3.5   bg-white text-vovoh-dark font-black rounded-full shadow-sm border border-gray-100 hover:bg-gray-50 active:scale-95 transition-all text-sm  flex items-center justify-center gap-2">
             <Sparkles size={16} className="text-vovoh-gold" /> Dica da Vovó
           </button>
        </div>

        <div className="mt-10  max-w-4xl mx-auto space-y-6">
          {prepTime && prepTime.forecast && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="relative overflow-hidden bg-white rounded- shadow-xl shadow-vovoh-red/5 border border-vovoh-red/10 p-5  flex flex-col  items-center justify-between gap-4 group">
                
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-vovoh-gold/5 rounded-full blur-2xl -z-0 pointer-events-none translate-x-1 -translate-y-1"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-vovoh-red/5 rounded-full blur-2xl -z-0 pointer-events-none -translate-x-1 translate-y-1"></div>

                <div className="flex items-center gap-4 relative z-10 w-full ">
                  <div className="w-12 h-12   bg-vovoh-red/10 text-vovoh-red rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                    <Timer size={24} className="animate-pulse  " strokeWidth={2.5} />
                  </div>
                  <div className="text-left">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-vovoh-gold/10 text-vovoh-gold text-[9px] font-black uppercase tracking-widest mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-vovoh-gold animate-ping"></span>
                      Ao Vivo
                    </div>
                    <h3 className="text-lg  font-black text-vovoh-dark tracking-tight leading-none">
                      Tempo de Preparo
                    </h3>
                    <p className="text-[10px]  text-gray-400 font-bold mt-0.5">
                      Estimativa para agora
                    </p>
                  </div>
                </div>

                <div className="relative z-10 w-full ">
                  <div className="bg-vovoh-dark text-white px-6 py-3   rounded-2xl shadow-lg flex items-center justify-between  gap-4 w-full ">
                    <div className="text-left">
                       <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Previsão</p>
                       <p className="text-2xl  font-black tracking-tighter text-vovoh-gold leading-none">{prepTime.forecast}</p>
                    </div>
                    <div className="h-8 w-px bg-white/10"></div>
                    <Clock size={20} className="text-gray-400" />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Highlights Carousel */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 -mx-4 px-4     ">
            <div className="min-w-[240px]  snap-center flex items-center gap-3 p-4 rounded-2xl bg-white shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <Flame size={20} />
              </div>
              <div className="text-left">
                <h4 className="font-black text-vovoh-dark text-xs uppercase tracking-wide">Frito na Hora</h4>
                <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">Chega quentinho e crocante pra você.</p>
              </div>
            </div>
            <div className="min-w-[240px]  snap-center flex items-center gap-3 p-4 rounded-2xl bg-white shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                <Heart size={20} />
              </div>
              <div className="text-left">
                <h4 className="font-black text-vovoh-dark text-xs uppercase tracking-wide">Tempero de Mãe</h4>
                <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">Receita de família com toque especial.</p>
              </div>
            </div>
            <div className="min-w-[240px]  snap-center flex items-center gap-3 p-4 rounded-2xl bg-white shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-green-50 text-green-500 rounded-xl flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="text-left">
                <h4 className="font-black text-vovoh-dark text-xs uppercase tracking-wide">Qualidade Real</h4>
                <p className="text-[10px] text-gray-500 font-medium leading-tight mt-0.5">Ingredientes frescos e selecionados.</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="menu" className="pb-24  container mx-auto px-4 ">
        
        <div className="sticky top-[70px] z-[190] bg-[#F9F9F9]/95 backdrop-blur-xl py-3 -mx-4 px-4   mb-6 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-200/50 shadow-sm transition-all snap-x snap-mandatory scroll-pl-4">
          {visibleCategories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={`px-4 py-2.5   rounded-full font-black text-xs  whitespace-nowrap transition-all flex-shrink-0 snap-center ${activeCat === c.id ? 'bg-vovoh-dark text-white shadow-lg shadow-black/10 scale-105' : 'bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}>
              {c.label}
            </button>
          ))}
        </div>

        {isLoading ? <GrandmaLoader /> : (
          <div className="grid grid-cols-1  lg:grid-cols-4 gap-3 ">
            {products.filter((p: any) => activeCat === 'todos' || p.category === activeCat).map((p: any) => (
              <div key={p.id} className="group bg-white rounded-[1.5rem]  p-3 shadow-sm border border-gray-100 flex gap-3 hover:border-vovoh-red0 hover:shadow-xl transition-all duration-300 items-stretch">
                <div 
                  className="w-24 h-24   flex-shrink-0 rounded-2xl [1.5rem] overflow-hidden bg-vovoh-cream relative cursor-zoom-in group/img self-center"
                  onClick={() => setSelectedZoomImage(p.image || PLACEHOLDER_IMG)}
                >
                   <img src={p.image || PLACEHOLDER_IMG} className="w-full h-full object-cover :scale-110 transition-transform duration-700" alt={p.name} />
                </div>
                
                <div 
                  className="flex flex-col flex-grow justify-between py-1 cursor-pointer min-w-0"
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
                        <h4 className="text-sm  font-black text-vovoh-dark leading-tight line-clamp-2">{p.name}</h4>
                        {p.oldPrice && (
                          <span className="bg-vovoh-gold text-white px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider shadow-sm shrink-0">Promo</span>
                        )}
                     </div>
                     <p className="text-[10px]  text-gray-400 font-medium line-clamp-2 mt-1 mb-2 leading-relaxed">"{p.description}"</p>
                     
                     <div className="mt-auto flex items-end justify-between gap-2">
                        <div className="flex flex-col">
                          {p.oldPrice && <span className="text-[9px] text-gray-300 line-through font-bold">R$ {Number(p.oldPrice).toFixed(2)}</span>}
                          <span className="text-sm  font-black text-vovoh-dark">R$ {Number(p.price).toFixed(2)}</span>
                        </div>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          onAddToCart(p, null, [], "", e);
                        }} className="w-8 h-8   bg-gray-50 text-vovoh-red rounded-full flex items-center justify-center hover:bg-vovoh-red hover:text-white transition-all active:scale-90 shadow-sm border border-gray-100">
                          <Plus size={16} className=" " strokeWidth={3} />
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
        <div 
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300"
          onClick={() => setSelectedZoomImage(null)}
        >
          <button 
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
        <div className="fixed inset-0 z-[500] flex flex-col justify-end items-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setSelectedProduct(null)} />
          
          <div className="relative w-full desktop:max-w-[480px] bg-white rounded-t-[2.5rem] shadow-2xl flex flex-col animate-in slide-in-from-bottom-full max-h-[90vh] overflow-hidden">
            
            {/* Drag Handle for Mobile */}
            <div className="w-full flex justify-center items-center h-6 bg-white shrink-0 cursor-pointer" onClick={() => setSelectedProduct(null)}>
               <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
            </div>

            <div className="relative shrink-0">
               <div className="h-48  w-full bg-vovoh-cream relative">
                  <img src={selectedProduct.image || PLACEHOLDER_IMG} className="w-full h-full object-cover" alt={selectedProduct.name} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 bg-white0 backdrop-blur-md p-2 rounded-full hover:bg-white/30 text-white transition-all"><X size={20} /></button>
               </div>
               <div className="absolute bottom-0 left-0 w-full p-6 text-white">
                  <h3 className="text-2xl  font-black leading-tight shadow-black drop-shadow-md">{selectedProduct.name}</h3>
                  <p className="text-xs  font-medium opacity-90 line-clamp-2 mt-1 drop-shadow-sm">{selectedProduct.description}</p>
               </div>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-white no-scrollbar pb-24">
              {selectedProduct.variations && selectedProduct.variations.length > 0 && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <span className="w-1 h-4 bg-vovoh-red rounded-full"></span>
                    Escolha uma opção
                  </label>
                  <div className="space-y-2">
                    {selectedProduct.variations.map((v: any, idx: number) => (
                      <label key={idx} className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${selectedVariation?.name === v.name ? 'border-vovoh-red bg-red-50 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedVariation?.name === v.name ? 'border-vovoh-red' : 'border-gray-300'}`}>
                            {selectedVariation?.name === v.name && <div className="w-2.5 h-2.5 bg-vovoh-red rounded-full" />}
                          </div>
                          <span className={`font-bold text-sm ${selectedVariation?.name === v.name ? 'text-vovoh-dark' : 'text-gray-600'}`}>{v.name}</span>
                        </div>
                        {v.price !== 0 && <span className="text-xs font-black text-vovoh-red">{v.price > 0 ? '+' : '-'} R$ {Math.abs(Number(v.price)).toFixed(2)}</span>}
                        <input 
                          type="radio" 
                          name="variation" 
                          className="hidden" 
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
                        <label key={idx} className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'border-vovoh-gold bg-amber-50 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-vovoh-gold bg-vovoh-gold' : 'border-gray-300'}`}>
                              {isSelected && <Check size={14} className="text-white" />}
                            </div>
                            <span className={`font-bold text-sm ${isSelected ? 'text-vovoh-dark' : 'text-gray-600'}`}>{add.name}</span>
                          </div>
                          {add.price !== 0 && <span className="text-xs font-black text-vovoh-gold">{add.price > 0 ? '+' : '-'} R$ {Math.abs(Number(add.price)).toFixed(2)}</span>}
                          <input 
                            type="checkbox" 
                            className="hidden" 
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
                <span className="bg-white0 px-3 py-1 rounded-lg">R$ {(Number(selectedProduct.price) + (selectedVariation ? Number(selectedVariation.price) : 0) + selectedAdditionals.reduce((acc, add) => acc + Number(add.price), 0)).toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <section id="vovoh-ai" className="py-16  container mx-auto px-4 ">
         <div className="max-w-5xl mx-auto bg-vovoh-dark rounded-[3rem] [4rem] p-6  shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col  gap-8  items-center relative overflow-hidden border border-white/10">
            
            <div className="absolute top-0 right-0 w-64 h-64 bg-vovoh-red0 rounded-full blur-[80px] -z-0 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-vovoh-gold/10 rounded-full blur-[80px] -z-0 pointer-events-none"></div>
            
            <div className="w-32 h-32   bg-vovoh-red rounded-[2.5rem]  flex items-center justify-center text-white shadow-2xl shadow-red-900/50 flex-shrink-0 z-10 border border-red-4000">
               <ChefHat size={60} className="  animate-pulse" />
            </div>
            
            <div className="flex-grow z-10 w-full text-center ">
               <div className="flex items-center justify-center  gap-2 mb-4 ">
                  <Sparkles size={24} className="text-vovoh-gold" />
                  <h3 className="text-2xl  font-black text-white tracking-tight">Dica da Vovó!</h3>
               </div>
               
               <div className="relative group">
                  <textarea 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    placeholder="Ex: Vovó, vou receber 10 amigos hoje à noite, o que eu peço?"
                    className="w-full p-6  bg-white/5 rounded- [2.5rem] min-h-[120px] [150px] outline-none border border-white/10 focus:border-vovoh-red/50 focus:bg-white/10 transition-all font-bold text-sm  text-white placeholder:text-gray-500 backdrop-blur-md resize-none"
                  />
                  <button onClick={askGrandma} disabled={aiLoading} className="absolute bottom-4 right-4   w-12 h-12   bg-vovoh-red text-white rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(214,31,31,0.4)] hover:bg-red-600 hover:scale-105 active:scale-90 transition-all">
                    {aiLoading ? <Loader2 className="animate-spin" /> : <Send size={24} />}
                  </button>
               </div>
               
               {aiRes && (
                 <div className="mt-6  p-6  bg-white rounded- [2.5rem] border border-gray-100 animate-in fade-in slide-in-from-top-4 text-left shadow-xl shadow-black/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-vovoh-gold/5 rounded-full blur-[40px] -z-0 pointer-events-none"></div>
                    
                    <div className="text-base  font-medium text-gray-600 leading-relaxed mb-6 prose prose-p:my-2 prose-strong:text-vovoh-dark prose-strong:font-black prose-ul:list-disc prose-ul:pl-4 prose-li:marker:text-vovoh-gold relative z-10">
                      <ReactMarkdown>{aiRes.message}</ReactMarkdown>
                    </div>
                    
                    {aiRes.suggestedItems && aiRes.suggestedItems.length > 0 && (
                      <div className="flex flex-col gap-4 pt-6 border-t border-gray-100 relative z-10">
                        <div className="flex flex-wrap gap-2">
                           {aiRes.suggestedItems.map((item: any, i: number) => (
                             <span key={i} className="px-3 py-1.5   bg-vovoh-red/5 rounded-xl text-[10px]  font-black text-vovoh-red uppercase shadow-sm border border-vovoh-red/10 flex items-center gap-2">
                               {item.name} <span className="bg-vovoh-red text-white px-1.5 rounded-md">x{item.quantity}</span>
                             </span>
                           ))}
                        </div>
                        <button 
                          onClick={handleAddSuggestion}
                          className="w-full  px-8 py-4 bg-vovoh-gold text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-5000 flex items-center justify-center gap-3 active:scale-95"
                        >
                          <Plus size={18} /> Adicionar Sugestão à Sacola
                        </button>
                      </div>
                    )}
                 </div>
               )}
            </div>
         </div>
      </section>

      <section className="py-16  bg-white">
        <div className="container mx-auto px-4 ">
          <div className="flex flex-col  gap-12 items-center">
            <div className="w-full  relative">
              <div className="aspect-square bg-vovoh-cream rounded-[3rem] overflow-hidden shadow-2xl rotate-3">
                <img 
                  src={dynamicConfigs?.story_image || "https://imgur.com/lrKC57Q.png"} 
                  className="w-full h-full object-cover hover:scale-105 transition-all duration-700" 
                  alt="Nossa História" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-vovoh-red text-white p-8 rounded- shadow-xl -rotate-6 hidden">
                <p className="text-4xl font-black">20+</p>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Anos de Tradição</p>
              </div>
            </div>
            <div className="w-full  space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-vovoh-cream text-vovoh-gold rounded-full text-[10px] font-black uppercase tracking-widest">
                Nossa História
              </div>
              <h3 className="text-3xl  font-black text-vovoh-dark tracking-tighter leading-tight">
                Da nossa cozinha <br/>
                <span className="text-vovoh-red">para a sua mesa.</span>
              </h3>
              <div className="text-gray-500 font-medium leading-relaxed whitespace-pre-line">
                {dynamicConfigs?.story_text || `A Delícias da Vovó nasceu do desejo de compartilhar o sabor autêntico da comida caseira. Tudo começou na cozinha da Vovó Grazy, onde cada salgado era feito com um cuidado que só quem ama cozinhar entende.

Com o tempo, o Vovô (que é argentino!) trouxe suas famosas receitas de empanadas, criando uma mistura única de sabores que conquistou toda a vizinhança de Colombo. Hoje, mantemos a mesma essência: massa fresca, recheio generoso e muito capricho.`}
              </div>
              <div className="pt-4 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?u=${i}`} alt="Avatar" />
                    </div>
                  ))}
                </div>
                <p className="text-xs font-bold text-vovoh-dark">
                  <span className="text-vovoh-red">500+</span> clientes felizes toda semana
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16  container mx-auto px-4 ">
        <div className="text-center mb-12 ">
          <h3 className="text-3xl  font-black text-vovoh-dark tracking-tighter mb-4">O que dizem os netinhos...</h3>
        </div>
        <div className="grid grid-cols-1  gap-6 ">
          {testimonials.map((t: any, i: number) => (
            <div key={i} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 hover:shadow-xl transition-all group">
              <div className="flex gap-1 mb-4">
                {[...Array(Number(t.rating || 5))].map((_, i) => <Star key={i} size={14} className="text-vovoh-gold fill-current" />)}
              </div>
              <p className="text-gray-600 font-medium italic mb-6 leading-relaxed">"{t.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-vovoh-cream flex items-center justify-center font-black text-vovoh-gold text-xs">
                  {t.name.charAt(0)}
                </div>
                <p className="font-black text-vovoh-dark text-sm">{t.name}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16  bg-vovoh-dark relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5">
          <div className="absolute top-10 left-10 w-64 h-64 bg-vovoh-red rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-vovoh-gold rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-4  max-w-4xl relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 text-vovoh-gold rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-white/10">
              Central de Ajuda
            </div>
            <h3 className="text-3xl  font-black text-white tracking-tighter mb-4">Dúvidas Frequentes</h3>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Tudo o que você precisa saber sobre as delícias</p>
          </div>

          <div className="grid gap-4">
            {faqs.map((faq: any, i: number) => (
              <div 
                key={i} 
                className={`group rounded- border transition-all duration-500 ${
                  openFaq === i 
                    ? 'bg-white/10 border-white0 shadow-2xl' 
                    : 'bg-white/5 border-white/5 hover:bg-white/[0.07] hover:border-white/10'
                }`}
              >
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full p-6  text-left flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs transition-colors ${
                      openFaq === i ? 'bg-vovoh-red text-white' : 'bg-white/10 text-vovoh-gold'
                    }`}>
                      {i + 1}
                    </div>
                    <span className="font-black text-white text-sm  tracking-tight">{faq.q}</span>
                  </div>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-white/40 group-hover:text-white transition-all ${
                    openFaq === i ? 'rotate-180 bg-vovoh-red0 text-vovoh-red' : ''
                  }`}>
                    <ChevronDown size={20} />
                  </div>
                </button>
                <div className={`transition-all duration-500 ease-in-out ${
                  openFaq === i ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
                } overflow-hidden`}>
                  <div className="px-6 pb-8   ml-12">
                    <div className="h-px w-12 bg-vovoh-red/30 mb-6"></div>
                    <p className="text-gray-300 font-medium text-sm  leading-relaxed">
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