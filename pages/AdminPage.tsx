import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChefHat, Bell, ArrowLeft, RefreshCw, Plus, Edit2, Trash2, Save, X, Upload, Loader2, AlertTriangle, CheckCircle2, ChevronDown, DollarSign, TrendingUp, Wallet, CreditCard, Calendar, PieChart, MessageCircle, Clock, MapPin, ArrowRight, ShoppingBag, Settings, Utensils, ClipboardList, Tag, Menu, MoreHorizontal, Flame, Bike, PackageCheck, Eye } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { GAS_API_URL, CATEGORIES, PLACEHOLDER_IMG } from '../constants/index';
import { Toast, ConfirmModal } from '../components/UI';
import { startVisiblePolling } from '../src/utils/visible-polling';
import { adminFetch } from '../src/utils/admin-api';
import { subscribeToPush, getPushSubscription } from '../src/utils/push';
import { StoreSetupChecklist } from '../components/StoreSetupChecklist';
import { AdminDialog } from '../components/AdminDialog';
import { ProductEditor, CouponEditor } from '../components/AdminEditors';
import { DeliverySettings, HoursSettings, AddressSettings, PaymentSettings } from '../components/AdminSettings';
import { parseMoneyInput, formatMoneyInput } from '../src/utils/money-input';
import { PhoneInput } from '../components/PhoneInput';


