import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, ShoppingCart, ClipboardList, Store, Star, User, X, Instagram, Facebook, MessageSquare, Bell, BellOff, Clock, AlertCircle, ArrowRight, Utensils, RefreshCw, Plus } from 'lucide-react';
import { STORE_NAME, GAS_API_URL, PIX_KEY, STORE_ADDRESS, OPENING_HOURS, PLACEHOLDER_IMG } from '../constants/index';
import { Product, CartItem, Order, User as UserType } from '../types/index';
import { Toast } from '../components/UI';
import { StoreFront } from '../components/StoreFront';
import { Checkout, TrackingModal } from '../components/Checkout';
import { AuthModal } from '../components/Auth';
import { QuickReorder } from '../components/QuickReorder';

const LOGO = "https://i.ibb.co/Rkt5c0zk/Del-cias-Da-Vov.png";

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  const [user, setUser] = useState<UserType | null>(null);
  const [lastSyncedUser, setLastSyncedUser] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [method, setMethod] = useState('pix');
  const [changeFor, setChangeFor] = useState('');
  const [toast, setToast] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [retryOrderId, setRetryOrderId] = useState<string | null>(null);
  const pollingRef = useRef<any>(null);
  const productsPollingRef = useRef<any>(null);
  const secretTimeoutRef = useRef<any>(null);

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [isForceClosed, setIsForceClosed] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [dynamicConfigs, setDynamicConfigs] = useState<any>(null);
  const [prepTime, setPrepTime] = useState<{baseTime: number, activeOrders: number, estimatedTime: number} | null>(null);
  const [flyingItems, setFlyingItems] = useState<{id: number, x: number, y: number, image: string}[]>([]);
  const [clickCount, setClickCount] = useState(0);
  
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

  const fetchConfigs = async () => {
    try {
      const res = await fetch(`${GAS_API_URL}/configs`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setDynamicConfigs(data);
      return data;
    } catch (e) {
      return null;
    }
  };

  const formatTime = (timeStr: string | number | undefined, defaultHour: number) => {
    if (!timeStr) return `${defaultHour}:00`;
    if (typeof timeStr === 'string' && timeStr.includes('T')) {
      // It's a full ISO date string from Google Sheets
      const date = new Date(timeStr);
      const roundedDate = new Date(date.getTime() + 30000); // Arredonda para o minuto mais próximo (corrige o bug de 1899 do fuso horário)
      return `${roundedDate.getHours().toString().padStart(2, '0')}:${roundedDate.getMinutes().toString().padStart(2, '0')}`;
    }
    if (typeof timeStr === 'string' && timeStr.includes(':')) {
      return timeStr.substring(0, 5);
    }
    return `${timeStr}:00`;
  };

  const trackVisit = async () => {
    // Verifica se é um robô antes de tudo
    const bots = ['bot', 'spider', 'crawl', 'lighthouse', 'headless', 'vercel-screenshot'];
    const ua = navigator.userAgent.toLowerCase();
    if (bots.some(bot => ua.includes(bot))) return;

    // Verifica se já contabilizou visita hoje para não inflar números
    const today = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('vovoh_last_visit_date') === today) return;

    const isPwa = window.matchMedia('(display-mode: standalone)').matches;
    
    let initialAuthType = 'none';
    if (user) {
      initialAuthType = user.name === 'Visitante' ? 'guest' : 'registered';
    }

    try {
      await fetch(`${GAS_API_URL}/visits`, {
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
      localStorage.setItem('vovoh_last_visit_date', today);
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

  const fetchPrepTime = async () => {
    try {
      const res = await fetch(`${GAS_API_URL}/stats/prep-time`);
      if (res.ok) {
        const data = await res.json();
        setPrepTime(data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    trackVisit();

    // Tenta pedir permissão de notificação assim que o app carrega
    if (typeof Notification !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setNotificationsEnabled(true);
          }
        });
      } else if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  }, [user]);

  useEffect(() => {
    trackPresence();
    fetchPrepTime();

    const prepTimeInterval = setInterval(fetchPrepTime, 600000); // 10 min

    return () => clearInterval(prepTimeInterval);
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
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${GAS_API_URL}/health`);
        const health = await res.json();
        if (!health.db?.includes('maintenance') && !health.db?.includes('quota')) {
          setIsMaintenance(false);
          window.location.reload(); // Recarrega para garantir que tudo seja reinicializado
        }
      } catch (e) {}
    }, 5000);

    return () => clearInterval(interval);
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

      const configs = await fetchConfigs();
      
      if (configs?.force_closed === 'true' || configs?.force_closed === true) {
        setIsClosed(true);
        setIsForceClosed(true);
        return;
      } else {
        setIsForceClosed(false);
      }

      const now = new Date();
      const day = now.getDay();
      
      let workingDays = [0, 1, 2, 3, 4, 5, 6];
      if (configs?.working_days) {
        try {
          workingDays = typeof configs.working_days === 'string' ? JSON.parse(configs.working_days) : configs.working_days;
        } catch(e) {}
      }

      const startFormatted = formatTime(configs?.opening_start, OPENING_HOURS.start);
      const endFormatted = formatTime(configs?.opening_end, OPENING_HOURS.end);
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (startFormatted > endFormatted) {
        // Overnight shift (e.g., 18:00 to 02:00)
        if (currentTime >= startFormatted) {
          // It's evening, check if today is a working day
          setIsClosed(!workingDays.includes(day));
        } else if (currentTime <= endFormatted) {
          // It's past midnight, check if yesterday was a working day
          const prevDay = day === 0 ? 6 : day - 1;
          setIsClosed(!workingDays.includes(prevDay));
        } else {
          setIsClosed(true);
        }
      } else {
        // Normal shift (e.g., 08:00 to 18:00)
        if (!workingDays.includes(day)) {
          setIsClosed(true);
        } else {
          setIsClosed(currentTime < startFormatted || currentTime >= endFormatted);
        }
      }
    };

    checkOpeningHours();
    const timer = setInterval(checkOpeningHours, 300000); // 5 min
    
    // Polling de produtos (a cada 5 min)
    productsPollingRef.current = setInterval(fetchProducts, 300000);

    return () => {
      clearInterval(timer);
      clearInterval(productsPollingRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user && !loading) {
      setIsAuthOpen(true);
    }
  }, [user, loading]);

  useEffect(() => {
    const savedNotify = localStorage.getItem('vovoh_notifications');
    if (savedNotify === 'true') setNotificationsEnabled(true);
    const savedUser = localStorage.getItem('vovoh_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setCustomer({ name: parsedUser.name, phone: parsedUser.phone || '', address: parsedUser.address || '' });
    } else {
      setIsAuthOpen(true);
    }

    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault(); 
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (user && user.id !== lastSyncedUser) {
      setCustomer(prev => ({ ...prev, name: user.name, phone: user.phone || prev.phone, address: user.address || prev.address }));
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
                clearInterval(pollingRef.current);
                pollingRef.current = setInterval(pollOrderStatus, 10000);
             }
          }
        } catch(e) { /* silent fail */ }

        setTimeout(() => setIsSyncing(false), 1500);
      };

      runSync();
    } else if (!user) {
      setCustomer({ name: '', phone: '', address: '' });
      setLastSyncedUser(null);
    }
  }, [user]);

  useEffect(() => {
    if (user && lastSyncedUser === user.id) {
      fetch(`${GAS_API_URL}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cart: JSON.stringify(cart) 
        })
      }).catch(()=>{});
    }
  }, [cart, user, lastSyncedUser]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setToast({ message: "Que alegria ter você pertinho! App instalado.", type: 'success' });
      
      if (localStorage.getItem('vovoh_app_installed')) return;

      // Track install
      try {
        await fetch(`${GAS_API_URL}/visits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            userId: user?.id || 'anonymous', 
            isPwa: true,
            userAgent: 'PWA_INSTALL_EVENT'
          })
        });
        localStorage.setItem('vovoh_app_installed', 'true');
      } catch (e) {}
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
      clearInterval(pollingRef.current);
      return;
    }

    // Polling de status a cada 15 segundos para maior agilidade
    clearInterval(pollingRef.current);
    pollingRef.current = setInterval(pollOrderStatus, 15000);

    try {
      const ids = activeOrders.map(o => o.id).join(',');
      const res = await fetch(`${GAS_API_URL}/orders/batch/status?ids=${ids}&t=${Date.now()}`);
      const statuses = await res.json();
      
      let hasChanges = false;
      const updatedOrders = currentOrders.map(order => {
        const newStatus = statuses[order.id];
        if (newStatus && newStatus !== order.status) {
          hasChanges = true;
          
          if (notificationsEnabled) {
            try { 
              const audio = new Audio('https://www.soundjay.com/button/sounds/button-3.mp3');
              audio.play().catch(() => {});
              if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
              
              if (Notification.permission === 'granted') {
                new Notification("Delícias da Vovó", {
                  body: `Pedido #${order.id.slice(-4)}: ${newStatus.toUpperCase()}`,
                  icon: PLACEHOLDER_IMG
                });
              }
            } catch(e) {}
          }
          
          if (newStatus === 'concluido') {
             const fid = parseInt(localStorage.getItem('vovoh_fidelidade') || '0');
             localStorage.setItem('vovoh_fidelidade', (fid + 1).toString());
             setToast({ message: `Pedido #${order.id.slice(-4)} chegou! Bom apetite. 🥟`, type: 'success' });
          } else {
             setToast({ message: `Pedido #${order.id.slice(-4)} atualizado: ${newStatus.toUpperCase()}`, type: 'info' });
          }
          
          return { ...order, status: newStatus };
        }
        return order;
      });

      if (hasChanges) {
        setOrders(updatedOrders);
        localStorage.setItem('vovoh_active_orders', JSON.stringify(updatedOrders.filter(o => o.status !== 'concluido' && o.status !== 'cancelado' && o.status !== 'pix_recusado')));
      }
    } catch (e) {
      console.error("Erro ao atualizar status dos pedidos:", e);
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
      clearInterval(pollingRef.current);
      pollingRef.current = setInterval(pollOrderStatus, 120000);
    }

    return () => clearInterval(pollingRef.current);
  }, []);

  const handleAddToCart = (p: Product, variation?: any, additionals?: any[], observation?: string, event?: React.MouseEvent) => {
    if (isClosed) {
      setToast({ message: "A loja está fechada no momento!", type: 'error' });
      return;
    }

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
    setToast({ message: `Adicionado no capricho: ${p.name}!`, type: 'success' });
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
    
    // Arquiva no backend para não voltar
    try {
      fetch(`${GAS_API_URL}/orders/${orderId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(()=>{});
    } catch(e) {}
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await fetch(`${GAS_API_URL}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelado' })
      });
      
      const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: 'cancelado' } : o);
      setOrders(updatedOrders as any);
      localStorage.setItem('vovoh_active_orders', JSON.stringify(updatedOrders));
      
      setToast({ message: "Pedido cancelado com sucesso.", type: 'success' });
    } catch (e) {
      setToast({ message: "Erro ao cancelar pedido.", type: 'error' });
    }
  };

  const receiveOrder = async (orderId: string) => {
    try {
      await fetch(`${GAS_API_URL}/orders/${orderId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: 'concluido' } : o);
      setOrders(updatedOrders as any);
      localStorage.setItem('vovoh_active_orders', JSON.stringify(updatedOrders));
      
      setToast({ message: "Que bom que recebeu! Bom apetite! 🥟", type: 'success' });
      
      const fid = parseInt(localStorage.getItem('vovoh_fidelidade') || '0');
      localStorage.setItem('vovoh_fidelidade', (fid + 1).toString());
    } catch (e) {
      setToast({ message: "Erro ao confirmar recebimento.", type: 'error' });
    }
  };

  const createOrder = async (extraDetails?: any) => {
    if (user && (customer.phone !== user.phone || customer.address !== user.address)) {
      const updatedUser = { ...user, phone: customer.phone, address: customer.address };
      setUser(updatedUser);
      localStorage.setItem('vovoh_user', JSON.stringify(updatedUser));
      
      fetch(GAS_API_URL + '/users/' + updatedUser.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      }).catch(()=>{});
    }

    const fullAddress = customer.address;

    const newOrder: Order = {
      id: retryOrderId || Math.random().toString(36).substr(2, 9).toUpperCase(),
      items: cart, 
      total: extraDetails?.finalTotal || cart.reduce((a,b) => a + (Number(b.price) * b.quantity), 0),
      status: 'pendente', 
      scheduledTo: extraDetails?.scheduledTo,
      customer: { ...customer, address: fullAddress }, 
      payment: { 
        method: (extraDetails?.method || method) as any, 
        paid: extraDetails?.method === 'cartao_online' 
      },
      timing: { createdAt: new Date().toISOString() }, 
      type: 'entrega'
    };

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
    
    // Inicia polling se não estiver rodando
    if (!pollingRef.current) {
      pollingRef.current = setInterval(pollOrderStatus, 10000);
    }
    
    let paymentDetails = '';
    if (extraDetails?.method === 'cartao_online') {
      paymentDetails = `Cartão Online (Pago - ID: ${extraDetails.id})`;
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

    try {
      const endpoint = retryOrderId ? `/orders/${retryOrderId}` : '/orders';
      const methodHttp = retryOrderId ? 'PUT' : 'POST';

      fetch(GAS_API_URL + endpoint, {
        method: methodHttp,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: newOrder.id,
            userId: user ? user.id : '',
            customer: {
              name: customer.name,
              phone: customer.phone,
              address: fullAddress
            },
            total: newOrder.total,
            paymentMethod: paymentDetails,
            type: 'entrega',
            itemsSummary: itemsSummary,
            items: cart,
            status: 'pendente', // Garante que volta pra pendente
            scheduledTo: newOrder.scheduledTo
        })
      });
      if (user) {
        fetch(GAS_API_URL + '/users/' + user.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cart: '[]' })
        }).catch(()=>{});
      }
    } catch(e) {}

    setCart([]);
    setChangeFor('');
    setIsCartOpen(false);
    setIsTrackingOpen(true);
    setRetryOrderId(null);
    setToast({ message: "Pedido enviado para a cozinha com sucesso!", type: 'success' });
    
    clearInterval(pollingRef.current);
    pollingRef.current = setInterval(pollOrderStatus, 10000);
  };

  const toggleNotifications = async () => {
    if (typeof Notification === 'undefined' || !('Notification' in window)) {
      setToast({ message: "Seu navegador não suporta notificações.", type: 'error' });
      return;
    }

    if (!notificationsEnabled) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('vovoh_notifications', 'true');
        setToast({ message: "Notificações ativadas! A vovó vai te avisar de tudo.", type: 'success' });
      } else {
        setToast({ message: "Poxa, você negou as notificações. Ative nas configurações do navegador!", type: 'error' });
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('vovoh_notifications', 'false');
      setToast({ message: "Notificações desativadas.", type: 'info' });
    }
  };

  const cartTotal = cart.reduce((acc, item) => {
    const itemPrice = Number(item.price) + (item.variation ? Number(item.variation.price) : 0);
    return acc + (itemPrice * item.quantity);
  }, 0);

  const handleAddSuggestedItems = (items: any[]) => {
    setCart(prev => [...prev, ...items]);
    setToast({ message: "Sugestão da Vovó adicionada com sucesso!", type: 'success' });
    setIsCartOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] font-sans flex flex-col relative">
      
      {/* Botão de permissão de notificação */}
      {typeof Notification !== 'undefined' && 'Notification' in window && !notificationsEnabled && Notification.permission !== 'granted' && (
        <div className="p-4 bg-red-100 text-red-800 text-center text-sm font-bold">
          <p>As notificações estão desativadas!</p>
          <button 
            onClick={() => {
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') setNotificationsEnabled(true);
              });
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg"
          >
            Ativar Notificações
          </button>
        </div>
      )}

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
                Estamos organizando as prateleiras! 🧹<br/>
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

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <nav className="sticky top-0 z-[300] bg-white/80 backdrop-blur-md border-b border-gray-200/50 h-16 px-4 flex items-center justify-between shadow-sm shrink-0 transition-all">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          <div className="w-10 h-10 bg-vovoh-red rounded-xl flex items-center justify-center text-white shadow-lg rotate-3 group-active:scale-95 transition-transform"><ChefHat size={20} /></div>
          <div>
            <h1 className="text-lg font-black text-vovoh-dark tracking-tighter leading-none">Vovó Grazy</h1>
            <p className="text-[8px] font-black text-vovoh-red uppercase tracking-[0.2em] mt-0.5">Salgados & Empanadas</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button 
             onClick={toggleNotifications} 
             className={`p-2 rounded-full transition-all border ${notificationsEnabled ? 'bg-vovoh-red/10 border-vovoh-red/20 text-vovoh-red' : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-50'}`}
             title={notificationsEnabled ? "Desativar notificações" : "Ativar notificações"}
           >
             {notificationsEnabled ? <Bell size={20} className="fill-current" /> : <BellOff size={20} />}
           </button>
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

      <div className="px-4 mt-4 space-y-3 relative z-[200]">
        {isClosed && (
          <div className="bg-vovoh-dark text-white px-4 py-3 rounded-2xl shadow-xl flex justify-center items-center gap-3 animate-in slide-in-from-top-2 mx-auto max-w-md border border-white/10">
            <Clock size={18} className="text-vovoh-gold animate-pulse shrink-0" />
            <span className="text-xs font-black uppercase tracking-widest text-center leading-tight">
              {isForceClosed 
                ? "A vovó tirou o dia de folga! Voltamos amanhã." 
                : `A vovó tá dormindo! Abrimos das ${formatTime(dynamicConfigs?.opening_start, OPENING_HOURS.start)}h às ${formatTime(dynamicConfigs?.opening_end, OPENING_HOURS.end)}h.`}
            </span>
          </div>
        )}

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
      </div>

      {/* Wrapper para o conteúdo crescer e empurrar o rodapé */}
      <div className="flex-grow pb-24">
         <div className="max-w-7xl mx-auto px-4 mt-2">
            <QuickReorder user={user} onReorder={handleReorder} />
         </div>
         <StoreFront 
           products={products} 
           isLoading={loading} 
           onAddToCart={handleAddToCart} 
           onAddSuggestedItems={handleAddSuggestedItems}
           logo={LOGO} 
           dynamicConfigs={dynamicConfigs} 
           isClosed={isClosed} 
         />
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 desktop:max-w-[480px] desktop:mx-auto desktop:left-1/2 desktop:-translate-x-1/2 z-[250] bg-white border-t border-gray-100 flex justify-around items-end h-20 pb-2 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)]">
        
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
            onClick={() => setIsCartOpen(true)}
            className="w-16 h-16 bg-vovoh-red text-white rounded-full shadow-[0_8px_25px_-5px_rgba(214,31,31,0.5)] flex items-center justify-center border-4 border-[#F9F9F9] active:scale-90 transition-all"
          >
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute top-0 right-0 bg-vovoh-gold text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce">
                {cart.length}
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
        setUser={setUser} 
        showMsg={(msg, type) => setToast({ message: msg, type })}
      />

      <Checkout 
        isOpen={isCartOpen} onClose={() => setIsCartOpen(false)}
        cart={cart} setCart={setCart} 
        customer={customer} setCustomer={setCustomer} 
        method={method} setMethod={setMethod}
        changeFor={changeFor} setChangeFor={setChangeFor}
        onOrder={createOrder} pixKey={dynamicConfigs?.pix_key || PIX_KEY}
        user={user} openAuth={() => { setIsCartOpen(false); setIsAuthOpen(true); }}
        dynamicConfigs={dynamicConfigs}
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

      <footer className="bg-vovoh-dark text-white py-16 mt-10 relative overflow-hidden shrink-0">
         <div className="absolute bottom-0 right-0 w-64 h-64 bg-vovoh-red/10 rounded-full blur-[80px]"></div>
         <div className="container mx-auto px-6 relative z-10">
            <div className="grid grid-cols-1 gap-12 text-left mb-16">
               <div className="col-span-1 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-vovoh-red rounded-xl flex items-center justify-center text-white shadow-lg rotate-3"><ChefHat size={20} /></div>
                    <h2 className="text-2xl font-black tracking-tighter">{STORE_NAME}</h2>
                  </div>
                  <p className="text-zinc-400 font-medium text-sm max-w-sm">
                    Salgados artesanais feitos com o carinho que só uma vovó tem. Fritos na hora, quentinhos e entregues na sua porta.
                  </p>
                  <div className="flex gap-4">
                    <a href="https://www.instagram.com/deliciasdavovosalgadinhos/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-vovoh-red transition-colors"><Instagram size={20} /></a>
                    <a href="https://www.facebook.com/SovereignsGrazy.Show" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-vovoh-red transition-colors"><Facebook size={20} /></a>
                  </div>
               </div>
               
               <div className="space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-vovoh-gold">Navegação</h4>
                  <ul className="space-y-4 text-sm font-bold text-zinc-400">
                    <li><a href="#menu" className="hover:text-white transition-colors">Cardápio</a></li>
                    <li><a href="#vovoh-ai" className="hover:text-white transition-colors">Dica da Vovó</a></li>
                    <li><button onClick={() => setIsAuthOpen(true)} className="hover:text-white transition-colors">Minha Conta</button></li>
                  </ul>
               </div>

               <div className="space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-vovoh-gold">Contato</h4>
                  <ul className="space-y-4 text-sm font-bold text-zinc-400">
                    <li className="flex items-start gap-3">
                      <Store size={18} className="shrink-0 text-zinc-600" />
                      <span>{dynamicConfigs?.store_address || STORE_ADDRESS}</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <MessageSquare size={18} className="shrink-0 text-zinc-600" />
                      <a 
                        href={`https://wa.me/554195796370`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-vovoh-gold transition-colors"
                      >
                        (41) 9579-6370 <span className="text-[10px] font-bold uppercase bg-green-100 text-green-800 px-1.5 py-0.5 rounded ml-1">WhatsApp</span>
                      </a>
                    </li>
                  </ul>
               </div>
            </div>
            
            <div className="pt-8 border-t border-white/5 flex flex-col justify-between items-center gap-4">
               <p className="text-zinc-600 font-bold text-[10px]">© {new Date().getFullYear()} — {STORE_NAME}. Todos os direitos reservados.</p>
               <button 
                 onClick={() => { 
                   if (secretTimeoutRef.current) {
                     clearTimeout(secretTimeoutRef.current);
                     secretTimeoutRef.current = null;
                   }

                   setClickCount(prev => {
                     const next = prev + 1;
                     
                     if (next === 3) {
                       secretTimeoutRef.current = setTimeout(() => {
                         window.location.hash = '#vovo-secreta';
                         setClickCount(0);
                       }, 1000);
                     }
                     return next;
                   });
                 }} 
                 className="opacity-10 hover:opacity-100 transition-opacity text-base select-none"
                 title="👵"
               >
                 👵
               </button>
               <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                  <a href="#" className="hover:text-zinc-400 transition-colors">Privacidade</a>
                  <a href="#" className="hover:text-zinc-400 transition-colors">Termos</a>
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
}