import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { AppInstallButton } from '../components/AppInstall';
import {CardPaymentReturn} from '../components/CardPayment';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, ShoppingCart, ClipboardList, Store, Star, User, X, Instagram, Facebook, MessageSquare, Clock, AlertCircle, ArrowRight, Utensils, RefreshCw, Plus } from 'lucide-react';
import { STORE_NAME, GAS_API_URL, PIX_KEY, WHATSAPP_NUMBER, STORE_ADDRESS, OPENING_HOURS, PLACEHOLDER_IMG } from '../constants/index';
import { Product, CartItem, Order, User as UserType } from '../types/index';
import { Toast } from '../components/UI';
import { StoreFront } from '../components/StoreFront';
import { Checkout, TrackingModal } from '../components/Checkout';
import { AuthModal } from '../components/Auth';
import {LEGAL_VERSION} from '../src/utils/legal';
import {shopDate} from '../src/utils/order-schedule';
import { startVisiblePolling } from '../src/utils/visible-polling';
import { QuickReorder } from '../components/QuickReorder';
import { storeAvailability, openingTime } from '../src/utils/store-hours';
import { customerName, validCustomerName, localGuest } from '../src/utils/customer-name';
import { CustomerDetails, lastCustomer, rememberCustomer } from '../src/utils/saved-checkout';