export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [pushState, setPushState] = useState<'inactive' | 'registering' | 'registered' | 'error'>('inactive');
  const [pushError, setPushError] = useState('');
  const [testingPush, setTestingPush] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const ordersLoaded = useRef(false);
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [savedConfigs, setSavedConfigs] = useState<Record<string, any> | null>(null);
  const [savedProductCount, setSavedProductCount] = useState<number | null>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<any[]>([]);
  const [editingNeighborhood, setEditingNeighborhood] = useState<any>(null);
  const [isAddingNeighborhood, setIsAddingNeighborhood] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('ativos');
  const [toast, setToast] = useState<any>(null);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [isAddingCoupon, setIsAddingCoupon] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);
  const [refusalModal, setRefusalModal] = useState<{isOpen: boolean, orderId: string | null}>({isOpen: false, orderId: null});
  const [refusalReason, setRefusalReason] = useState("");
  const [stats, setStats] = useState<any>(null);
  
  const [isCatMenuOpen, setIsCatMenuOpen] = useState(false);

  const [financeData, setFinanceData] = useState<any>(null);
  const [financeError, setFinanceError] = useState('');
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const historyOrders = useRef<any[]>([]);
  const [financePeriod, setFinancePeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [isKDS, setIsKDS] = useState(false);
  const [configTab, setConfigTab] = useState<'geral' | 'entrega' | 'conteudo' | 'atendimento' | 'endereco' | 'pagamentos' | 'avisos'>('geral');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [manualOverrideOrderId, setManualOverrideOrderId] = useState<string | null>(null);
  
  const topProducts = useMemo(() => {
    const counts: Record<string, { count: number, revenue: number }> = {};
    orders.filter(o => o.status === 'concluido').forEach(o => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((item: any) => {
        if (!counts[item.name]) counts[item.name] = { count: 0, revenue: 0 };
        counts[item.name].count += item.quantity;
        counts[item.name].revenue += (Number(item.price) * item.quantity);
      });
    });
    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [orders]);

  // Controle de Notificações
  const [notifPerm, setNotifPerm] = useState('Notification' in window ? Notification.permission : 'default');
  const knownOrdersRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundRetry, setSoundRetry] = useState(0);
  const [savingAddress, setSavingAddress] = useState(false);
  const pendingOrderIds = orders.filter(o => o.status === 'pendente').map(o => o.id).sort().join(',');

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  const showIOSBanner = isIOS && !isStandalone;

  const showMsg = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const handleRefuseOrder = async () => {
    if (!refusalModal.orderId) return;
    
    const order = orders.find(o => o.id === refusalModal.orderId);
    if (!order) return;

    // Optimistic Update
    const updatedOrder = { ...order, status: 'cancelado', refusalReason };
    const oldOrders = [...orders];
    setOrders(orders.map(o => o.id === order.id ? updatedOrder : o));

    setRefusalModal({isOpen: false, orderId: null});
    setRefusalReason("");
    
    setSyncing(true);
    try {
      const res = await adminFetch(`/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedOrder)
      });
      
      if (res.ok) {
        showMsg("Agendamento recusado com sucesso!", "success");
        // No need to fetch immediately if optimistic worked
      } else {
        throw new Error();
      }
    } catch (e) {
      setOrders(oldOrders); // Revert
      showMsg("Erro ao recusar agendamento.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const loadHistory = async (more = false) => {
    if (loadingHistory) return;
    setLoadingHistory(true);
    try {
      const response = await adminFetch('/orders/history' + (more && historyCursor ? '?cursor=' + encodeURIComponent(historyCursor) : ''));
      if (!response.ok) throw new Error();
      const data = await response.json();
      historyOrders.current = more ? [...historyOrders.current, ...data.orders] : data.orders;
      setHistoryCursor(data.nextCursor);
      setOrders(previous => Array.from(new Map([...historyOrders.current, ...previous].map(order => [order.id,order])).values()));
    } catch { showMsg('Não foi possível carregar o histórico.', 'error'); }
    finally { setLoadingHistory(false); }
  };
  useEffect(() => {
    if (isAuthenticated && tab === 'orders' && filter === 'todos') void loadHistory();
  }, [isAuthenticated, tab, filter]);
  useEffect(() => {
    if (!isAuthenticated || tab !== 'finance') return;
    const controller = new AbortController();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (financePeriod === 'week') start.setDate(start.getDate() - start.getDay());
    if (financePeriod === 'month') start.setDate(1);
    const since = financePeriod === 'all' ? '' : start.toISOString();
    setFinanceData(null); setFinanceError('');
    adminFetch('/admin/finance?since=' + encodeURIComponent(since), { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!controller.signal.aborted) setFinanceData(data);
    }).catch(() => { if (!controller.signal.aborted) setFinanceError('Não foi possível atualizar o financeiro. Abra esta tela novamente.'); });
    return () => controller.abort();
  }, [isAuthenticated, tab, financePeriod]);

  const fetchStats = async () => {
    try {
      const res = await adminFetch(`/admin/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else return false;
    } catch (e) {
      console.error("Erro ao buscar estatísticas:", e);
      return false;
    }
  };

  const requestNotification = async () => {
    setPushState('registering'); setPushError('');
    try {
      if (!('Notification' in window)) throw new Error('Use um navegador com notificações, como o Chrome no Android.');
      const permission = await Notification.requestPermission();
      setNotifPerm(permission);
      if (permission !== 'granted') throw new Error('Permita as notificações nas configurações do navegador e tente novamente.');
      await subscribeToPush('admin-user', 'admin');
      setPushState('registered');
      showMsg('Aparelho cadastrado. Envie um teste para conferir o aviso.', 'success');
    } catch (error) {
      setPushState('error');
      setPushError(error instanceof Error ? error.message : 'Não foi possível ativar os avisos.');
    }
  };
  const testNotification = async () => {
    setTestingPush(true); setPushError('');
    try {
      const subscription = await getPushSubscription();
      if (!subscription) throw new Error('Ative os avisos neste aparelho primeiro.');
      const response = await adminFetch('/admin/test-push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível enviar o teste.');
      showMsg('Teste enviado. Confira se o aviso chegou neste aparelho.', 'info');
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Falha no teste.');
    } finally { setTestingPush(false); }
  };

  useEffect(() => {
    if (!isAuthenticated || !('Notification' in window) || Notification.permission !== 'granted') return;
    let active = true;
    getPushSubscription().then(async subscription => {
      if (!subscription || !active) return;
      await subscribeToPush('admin-user', 'admin');
      if (active) setPushState('registered');
    }).catch(error => {
      if (active) { setPushState('error'); setPushError(error instanceof Error ? error.message : 'Ative os avisos novamente.'); }
    });
    return () => { active = false; };
  }, [isAuthenticated]);

  const fetchGlobalOrders = async (silent = false) => {
    try {
      const res = await adminFetch(`/orders`);
      if (!res.ok) throw new Error('Não foi possível atualizar os pedidos.');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Resposta de pedidos inválida.');
      
      // Lógica de Notificação de Novo Pedido!
      const incomingIds = data.map((o: any) => o.id);
      
      if (ordersLoaded.current) {
         const newOrders = data.filter((o: any) => !knownOrdersRef.current.has(o.id));
         
         if (newOrders.length > 0) {
            if (pushState !== 'registered' && 'Notification' in window && Notification.permission === 'granted') {
              navigator.serviceWorker?.getRegistration().then(registration =>
                registration?.showNotification('Novo pedido na cozinha', {
                  body: 'Abra o painel para conferir.', tag: 'order-' + newOrders[0].id,
                  data: { url: '/?order=' + encodeURIComponent(newOrders[0].id) + '#vovo-secreta' },
                })
              ).catch(() => {});
            }
         }
      }
      
      knownOrdersRef.current = new Set(incomingIds);
      ordersLoaded.current = true;
      setOrders(Array.from(new Map([...historyOrders.current, ...data].map(order => [order.id, order])).values()));
      setOrdersError('');
      setLastUpdated(new Date());
    } catch (e) {
      setOrdersError('Sem atualização dos pedidos. Confira a internet e toque em atualizar.');
      if (!silent) console.error('Erro ao buscar pedidos.');
      return false;
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await adminFetch(`/products`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      const parsed = data.map((p: any) => {
        if (typeof p.variations === 'string') {
          try { 
            const allVars = JSON.parse(p.variations); 
            p.variations = allVars.filter((v:any) => !v.isAdditional);
            p.additionals = allVars.filter((v:any) => v.isAdditional);
          } catch(e) { 
            p.variations = []; 
            p.additionals = [];
          }
        }
        return p;
      });
      setProducts(parsed);
      setSavedProductCount(parsed.length);
    } catch (e) {
      showMsg("Erro ao buscar cardápio", "error");
    }
  };

  const formatTimeForInput = (timeStr: string | undefined) => {
    if (!timeStr) return '';
    if (typeof timeStr === 'string' && timeStr.includes('T')) {
      const date = new Date(timeStr);
      const roundedDate = new Date(date.getTime() + 30000); // Arredonda para o minuto mais próximo (corrige o bug de 1899 do fuso horário)
      return `${roundedDate.getHours().toString().padStart(2, '0')}:${roundedDate.getMinutes().toString().padStart(2, '0')}`;
    }
    if (typeof timeStr === 'string' && timeStr.includes(':')) {
      return timeStr.substring(0, 5);
    }
    return timeStr;
  };

  const fetchConfigs = async () => {
    try {
      const res = await adminFetch(`/configs`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setSavedConfigs({ ...data });
      if (data.opening_start) data.opening_start = formatTimeForInput(data.opening_start);
      if (data.opening_end) data.opening_end = formatTimeForInput(data.opening_end);
      
      if (data.working_days) {
        try {
          data.working_days = JSON.parse(data.working_days);
        } catch (e) {
          data.working_days = [];
        }
      } else {
        data.working_days = [];
      }
      
      if (!data.faqs) data.faqs = '[]';

      if (!data.testimonials) {
        data.testimonials = '[]';
      }
      
      if (data.fee_per_km != null && String(data.fee_per_km).trim() !== '') data.fee_per_km = Number(data.fee_per_km);
      setConfigs(data);
      if (data.coupons) {
        try {
          setCoupons(JSON.parse(data.coupons));
        } catch (e) {
          setCoupons([]);
        }
      }
      if (data.neighborhoods) {
        try {
          setNeighborhoods(JSON.parse(data.neighborhoods));
        } catch (e) {
          setNeighborhoods([]);
        }
      }
    } catch (e) {
      console.error("Erro ao buscar configs:", e);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchProducts();
    fetchConfigs();
    return startVisiblePolling(() => fetchGlobalOrders(true), 60000);
  }, [isAuthenticated, pushState]);
  useEffect(() => {
    if (!isAuthenticated || tab !== 'stats') return;
    return startVisiblePolling(fetchStats, 300000);
  }, [isAuthenticated, tab]);

// ...

  // The browser chime and background push registration are independent.
  useEffect(() => {
    const audio = audioRef.current ||= new Audio('/sounds/order-chime.wav');
    let active = true;
    audio.onplaying = () => { if (active) { setSoundPlaying(true); setSoundEnabled(true); setAudioBlocked(false); } };
    audio.onpause = audio.onended = () => { if (active) setSoundPlaying(false); };
    const play = async () => {
      if (!active || !isAuthenticated || !pendingOrderIds || isAlarmMuted) return;
      try {
        audio.currentTime = 0;
        await audio.play();
        if (active) timeoutRef.current = setTimeout(play, 15000);
      } catch {
        if (active) { setAudioBlocked(true); setSoundEnabled(false); setSoundPlaying(false); }
      }
    };
    void play();
    return () => {
      active = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      audio.onplaying = audio.onpause = audio.onended = null;
      audio.pause(); audio.currentTime = 0;
      setSoundPlaying(false);
    };
  }, [pendingOrderIds, isAlarmMuted, isAuthenticated, soundRetry]);

  const testOrderSound = async () => {
    try {
      const audio = audioRef.current ||= new Audio('/sounds/order-chime.wav');
      audio.currentTime = 0;
      await audio.play();
      setSoundEnabled(true); setAudioBlocked(false);
      if (audioBlocked && pendingOrderIds && !isAlarmMuted) setSoundRetry(previous => previous + 1);
    } catch {
      setSoundEnabled(false); setAudioBlocked(true);
      showMsg('O navegador bloqueou o som. Confira a permissão de áudio.', 'error');
    }
  };

  const saveStoreAddress = async () => {
    setSavingAddress(true);
    try {
      const lat = Number(String(configs.store_lat ?? '').replace(',', '.'));
      const lng = Number(String(configs.store_lng ?? '').replace(',', '.'));
      if (!configs.store_street?.trim() || !configs.store_number?.trim() || !configs.store_city?.trim()) throw new Error('Preencha rua, número e cidade da loja.');
      if (String(configs.store_lat ?? '').trim() === '' || String(configs.store_lng ?? '').trim() === '' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error('Confirme a latitude e longitude da loja no Google Maps.');
      const values: Record<string, any> = { ...configs, store_lat: String(lat), store_lng: String(lng) };
      for (const key of ['store_cep', 'store_street', 'store_number', 'store_neighborhood', 'store_city', 'store_state', 'store_lat', 'store_lng']) {
        const response = await adminFetch('/configs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: String(values[key] ?? '') }),
        });
        if (!response.ok) throw new Error('Não foi possível salvar tudo. Confira o endereço e tente novamente.');
        setSavedConfigs(previous => ({ ...previous, [key]: String(values[key] ?? '') }));
      }
      setConfigs(previous => ({ ...previous, store_lat: String(lat), store_lng: String(lng) }));
      showMsg('Endereço e localização salvos para calcular as entregas.', 'success');
    } catch (error) {
      showMsg(error instanceof Error ? error.message : 'Não foi possível salvar o endereço.', 'error');
    } finally { setSavingAddress(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Redimensiona se for muito grande (max 1200px)
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Comprime para JPEG com qualidade 0.7 (bom equilíbrio entre peso e qualidade)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        callback(compressedBase64);
        setUploading(false);
      };
      img.onerror = () => {
        showMsg("Erro ao processar imagem.", "error");
        setUploading(false);
      };
      img.src = event.target?.result as string;
    };
    reader.onerror = () => {
      showMsg("Erro ao ler arquivo.", "error");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateConfig = async (key: string, value: any, updateState = true) => {
    setSyncing(true);
    try {
      const res = await adminFetch(`/configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: String(value) })
      });
      if (!res.ok) throw new Error();
      setSavedConfigs(previous => ({ ...previous, [key]: String(value) }));
      if (updateState) {
        setConfigs(prev => ({ ...prev, [key]: value }));
      }
      showMsg("Configuração salva!", "success");
      return true;
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Erro ao salvar config.", "error");
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateConfigs = async (updates: Record<string,string>) => {
    setSyncing(true);
    try {
      const response = await adminFetch('/configs/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({updates})});
      const result = await response.json();
      if (result.success !== true || !result.values) throw new Error('Não foi possível confirmar o salvamento.');
      setSavedConfigs(previous=>({...previous,...result.values}));
      setConfigs(previous=>({...previous,...result.values,...(result.values.fee_per_km !== undefined ? {fee_per_km:Number(result.values.fee_per_km)} : {}),...(result.values.working_days !== undefined ? {working_days:JSON.parse(result.values.working_days)} : {})}));
      showMsg('Configurações salvas!', 'success');return true;
    } catch(error) {showMsg(error instanceof Error ? error.message : 'Não foi possível salvar.', 'error');return false;}
    finally {setSyncing(false);}
  };
  const settingsProps = {configs,saved:savedConfigs,onChange:setConfigs,onSave:handleUpdateConfig,onSaveMany:handleUpdateConfigs,saving:syncing};

  const confirmPayment = async (orderId: string) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const response = await adminFetch(`/orders/${orderId}/payment/confirm`, {method:'POST'});
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error || 'Recebimento não confirmado.');
      setOrders(previous => previous.map(order => order.id === orderId ? {...order,payment:result.payment} : order));
      showMsg('Recebimento confirmado e salvo.', 'success');
    } catch(error) { showMsg(error instanceof Error ? error.message : 'Não foi possível confirmar.', 'error'); }
    finally {setSyncing(false);}
  };
  const cashReceipt = (order: any, isCash: boolean, isVerified: boolean) => isCash && !isVerified && !['concluido','cancelado','recusado'].includes(order.status) && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 space-y-2">
    <p className="text-sm font-bold">Dinheiro na entrega</p>
    <p className="text-xs text-zinc-400">Pode preparar e sair para entrega. Confirme somente quando receber o dinheiro.</p>
    <button type="button" disabled={syncing} onClick={() => confirmPayment(order.id)} className="w-full p-3 rounded-xl bg-green-600 text-white font-bold text-sm disabled:opacity-50">Confirmar dinheiro recebido</button>
  </div>;

  const updateStatusAPI = async (orderId: string, newStatus: string) => {
    // Atualização Otimista: Muda na hora pra Vovó não esperar
    const oldOrders = [...orders];
    setOrders(orders.map(o => o.id === orderId ? {...o, status: newStatus} : o));
    
    try {
      setSyncing(true);
      const res = await adminFetch(`/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (!res.ok) {
        throw new Error("Falha ao atualizar");
      }
      
      showMsg(`Status mudado para ${newStatus}!`, 'success');
      // Não precisa forçar fetchGlobalOrders imediatamente se já atualizamos localmente, 
      // o polling de 5s vai garantir a consistência logo.
    } catch (e) {
      // Reverte se der erro
      setOrders(oldOrders);
      showMsg("Erro ao atualizar status. Tente novamente.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveProduct = async (product: any) => {
    const price = parseMoneyInput(product.price);
    if (!String(product.name || '').trim() || price === null || !product.category) { showMsg('Preencha nome, preço válido e categoria.', 'error'); return; }
    const choices: any[] = [];
    for (const key of ['variations','additionals']) {
      const names = new Set<string>();
      for (const option of product[key] || []) {
        const optionPrice = parseMoneyInput(option.price); const name = String(option.name || '').trim();
        if (!name || optionPrice === null || names.has(name)) { showMsg('Cada opção precisa de nome único e valor válido. Use zero quando não houver acréscimo.', 'error'); return; }
        names.add(name); choices.push({name,price:optionPrice,...(key === 'additionals' ? {isAdditional:true} : {})});
      }
    }
    const productToSave = {...product,id:product.id || crypto.randomUUID(),name:String(product.name).trim(),price,variations:JSON.stringify(choices)};
    delete productToSave.additionals;
    setEditingProduct((previous: any) => previous ? {...previous,id:productToSave.id} : previous);
    setSyncing(true);
    try {
      await adminFetch(isAdding ? '/products' : `/products/${productToSave.id}`,{method:isAdding ? 'POST' : 'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(productToSave)});
      const display={...productToSave,variations:choices.filter(option=>!option.isAdditional),additionals:choices.filter(option=>option.isAdditional)};
      setProducts(previous=>isAdding ? [...previous,display] : previous.map(item=>item.id===display.id ? display : item));
      setSavedProductCount(isAdding ? products.length+1 : products.length);
      setEditingProduct(null); setIsAdding(false); showMsg('Produto salvo com sucesso!', 'success');
    } catch(error) { showMsg(error instanceof Error ? error.message : 'Não foi possível salvar. Seus dados continuam no formulário.', 'error'); }
    finally { setSyncing(false); }
  };

  const handleDeleteProduct = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Remover Item",
      message: "Tem certeza que deseja remover este item permanentemente?",
      onConfirm: async () => {
        setConfirmModal(null);
        
        // Optimistic Update
        const oldProducts = [...products];
        setProducts(products.filter(p => p.id !== id));
        
        setSyncing(true);
        try {
          await adminFetch(`/products/${id}`, {
            method: 'DELETE'
          });
          showMsg("Removido!", "success");
          setSavedProductCount(oldProducts.filter(product => product.id !== id).length);
        } catch (e) {
          setProducts(oldProducts); // Revert
          showMsg("Erro ao deletar.", "error");
        } finally {
          setSyncing(false);
        }
      }
    });
  };

  const handleSaveCoupon = async (coupon: any) => {
    const code = String(coupon.code || '').trim().toUpperCase();
    const value = parseMoneyInput(coupon.discount);
    if (!/^[A-Z0-9_-]{1,32}$/.test(code) || value === null || value <= 0 || !['percent','fixed'].includes(coupon.type) || (coupon.type==='percent' && value > 100)) { showMsg('Confira o código e o desconto. Porcentagens devem estar entre 0 e 100.', 'error'); return; }
    if (isAddingCoupon && coupons.some(item=>String(item.code).toUpperCase()===code)) { showMsg('Esse código já existe. Escolha outro.', 'error'); return; }
    const saved = {...coupon,code,discount:coupon.type==='percent' ? value/100 : value};
    const updated = isAddingCoupon ? [...coupons,saved] : coupons.map(item=>String(item.code).toUpperCase()===code ? saved : item);
    setSyncing(true);
    try {
      await adminFetch('/configs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:'coupons',value:JSON.stringify(updated)})});
      setCoupons(updated);setConfigs(previous=>({...previous,coupons:JSON.stringify(updated)}));setSavedConfigs(previous=>({...previous,coupons:JSON.stringify(updated)}));
      setEditingCoupon(null);setIsAddingCoupon(false);showMsg('Cupom salvo com sucesso!', 'success');
    } catch(error) { showMsg(error instanceof Error ? error.message : 'Não foi possível salvar. Seus dados continuam no formulário.', 'error'); }
    finally {setSyncing(false);}
  };

  const handleDeleteCoupon = async (code: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Remover Cupom",
      message: "Tem certeza que deseja remover este cupom permanentemente?",
      onConfirm: async () => {
        setConfirmModal(null);
        
        // Optimistic Update
        const oldCoupons = [...coupons];
        const newCoupons = coupons.filter(c => c.code !== code);
        
        setCoupons(newCoupons);
        setConfigs(prev => ({ ...prev, coupons: JSON.stringify(newCoupons) }));
        setSyncing(true);

        try {
          await adminFetch(`/configs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'coupons', value: JSON.stringify(newCoupons) })
          });
          showMsg("Cupom removido!", "success");
        } catch (e) {
          setCoupons(oldCoupons); // Revert
          setConfigs(prev => ({ ...prev, coupons: JSON.stringify(oldCoupons) }));
          showMsg("Erro ao deletar cupom.", "error");
        } finally {
          setSyncing(false);
        }
      }
    });
  };

  const handleSaveNeighborhood = async (neighborhood: any) => {
    if (!neighborhood.name || !neighborhood.fee || !neighborhood.time) {
      showMsg("Preencha todos os campos do bairro!", "error");
      return;
    }
    
    // Optimistic Update
    const oldNeighborhoods = [...neighborhoods];
    const newNeighborhoods = isAddingNeighborhood 
      ? [...neighborhoods, neighborhood] 
      : neighborhoods.map(n => n.name === neighborhood.name ? neighborhood : n);
    
    setNeighborhoods(newNeighborhoods);
    setConfigs(prev => ({ ...prev, neighborhoods: JSON.stringify(newNeighborhoods) }));
    setEditingNeighborhood(null);
    setIsAddingNeighborhood(false);
    setSyncing(true);

    try {
      await adminFetch(`/configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'neighborhoods', value: JSON.stringify(newNeighborhoods) })
      });
      showMsg("Bairro salvo com sucesso!", "success");
    } catch (e) {
      setNeighborhoods(oldNeighborhoods); // Revert
      setConfigs(prev => ({ ...prev, neighborhoods: JSON.stringify(oldNeighborhoods) }));
      showMsg("Erro ao salvar bairro.", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteNeighborhood = async (name: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Remover Bairro",
      message: "Tem certeza que deseja remover este bairro?",
      onConfirm: async () => {
        setConfirmModal(null);
        
        // Optimistic Update
        const oldNeighborhoods = [...neighborhoods];
        const newNeighborhoods = neighborhoods.filter(n => n.name !== name);
        
        setNeighborhoods(newNeighborhoods);
        setConfigs(prev => ({ ...prev, neighborhoods: JSON.stringify(newNeighborhoods) }));
        setSyncing(true);

        try {
          await adminFetch(`/configs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'neighborhoods', value: JSON.stringify(newNeighborhoods) })
          });
          showMsg("Bairro removido!", "success");
        } catch (e) {
          setNeighborhoods(oldNeighborhoods); // Revert
          setConfigs(prev => ({ ...prev, neighborhoods: JSON.stringify(oldNeighborhoods) }));
          showMsg("Erro ao deletar bairro.", "error");
        } finally {
          setSyncing(false);
        }
      }
    });
  };

  const pendingOrders = orders.filter(order => order.status === 'pendente').length;
  const visibleOrders = orders
    .filter(order => filter === 'novos' ? order.status === 'pendente' : filter === 'ativos' ? !['concluido', 'cancelado', 'pix_recusado'].includes(order.status) : true)
    .sort((a, b) => Number(b.status === 'pendente') - Number(a.status === 'pendente') || new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order');
    if (id && isAuthenticated && orders.length) document.getElementById('order-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [orders.length, isAuthenticated]);

  useEffect(() => {
    localStorage.removeItem('vovoh_admin_auth');
    adminFetch('/admin/session').then(response => setIsAuthenticated(response.ok)).catch(() => {});
    const expire = () => { setIsAuthenticated(false); historyOrders.current = []; setHistoryCursor(null); setFinanceData(null); setOrders([]); setStats(null); setPushState('inactive'); ordersLoaded.current = false; };
    window.addEventListener('vovo-admin-session-expired', expire);
    return () => window.removeEventListener('vovo-admin-session-expired', expire);
  }, []);
  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault(); if (loggingIn) return; setLoggingIn(true);
    try {
      const response = await adminFetch('/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: passwordInput }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.');
      setPasswordInput(''); setIsAuthenticated(true);
    } catch (error) { showMsg(error instanceof Error ? error.message : 'Não foi possível entrar.', 'error'); }
    finally { setLoggingIn(false); }
  };
  const logout = async () => {
    try {
      const response = await adminFetch('/admin/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      setIsAuthenticated(false); historyOrders.current = []; setHistoryCursor(null); setFinanceData(null); setOrders([]); setStats(null); setPushState('inactive'); ordersLoaded.current = false;
    } catch { showMsg('Não foi possível sair. Tente novamente.', 'error'); }
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-page min-h-screen bg-vovoh-dark flex items-center justify-center p-6">
        {toast && <Toast {...toast} notification={toast} onClose={() => setToast(null)} />}
        <form onSubmit={handleLogin} className="bg-zinc-900 border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full space-y-6 text-center animate-in zoom-in-95">
          <div className="w-20 h-20 bg-vovoh-red text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-red-900/50 mx-auto rotate-3">
            <ChefHat size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Painel da Vovó</h2>
            <p className="text-zinc-400 font-bold text-xs mt-1">Área restrita</p>
          </div>
          <input 
            type="password" 
            autoComplete="current-password" aria-label="Senha do painel" required
            placeholder="Senha secreta" 
            className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm text-center text-white"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={loggingIn} className="w-full py-4 bg-vovoh-red text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all">
            {loggingIn ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  if (isKDS) {
    const kdsOrders = orders.filter(o => o.status !== 'concluido' && o.status !== 'cancelado' && o.status !== 'pix_recusado');
    
    return (
      <div className="min-h-screen bg-black text-white p-4  font-sans overflow-hidden flex flex-col">
        {toast && <Toast {...toast} notification={toast} onClose={() => setToast(null)} />}
        
        <header className="flex justify-between items-center mb-8 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-500 text-black rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 rotate-3">
              <ChefHat size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase">Cozinha da Vovó <span className="text-amber-500">KDS</span></h1>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Monitor de Produção em Tempo Real</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-zinc-900 px-4 py-2 rounded-xl border border-white/5 flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{kdsOrders.length} Pedidos Ativos</span>
            </div>
            <button onClick={() => setIsKDS(false)} className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10">Sair do KDS</button>
          </div>
        </header>

        <main className="flex-grow overflow-x-auto no-scrollbar pb-8">
          <div className="flex gap-6 h-full min-w-max">
            {kdsOrders.length === 0 ? (
              <div className="w-full flex flex-col items-center justify-center text-zinc-800 space-y-6 opacity-50">
                <ChefHat size={120} />
                <p className="text-3xl font-black uppercase tracking-[0.3em]">Cozinha Limpa, Vovó!</p>
              </div>
            ) : (
              kdsOrders.map(o => {
                const createdAt = new Date(o.timing?.createdAt || o.date || Date.now());
                const diffMin = Math.floor((Date.now() - createdAt.getTime()) / 60000);
                
                let urgencyColor = 'border-white/10 bg-zinc-900/50';
                let timerColor = 'text-zinc-500';
                
                if (diffMin >= 30) {
                  urgencyColor = 'border-red-500/50 bg-red-500/5 shadow-2xl shadow-red-500/10';
                  timerColor = 'text-red-500 animate-pulse';
                } else if (diffMin >= 15) {
                  urgencyColor = 'border-amber-500/50 bg-amber-500/5 shadow-xl shadow-amber-500/10';
                  timerColor = 'text-amber-500';
                }

                const nextStatus = o.status === 'pendente' ? 'preparando' : o.status === 'preparando' ? 'forno' : o.status === 'forno' ? 'entrega' : 'concluido';
                const nextLabel = o.status === 'pendente' ? 'Começar Preparo' : o.status === 'preparando' ? 'Colocar no Forno' : o.status === 'forno' ? 'Saiu para Entrega' : 'Concluir Pedido';

                const isPix = String(o.paymentMethod).toLowerCase().includes('pix');
                const isOnlineCard = String(o.paymentMethod).toLowerCase().includes('cartão online');
                const isCash = o.payment?.method === 'dinheiro' || String(o.paymentMethod).toLowerCase().includes('dinheiro');
                  const isVerified = o.payment?.paid === true;

                return (
                  <div key={o.id} className={`w-[85vw] [380px] h-full flex flex-col rounded-[2rem] [2.5rem] border-2 ${urgencyColor} transition-all duration-500 animate-in slide-in-from-right-8`}>
                    <div className="p-4  border-b border-white/5 flex justify-between items-start shrink-0">
                      <div>
                        <p className="text-[10px] font-black text-vovoh-red uppercase tracking-widest mb-1">#{String(o.id).slice(-4)}</p>
                        <h3 className="text-xl  font-black truncate max-w-[150px] [200px]">{o.customer?.name}</h3>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center gap-2 font-black text-lg  ${timerColor}`}>
                          <Clock size={18} />
                          {diffMin}'
                        </div>
                        <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">Desde o pedido</p>
                      </div>
                    </div>

                    <div className="flex-grow p-4  overflow-y-auto no-scrollbar space-y-4">
                      <div className="space-y-3">
                        {String(o.itemsSummary).split('\n').map((line, i) => {
                          if (!line.trim()) return null;
                          const isHeader = line.startsWith('---');
                          if (isHeader) return <div key={i} className="h-px bg-white/5 my-4" />;
                          
                          return (
                            <div key={i} className="flex gap-3 items-start">
                              <div className="w-2 h-2 bg-vovoh-gold rounded-full mt-2 shrink-0" />
                              <p className="text-base  font-bold text-zinc-100 leading-tight">{line}</p>
                            </div>
                          );
                        })}
                      </div>
                      
                      {o.customer?.address && (
                        <div className="mt-6 pt-6 border-t border-white/5">
                          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                            <MapPin size={12} /> Endereço
                          </p>
                          <p className="text-[10px]  font-bold text-zinc-400 leading-relaxed">{o.customer.address}</p>
                        </div>
                      )}
                    </div>

                    <div className="p-4  pt-0 shrink-0 space-y-4">
                      {cashReceipt(o, isCash, isVerified)}
                      {/* PIX VERIFICATION IN KDS */}
                      {o.status !== 'concluido' && o.status !== 'entrega' && o.status !== 'cancelado' && !isVerified && isPix && (
                        <div className="p-3 rounded-2xl border bg-amber-500/10 border-amber-500/30 animate-pulse">
                           <div className="flex gap-2 mb-2">
                             <AlertTriangle size={16} className="text-amber-500" />
                             <h4 className="text-[10px] font-black text-amber-500 uppercase">Conferir Pix!</h4>
                           </div>
                           <div className="flex gap-2">
                             <button onClick={() => updateStatusAPI(o.id, 'pix_recusado')} className="flex-1 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest bg-white/5 text-vovoh-red border border-vovoh-red/20">
                               Recusar
                             </button>
                             <button onClick={() => confirmPayment(o.id)} className="flex-1 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest bg-amber-500 text-black">
                               Recebido
                             </button>
                           </div>
                        </div>
                      )}

                      <div className="bg-black/40 rounded-2xl  p-3  flex justify-between items-center border border-white/5">
                         <div>
                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Status</p>
                            <p className="text-[10px] font-black text-vovoh-red uppercase tracking-widest">{o.status}</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Pagamento</p>
                            <p className="text-[10px] font-black text-vovoh-gold uppercase tracking-widest">{o.paymentMethod}</p>
                         </div>
                      </div>
                      
                      <button 
                        onClick={() => {
                          if ((isPix || (isCash && nextStatus === 'concluido')) && !isVerified) {
                            showMsg(isCash ? 'Confirme o dinheiro recebido antes de finalizar.' : 'Vovó, confere o Pix primeiro!', 'error');
                            return;
                          }
                          updateStatusAPI(o.id, nextStatus);
                        }}
                        className={`w-full py-4  rounded-[1.2rem] [1.5rem] font-black text-xs  uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center justify-center gap-3 ${isPix && !isVerified ? 'bg-zinc-800 text-zinc-600 opacity-50' : 'bg-vovoh-red text-white shadow-red-900/20 hover:scale-[1.02] active:scale-95'}`}
                      >
                        {nextLabel} <ArrowRight size={18} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
        
        <footer className="shrink-0 py-4 border-t border-white/5 flex justify-between items-center text-zinc-600">
           <p className="text-[10px] font-black uppercase tracking-widest">Delícias da Vovó Grazy • Sistema de Cozinha</p>
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Atenção (15m+)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Urgente (30m+)</span>
              </div>
           </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vovoh-dark text-white p-4  font-sans selection:bg-vovoh-red pb-36 ">
      {toast && <Toast {...toast} notification={toast} onClose={() => setToast(null)} />}
      
      {showIOSBanner && (
        <div className="mb-8 bg-blue-500/20 border border-blue-500/50 p-4 rounded-2xl text-blue-200 text-sm flex items-start gap-3">
          <div className="mt-0.5"><Bell size={18} /></div>
          <div>
            <p className="font-bold mb-1">Ative as Notificações no iPhone!</p>
            <p className="opacity-90">Para receber alertas de novos pedidos, você precisa instalar este painel. Toque no botão de <b>Compartilhar</b> (quadrado com setinha para cima) e depois em <b>Adicionar à Tela de Início</b>.</p>
          </div>
        </div>
      )}

      {audioBlocked && (
        <div className="mb-8 bg-vovoh-red/20 border border-vovoh-red/50 p-4 rounded-2xl text-red-200 text-sm flex items-start gap-3 cursor-pointer" onClick={testOrderSound}>
          <div className="mt-0.5"><Bell size={18} /></div>
          <div>
            <p className="font-bold mb-1">Permita o som de pedidos</p>
            <p className="opacity-90">O navegador bloqueou a campainha. <b>Toque aqui</b> para testar o som com o painel aberto.</p>
          </div>
        </div>
      )}

      {pendingOrderIds && (
        <div className="mb-8 bg-amber-500/20 border border-amber-500/50 p-4 rounded-2xl text-amber-200 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="mt-0.5"><Bell size={18} className="animate-pulse" /></div>
            <div>
              <p className="font-bold mb-1">Novo Pedido na Cozinha!</p>
              <p className="opacity-90">{isAlarmMuted ? 'Som silenciado.' : soundPlaying ? 'Campainha tocando agora.' : soundEnabled ? 'Campainha habilitada enquanto o painel estiver aberto.' : 'Som ainda não liberado neste navegador.'}</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAlarmMuted(!isAlarmMuted)}
            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/40 rounded-xl font-bold transition-all"
          >
            {isAlarmMuted ? 'Ativar som' : 'Silenciar'}
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-12">
        <header className="sticky top-0 bg-vovoh-dark/95 backdrop-blur-md z-40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 py-4 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-vovoh-red rounded-2xl flex items-center justify-center shadow-2xl rotate-3 shrink-0">
              <ChefHat className="text-white w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div className="min-w-0 flex-grow">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate">Painel da Vovó</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-vovoh-red font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em] whitespace-nowrap">Gestão de Pedidos</span>
                <span className="text-zinc-600 font-bold text-[9px] md:text-[10px]">•</span>
                <span className="text-xs text-zinc-300">{pushState === 'registered' ? 'Aparelho cadastrado para avisos' : 'Avisos ainda não verificados'}</span>
                <button onClick={logout} className="ml-auto px-3 py-2 rounded-xl bg-white/10 text-xs">Sair</button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            {/* Quick manual refresh and web store view */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  fetchGlobalOrders(true);
                  fetchStats();
                  showMsg("Atualizado manualmente!", "success");
                }}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition-all active:rotate-180 duration-500 flex items-center justify-center"
                title="Atualizar agora"
              >
                <RefreshCw size={14} />
              </button>
              
              <button
                onClick={() => {
                  window.location.hash = '';
                }}
                className="flex items-center gap-1.5 px-4 py-3 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                title="Voltar para a loja de doces e salgados"
              >
                <ArrowLeft size={12} /> Ver Loja
              </button>
            </div>

            <button 
              onClick={() => setIsKDS(!isKDS)} 
              className={`px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 ${isKDS ? 'bg-amber-500 text-black shadow-xl' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
            >
              <ChefHat size={14} /> {isKDS ? 'Sair do KDS' : 'Modo KDS'}
            </button>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="bg-white/5 backdrop-blur-md p-1.5 rounded-2xl hidden md:flex gap-1.5 border border-white/5 w-full overflow-x-auto no-scrollbar">
            <button onClick={() => setTab('orders')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${tab === 'orders' ? 'bg-vovoh-red text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Pedidos</button>
            <button onClick={() => setTab('menu')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${tab === 'menu' ? 'bg-vovoh-red text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Cardápio</button>
            <button onClick={() => setTab('coupons')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${tab === 'coupons' ? 'bg-vovoh-red text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Cupons</button>
            <button onClick={() => setTab('configs')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${tab === 'configs' ? 'bg-vovoh-red text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Configs</button>
            <button onClick={() => setTab('stats')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${tab === 'stats' ? 'bg-vovoh-red text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Estatísticas</button>
            <button onClick={() => setTab('finance')} className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${tab === 'finance' ? 'bg-vovoh-red text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}>Financeiro</button>
          </div>
        </header>

        {/* Bottom Navigation Bar (Mobile Only) - Professional 5-tab layout */}
        {!isMobileMenuOpen && (
          <div className="safe-area-nav md:hidden fixed bottom-0 left-0 right-0 z-[250] bg-zinc-950 border-t border-white/5 flex justify-between items-center h-20 pb-4 px-3 shadow-[0_-8px_30px_rgb(0,0,0,0.8)]">
            <button 
              onClick={() => { setTab('orders'); setIsMobileMenuOpen(false); }} 
              className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 active:scale-90 transition-all ${tab === 'orders' ? 'text-vovoh-red' : 'text-zinc-500 hover:text-white'}`}
            >
              <ClipboardList size={22} className={tab === 'orders' ? 'scale-110 transition-transform' : ''} />
              <span className="text-[9px] font-extrabold tracking-wide">Pedidos</span>
            </button>

            <button 
              onClick={() => { setTab('menu'); setIsMobileMenuOpen(false); }} 
              className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 active:scale-90 transition-all ${tab === 'menu' ? 'text-vovoh-red' : 'text-zinc-500 hover:text-white'}`}
            >
              <Utensils size={22} className={tab === 'menu' ? 'scale-110 transition-transform' : ''} />
              <span className="text-[9px] font-extrabold tracking-wide">Cardápio</span>
            </button>

            <div className="relative -top-4 flex-none w-16 flex justify-center">
              <button 
                onClick={() => { setIsKDS(!isKDS); setIsMobileMenuOpen(false); }}
                className={`w-14 h-14 rounded-full shadow-[0_8px_25px_-5px_rgba(245,158,11,0.4)] flex items-center justify-center border-4 border-zinc-950 active:scale-90 transition-all ${isKDS ? 'bg-vovoh-red text-white' : 'bg-amber-500 text-black'}`}
                title="Modo KDS"
              >
                <ChefHat size={24} className="animate-wiggle" />
              </button>
            </div>

            <button 
              onClick={() => { setTab('finance'); setIsMobileMenuOpen(false); }} 
              className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 active:scale-90 transition-all ${tab === 'finance' ? 'text-vovoh-red' : 'text-zinc-500 hover:text-white'}`}
            >
              <DollarSign size={22} className={tab === 'finance' ? 'scale-110 transition-transform' : ''} />
              <span className="text-[9px] font-extrabold tracking-wide">Caixa</span>
            </button>

            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 active:scale-90 transition-all ${isMobileMenuOpen ? 'text-vovoh-red' : 'text-zinc-500 hover:text-white'}`}
            >
              <Menu size={22} className={isMobileMenuOpen ? 'scale-110 transition-transform rotate-90 duration-200' : 'duration-200'} />
              <span className="text-[9px] font-extrabold tracking-wide">Mais</span>
            </button>
          </div>
        )}

        {isMobileMenuOpen && (
          <AdminDialog title="Mais opções" fullScreen onClose={() => setIsMobileMenuOpen(false)} footer={<button className="w-full py-3 rounded-xl bg-white/10 font-bold" onClick={() => setIsMobileMenuOpen(false)}>Voltar ao painel</button>}>
            <p className="text-sm text-zinc-400">Acesse as ferramentas da loja.</p>
            <div className="grid grid-cols-1 gap-3">
              {[
                {name:'Cupons',detail:'Criar e editar descontos',icon:Tag,tab:'coupons'},
                {name:'Configurações',detail:'Loja, pagamento, frete e atendimento',icon:Settings,tab:'configs'},
                {name:'Estatísticas',detail:'Acompanhar vendas e visitas',icon:PieChart,tab:'stats'},
              ].map(item => <button key={item.tab} className="flex items-center gap-4 p-4 min-w-0 rounded-xl bg-white/5 text-left" onClick={() => {setTab(item.tab);setIsMobileMenuOpen(false);}}><item.icon size={24} className="shrink-0 text-vovoh-gold" /><span className="min-w-0"><span className="block font-bold">{item.name}</span><span className="block text-sm text-zinc-400">{item.detail}</span></span></button>)}
              <button className="flex items-center gap-4 p-4 rounded-xl bg-white/5 text-left" onClick={() => {window.location.hash='';setIsMobileMenuOpen(false);}}><ArrowLeft size={24} className="shrink-0" /><span className="font-bold">Ver loja</span></button>
            </div>
          </AdminDialog>
        )}

        {tab === 'orders' ? (
          <div className="space-y-6">
            {savedConfigs && savedProductCount !== null && <StoreSetupChecklist configs={savedConfigs} productCount={savedProductCount} onConfigure={target => {
              if (target === 'menu') setTab('menu');
              else { setConfigTab(target); setTab('configs'); }
              window.scrollTo({ top: 0, behavior: 'auto' });
            }} />}
            <section className="bg-zinc-900 p-5 rounded-2xl space-y-4 border border-white/10" aria-label="Recebimento de pedidos">
              <div><h2 className="text-xl font-bold">{pendingOrders ? pendingOrders + ' pedido(s) aguardando você' : 'Nenhum pedido novo'}</h2>
                <p className="text-sm text-zinc-400 mt-1">{lastUpdated ? 'Última atualização: ' + lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Buscando pedidos...'}</p></div>
              {ordersError && <p role="alert" className="text-amber-300">{ordersError}</p>}
              <details className="space-y-2 border-t border-white/10 pt-3" open={pushState !== 'registered'}>
                <summary className="font-bold cursor-pointer min-h-10">Avisos no celular</summary>
                <p className="text-sm text-zinc-400">O som da campainha funciona com o painel aberto. Para receber avisos com ele fechado, cadastre este aparelho e confira o teste com a tela bloqueada.</p>
                <p className="text-sm" role="status">{pushState === 'registered' ? 'Cadastro confirmado pelo servidor. Confira o teste no celular.' : notifPerm === 'denied' ? 'Notificações bloqueadas no navegador.' : 'Os avisos ainda precisam ser ativados neste aparelho.'}</p>
                {pushError && <p role="alert" className="text-amber-300 text-sm">{pushError}</p>}
                <div className="flex flex-wrap gap-3">
                  <button onClick={requestNotification} disabled={pushState === 'registering'} className="min-h-12 px-4 bg-amber-400 text-black rounded-xl font-bold disabled:opacity-50">{pushState === 'registering' ? 'Ativando...' : pushState === 'registered' ? 'Cadastrar novamente' : 'Ativar avisos'}</button>
                  <button onClick={testNotification} disabled={pushState !== 'registered' || testingPush} className="min-h-12 px-4 bg-white/10 rounded-xl font-bold disabled:opacity-40">{testingPush ? 'Enviando...' : 'Enviar teste'}</button>
                </div>
              </details>
            </section>
            <div className="flex flex-wrap gap-2">
               <button onClick={() => setFilter('novos')} className={'min-h-12 px-4 py-2 rounded-lg text-sm font-bold ' + (filter === 'novos' ? 'bg-amber-400 text-black' : 'bg-white/10 text-white')}>Novos ({pendingOrders})</button>
               <button onClick={() => setFilter('ativos')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${filter === 'ativos' ? 'bg-white/10 text-white' : 'text-zinc-600'}`}>Ativos</button>
               <button onClick={() => setFilter('todos')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${filter === 'todos' ? 'bg-white/10 text-white' : 'text-zinc-600'}`}>Histórico</button>
               {filter === 'todos' && historyCursor && <button disabled={loadingHistory} onClick={() => loadHistory(true)} className="px-4 py-2 text-xs text-zinc-300">{loadingHistory ? 'Carregando...' : 'Carregar anteriores'}</button>}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {visibleOrders.length === 0 ? (
                 <div className="col-span-full py-32 text-center text-zinc-800 space-y-4">
                   <Bell size={64} className="mx-auto" />
                   <p className="text-lg font-black uppercase tracking-widest">Nenhum pedido aqui...</p>
                 </div>
              ) : (
                visibleOrders.map(o => {
                  const isPix = String(o.paymentMethod).toLowerCase().includes('pix');
                  const isOnlineCard = String(o.paymentMethod).toLowerCase().includes('cartão online');
                  const isCash = o.payment?.method === 'dinheiro' || String(o.paymentMethod).toLowerCase().includes('dinheiro');
                  const isVerified = o.payment?.paid === true;

                  return (
                    <div key={o.id} id={'order-' + o.id} className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 p-4 sm:p-8 rounded-[2rem] sm:rounded-[3rem] space-y-4 sm:space-y-6 relative overflow-hidden group">
                      {syncing && <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center backdrop-blur-sm"><RefreshCw className="animate-spin text-vovoh-red" size={32} /></div>}
                      <div className="flex justify-between items-start gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-vovoh-red uppercase tracking-widest mb-0.5">#{String(o.id).slice(-6)}</p>
                          <h4 className="text-lg sm:text-xl font-black truncate">{o.customer?.name}</h4>
                          <p className="text-xs font-bold text-amber-300">{o.type === 'retirada' ? 'Retirada na loja' : 'Entrega no endereço'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-zinc-500 font-bold">{o.customer?.phone}</p>
                            {o.customer?.phone && (
                              <button 
                                onClick={() => {
                                  const cleanPhone = String(o.customer.phone).replace(/\D/g, '');
                                  const msg = `Oi ${o.customer.name}, aqui é da Delícias da Vovó!  Sobre o seu pedido #${String(o.id).slice(-4)}...`;
                                  window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                                }}
                                className="w-6 h-6 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center hover:bg-green-500 hover:text-white transition-colors shrink-0"
                                title="Chamar no WhatsApp"
                              >
                                <MessageCircle size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${o.status === 'concluido' ? 'bg-green-500/20 text-green-500' : o.status === 'cancelado' ? 'bg-red-500/20 text-red-500' : 'bg-vovoh-red/20 text-vovoh-red'}`}>
                          {o.status === 'cancelado' && o.refusalReason ? 'RECUSADO' : o.status}
                        </div>
                      </div>
                      
                      <div className="p-3.5 sm:p-4 bg-black/20 rounded-2xl space-y-2">
                        {o.scheduledTo && (
                          <div className="bg-blue-500/20 text-blue-300 p-2.5 sm:p-3 rounded-xl mb-1 text-[10px] sm:text-xs font-black uppercase tracking-wide border border-blue-500/30 flex items-center gap-2">
                            <Calendar size={13} />
                            Agendado: {new Date(o.scheduledTo).toLocaleDateString('pt-BR')} às {new Date(o.scheduledTo).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        )}
                        <p className="text-xs font-bold text-zinc-300 whitespace-pre-line leading-relaxed break-words">{o.itemsSummary}</p>
                        {o.customer?.address && (
                          <p className="text-[10px] font-medium text-zinc-500 mt-2 pt-2 border-t border-white/5 break-words"><MapPin size={12} className="inline mr-1" aria-hidden="true" /> {o.customer.address}</p>
                        )}
                        <div className="pt-2 mt-2 border-t border-white/5 flex justify-between items-center gap-4">
                          <div className="flex flex-col min-w-0">
                            <span className="text-zinc-500 uppercase text-[9px] font-black truncate">Pagamento</span>
                            <span className={`text-[10px] font-bold truncate ${isOnlineCard ? 'text-green-400' : isPix ? 'text-amber-400' : 'text-zinc-300'}`}>{o.paymentMethod}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-zinc-500 uppercase text-[9px] font-black block">Total do pedido</span>
                            <span className="text-vovoh-gold font-black text-sm sm:text-base">R$ {Number(o.total || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {cashReceipt(o, isCash, isVerified)}
                      {/* CAIXA DE ALERTA DE PAGAMENTO */}
                      {o.status !== 'concluido' && o.status !== 'entrega' && o.status !== 'cancelado' && !isVerified && isPix && (
                        <div className="p-3.5 sm:p-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 space-y-3">
                           <div className="flex gap-2.5">
                             <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                             <div>
                                <h4 className="text-xs sm:text-sm font-black text-amber-500">
                                  Atenção: Conferir Pix!
                                </h4>
                                <p className="text-[9px] sm:text-[10px] text-zinc-400 mt-0.5 font-bold">
                                  Verifique o comprovante antes de pôr no forno.
                                </p>
                             </div>
                           </div>
                           <div className="flex gap-2">
                             <button onClick={() => updateStatusAPI(o.id, 'pix_recusado')} className="flex-1 py-3 sm:py-3.5 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all bg-white/5 text-vovoh-red hover:bg-vovoh-red/20 border border-vovoh-red/20">
                               <X size={14} /> Não Recebi
                             </button>
                             <button onClick={() => confirmPayment(o.id)} className="flex-[2] py-3 sm:py-3.5 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all bg-amber-500 text-black hover:bg-amber-400">
                               <CheckCircle2 size={14} /> Pix Recebido
                             </button>
                           </div>
                        </div>
                      )}

                      {o.status === 'pix_recusado' && (
                        <div className="p-3 bg-vovoh-red/10 rounded-2xl border border-vovoh-red/20 flex items-center gap-2.5">
                          <X size={14} className="text-vovoh-red shrink-0" />
                          <span className="text-xs font-bold text-vovoh-red leading-snug">Você marcou o Pix como não recebido. Aguardando cliente.</span>
                        </div>
                      )}

                      {isVerified && o.status !== 'concluido' && o.status !== 'cancelado' && (
                        <div className="p-2.5 sm:p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-2.5">
                          <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                          <span className="text-[11px] sm:text-xs font-bold text-zinc-400 leading-snug">
                            {isOnlineCard ? 'Pagamento Online Confirmado!' : 'Caixa conferido pela Vovó!'}
                          </span>
                        </div>
                      )}

                      {o.status !== 'concluido' && o.status !== 'cancelado' && (
                        <div className="mt-2 space-y-2.5">
                          {o.scheduledTo && (
                            <button 
                              onClick={() => setRefusalModal({isOpen: true, orderId: o.id})}
                              className="w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/10 flex items-center justify-center gap-1.5"
                            >
                              <X size={12} /> Recusar Agendamento
                            </button>
                          )}

                          {/* SMART FLOW TRANSITION BUTTON (HUMAN TRACEABLE UX) */}
                          {(() => {
                            const getWorkflowInfo = (currentStatus: string) => {
                              switch (currentStatus) {
                                case 'pendente':
                                  return {
                                    nextStatus: 'preparando',
                                    label: 'Começar Preparo',
                                    icon: ChefHat,
                                    color: 'bg-vovoh-red text-white hover:bg-red-600 shadow-md shadow-vovoh-red/10',
                                    checkBefore: true
                                  };
                                case 'preparando':
                                  return {
                                    nextStatus: 'forno',
                                    label: 'Enviar p/ Forno',
                                    icon: Flame,
                                    color: 'bg-amber-500 text-black hover:bg-amber-400 shadow-md shadow-amber-500/5',
                                    checkBefore: false
                                  };
                                case 'forno':
                                  return {
                                    nextStatus: 'entrega',
                                    label: 'Pronto p/ Entrega',
                                    icon: Bike,
                                    color: 'bg-sky-500 text-white hover:bg-sky-600 shadow-md shadow-sky-500/10',
                                    checkBefore: false
                                  };
                                case 'entrega':
                                  return {
                                    nextStatus: 'concluido',
                                    label: 'Finalizar Pedido',
                                    icon: PackageCheck,
                                    color: 'bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-500/10',
                                    checkBefore: false
                                  };
                                default:
                                  return null;
                              }
                            };

                            const flow = getWorkflowInfo(o.status);

                            if (flow && manualOverrideOrderId !== o.id) {
                              return (
                                <div className="space-y-2.5">
                                  <button
                                    onClick={() => {
                                      // Flow check rules
                                      if (flow.nextStatus === 'preparando' && o.scheduledTo) {
                                        const scheduledDate = new Date(o.scheduledTo);
                                        const now = new Date();
                                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                        const scheduled = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate());
                                        
                                        if (scheduled > today) {
                                          setConfirmModal({
                                            isOpen: true,
                                            title: " Pedido Agendado",
                                            message: `Vovó, este pedido é para ${scheduledDate.toLocaleDateString('pt-BR')} às ${scheduledDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}.\n\nTem certeza que quer começar a preparar hoje?`,
                                            onConfirm: () => {
                                              setConfirmModal(null);
                                              updateStatusAPI(o.id, 'preparando');
                                            }
                                          });
                                          return;
                                        }
                                      }

                                      if (flow.nextStatus === 'forno' && isPix && !isVerified) {
                                        showMsg("Vovó, confere o Pix ali em cima primeiro!", "error");
                                        return;
                                      }

                                      if (flow.nextStatus === 'entrega' && !isVerified && !isCash) {
                                        showMsg("Vovó, confirme o pagamento/troco antes da entrega!", "error");
                                        return;
                                      }

                                      if (flow.nextStatus === 'concluido' && !isVerified) {
                                        showMsg("Não podemos concluir sem verificar o caixa!", "error");
                                        return;
                                      }

                                      updateStatusAPI(o.id, flow.nextStatus);
                                    }}
                                    className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 ${flow.color}`}
                                  >
                                    <flow.icon size={16} aria-hidden="true" /> {flow.label}
                                  </button>

                                  <div className="text-center">
                                    <button 
                                      onClick={() => setManualOverrideOrderId(o.id)}
                                      className="text-[10px] text-zinc-500 hover:text-vovoh-gold font-bold underline decoration-dashed"
                                    >
                                      Alterar status manualmente
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            // Manual override fallback layout
                            return (
                              <div className="space-y-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Status Manual</span>
                                  <button 
                                    onClick={() => setManualOverrideOrderId(null)}
                                    className="text-[9px] font-black text-vovoh-gold uppercase hover:underline"
                                  >
                                    Voltar ao botão rápido
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <button onClick={() => updateStatusAPI(o.id, 'preparando')} className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${o.status === 'preparando' ? 'bg-vovoh-red text-white' : 'bg-white/5 hover:bg-white/10 text-zinc-400'}`}>
                                    Preparando
                                  </button>
                                  
                                  <button onClick={() => {
                                    if (isPix && !isVerified) {
                                      showMsg("Vovó, confere o Pix ali em cima primeiro!", "error");
                                      return;
                                    }
                                    updateStatusAPI(o.id, 'forno');
                                  }} className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${o.status === 'forno' ? 'bg-vovoh-red text-white' : (isPix && !isVerified ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' : 'bg-white/5 hover:bg-white/10 text-zinc-400')}`}>
                                    Forno
                                  </button>
                                  
                                  <button onClick={() => {
                                    if (!isVerified && !isCash) {
                                      showMsg("Vovó, confirme o pagamento/troco antes da entrega!", "error");
                                      return;
                                    }
                                    updateStatusAPI(o.id, 'entrega');
                                  }} className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${o.status === 'entrega' ? 'bg-vovoh-red text-white' : (!isVerified && !isCash ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' : 'bg-white/5 hover:bg-white/10 text-zinc-400')}`}>
                                    Entrega
                                  </button>
                                  
                                  <button onClick={() => {
                                    if (!isVerified) {
                                      showMsg("Não podemos concluir sem verificar o caixa!", "error");
                                      return;
                                    }
                                    updateStatusAPI(o.id, 'concluido');
                                  }} className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${o.status === 'concluido' ? 'bg-vovoh-red text-white' : (!isVerified ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50' : 'bg-white/5 hover:bg-white/10 text-zinc-400')}`}>
                                    Concluído
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : tab === 'menu' ? (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <h3 className="text-xl sm:text-2xl font-black">Nosso Cardápio</h3>
              <button onClick={() => { setIsAdding(true); setEditingProduct({ name:'', description:'', price:'', category:'fritos', image:'' }); }} className="flex items-center justify-center gap-2 px-5 py-3.5 bg-vovoh-red text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">
                <Plus size={18}/> Adicionar produto
              </button>
            </div>

            <div className="grid grid-cols-1  lg:grid-cols-3 gap-4 sm:gap-6">
              {products.map((p:any) => (
                <div key={p.id} className="bg-zinc-900/50 p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 flex items-center gap-4 sm:gap-6 group hover:border-vovoh-red/20 transition-all">
                  <img src={p.image || PLACEHOLDER_IMG} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl object-cover bg-white/5 shrink-0" />
                  <div className="flex-grow min-w-0">
                    <h4 className="font-black text-sm sm:text-base truncate">{p.name}</h4>
                    <p className="text-vovoh-red font-black text-xs sm:text-sm mt-0.5">R$ {formatMoneyInput(p.price)}</p>
                  </div>
                  <div className="flex sm:flex-col gap-2  :opacity-100 opacity-100 transition-opacity shrink-0">
                    <button aria-label={`Editar produto ${p.name}`} onClick={() => { setIsAdding(false); setEditingProduct(p); }} className="p-2.5 sm:p-3 bg-white/5 hover:bg-vovoh-gold text-zinc-400  hover:text-white rounded-xl transition-all" title="Editar"><Edit2 size={14}/></button>
                    <button aria-label={`Excluir produto ${p.name}`} onClick={() => handleDeleteProduct(p.id)} className="p-2.5 sm:p-3 bg-white/5 hover:bg-vovoh-red text-zinc-400  hover:text-white rounded-xl transition-all" title="Excluir"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : tab === 'coupons' ? (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <h3 className="text-xl sm:text-2xl font-black">Cupons de Desconto</h3>
              <button onClick={() => { setIsAddingCoupon(true); setEditingCoupon({ code:'', discount:'', type:'percent' }); }} className="flex items-center justify-center gap-2 px-5 py-3.5 bg-vovoh-red text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">
                <Plus size={18}/> Novo Cupom
              </button>
            </div>

            <div className="grid grid-cols-1  lg:grid-cols-3 gap-4 sm:gap-6">
              {coupons.map((c:any) => (
                <div key={c.code} className="bg-zinc-900/50 p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 flex items-center gap-4 sm:gap-6 group hover:border-vovoh-red/20 transition-all">
                  <div className="flex-grow min-w-0">
                    <h4 className="font-black text-base sm:text-lg uppercase tracking-widest text-vovoh-gold truncate">{c.code}</h4>
                    <p className="text-zinc-400 font-bold text-xs mt-0.5">
                      Desconto: {c.type === 'percent' ? `${c.discount > 1 ? c.discount : c.discount * 100}%` : `R$ ${formatMoneyInput(c.discount)}`}
                    </p>
                  </div>
                  <div className="flex sm:flex-col gap-2  :opacity-100 opacity-100 transition-opacity shrink-0">
                    <button aria-label={`Editar cupom ${c.code}`} onClick={() => { setIsAddingCoupon(false); setEditingCoupon({...c,discount:c.type === 'percent' ? (Number(c.discount)>1 ? Number(c.discount) : Number(c.discount)*100) : c.discount}); }} className="p-2.5 sm:p-3 bg-white/5 hover:bg-vovoh-gold text-zinc-400  hover:text-white rounded-xl transition-all" title="Editar"><Edit2 size={14}/></button>
                    <button aria-label={`Excluir cupom ${c.code}`} onClick={() => handleDeleteCoupon(c.code)} className="p-2.5 sm:p-3 bg-white/5 hover:bg-vovoh-red text-zinc-400  hover:text-white rounded-xl transition-all" title="Excluir"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
              {coupons.length === 0 && (
                 <div className="col-span-full py-16 text-center text-zinc-800 space-y-4">
                   <p className="text-lg font-black uppercase tracking-widest">Nenhum cupom criado ainda.</p>
                 </div>
              )}
            </div>
          </div>
        ) : tab === 'configs' ? (
          <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto">
            <div className="flex flex-col   justify-between gap-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-vovoh-gold text-white rounded-xl flex items-center justify-center shadow-lg"><RefreshCw size={20} /></div>
                <h3 className="text-2xl font-black">Configurações da Loja</h3>
              </div>
              
              <nav aria-label="Seções das configurações" className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full min-w-0">
                {([['geral','Loja'],['pagamentos','Pagamentos'],['entrega','Frete'],['atendimento','Atendimento'],['endereco','Endereço'],['conteudo','Conteúdo'],['avisos','Avisos']] as const).map(([id,label]) => <button key={id} type="button" aria-pressed={configTab === id} onClick={() => setConfigTab(id)} className={`min-w-0 py-3 px-2 rounded-xl text-sm font-bold border ${configTab === id ? 'bg-white/10 border-white/30' : 'border-white/10 text-zinc-400'}`}>{label}</button>)}
              </nav>
            </div>

            <div className="grid gap-6">
              {configTab === 'geral' && (
                <div className="bg-zinc-900/50 p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nome da Loja</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text" 
                        className="flex-grow p-4 bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm"
                        value={configs.store_name || ''}
                        onChange={e => setConfigs({...configs, store_name: e.target.value})}
                      />
                      <button onClick={() => handleUpdateConfig('store_name', configs.store_name)} className="px-6 py-4 sm:py-0 bg-vovoh-red text-white rounded-2xl font-black text-xs uppercase shrink-0">Salvar</button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Descrição da Loja (Subtítulo)</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text" 
                        className="flex-grow p-4 bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm"
                        value={configs.store_subtitle || ''}
                        onChange={e => setConfigs({...configs, store_subtitle: e.target.value})}
                      />
                      <button onClick={() => handleUpdateConfig('store_subtitle', configs.store_subtitle)} className="px-6 py-4 sm:py-0 bg-vovoh-red text-white rounded-2xl font-black text-xs uppercase shrink-0">Salvar</button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label htmlFor="store-whatsapp" className="text-sm font-bold">WhatsApp da loja (com DDD)</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <PhoneInput
                        type="tel"
                        className="flex-grow p-4 bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm"
                        id="store-whatsapp" value={configs.whatsapp_number || ''}
                        onValueChange={phone => setConfigs({...configs, whatsapp_number: phone})}
                      />
                      <button onClick={() => handleUpdateConfig('whatsapp_number', configs.whatsapp_number)} className="px-6 py-4 sm:py-0 bg-vovoh-red text-white rounded-2xl font-black text-xs uppercase shrink-0">Salvar</button>
                    </div>
                  </div>

                </div>
              )}
              {configTab === 'avisos' && <section className="min-w-0 bg-zinc-900/50 p-4 sm:p-6 rounded-2xl border border-white/10 space-y-5"><h3 className="text-xl font-bold">Avisos e som de pedidos</h3>                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Alarme Geral (Todos os Dispositivos)</label>
                    <button
                      onClick={async () => {
                        if (confirm("Tem certeza que deseja enviar um alerta para TODOS os dispositivos?")) {
                          try {
                            const res = await adminFetch(`/admin/broadcast-push`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ title: ' ALERTA GERAL DA VOVÓ!', body: 'Por favor, verifique o pedido agora!' })
                            });
                            if (res.ok) showMsg("Alerta enviado para todos!", "success");
                            else showMsg("Erro ao enviar alerta.", "error");
                          } catch (e) {
                            showMsg("Erro ao enviar alerta.", "error");
                          }
                        }
                      }}
                      className="w-full py-4 bg-red-600/20 text-red-500 rounded-2xl font-black text-xs uppercase border border-red-500/20 hover:bg-red-600 hover:text-white transition-all"
                    >
                      Enviar Alarme Geral
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Testar Notificações</label>
                    <button
                      onClick={testNotification}
                      disabled={testingPush}
                      className="w-full py-4 bg-vovoh-red/10 text-vovoh-red rounded-2xl font-black text-xs uppercase border border-vovoh-red/20 hover:bg-vovoh-red hover:text-white transition-all"
                    >
                      Enviar Notificação de Teste
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Testar Campainha</label>
                    <button
                      onClick={testOrderSound}
                      className="w-full py-4 bg-vovoh-red/10 text-vovoh-red rounded-2xl font-black text-xs uppercase border border-vovoh-red/20 hover:bg-vovoh-red hover:text-white transition-all"
                    >
                      Tocar Som de Pedido
                    </button>
                  </div>

</section>}

{configTab === 'pagamentos' && <PaymentSettings {...settingsProps} />}
              {configTab === 'entrega' && <DeliverySettings {...settingsProps} />}
              {configTab === 'atendimento' && <HoursSettings {...settingsProps} />}
              {configTab === 'endereco' && <AddressSettings configs={configs} onChange={setConfigs} onSaveAddress={saveStoreAddress} saving={savingAddress} />}

              {configTab === 'conteudo' && (
                <div className="bg-zinc-900/50 p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-white/5 space-y-8 animate-in slide-in-from-bottom-4">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Previsão da Cozinha (Texto Livre)</label>
                    <p className="text-[10px] font-bold text-zinc-500 italic">Este texto aparecerá no topo do site para os clientes.</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text" 
                        placeholder="Ex: 40 a 50 min"
                        className="flex-grow p-4 bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm"
                        value={configs.kitchen_forecast || ''}
                        onChange={e => setConfigs({...configs, kitchen_forecast: e.target.value})}
                      />
                      <button onClick={() => handleUpdateConfig('kitchen_forecast', configs.kitchen_forecast)} className="px-6 py-4 sm:py-0 bg-vovoh-red text-white rounded-2xl font-black text-xs uppercase shrink-0">Salvar</button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nossa História (Texto)</label>
                    <textarea 
                      className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm min-h-[150px] resize-none"
                      value={configs.story_text || ''}
                      onChange={e => setConfigs({...configs, story_text: e.target.value})}
                      onBlur={() => handleUpdateConfig('story_text', configs.story_text)}
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Foto da História</label>
                    <div className="flex flex-col gap-4">
                      {configs.story_image && (
                        <div className="w-32 h-32 rounded-2xl overflow-hidden border border-white/10">
                          <img src={configs.story_image} className="w-full h-full object-cover" alt="História" />
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          type="text" 
                          placeholder="URL da Imagem"
                          className="flex-grow p-4 bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm"
                          value={configs.story_image || ''}
                          onChange={e => setConfigs({...configs, story_image: e.target.value})}
                        />
                        <label className="px-6 bg-zinc-800 text-white rounded-2xl font-black text-xs uppercase flex items-center justify-center cursor-pointer hover:bg-zinc-700 transition-colors">
                          <Upload size={16} className="mr-2" />
                          {uploading ? '...' : 'Upload'}
                          <input type="file" className="hidden" accept="image/*" onChange={e => handleImageUpload(e, (base64) => {
                            setConfigs({...configs, story_image: base64});
                            handleUpdateConfig('story_image', base64);
                          })} />
                        </label>
                        <button onClick={() => handleUpdateConfig('story_image', configs.story_image)} className="px-6 bg-vovoh-red text-white rounded-2xl font-black text-xs uppercase">Salvar</button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Depoimentos dos Netinhos</label>
                      <button 
                        onClick={() => {
                          const current = configs.testimonials ? JSON.parse(configs.testimonials) : [];
                          const updated = [...current, { name: "Novo Netinho", text: "Escreva aqui...", rating: 5 }];
                          setConfigs({...configs, testimonials: JSON.stringify(updated)});
                          handleUpdateConfig('testimonials', JSON.stringify(updated));
                        }}
                        className="px-4 py-2 bg-vovoh-red/10 text-vovoh-red rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                      >
                        <Plus size={14} /> Adicionar Depoimento
                      </button>
                    </div>
                    
                    <div className="grid gap-4">
                      {(configs.testimonials ? (Array.isArray(JSON.parse(configs.testimonials)) ? JSON.parse(configs.testimonials) : []) : []).map((t: any, idx: number) => (
                        <div key={idx} className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4 relative group">
                          <button 
                            onClick={() => {
                              const current = JSON.parse(configs.testimonials);
                              const updated = current.filter((_: any, i: number) => i !== idx);
                              setConfigs({...configs, testimonials: JSON.stringify(updated)});
                              handleUpdateConfig('testimonials', JSON.stringify(updated));
                            }}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-vovoh-red transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          
                          <div className="grid grid-cols-1  gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-zinc-500">Nome</label>
                              <input 
                                type="text" 
                                className="w-full p-3 bg-white/5 rounded-xl border border-white/10 font-bold text-sm"
                                value={t.name}
                                onChange={e => {
                                  const current = JSON.parse(configs.testimonials);
                                  current[idx].name = e.target.value;
                                  setConfigs({...configs, testimonials: JSON.stringify(current)});
                                }}
                                onBlur={() => handleUpdateConfig('testimonials', configs.testimonials)}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-zinc-500">Estrelas (1-5)</label>
                              <input 
                                type="number" min="1" max="5"
                                className="w-full p-3 bg-white/5 rounded-xl border border-white/10 font-bold text-sm"
                                value={t.rating}
                                onChange={e => {
                                  const current = JSON.parse(configs.testimonials);
                                  current[idx].rating = parseInt(e.target.value);
                                  setConfigs({...configs, testimonials: JSON.stringify(current)});
                                }}
                                onBlur={() => handleUpdateConfig('testimonials', configs.testimonials)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-500">Depoimento</label>
                            <textarea 
                              className="w-full p-3 bg-white/5 rounded-xl border border-white/10 font-medium text-sm min-h-[80px] resize-none"
                              value={t.text}
                              onChange={e => {
                                const current = JSON.parse(configs.testimonials);
                                current[idx].text = e.target.value;
                                setConfigs({...configs, testimonials: JSON.stringify(current)});
                              }}
                              onBlur={() => handleUpdateConfig('testimonials', configs.testimonials)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Dúvidas Frequentes</label>
                      <button 
                        onClick={() => {
                          const current = configs.faqs ? JSON.parse(configs.faqs) : [];
                          const updated = [...current, { q: "Nova Pergunta?", a: "Resposta aqui..." }];
                          setConfigs({...configs, faqs: JSON.stringify(updated)});
                          handleUpdateConfig('faqs', JSON.stringify(updated));
                        }}
                        className="px-4 py-2 bg-vovoh-red/10 text-vovoh-red rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                      >
                        <Plus size={14} /> Adicionar Pergunta
                      </button>
                    </div>
                    
                    <div className="grid gap-4">
                      {(configs.faqs ? (Array.isArray(JSON.parse(configs.faqs)) ? JSON.parse(configs.faqs) : []) : []).map((f: any, idx: number) => (
                        <div key={idx} className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-4 relative group">
                          <button 
                            onClick={() => {
                              const current = JSON.parse(configs.faqs);
                              const updated = current.filter((_: any, i: number) => i !== idx);
                              setConfigs({...configs, faqs: JSON.stringify(updated)});
                              handleUpdateConfig('faqs', JSON.stringify(updated));
                            }}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-vovoh-red transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-500">Pergunta</label>
                            <input 
                              type="text" 
                              className="w-full p-3 bg-white/5 rounded-xl border border-white/10 font-bold text-sm"
                              value={f.q}
                              onChange={e => {
                                const current = JSON.parse(configs.faqs);
                                current[idx].q = e.target.value;
                                setConfigs({...configs, faqs: JSON.stringify(current)});
                              }}
                              onBlur={() => handleUpdateConfig('faqs', configs.faqs)}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-500">Resposta</label>
                            <textarea 
                              className="w-full p-3 bg-white/5 rounded-xl border border-white/10 font-medium text-sm min-h-[80px] resize-none"
                              value={f.a}
                              onChange={e => {
                                const current = JSON.parse(configs.faqs);
                                current[idx].a = e.target.value;
                                setConfigs({...configs, faqs: JSON.stringify(current)});
                              }}
                              onBlur={() => handleUpdateConfig('faqs', configs.faqs)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-vovoh-red/10 border border-vovoh-red/20 p-4 sm:p-8 rounded-[2.5rem] flex items-start gap-3 sm:gap-6">
                <AlertTriangle className="text-vovoh-red shrink-0" size={32} />
                <div>
                  <h4 className="font-black text-sm">Aviso de Segurança</h4>
                  <p className="text-xs font-medium text-zinc-400 mt-1">Estas alterações afetam a loja em tempo real para todos os clientes. Use com carinho!</p>
                </div>
              </div>
            </div>
          </div>
        ) : tab === 'stats' ? (
          <div className="space-y-8 animate-in fade-in max-w-6xl mx-auto pb-20">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-vovoh-red text-white rounded-xl flex items-center justify-center shadow-lg"><PieChart size={20} /></div>
                  <h3 className="text-2xl font-black">Estatísticas em Tempo Real</h3>
                </div>
                <button onClick={fetchStats} className="p-3 bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-all">
                  <RefreshCw size={20} className={syncing ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="grid grid-cols-1  gap-6">
                <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Online Agora</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-emerald-400">{stats?.online?.length || 0}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1">pessoas</span>
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Visitas Totais</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-white">{stats?.visits?.total || 0}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1">cliques</span>
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Este Mês</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-vovoh-gold">{stats?.visits?.month || 0}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1">novos</span>
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Acessos via App</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-vovoh-red">{stats?.visits?.pwa || 0}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1">visitas</span>
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Apps Instalados</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-blue-400">{stats?.visits?.installs || 0}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1">instalações</span>
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Sem Login</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-zinc-400">{stats?.visits?.authStats?.none || 0}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1">visitas</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1  gap-6">
                <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Login como Convidado</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-indigo-400">{stats?.visits?.authStats?.guest || 0}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1">usuários</span>
                  </div>
                </div>
                <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Login Completo (Google/Email)</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-emerald-400">{stats?.visits?.authStats?.registered || 0}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1">usuários</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                  <h4 className="font-black text-lg">Visitas nos Últimos 7 Dias</h4>
                  <div className="h-[300px] w-full min-h-[300px]">
                    {stats?.history && stats.history.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.history}>
                          <defs>
                            <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#D61F1F" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#D61F1F" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#ffffff40" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="#ffffff40" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '1rem' }}
                            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#D61F1F" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorVisits)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-zinc-500 text-xs font-bold uppercase tracking-widest">
                        Sem dados de visitas ainda
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h4 className="font-black text-lg">Online Agora</h4>
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                      Ao Vivo
                    </div>
                  </div>
                  
                  <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar">
                    {(stats?.online || []).length === 0 ? (
                      <p className="text-sm text-zinc-500 italic text-center py-8">Ninguém navegando no momento...</p>
                    ) : stats.online.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-vovoh-cream text-vovoh-red rounded-xl flex items-center justify-center font-black">
                            {(p.userName || 'V').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-sm">{p.userName || 'Visitante Anônimo'}</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                              {p.isShopping ? <ShoppingBag size={12} className="inline mr-1" aria-hidden="true" /> : <Eye size={12} className="inline mr-1" aria-hidden="true" />} {p.isShopping ? 'Montando Sacola' : 'Navegando'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Visto há</p>
                          <p className="text-xs font-black text-white">
                            {Math.floor((Date.now() - new Date(p.lastSeen).getTime()) / 1000)}s
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                  <h4 className="font-black text-lg">Produtos Mais Vendidos</h4>
                  <div className="space-y-4">
                    {topProducts.length === 0 ? (
                      <p className="text-sm text-zinc-500 italic text-center py-8">Ainda não temos vendas concluídas...</p>
                    ) : topProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-vovoh-red/10 text-vovoh-red rounded-2xl flex items-center justify-center font-black text-lg">
                            {i + 1}
                          </div>
                          <div>
                            <p className="font-black text-base">{p.name}</p>
                            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{p.count} unidades vendidas</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Receita</p>
                          <p className="text-lg font-black text-emerald-400">R$ {p.revenue.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                  <h4 className="font-black text-lg">Resumo Geral</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total de Clientes</p>
                      <p className="text-2xl font-black text-white">{stats?.totalUsers || 0}</p>
                    </div>
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total de Pedidos</p>
                      <p className="text-2xl font-black text-white">{stats?.totalOrders || 0}</p>
                    </div>
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Faturamento (Concluídos)</p>
                      <p className="text-3xl font-black text-emerald-400">R$ {(stats?.revenue || 0).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

        {tab === 'finance' && (() => {
          if (!financeData) return <p className="p-8 text-zinc-400">{financeError || 'Carregando o resumo financeiro...'}</p>;
          const filteredOrders = financeData.recent as any[];
          const { totalRevenue, pixRevenue, cardRevenue } = financeData;
          const averageOrder = financeData.count ? totalRevenue / financeData.count : 0;

          return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
              <div className="flex flex-col  justify-between items-start  gap-4">
                <h3 className="text-2xl font-black">Resumo Financeiro</h3>
                <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-white/5 w-full  overflow-x-auto no-scrollbar">
                  {[
                    { id: 'today', label: 'Hoje' },
                    { id: 'week', label: 'Semana' },
                    { id: 'month', label: 'Mês' },
                    { id: 'all', label: 'Tudo' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setFinancePeriod(p.id as any)}
                      className={`px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap flex-grow  ${financePeriod === p.id ? 'bg-vovoh-red text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1  lg:grid-cols-4 gap-6">
                <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] flex flex-col gap-4">
                  <div className="w-12 h-12 bg-green-500/20 text-green-500 rounded-2xl flex items-center justify-center"><DollarSign size={24} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Faturamento Período</p>
                    <h3 className="text-3xl font-black text-white">R$ {totalRevenue.toFixed(2)}</h3>
                  </div>
                </div>
                
                <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] flex flex-col gap-4">
                  <div className="w-12 h-12 bg-blue-500/20 text-blue-500 rounded-2xl flex items-center justify-center"><PieChart size={24} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Ticket Médio</p>
                    <h3 className="text-3xl font-black text-white">R$ {averageOrder.toFixed(2)}</h3>
                  </div>
                </div>

                <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] flex flex-col gap-4">
                  <div className="w-12 h-12 bg-purple-500/20 text-purple-500 rounded-2xl flex items-center justify-center"><CreditCard size={24} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Pedidos Concluídos</p>
                    <h3 className="text-3xl font-black text-white">{financeData.count}</h3>
                  </div>
                </div>

                <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] flex flex-col gap-4">
                  <div className="w-12 h-12 bg-vovoh-gold/20 text-vovoh-gold rounded-2xl flex items-center justify-center"><TrendingUp size={24} /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Crescimento</p>
                    <h3 className="text-3xl font-black text-white">+12%</h3>
                    <p className="text-[8px] font-bold text-zinc-600 uppercase mt-1">Simulado vs. período anterior</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Wallet className="text-vovoh-red" size={24} />
                      <h3 className="text-xl font-black">Métodos de Pagamento</h3>
                    </div>
                  </div>
                  <div className="p-8 space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                        <span className="text-zinc-400">Pix</span>
                        <span className="text-white">R$ {pixRevenue.toFixed(2)}</span>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-vovoh-gold rounded-full transition-all duration-1000" 
                          style={{ width: `${totalRevenue > 0 ? (pixRevenue / totalRevenue) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-black uppercase tracking-widest">
                        <span className="text-zinc-400">Cartão Online (Stripe)</span>
                        <span className="text-white">R$ {cardRevenue.toFixed(2)}</span>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-1000" 
                          style={{ width: `${totalRevenue > 0 ? (cardRevenue / totalRevenue) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden">
                  <div className="p-8 border-b border-white/5 flex items-center gap-4">
                    <Calendar className="text-vovoh-red" size={24} />
                    <h3 className="text-xl font-black">Últimas Entradas</h3>
                  </div>
                  <div className="p-4 max-h-[400px] overflow-y-auto no-scrollbar">
                    {filteredOrders.length === 0 ? (
                      <div className="py-12 text-center text-zinc-600">
                        <p className="font-bold text-sm">Nenhum pedido concluído neste período.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredOrders.slice(0, 20).map(o => (
                          <div key={o.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center"><CheckCircle2 size={18} /></div>
                              <div>
                                <p className="font-black text-sm text-white">{o.customer?.name || 'Cliente'}</p>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">#{String(o.id).slice(-6)} • {o.paymentMethod}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-green-400">R$ {Number(o.total || 0).toFixed(2)}</p>
                              <p className="text-[10px] font-bold text-zinc-500">{new Date(o.timing?.createdAt || o.date || Date.now()).toLocaleDateString('pt-BR')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {editingProduct && <ProductEditor product={editingProduct} adding={isAdding} onChange={setEditingProduct} onClose={() => setEditingProduct(null)} onSave={handleSaveProduct} saving={syncing} uploading={uploading} onUpload={(event: React.ChangeEvent<HTMLInputElement>) => handleImageUpload(event, image => setEditingProduct((previous: any) => previous ? {...previous,image} : previous))} />}
      {editingCoupon && <CouponEditor coupon={editingCoupon} adding={isAddingCoupon} onChange={setEditingCoupon} onClose={() => setEditingCoupon(null)} onSave={handleSaveCoupon} saving={syncing} />}

      {editingNeighborhood && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 overflow-hidden">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setEditingNeighborhood(null)} />
          
          <div className="relative w-full max-w-lg bg-zinc-900 border border-white/10 p-6  rounded-[2.5rem] [3rem] shadow-3xl flex flex-col animate-in zoom-in-95">
            
            <div className="flex justify-between items-center mb-6 shrink-0">
               <h3 className="text-xl  font-black">{isAddingNeighborhood ? 'Novo Bairro' : 'Editar Bairro'}</h3>
               <button onClick={() => setEditingNeighborhood(null)} className="bg-white/5 p-2 rounded-full hover:bg-vovoh-red"><X size={20} className="text-zinc-400 hover:text-white" /></button>
            </div>
            
            <div className="space-y-4 flex-grow">
              <input type="text" placeholder="Nome do Bairro (Ex: Centro)" className="w-full p-4  bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm" value={editingNeighborhood.name} onChange={e => setEditingNeighborhood({...editingNeighborhood, name: e.target.value})} disabled={!isAddingNeighborhood} />
              
              <div className="grid grid-cols-1  gap-4">
                <input type="number" step="0.01" placeholder="Taxa de Entrega (Ex: 5.00)" className="w-full p-4  bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm" value={editingNeighborhood.fee} onChange={e => setEditingNeighborhood({...editingNeighborhood, fee: e.target.value})} />
                <input type="number" placeholder="Tempo Adicional (min)" className="w-full p-4  bg-white/5 rounded-2xl border border-white/10 font-bold outline-none focus:border-vovoh-red text-sm" value={editingNeighborhood.time} onChange={e => setEditingNeighborhood({...editingNeighborhood, time: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-3 pt-6 shrink-0 mt-4">
              <button onClick={() => setEditingNeighborhood(null)} className="flex-1 py-4  font-black text-zinc-500 uppercase text-[10px]  bg-white/5 rounded-2xl hover:bg-white/10 transition-colors">Cancelar</button>
              <button onClick={() => handleSaveNeighborhood(editingNeighborhood)} disabled={syncing} className="flex-[2] py-4  bg-vovoh-red text-white rounded-2xl font-black text-[10px]  uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                {syncing ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>}
                Salvar Bairro
              </button>
            </div>
          </div>
        </div>
      )}
      
      {confirmModal && (
        <ConfirmModal 
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {refusalModal.isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 overflow-hidden">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setRefusalModal({isOpen: false, orderId: null})} />
          
          <div className="relative w-full max-w-md bg-zinc-900 border border-white/10 p-6 rounded-[2rem] shadow-3xl flex flex-col animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-black text-white">Recusar Agendamento</h3>
               <button onClick={() => setRefusalModal({isOpen: false, orderId: null})} className="bg-white/5 p-2 rounded-full hover:bg-vovoh-red"><X size={20} className="text-zinc-400 hover:text-white" /></button>
            </div>
            
            <p className="text-sm text-zinc-400 mb-4">
              Vovó, explique para o cliente o motivo da recusa. Ele receberá essa mensagem e poderá reagendar ou cancelar.
            </p>
            
            <textarea 
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/10 font-medium text-sm text-white outline-none focus:border-vovoh-red h-32 resize-none mb-4"
              placeholder="Ex: Olá filho! Infelizmente nesse horário já estou com muitas encomendas. Que tal agendar para mais tarde ou outro dia?"
              value={refusalReason}
              onChange={e => setRefusalReason(e.target.value)}
            />
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setRefusalModal({isOpen: false, orderId: null})} className="flex-1 py-3 bg-white/5 text-zinc-400 rounded-xl font-black text-xs uppercase hover:bg-white/10">Cancelar</button>
              <button onClick={handleRefuseOrder} disabled={!refusalReason.trim() || syncing} className="flex-1 py-3 bg-vovoh-red text-white rounded-xl font-black text-xs uppercase hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {syncing ? <Loader2 className="animate-spin" size={16}/> : <X size={16}/>}
                Recusar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