const LOGO = "/store-logo.webp";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const submittingOrder = useRef(false);
  const pendingSubmissionKey = useRef<string | null>(null);
  const pendingSubmissionId = useRef<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(window.location.hash==='#entrar');
  const authForCheckout=useRef(false);
  const openCheckoutAuth=()=>{authForCheckout.current=true;setIsCartOpen(false);setIsAuthOpen(true);};
  const ensureCheckoutIdentity=async()=>{
    try {
      const response=await fetch('/api/auth/session',{signal:AbortSignal.timeout(10000)});
      if(response.status===401){setUser(null);localStorage.removeItem('vovoh_user');openCheckoutAuth();return false;}
      const result=await response.json();if(!response.ok||!result.success)throw new Error(result.error||'Não foi possível conferir sua identificação.');
      if(result.legalVersion!==LEGAL_VERSION)throw new Error('Os documentos foram atualizados. Recarregue a página e confira antes de pedir.');
      setUser(result.user);return true;
    } catch(error){setToast({message:error instanceof Error?error.message:'Não foi possível conferir seu acesso.',type:'error'});return false;}
  };

  const [user, setUser] = useState<UserType | null>(null);
  const [lastSyncedUser, setLastSyncedUser] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [customer, setCustomer] = useState<CustomerDetails>(() => lastCustomer());
  const [method, setMethod] = useState('pix');
  const [changeFor, setChangeFor] = useState('');
  const [toast, setToast] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [retryOrderId, setRetryOrderId] = useState<string | null>(null);
  const pollingRef = useRef<any>(null);
  const productsPollingRef = useRef<any>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [isForceClosed, setIsForceClosed] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [dynamicConfigs, setDynamicConfigs] = useState<any>(null);
  const [flyingItems, setFlyingItems] = useState<{id: number, x: number, y: number, image: string}[]>([]);

  const cartButtonRef = useRef<HTMLButtonElement>(null);
  const mobileCartButtonRef = useRef<HTMLButtonElement>(null);
  const getSessionId = () => {
    let id = localStorage.getItem('vovoh_browser_session_id');
    if (!id) {
      id = `session-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('vovoh_browser_session_id', id);
    }
    return id;
  };
  const sessionIdRef = useRef(getSessionId());
  const presenceState=useRef({id:sessionIdRef.current,userId:'anonymous',userName:'Visitante',isShopping:false});
  presenceState.current={id:sessionIdRef.current,userId:user?.id||'anonymous',userName:user?.name||'Visitante',isShopping:cart.length>0};
  useEffect(()=>startVisiblePolling(async()=>{const response=await fetch('/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(presenceState.current),signal:AbortSignal.timeout(10000)});return response.ok;},60000,false),[]);

  const configRequest = useRef<Promise<any> | null>(null);
  const fetchConfigs = useCallback(() => {
    // Opening checkout and the existing visibility refresh share an in-flight read.
    if (configRequest.current) return configRequest.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    configRequest.current = (async () => {
      try {
        const res = await fetch(`${GAS_API_URL}/configs`, {cache:'no-store', signal:controller.signal});
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        setDynamicConfigs(data);
        return data;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
        configRequest.current = null;
      }
    })();
    return configRequest.current;
  }, []);

  const formatTime = (timeStr: string | number | undefined, defaultHour: number) => {
    return openingTime(timeStr, defaultHour) || '--:--';
  };

  const trackVisit = async () => {
    // Verifica se é um robô antes de tudo
    const bots = ['bot', 'spider', 'crawl', 'lighthouse', 'headless', 'vercel-screenshot'];
    const ua = navigator.userAgent.toLowerCase();
    if (bots.some(bot => ua.includes(bot))) return;

    // Verifica se já contabilizou visita hoje para não inflar números
    const today = shopDate();
    if (localStorage.getItem('vovoh_last_visit_date') === today) return;

    const isPwa = window.matchMedia('(display-mode: standalone)').matches;

    let initialAuthType = 'none';
    if (user) {
      initialAuthType = localGuest(user) ? 'guest' : 'registered';
    }

    try {
      const response = await fetch(`${GAS_API_URL}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'anonymous',
          isPwa,
          userAgent: navigator.userAgent,
          sessionId: sessionIdRef.current,
          authType: initialAuthType
        })
      });
      if (response.ok) localStorage.setItem('vovoh_last_visit_date', today);
    } catch (e) {}
  };

  const trackPresence = async () => {
    try {
      await fetch(`${GAS_API_URL}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionIdRef.current,
          userId: user?.id || 'anonymous',
          userName: user?.name || 'Visitante',
          isShopping: cart.length > 0
        })
      });
    } catch (e) {}
  };

  useEffect(() => {
    trackVisit();

  }, [user]);

  useEffect(() => {
    trackPresence();
  }, [user?.id, user?.name]);

  // Dispara presença apenas quando o carrinho muda (evento importante)
  useEffect(() => {
    if (cart.length > 0) {
      const trackPresence = async () => {
        try {
          await fetch(`${GAS_API_URL}/presence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: sessionIdRef.current,
              userId: user?.id || 'anonymous',
              userName: user?.name || 'Visitante',
              isShopping: true
            })
          });
        } catch (e) {}
      };
      trackPresence();
    }
  }, [cart.length]);

  useEffect(() => {
    if (!isMaintenance) return;

    // Polling rápido (5s) quando em manutenção para detectar retorno automático
    const stopMaintenance = startVisiblePolling(async () => {
      try {
        const res = await fetch(`${GAS_API_URL}/health`);
        const health = await res.json();
        if (!health.db?.includes('maintenance') && !health.db?.includes('quota')) {
          setIsMaintenance(false);
          window.location.reload(); // Recarrega para garantir que tudo seja reinicializado
        }
      } catch (e) {}
    }, 60000);

    return stopMaintenance;
  }, [isMaintenance]);

  useEffect(() => {
    const checkOpeningHours = async () => {
      try {
        const healthRes = await fetch(`${GAS_API_URL}/health`).catch(() => null);
        if (healthRes && healthRes.ok) {
          const health = await healthRes.json();
          // Only trigger maintenance mode if it's NOT a fallback scenario
          // "maintenance: disabled (using local-fs)" means we are running on files, so let the app open
          if ((health.db?.includes('maintenance') && !health.db?.includes('local-fs')) || health.db?.includes('quota') || health.db?.includes('error')) {
            setIsMaintenance(true);
          } else {
            setIsMaintenance(false);
          }
        } else if (healthRes && healthRes.status === 500) {
          // Se o servidor der 500, provavelmente é erro de conexão com banco
          setIsMaintenance(true);
        }
      } catch (e) {
        console.error("Erro ao verificar saúde do banco:", e);
      }

      await fetchConfigs();
    };

    checkOpeningHours();
    const stopOpeningHours = startVisiblePolling(checkOpeningHours, 600000, false);

    // Polling de produtos (a cada 5 min)
    productsPollingRef.current = startVisiblePolling(fetchProducts, 600000, false);

    return () => {
      stopOpeningHours();
      productsPollingRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!dynamicConfigs) return;
    // The clock updates locally; it does not read the database every minute.
    return startVisiblePolling(async () => {
      const availability = storeAvailability(dynamicConfigs);
      setIsClosed(!availability.open);
      setIsForceClosed(availability.forceClosed);
    }, 60000);
  }, [dynamicConfigs]);

  useEffect(() => {
    const savedUser = localStorage.getItem('vovoh_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      const remembered = lastCustomer();
      setCustomer(remembered.name ? remembered : { name: customerName(parsedUser.name), phone: parsedUser.phone || '', address: parsedUser.address || '' });
    }

    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const previousGuestName = useRef('');
  useEffect(() => {
    if (localGuest(user) && user) {
      const oldName = previousGuestName.current;
      setCustomer(prev => ({...prev, name: !validCustomerName(prev.name) || prev.name === oldName ? customerName(user.name) : prev.name}));
      previousGuestName.current = customerName(user.name);
      setLastSyncedUser(user.id);
    }
    if (user && user.id !== lastSyncedUser) {
      setCustomer(prev => prev.name ? prev : { name: customerName(user.name), phone: user.phone || '', address: user.address || '' });
      setLastSyncedUser(user.id);
      setIsSyncing(true);

      const runSync = async () => {
        if (user.cart && cart.length === 0) {
          try {
            const parsedCart = typeof user.cart === 'string' ? JSON.parse(user.cart) : user.cart;
            if (Array.isArray(parsedCart) && parsedCart.length > 0) {
              setCart(parsedCart);
            }
          } catch(e) {}
        }

        try {
          const res = await fetch(`${GAS_API_URL}/orders/user/${user.id}`);
          const data = await res.json();
          if (Array.isArray(data)) {
             // Mescla pedidos do backend com locais, priorizando backend
             setOrders(prev => {
               const merged = [...data, ...prev];
               // Remove duplicatas por ID
               return Array.from(new Map(merged.map(item => [item.id, item])).values());
             });

             const active = data.some((o: any) => o.status !== 'concluido' && o.status !== 'cancelado' && o.status !== 'pix_recusado');
             if (active) {
                setIsTrackingOpen(true);
                pollingRef.current?.();
                pollingRef.current = startVisiblePolling(pollOrderStatus, 60000, false);
             }
          }
        } catch(e) { /* silent fail */ }

        setTimeout(() => setIsSyncing(false), 1500);
      };

      runSync();
    } else if (!user) {
      setCustomer(lastCustomer());
      setLastSyncedUser(null);
    }
  }, [user]);

  const savedCart = useRef('');
  useEffect(() => {
    if (!user || localGuest(user) || lastSyncedUser !== user.id) return;
    const serialized = JSON.stringify(cart);
    if (savedCart.current === user.id + serialized) return;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${GAS_API_URL}/users/${user.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cart: serialized }),
        });
        if (response.ok) savedCart.current = user.id + serialized;
      } catch {}
    }, 2000);
    return () => clearTimeout(timer);
  }, [cart, user?.id, lastSyncedUser]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setToast({ message: "Instalação solicitada. Abra pelo ícone quando terminar.", type: 'success' });
      // AppInstallProvider records the confirmed appinstalled event.
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${GAS_API_URL}/products`);
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
    } catch (e) {
      // silent fail
    } finally {
      setLoading(false);
    }
  };

  const ordersRef = useRef<Order[]>([]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const pollOrderStatus = async () => {
    const currentOrders = ordersRef.current;
    if (currentOrders.length === 0) return;

    const activeOrders = currentOrders.filter(o => o.status !== 'concluido' && o.status !== 'cancelado' && o.status !== 'pix_recusado');
    if (activeOrders.length === 0) {
      pollingRef.current?.();
      return;
    }


    try {
      const ids = activeOrders.map(o => o.id).join(',');
      const res = await fetch(`${GAS_API_URL}/orders/batch/status?ids=${ids}&details=1&t=${Date.now()}`);
      if (!res.ok) return false;
      const statuses = await res.json();

      let hasChanges = false;
      const updatedOrders = currentOrders.map(order => {
        const detail = statuses[order.id];
        const newStatus = typeof detail === 'string' ? detail : detail?.status;
        const acknowledgedAt = typeof detail === 'object' ? detail?.acknowledgedAt || undefined : order.acknowledgedAt;
        if (newStatus === order.status && acknowledgedAt !== order.acknowledgedAt) {
          hasChanges = true;
          return {...order,acknowledgedAt};
        }
        if (newStatus && newStatus !== order.status) {
          hasChanges = true;

          if (newStatus === 'concluido') {
             const fid = parseInt(localStorage.getItem('vovoh_fidelidade') || '0');
             localStorage.setItem('vovoh_fidelidade', (fid + 1).toString());
             setToast({ message: `Pedido #${order.id.slice(-4)} chegou! Bom apetite. `, type: 'success' });
          } else {
             setToast({ message: `Pedido #${order.id.slice(-4)} atualizado: ${newStatus.toUpperCase()}`, type: 'info' });
          }

          return { ...order, status: newStatus, acknowledgedAt };
        }
        return order;
      });

      if (hasChanges) {
        setOrders(updatedOrders);
        localStorage.setItem('vovoh_active_orders', JSON.stringify(updatedOrders.filter(o => o.status !== 'concluido' && o.status !== 'cancelado' && o.status !== 'pix_recusado')));
      }
    } catch (e) {
      console.error("Erro ao atualizar status dos pedidos:", e);
      return false;
    }
  };

  useEffect(() => {
    fetchProducts();

    // Migração de pedido único para array
    const oldOrder = localStorage.getItem('vovoh_active_order');
    let initialOrders: Order[] = [];

    if (oldOrder) {
      try {
        const parsed = JSON.parse(oldOrder);
        initialOrders = [parsed];
        localStorage.removeItem('vovoh_active_order');
      } catch(e) {}
    }

    const savedOrders = localStorage.getItem('vovoh_active_orders');
    if (savedOrders) {
      try {
        const parsed = JSON.parse(savedOrders);
        initialOrders = [...initialOrders, ...parsed];
        // Remove duplicatas por ID
        initialOrders = Array.from(new Map(initialOrders.map(item => [item.id, item])).values());
      } catch(e) {}
    }

    setOrders(initialOrders);

    if (initialOrders.some(o => o.status !== 'concluido' && o.status !== 'cancelado' && o.status !== 'pix_recusado')) {
      setIsTrackingOpen(true);
      pollingRef.current?.();
      pollingRef.current = startVisiblePolling(pollOrderStatus, 60000, false);
    }

    return () => pollingRef.current?.();
  }, []);

  const handleAddToCart = (p: Product, variation?: any, additionals?: any[], observation?: string, event?: React.MouseEvent) => {

    // Flying animation logic
    if (event) {
      const isMobile = window.innerWidth < 768;
      const targetRef = isMobile ? mobileCartButtonRef : cartButtonRef;

      if (targetRef.current) {
        const rect = targetRef.current.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;

        const newItem = {
          id: Date.now(),
          x: event.clientX,
          y: event.clientY,
          image: p.image || PLACEHOLDER_IMG
        };

        setFlyingItems(prev => [...prev, newItem]);

        // Remove item after animation
        setTimeout(() => {
          setFlyingItems(prev => prev.filter(item => item.id !== newItem.id));
        }, 800);
      }
    }

    setCart(prev => {
      const exists = prev.find(i =>
        i.id === p.id &&
        i.variation?.name === variation?.name &&
        i.observation === observation &&
        JSON.stringify(i.additionals || []) === JSON.stringify(additionals || [])
      );
      if (exists) return prev.map(i => i === exists ? {...i, quantity: i.quantity + 1} : i);
      return [...prev, {...p, quantity: 1, variation, additionals, observation}];
    });
    setToast({ message: isClosed ? 'Adicionado à sacola. Escolha uma entrega agendada.' : 'Adicionado à sacola.', type: 'success' });
  };

  const handleReorder = (items: any[]) => {
    setCart(prev => [...prev, ...items]);
    setIsCartOpen(true);
    setToast({ message: "Itens adicionados ao carrinho!", type: 'success' });
  };

  const handleRetryPayment = (order: Order) => {
    setCart(order.items || []);
    setRetryOrderId(order.id);
    setIsTrackingOpen(false);
    setIsCartOpen(true);
    setToast({ message: "Retomando pagamento do pedido...", type: 'info' });
  };

  const clearOrder = (orderId: string) => {
    const updatedOrders = orders.filter(o => o.id !== orderId);
    setOrders(updatedOrders);
    localStorage.setItem('vovoh_active_orders', JSON.stringify(updatedOrders));
    if (updatedOrders.length === 0) setIsTrackingOpen(false);
    setSelectedOrder(null);


  };

  const cancelOrder = async (orderId: string) => {
    try {
      const response = await fetch(`${GAS_API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Order-Token': orders.find(order => order.id === orderId)?.accessToken || '' },
        body: JSON.stringify({ status: 'cancelado' })
      });

      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Não foi possível atualizar o pedido.'); }
      const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: 'cancelado' } : o);
      setOrders(updatedOrders as any);
      localStorage.setItem('vovoh_active_orders', JSON.stringify(updatedOrders));

      setToast({ message: "Pedido cancelado com sucesso.", type: 'success' });
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Erro ao cancelar pedido.', type: 'error' });
    }
  };

  const receiveOrder = async (orderId: string) => {
    try {
      const response = await fetch(`${GAS_API_URL}/orders/${orderId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Order-Token': orders.find(order => order.id === orderId)?.accessToken || '' }
      });

      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Não foi possível atualizar o pedido.'); }
      const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: 'concluido' } : o);
      setOrders(updatedOrders as any);
      localStorage.setItem('vovoh_active_orders', JSON.stringify(updatedOrders));

      setToast({ message: "Que bom que recebeu! Bom apetite! ", type: 'success' });

      const fid = parseInt(localStorage.getItem('vovoh_fidelidade') || '0');
      localStorage.setItem('vovoh_fidelidade', (fid + 1).toString());
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Erro ao confirmar recebimento.', type: 'error' });
    }
  };

  const createOrder = async (extraDetails?: any) => {
    if (submittingOrder.current) return false;
    submittingOrder.current = true;
    try {
    if (user && (customer.phone !== user.phone || customer.address !== user.address)) {
      const updatedUser = { ...user, phone: customer.phone, address: customer.address };
      setUser(updatedUser);
      localStorage.setItem('vovoh_user', JSON.stringify(updatedUser));

      if (!localGuest(updatedUser)) fetch(GAS_API_URL + '/users/' + updatedUser.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      }).catch(()=>{});
    }

    const fullAddress = customer.address;

    const newOrder: Order = {
      id: extraDetails?.orderId || (pendingSubmissionId.current ||= crypto.randomUUID()),
      items: cart,
      total: extraDetails?.finalTotal ?? cart.reduce((a,b) => a + (Number(b.price) * b.quantity), 0),
      status: 'pendente',
      scheduledTo: extraDetails?.scheduledTo,
      customer: { ...customer, address: fullAddress },
      payment: {
        method: (extraDetails?.method || method) as any,
        ...(extraDetails?.method === 'dinheiro' && extraDetails.changeFor !== undefined ? { changeFor: extraDetails.changeFor } : {}),
        paid: extraDetails?.method === 'cartao_online'
      },
      timing: { createdAt: new Date().toISOString() },
      type: 'entrega'
    };

    let paymentDetails = '';
    if (extraDetails?.method === 'cartao_online') {
      paymentDetails = `Cartão Online (Pago - ID: ${extraDetails.id})`;
    } else if (method === 'dinheiro') {
      paymentDetails = 'Dinheiro na entrega';
    } else {
      paymentDetails = 'Pix (Conferir Recibo)';
    }

    let itemsSummary = cart.map(i => {
      let desc = `${i.quantity}x ${i.name}`;
      if (i.variation) desc += ` (Opção: ${i.variation.name})`;
      if (i.additionals && i.additionals.length > 0) {
        desc += ` (Adicionais: ${i.additionals.map((a:any) => a.name).join(', ')})`;
      }
      if (i.observation) desc += ` [Obs: ${i.observation}]`;
      return desc;
    }).join(", ");
    if (extraDetails?.coupon) itemsSummary += `\n[Cupom: ${extraDetails.coupon}]`;
    if (extraDetails?.deliveryFee !== undefined) itemsSummary += `\n[Taxa de Entrega: R$ ${Number(extraDetails.deliveryFee).toFixed(2)}]`;

    const response = await fetch(GAS_API_URL + '/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Request': pendingSubmissionKey.current ||= crypto.randomUUID() },
      body: JSON.stringify({
        ...newOrder, userId: user ? user.id : '', paymentMethod: paymentDetails,
        itemsSummary, paymentIntentId: extraDetails?.id, coupon: extraDetails?.coupon, deliveryToken: extraDetails?.deliveryToken,legalAcceptance:extraDetails?.legalAcceptance,
      }),
    });
    const result = await response.json();
    if (!response.ok || result.success !== true) throw new Error(result.error || 'Não foi possível enviar o pedido.');
    newOrder.id = result.id;
    newOrder.accessToken = result.accessToken;
    rememberCustomer(customer);
    pendingSubmissionId.current = null; pendingSubmissionKey.current = null;
    setOrders(prev => {
      // Se for retry, substitui o existente. Se não, adiciona.
      const exists = prev.find(o => o.id === newOrder.id);
      let updated;
      if (exists) {
        updated = prev.map(o => o.id === newOrder.id ? newOrder : o);
      } else {
        updated = [newOrder, ...prev];
      }
      localStorage.setItem('vovoh_active_orders', JSON.stringify(updated));
      return updated;
    });


    setCart([]);
    setChangeFor('');
    setIsCartOpen(false);
    setIsTrackingOpen(true);
    setRetryOrderId(null);
    setToast({ message: "Pedido enviado para a cozinha!", type: 'success' });

    pollingRef.current?.();
    pollingRef.current = startVisiblePolling(pollOrderStatus, 60000, false);
    return true;
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Não foi possível enviar. Sua sacola foi mantida; confira a internet e tente novamente.', type: 'error' });
      return false;
    } finally { submittingOrder.current = false; }
  };

  const cartTotal = cart.reduce((acc, item) => {
    const itemPrice = Number(item.price) + (item.variation ? Number(item.variation.price) : 0) + (item.additionals || []).reduce((sum, additional) => sum + Number(additional.price), 0);
    return acc + (itemPrice * item.quantity);
  }, 0);

  const storePhone = String(dynamicConfigs?.whatsapp_number || WHATSAPP_NUMBER).replace(/\D/g, '');
  const storeWhatsApp = storePhone.startsWith('55') ? storePhone : '55' + storePhone;
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  const cartSubtotal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cartTotal);

  return (
    <div className="min-h-screen bg-[#F9F9F9] font-sans flex flex-col relative">
      <CardPaymentReturn onApproved={order=>{
        setOrders(previous=>{
          const next=[order,...previous.filter(item=>item.id!==order.id)];
          localStorage.setItem('vovoh_active_orders',JSON.stringify(next));return next;
        });
        rememberCustomer(order.customer);setCart([]);setSelectedOrder(order);setIsTrackingOpen(true);
      }}/>
      {dynamicConfigs?.preview_mode === 'true' && <p className="bg-amber-100 text-amber-900 p-3 text-center text-sm font-bold">Prévia local: pedidos de teste. Loja aberta para testar a qualquer hora.</p>}

      {isSyncing && (
        <div className="fixed inset-0 z-[9999] bg-[#F9F9F9]/95 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
          <div className="relative mb-6">
            <div className="w-24 h-24 bg-vovoh-red/10 rounded-full animate-ping absolute inset-0"></div>
            <ChefHat size={80} className="text-vovoh-red animate-bounce relative z-10" />
          </div>
          <h3 className="text-3xl font-black text-vovoh-dark tracking-tight">Arrumando a mesa...</h3>
          <p className="text-gray-500 font-bold text-xs mt-3 uppercase tracking-widest px-8 text-center">Buscando seus pedidos e carrinho de onde você parou</p>
        </div>
      )}

      {isMaintenance && (
        <div className="fixed inset-0 z-[9999] bg-vovoh-dark/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-8">
            <div className="w-24 h-24 bg-vovoh-red rounded-3xl flex items-center justify-center shadow-2xl rotate-3 mx-auto animate-pulse">
              <ChefHat size={48} className="text-white" />
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-black text-white tracking-tight">Cozinha em Manutenção</h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
                <RefreshCw size={20} className="inline mr-2" aria-hidden="true" /> Estamos organizando as prateleiras!<br/>
                O app voltará a funcionar <b>automaticamente</b> assim que terminarmos.
              </p>
            </div>

            <div className="pt-4 space-y-4">
              <p className="text-white font-bold text-sm uppercase tracking-widest">Não quer esperar? Peça pelo WhatsApp!</p>
              <a
                href="https://wa.me/554195796370?text=Olá! O app está em manutenção, gostaria de fazer um pedido por aqui."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-[#25D366] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-green-900/20"
              >
                <MessageSquare size={20} />
                Falar com a Vovó
              </a>
            </div>

            <div className="flex justify-center gap-2">
              <div className="w-2 h-2 bg-vovoh-red rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-vovoh-red rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-vovoh-red rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast {...toast} notification={toast} onClose={() => setToast(null)} />}

      <nav className="sticky top-0 z-[300] bg-white/85 backdrop-blur-md border-b border-gray-200/50 h-16 px-4 md:px-8 shadow-sm shrink-0 transition-all">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
          <button aria-label="Voltar ao início" className="flex items-center gap-3 group text-left min-h-11" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
            <div className="w-10 h-10 bg-vovoh-red rounded-xl flex items-center justify-center text-white shadow-lg rotate-3 group-active:scale-95 transition-transform"><ChefHat size={20} /></div>
            <div>
              <span className="text-lg md:text-xl font-bold text-vovoh-dark tracking-tight leading-none">Vovó Grazy</span>
              <p className="text-[8px] md:text-[9px] font-black text-vovoh-red uppercase tracking-[0.2em] mt-0.5">Salgados & Empanadas</p>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-8">
            <button
              onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
              className="text-xs font-black uppercase tracking-wider text-gray-500 hover:text-vovoh-red transition-colors"
            >
              Início
            </button>
            <button
              onClick={() => document.getElementById('menu')?.scrollIntoView({behavior: 'smooth'})}
              className="text-xs font-black uppercase tracking-wider text-gray-500 hover:text-vovoh-red transition-colors"
            >
              Cardápio
            </button>
            <button
              onClick={() => setIsTrackingOpen(true)}
              className={`text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 ${orders.some(o => o.status !== 'concluido' && o.status !== 'cancelado' && o.status !== 'pix_recusado') ? 'text-vovoh-gold animate-pulse' : 'text-gray-500 hover:text-vovoh-red'}`}
            >
              <ClipboardList size={16} /> Meus Pedidos
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <AppInstallButton compact />
            <ThemeSwitcher />


            {/* Desktop User Profile Button */}
            <button
              onClick={() => setIsAuthOpen(true)}
              className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-full border border-gray-200 text-xs font-bold text-vovoh-dark hover:border-vovoh-red hover:text-vovoh-red transition-all"
            >
              <User size={16} />
              <span>{user ? user.name.split(' ')[0] : 'Entrar'}</span>
            </button>

            {/* Desktop Cart Button */}
            <button
              ref={cartButtonRef}
              aria-label="Abrir sacola"
              onClick={() => setIsCartOpen(true)}
              className="hidden md:flex items-center gap-2.5 px-4 py-2 bg-vovoh-red text-white rounded-full font-black text-xs uppercase tracking-wider shadow-md hover:bg-red-600 transition-all active:scale-95 relative"
            >
              <ShoppingCart size={16} />
              <span>{cartCount > 0 ? cartSubtotal : "Sacola"}</span>
              {cart.length > 0 && (
                <span className="bg-vovoh-gold text-white text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Flying Items Animation Layer */}
      <div className="fixed inset-0 pointer-events-none z-[9999]">
        <AnimatePresence>
          {flyingItems.map(item => {
            const isMobile = window.innerWidth < 768;
            const targetRef = isMobile ? mobileCartButtonRef : cartButtonRef;
            const rect = targetRef.current?.getBoundingClientRect();
            const targetX = rect ? rect.left + rect.width / 2 : 0;
            const targetY = rect ? rect.top + rect.height / 2 : 0;

            return (
              <motion.div
                key={item.id}
                initial={{ x: item.x - 20, y: item.y - 20, scale: 1, opacity: 1 }}
                animate={{
                  x: targetX - 20,
                  y: targetY - 20,
                  scale: 0.2,
                  opacity: 0.5,
                  rotate: 360
                }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                className="fixed w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-lg bg-white"
              >
                <img src={item.image} className="w-full h-full object-cover" alt="flying" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {deferredPrompt && <div className="px-4 mt-4 space-y-3 relative z-[200]">
        {deferredPrompt && (
          <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl shadow-xl flex justify-between items-center animate-in slide-in-from-top-2 mx-auto max-w-md">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-vovoh-gold rounded-lg flex items-center justify-center shrink-0">
                <Star size={14} className="text-white fill-current animate-pulse" />
              </div>
              <div className="flex flex-col">
                 <span className="text-xs font-black text-vovoh-dark">Instalar App</span>
                 <span className="text-[10px] text-gray-500 font-medium">Melhor experiência pra você!</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleInstallClick} className="px-4 py-1.5 bg-vovoh-dark text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all hover:bg-black whitespace-nowrap">
                Instalar
              </button>
              <button onClick={() => setDeferredPrompt(null)} className="p-1.5 rounded-full hover:bg-gray-100 active:scale-90 transition-all text-gray-400">
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>}

      {/* Wrapper para o conteúdo crescer e empurrar o rodapé */}
      <div className="flex-grow">
         {user && <div className="max-w-7xl mx-auto px-4 mt-2">
            <QuickReorder user={localGuest(user) ? null : user} onReorder={handleReorder} />
         </div>}
         <StoreFront
           products={products}
           isLoading={loading}
           onAddToCart={handleAddToCart}
           logo={LOGO}
           dynamicConfigs={dynamicConfigs}
           isClosed={isClosed}
           onTrackOrders={() => setIsTrackingOpen(true)}
         />
      </div>

      {cartCount > 0 && !isCartOpen && (
        <div className="md:hidden fixed left-4 right-4 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-[250]">
          <button aria-label="Ver sacola" onClick={() => setIsCartOpen(true)} className="w-full min-h-14 px-4 py-3 rounded-2xl bg-vovoh-red text-white shadow-lg flex items-center justify-between gap-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vovoh-red">
            <span className="flex items-center gap-3"><span className="bg-black/15 rounded-lg min-w-8 px-2 py-1 text-sm">{cartCount}</span><span>Ver sacola</span></span>
            <span className="text-right"><span className="block text-[10px] font-normal">Subtotal</span><span className="text-sm">{cartSubtotal}</span></span>
          </button>
        </div>
      )}

      {/* Bottom Navigation Bar (Mobile Only) */}
      <div className="safe-area-nav md:hidden fixed bottom-0 left-0 right-0 z-[250] bg-white border-t border-gray-100 flex justify-around items-end h-20 pb-2 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)]">

        <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-vovoh-red active:scale-95 transition-all w-16">
          <Store size={22} />
          <span className="text-[10px] font-bold">Início</span>
        </button>

        <button onClick={() => document.getElementById('menu')?.scrollIntoView({behavior: 'smooth'})} className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-vovoh-red active:scale-95 transition-all w-16">
          <Utensils size={22} />
          <span className="text-[10px] font-bold">Cardápio</span>
        </button>

        <div className="relative -top-5">
          <button
            ref={mobileCartButtonRef}
            aria-label="Abrir sacola"
            onClick={() => setIsCartOpen(true)}
            className="w-16 h-16 bg-vovoh-red text-white rounded-full shadow-[0_8px_25px_-5px_rgba(214,31,31,0.5)] flex items-center justify-center border-4 border-[#F9F9F9] active:scale-90 transition-all"
          >
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute top-0 right-0 bg-vovoh-gold text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        <button onClick={() => setIsTrackingOpen(true)} className={`flex flex-col items-center gap-1 p-2 active:scale-95 transition-all w-16 relative ${orders.some(o => o.status !== 'concluido' && o.status !== 'cancelado' && o.status !== 'pix_recusado') ? 'text-vovoh-gold animate-pulse' : 'text-gray-400 hover:text-vovoh-red'}`}>
          <ClipboardList size={22} />
          <span className="text-[10px] font-bold">Pedidos</span>
          {orders.some(o => o.status !== 'concluido' && o.status !== 'cancelado' && o.status !== 'pix_recusado') && (
            <span className="absolute top-2 right-4 w-2 h-2 bg-vovoh-red rounded-full animate-ping"></span>
          )}
        </button>

        <button onClick={() => setIsAuthOpen(true)} className={`flex flex-col items-center gap-1 p-2 active:scale-95 transition-all w-16 ${user ? 'text-vovoh-dark' : 'text-gray-400 hover:text-vovoh-red'}`}>
          <User size={22} />
          <span className="text-[10px] font-bold">Perfil</span>
        </button>

      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        user={user}
        setUser={next=>{setUser(next);if(next&&authForCheckout.current){authForCheckout.current=false;setIsCartOpen(true);}}}
        onGuestName={(name,phone) => setCustomer(prev => ({...prev, name, ...(phone !== undefined ? {phone} : {})}))}
        showMsg={(msg, type) => setToast({ message: msg, type })}
      />

      <Checkout
        isOpen={isCartOpen} onClose={() => setIsCartOpen(false)}
        cart={cart} setCart={setCart}
        customer={customer} setCustomer={setCustomer}
        method={method} setMethod={setMethod}
        changeFor={changeFor} setChangeFor={setChangeFor}
        onOrder={createOrder} pixKey={dynamicConfigs?.pix_key || PIX_KEY}
        user={user} openAuth={openCheckoutAuth} ensureIdentity={ensureCheckoutIdentity}
        dynamicConfigs={dynamicConfigs}
        onRefreshConfigs={fetchConfigs}
        showMsg={(msg: string, type: any) => setToast({ message: msg, type })}
        coupons={(() => {
          try {
            return dynamicConfigs?.coupons ? JSON.parse(dynamicConfigs.coupons) : [];
          } catch (e) {
            return [];
          }
        })()}
      />

      <TrackingModal
        isOpen={isTrackingOpen}
        onClose={() => setIsTrackingOpen(false)}
        orders={orders}
        onClearOrder={clearOrder}
        onCancelOrder={cancelOrder}
        onReceiveOrder={receiveOrder}
        onRetryPayment={handleRetryPayment}
        onRefresh={pollOrderStatus}
        onReorder={(items: any[]) => {
          setCart(items || []);
          setIsTrackingOpen(false);
          setIsCartOpen(true);
          setToast({ message: "Itens adicionados ao carrinho! Finalize o pagamento.", type: 'success' });
        }}
        dynamicConfigs={dynamicConfigs}
      />

      <footer className={'bg-vovoh-dark text-white pt-7 md:pt-8 md:pb-6 '+(cartCount > 0 ? 'pb-[calc(12rem+env(safe-area-inset-bottom))]' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))]')}>
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_1fr] gap-6 pb-6">
            <div><div className="flex gap-3 items-center"><ChefHat size={26} className="text-vovoh-gold shrink-0" aria-hidden="true" /><p className="text-lg font-semibold">{STORE_NAME}</p></div><p className="text-sm text-zinc-300 mt-3 max-w-sm">Salgados artesanais e receitas de família, preparados com carinho.</p><div className="flex gap-2 mt-3"><a aria-label="Instagram da Delícias da Vovó" href="https://www.instagram.com/deliciasdavovosalgadinhos/" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center"><Instagram size={20} /></a><a aria-label="Facebook da Delícias da Vovó" href="https://www.facebook.com/SovereignsGrazy.Show" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center"><Facebook size={20} /></a></div></div>
            <div><p className="text-sm font-semibold mb-2">Explore</p><div className="grid grid-cols-2 sm:grid-cols-1 text-sm text-zinc-300"><a href="#menu" className="min-h-11 flex items-center">Cardápio</a><a href="#nossa-historia" className="min-h-11 flex items-center">Nossa história</a><a href="#ajuda" className="min-h-11 flex items-center">Central de ajuda</a><button onClick={() => setIsAuthOpen(true)} className="min-h-11 text-left">Meu perfil</button></div></div>
            <div><p className="text-sm font-semibold mb-3">Fale com a loja</p><p className="flex gap-2 text-sm text-zinc-300"><Store size={18} className="shrink-0 mt-0.5" aria-hidden="true" /><span>{dynamicConfigs?.store_address || STORE_ADDRESS}</span></p><a href={'https://wa.me/'+storeWhatsApp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 min-h-11 mt-3 text-sm text-white underline underline-offset-4"><MessageSquare size={18} aria-hidden="true" />Falar pelo WhatsApp</a></div>
          </div>
          <nav aria-label="Documentos da loja" className="flex flex-wrap gap-4 text-sm"><a href="/#termos" target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center underline">Termos de Uso</a><a href="/#privacidade" target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center underline">Política de Privacidade</a></nav>
          <div className="border-t border-white/10 pt-4 flex gap-4 items-center justify-between"><p className="text-xs text-zinc-400">© {new Date().getFullYear()} · {STORE_NAME}</p>
            <button type="button" onClick={() => {window.location.hash='#vovo-secreta';}} className="inline-flex gap-2 items-center min-h-11 text-xs text-zinc-300 hover:text-white" aria-label="Painel da Vovó"><ChefHat size={18} aria-hidden="true" /><span>Painel da Vovó</span></button>
          </div>
        </div>
      </footer>
    </div>
  );
}
