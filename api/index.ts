import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import webpush from 'web-push';
import { GoogleGenAI } from "@google/genai";
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';

dotenv.config();

// --- Inicialização do Firebase Firestore no Backend ---
let firebaseApp;
let db: any = null;
let firestoreLoadMethod = "none";

try {
  let fbConfig: any = null;
  // 1. Tentar ler das variáveis de ambiente
  if (process.env.VITE_FIREBASE_API_KEY) {
    fbConfig = {
      apiKey: process.env.VITE_FIREBASE_API_KEY,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.VITE_FIREBASE_APP_ID,
    };
    firestoreLoadMethod = "env";
  } else {
    // 2. Tentar ler usando require relativo (para que o esbuild inclua no bundle compilado)
    try {
      fbConfig = require('../firebase-applet-config.json');
      firestoreLoadMethod = "require_bundle";
    } catch (e) {
      // 3. Fallback para ler por fs-extra caso o require falhe
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        fbConfig = fs.readJsonSync(configPath);
        firestoreLoadMethod = "fs_local";
      }
    }
  }

  if (fbConfig && fbConfig.apiKey) {
    firebaseApp = getApps().length === 0 ? initializeApp(fbConfig) : getApp();
    const databaseId = fbConfig.firestoreDatabaseId || process.env.VITE_FIREBASE_DATABASE_ID;
    if (databaseId) {
      db = getFirestore(firebaseApp, databaseId);
    } else {
      db = getFirestore(firebaseApp);
    }
    console.log(`API Backend: Firebase Firestore inicializado e ativo via método: ${firestoreLoadMethod} (databaseId: ${databaseId || 'default'})!`);
  } else {
    console.warn("API Backend: Nenhuma configuração do Firebase encontrada para inicialização.");
  }
} catch (e) {
  console.error("API Backend: Falha ao inicializar o Firestore:", e);
}

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23FFFBF2'/%3E%3Ccircle cx='200' cy='180' r='100' fill='%23fef3c7' stroke='%23D97706' stroke-width='4' stroke-dasharray='10 10'/%3E%3Cpath d='M200 140 C 200 140 170 110 140 140 C 110 170 200 240 200 240 C 200 240 290 170 260 140 C 230 110 200 140 200 140 Z' fill='%23D61F1F' opacity='0.8'/%3E%3Ctext x='50%25' y='80%25' font-family='sans-serif' font-weight='900' font-size='22' fill='%23D97706' text-anchor='middle'%3EMistério Gostoso%3C/text%3E%3Ctext x='50%25' y='88%25' font-family='sans-serif' font-weight='500' font-size='14' fill='%23999' text-anchor='middle'%3E(Logo a Vovó põe a foto)%3C/text%3E%3C/svg%3E";

function cleanForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = cleanForFirestore(val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

const isVercel = !!process.env.VERCEL;
const DATA_DIR = (process.env.NODE_ENV === 'production' || isVercel) ? '/tmp/data' : path.join(process.cwd(), 'data');

console.log(`Storage: Usando diretório de dados local: ${DATA_DIR}`);

const FILES = {
  products: path.join(DATA_DIR, 'products.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  users: path.join(DATA_DIR, 'users.json'),
  configs: path.join(DATA_DIR, 'configs.json'),
  push_subscriptions: path.join(DATA_DIR, 'push_subscriptions.json'),
  visits: path.join(DATA_DIR, 'visits.json'),
  presence: path.join(DATA_DIR, 'presence.json')
};

// Garante que o diretório e arquivos locais existam
try {
  fs.ensureDirSync(DATA_DIR);
  Object.values(FILES).forEach(file => {
    if (!fs.existsSync(file)) {
      fs.writeJsonSync(file, []);
    }
  });
} catch (e) {
  console.error(`Erro ao criar diretório de dados em ${DATA_DIR}:`, e);
}

// Interfaces
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  oldPrice?: number;
  variations?: any[];
  additionals?: any[];
}

export interface Order {
  id: string;
  date?: string;
  scheduledTo?: string;
  refusalReason?: string;
  customer: { name: string; phone: string; address: string };
  total: number;
  itemsSummary: string;
  items?: any[];
  paymentMethod: string;
  status: string;
  type: string;
  userId?: string;
  archived?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  cart?: string;
}

export interface Config {
  key: string;
  value: string;
}

export interface Visit {
  id: string;
  userId?: string;
  timestamp: string;
  isPwa: boolean;
  userAgent?: string;
  sessionId?: string;
  authType?: string;
}

export interface Presence {
  id: string;
  userId?: string;
  userName?: string;
  lastSeen: string;
  isShopping: boolean;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  role?: 'admin' | 'customer';
}

// Helper para comunicação com Google Sheets via Google Apps Script
async function callGAS(action: string, payload?: any, queryParams: Record<string, string> = {}) {
  const url = process.env.GOOGLE_SHEETS_SCRIPT_URL;
  if (!url) {
    throw new Error("GOOGLE_SHEETS_SCRIPT_URL is not configured");
  }

  const urlObj = new URL(url);
  urlObj.searchParams.append('action', action);
  Object.entries(queryParams).forEach(([k, v]) => {
    urlObj.searchParams.append(k, v);
  });

  const options: RequestInit = {
    method: payload !== undefined ? 'POST' : 'GET',
    headers: {
      'Accept': 'application/json',
    },
    redirect: 'follow'
  };

  if (payload !== undefined) {
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    };
    options.body = JSON.stringify({ action, payload });
  }

  const response = await fetch(urlObj.toString(), options);
  if (!response.ok) {
    throw new Error(`Google Sheets API failed with status ${response.status}`);
  }

  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (data && data.error) {
      throw new Error(data.error);
    }
    return data;
  } catch (e: any) {
    console.error("Failed to parse GAS response as JSON. Text content was:", text);
    throw new Error(e.message || "Invalid response from Google Sheets Script");
  }
}

// --- Cache System ---
let cache: {
  products: { data: Product[] | null, lastFetch: number },
  configs: { data: Record<string, string> | null, lastFetch: number }
} = {
  products: { data: null, lastFetch: 0 },
  configs: { data: null, lastFetch: 0 }
};

const CACHE_TTL = 300000; // 5 minutos

// --- Repositórios ---

// Push Subscriptions
const PushSubscriptionRepo = {
  getAll: async (): Promise<PushSubscription[]> => {
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'push_subscriptions'));
        return querySnapshot.docs.map(docSnap => docSnap.data()) as PushSubscription[];
      } catch (e) {
        console.error("Firestore: Erro ao listar push subscriptions:", e);
      }
    }
    const subscriptions = await fs.readJson(FILES.push_subscriptions).catch(() => []);
    return subscriptions;
  },
  add: async (subscription: PushSubscription) => {
    if (db) {
      try {
        const docId = encodeURIComponent(subscription.endpoint).replace(/\//g, '_');
        await setDoc(doc(db, 'push_subscriptions', docId), subscription);
        return;
      } catch (e) {
        console.error("Firestore: Erro ao adicionar push subscription:", e);
      }
    }
    const subscriptions = await fs.readJson(FILES.push_subscriptions).catch(() => []);
    const index = subscriptions.findIndex((s: PushSubscription) => s.endpoint === subscription.endpoint);
    if (index !== -1) {
      subscriptions[index] = subscription;
    } else {
      subscriptions.push(subscription);
    }
    await fs.writeJson(FILES.push_subscriptions, subscriptions);
  },
  delete: async (endpoint: string) => {
    if (db) {
      try {
        const docId = encodeURIComponent(endpoint).replace(/\//g, '_');
        await deleteDoc(doc(db, 'push_subscriptions', docId));
        return;
      } catch (e) {
        console.error("Firestore: Erro ao deletar push subscription:", e);
      }
    }
    const subscriptions = await fs.readJson(FILES.push_subscriptions).catch(() => []);
    const filtered = subscriptions.filter((s: PushSubscription) => s.endpoint !== endpoint);
    await fs.writeJson(FILES.push_subscriptions, filtered);
  }
};

// Visitas
const VisitRepo = {
  isBot: (userAgent: string): boolean => {
    if (!userAgent) return false;
    const bots = [
      'vercel-screenshot', 'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'slurp', 
      'baiduspider', 'facebookexternalhit', 'twitterbot', 'rogerbot', 'linkedinbot', 
      'embedly', 'quora link preview', 'showyoubot', 'outbrain', 'pinterest/0.', 
      'developers.google.com/+/web/snippet', 'slackbot', 'vkshare', 'redditbot', 
      'applebot', 'whatsapp', 'flipboard', 'tumblr', 'bitlybot', 'skypeuripreview', 
      'nuzzel', 'discordbot', 'google pagead', 'lighthouse', 'headless', 'bot', 
      'spider', 'crawl', 'monitoring', 'pingdom', 'uptime'
    ];
    const ua = userAgent.toLowerCase();
    return bots.some(bot => ua.includes(bot));
  },
  add: async (visit: Partial<Visit>) => {
    if (visit.userAgent && VisitRepo.isBot(visit.userAgent)) {
      console.log(`Visit ignored: Bot detected (${visit.userAgent})`);
      return;
    }

    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const today = timestamp.split('T')[0];
    
    if (db) {
      try {
        const q = query(collection(db, 'visits'), where('sessionId', '==', visit.sessionId || ''));
        const querySnapshot = await getDocs(q);
        const hasVisitedToday = querySnapshot.docs.some(docSnap => {
          const t = docSnap.data().timestamp;
          return t && t.startsWith(today);
        });

        if (hasVisitedToday) return;

        await setDoc(doc(db, 'visits', id), {
          id,
          ...visit,
          timestamp,
          sessionId: visit.sessionId || null,
          authType: visit.authType || 'none'
        });
        return;
      } catch (e) {
        console.error("Firestore: Erro ao registrar visita:", e);
      }
    }

    const visits = await fs.readJson(FILES.visits).catch(() => []);
    
    const hasVisitedToday = visits.some((v: any) => 
      (v.sessionId === visit.sessionId || (visit.userId && visit.userId !== 'anonymous' && v.userId === visit.userId)) &&
      v.timestamp.startsWith(today)
    );
    
    if (hasVisitedToday) return;

    visits.push({ id, ...visit, timestamp, sessionId: visit.sessionId || null, authType: visit.authType || 'none' });
    await fs.writeJson(FILES.visits, visits);
  },
  updateAuth: async (sessionId: string, userId: string, authType: string) => {
    if (db) {
      try {
        const q = query(collection(db, 'visits'), where('sessionId', '==', sessionId));
        const querySnapshot = await getDocs(q);
        for (const docSnap of querySnapshot.docs) {
          await updateDoc(doc(db, 'visits', docSnap.id), { userId, authType });
        }
        return;
      } catch (e) {
        console.error("Firestore: Erro ao atualizar auth da visita:", e);
      }
    }

    const visits = await fs.readJson(FILES.visits).catch(() => []);
    let updated = false;
    for (const v of visits) {
      if (v.sessionId === sessionId) {
        v.userId = userId;
        v.authType = authType;
        updated = true;
      }
    }
    if (updated) await fs.writeJson(FILES.visits, visits);
  },
  getAll: async (): Promise<Visit[]> => {
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'visits'));
        const visits = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Visit[];
        return visits.filter((v: Visit) => !VisitRepo.isBot(v.userAgent || ''));
      } catch (e) {
        console.error("Firestore: Erro ao obter visitas:", e);
      }
    }
    const visits = await fs.readJson(FILES.visits).catch(() => []);
    return visits.filter((v: Visit) => !VisitRepo.isBot(v.userAgent || ''));
  },
  getStats: async () => {
    const visits = await VisitRepo.getAll();
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    const actualVisits = visits.filter((v: Visit) => v.userAgent !== 'PWA_INSTALL_EVENT' && !VisitRepo.isBot(v.userAgent || ''));
    const installEvents = visits.filter((v: Visit) => v.userAgent === 'PWA_INSTALL_EVENT');

    let authStats = { none: 0, guest: 0, registered: 0 };
    actualVisits.forEach((v: any) => {
      const type = v.authType || 'none';
      if (type === 'none') authStats.none++;
      else if (type === 'guest') authStats.guest++;
      else if (type === 'registered') authStats.registered++;
    });

    return {
      total: actualVisits.length,
      pwa: actualVisits.filter((v: Visit) => v.isPwa).length,
      installs: installEvents.length,
      month: actualVisits.filter((v: Visit) => new Date(v.timestamp) > oneMonthAgo).length,
      authStats
    };
  }
};

// Presença
const PresenceRepo = {
  update: async (presence: Presence) => {
    if (db) {
      try {
        await setDoc(doc(db, 'presence', presence.id), presence);
        return;
      } catch (e) {
        console.error("Firestore: Erro ao atualizar presença:", e);
      }
    }

    const presences = await fs.readJson(FILES.presence).catch(() => []);
    const index = presences.findIndex((p: Presence) => p.id === presence.id);

    if (index !== -1) {
      presences[index] = presence;
    } else {
      presences.push(presence);
    }
    await fs.writeJson(FILES.presence, presences);
  },
  cleanup: async () => {
    const timeout = 60000; // 1 minuto
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'presence'));
        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data();
          if (new Date(data.lastSeen).getTime() <= Date.now() - timeout) {
            await deleteDoc(doc(db, 'presence', docSnap.id));
          }
        }
        return;
      } catch (e) {
        console.error("Firestore: Erro no cleanup de presença:", e);
      }
    }

    const presences = await fs.readJson(FILES.presence).catch(() => []);
    const filtered = presences.filter((p: Presence) => new Date(p.lastSeen).getTime() > Date.now() - timeout);
    await fs.writeJson(FILES.presence, filtered);
  },
  getAll: async (): Promise<Presence[]> => {
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'presence'));
        return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Presence[];
      } catch (e) {
        console.error("Firestore: Erro ao obter presença:", e);
      }
    }
    return fs.readJson(FILES.presence).catch(() => []);
  }
};

// Produtos
const ProductRepo = {
  getAll: async (): Promise<Product[]> => {
    const now = Date.now();
    if (cache.products.data && (now - cache.products.lastFetch < CACHE_TTL)) {
      return cache.products.data;
    }

    let products: Product[] = [];
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('getProducts');
        if (Array.isArray(data)) {
          products = data.map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: Number(p.price) || 0,
            category: p.category || 'outros',
            image: p.image || undefined,
            oldPrice: p.oldPrice ? Number(p.oldPrice) : undefined,
            variations: typeof p.variations === 'string' ? JSON.parse(p.variations || '[]') : p.variations || [],
            additionals: typeof p.additionals === 'string' ? JSON.parse(p.additionals || '[]') : p.additionals || [],
          }));
        }
      } catch (e) {
        console.error("Google Sheets Error fetching products:", e);
      }
    } else if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        products = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Product[];
      } catch (e) {
        console.error("Firestore Error fetching products:", e);
      }
    }

    if (products.length === 0) {
      products = await fs.readJson(FILES.products).catch(() => []);
    }

    cache.products = { data: products, lastFetch: now };
    return products;
  },
  add: async (product: Product) => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('addProduct', {
          ...product,
          variations: JSON.stringify(product.variations || []),
          additionals: JSON.stringify(product.additionals || [])
        });
        cache.products.data = null;
        return;
      } catch (e) {
        console.error("Google Sheets Error adding product:", e);
      }
    } else if (db) {
      try {
        await setDoc(doc(db, 'products', product.id), product);
        cache.products.data = null;
        return;
      } catch (e) {
        console.error("Firestore Error adding product:", e);
      }
    }
    const products = await fs.readJson(FILES.products).catch(() => []);
    products.push(product);
    await fs.writeJson(FILES.products, products);
    cache.products.data = null;
  },
  update: async (product: Product) => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('updateProduct', {
          ...product,
          variations: JSON.stringify(product.variations || []),
          additionals: JSON.stringify(product.additionals || [])
        });
        cache.products.data = null;
        return;
      } catch (e) {
        console.error("Google Sheets Error updating product:", e);
      }
    } else if (db) {
      try {
        await setDoc(doc(db, 'products', product.id), product, { merge: true });
        cache.products.data = null;
        return;
      } catch (e) {
        console.error("Firestore Error updating product:", e);
      }
    }
    const products = await fs.readJson(FILES.products).catch(() => []);
    const index = products.findIndex((p: Product) => p.id === product.id);
    if (index !== -1) {
      products[index] = product;
      await fs.writeJson(FILES.products, products);
    }
    cache.products.data = null;
  },
  delete: async (id: string) => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('deleteProduct', { id });
        cache.products.data = null;
        return;
      } catch (e) {
        console.error("Google Sheets Error deleting product:", e);
      }
    } else if (db) {
      try {
        await deleteDoc(doc(db, 'products', id));
        cache.products.data = null;
        return;
      } catch (e) {
        console.error("Firestore Error deleting product:", e);
      }
    }
    const products = await fs.readJson(FILES.products).catch(() => []);
    const filtered = products.filter((p: Product) => p.id !== id);
    await fs.writeJson(FILES.products, filtered);
    cache.products.data = null;
  }
};

// Pedidos
const OrderRepo = {
  getAll: async (): Promise<Order[]> => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('getOrders');
        if (Array.isArray(data)) {
          return data.map((row: any) => ({
            id: row.id,
            date: row.date,
            scheduledTo: row.scheduledTo || undefined,
            refusalReason: row.refusalReason || undefined,
            customer: {
              name: row.customerName || '',
              phone: row.customerPhone || '',
              address: row.address || ''
            },
            total: Number(row.total) || 0,
            itemsSummary: row.itemsSummary || '',
            items: typeof row.items === 'string' ? JSON.parse(row.items || '[]') : row.items || [],
            paymentMethod: row.paymentMethod || '',
            status: row.status || 'pendente',
            type: row.type || '',
            userId: row.userId || '',
            archived: row.archived === true || row.archived === 'TRUE'
          }));
        }
      } catch (e) {
        console.error("Google Sheets Error fetching orders:", e);
      }
    } else if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'orders'));
        return querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            date: data.date,
            scheduledTo: data.scheduledTo || undefined,
            refusalReason: data.refusalReason || undefined,
            customer: data.customer || { name: '', phone: '', address: '' },
            total: Number(data.total) || 0,
            itemsSummary: data.itemsSummary || '',
            items: typeof data.items === 'string' ? JSON.parse(data.items || '[]') : data.items || [],
            paymentMethod: data.paymentMethod || '',
            status: data.status || 'pendente',
            type: data.type || '',
            userId: data.userId || '',
            archived: data.archived === true
          };
        }) as Order[];
      } catch (e) {
        console.error("Firestore Error fetching orders:", e);
      }
    }
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    return orders;
  },
  getById: async (id: string): Promise<Order | null> => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const orders = await OrderRepo.getAll();
        return orders.find(o => o.id === id) || null;
      } catch (e) {
        console.error("Google Sheets Error getting order status:", e);
      }
    } else if (db) {
      try {
        const docSnap = await getDoc(doc(db, 'orders', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            date: data.date,
            scheduledTo: data.scheduledTo || undefined,
            refusalReason: data.refusalReason || undefined,
            customer: data.customer || { name: '', phone: '', address: '' },
            total: Number(data.total) || 0,
            itemsSummary: data.itemsSummary || '',
            items: typeof data.items === 'string' ? JSON.parse(data.items || '[]') : data.items || [],
            paymentMethod: data.paymentMethod || '',
            status: data.status || 'pendente',
            type: data.type || '',
            userId: data.userId || '',
            archived: data.archived === true
          } as Order;
        }
        return null;
      } catch (e) {
        console.error("Firestore Error getting order status:", e);
      }
    }
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    return orders.find((o: Order) => o.id === id) || null;
  },
  getByUserId: async (userId: string): Promise<Order[]> => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('getUserOrders', undefined, { userId });
        if (Array.isArray(data)) {
          return data.map((row: any) => ({
            id: row.id,
            date: row.date,
            scheduledTo: row.scheduledTo || undefined,
            refusalReason: row.refusalReason || undefined,
            customer: {
              name: row.customerName || '',
              phone: row.customerPhone || '',
              address: row.address || ''
            },
            total: Number(row.total) || 0,
            itemsSummary: row.itemsSummary || '',
            items: typeof row.items === 'string' ? JSON.parse(row.items || '[]') : row.items || [],
            paymentMethod: row.paymentMethod || '',
            status: row.status || 'pendente',
            type: row.type || '',
            userId: row.userId || '',
            archived: row.archived === true || row.archived === 'TRUE'
          }));
        }
      } catch (e) {
        console.error("Google Sheets Error fetching user orders:", e);
      }
    } else if (db) {
      try {
        const q = query(collection(db, 'orders'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            ...data,
            total: Number(data.total) || 0,
            items: typeof data.items === 'string' ? JSON.parse(data.items || '[]') : data.items || [],
          };
        }).filter((o: any) => !o.archived) as Order[];
      } catch (e) {
        console.error("Firestore Error fetching user orders:", e);
      }
    }
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    return orders.filter((o: Order) => o.userId === userId && !o.archived);
  },
  create: async (order: Order) => {
    const formattedOrder = {
      ...order,
      date: order.date || new Date().toISOString(),
      status: 'pendente',
      archived: false
    };

    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('order', {
          id: formattedOrder.id,
          customerName: formattedOrder.customer.name,
          customerPhone: formattedOrder.customer.phone,
          address: formattedOrder.customer.address,
          total: formattedOrder.total,
          itemsSummary: formattedOrder.itemsSummary,
          paymentMethod: formattedOrder.paymentMethod,
          type: formattedOrder.type,
          userId: formattedOrder.userId || '',
          items: JSON.stringify(formattedOrder.items || [])
        });
        return;
      } catch (e) {
        console.error("Google Sheets Error creating order:", e);
      }
    } else if (db) {
      try {
        await setDoc(doc(db, 'orders', formattedOrder.id), formattedOrder);
        return;
      } catch (e) {
        console.error("Firestore Error creating order:", e);
      }
    }
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    orders.push(formattedOrder);
    await fs.writeJson(FILES.orders, orders);
  },
  update: async (order: Order) => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('updateStatus', {
          orderId: order.id,
          status: order.status
        });
        return;
      } catch (e) {
        console.error("Google Sheets Error updating order status:", e);
      }
    } else if (db) {
      try {
        await setDoc(doc(db, 'orders', order.id), order, { merge: true });
        return;
      } catch (e) {
        console.error("Firestore Error updating order:", e);
      }
    }
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    const index = orders.findIndex((o: Order) => o.id === order.id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...order };
      await fs.writeJson(FILES.orders, orders);
    }
  },
  updateStatus: async (id: string, status: string) => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('updateStatus', { orderId: id, status });
        return;
      } catch (e) {
        console.error("Google Sheets Error updating status:", e);
      }
    } else if (db) {
      try {
        await updateDoc(doc(db, 'orders', id), { status });
        return;
      } catch (e) {
        console.error("Firestore Error updating status:", e);
      }
    }
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    const index = orders.findIndex((o: Order) => o.id === id);
    if (index !== -1) {
      orders[index].status = status;
      await fs.writeJson(FILES.orders, orders);
    }
  },
  countActive: async (): Promise<number> => {
    const orders = await OrderRepo.getAll();
    return orders.filter((o: Order) => o.status === 'pendente' || o.status === 'preparando').length;
  },
  archive: async (id: string) => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('archiveOrder', { id });
        return;
      } catch (e) {
        console.error("Google Sheets Error archiving order:", e);
      }
    } else if (db) {
      try {
        await updateDoc(doc(db, 'orders', id), { archived: true });
        return;
      } catch (e) {
        console.error("Firestore Error archiving order:", e);
      }
    }
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    const index = orders.findIndex((o: Order) => o.id === id);
    if (index !== -1) {
      orders[index].archived = true;
      await fs.writeJson(FILES.orders, orders);
    }
  }
};

// Usuários (Auth via Google Sheets!)
const UserRepo = {
  getById: async (id: string): Promise<User | null> => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const users = await UserRepo.getAll();
        return users.find(u => u.id === id) || null;
      } catch (e) {
        console.error("Google Sheets Error getting user by ID:", e);
      }
    } else if (db) {
      try {
        const docSnap = await getDoc(doc(db, 'users', id));
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as User;
        }
      } catch (e) {
        console.error("Firestore Error getting user by ID:", e);
      }
    }
    const users = await fs.readJson(FILES.users).catch(() => []);
    return users.find((u: User) => u.id === id) || null;
  },
  findByEmail: async (email: string): Promise<User | null> => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const users = await UserRepo.getAll();
        return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
      } catch (e) {
        console.error("Google Sheets Error getting user by email:", e);
      }
    } else if (db) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          return { id: docSnap.id, ...docSnap.data() } as User;
        }
      } catch (e) {
        console.error("Firestore Error getting user by email:", e);
      }
    }
    const users = await fs.readJson(FILES.users).catch(() => []);
    return users.find((u: User) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },
  create: async (user: User) => {
    let savedInFirestore = false;
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('register', {
          id: user.id,
          name: user.name,
          email: user.email,
          password: user.password || '',
          phone: user.phone || '',
          address: user.address || ''
        });
        return;
      } catch (e) {
        console.error("Google Sheets Error creating user:", e);
      }
    } else if (db) {
      try {
        const cleanedUser = cleanForFirestore({
          ...user,
          email: user.email.toLowerCase()
        });
        await setDoc(doc(db, 'users', user.id), cleanedUser);
        savedInFirestore = true;
      } catch (e) {
        console.error("Firestore Error creating user:", e);
      }
    }
    // Sempre salvar localmente também como backup/fallback robusto
    const users = await fs.readJson(FILES.users).catch(() => []);
    if (!users.some((u: User) => u.id === user.id)) {
      users.push(user);
      await fs.writeJson(FILES.users, users);
    }
  },
  getAll: async (): Promise<User[]> => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('getUsers');
        if (Array.isArray(data)) {
          return data.map((row: any) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone || '',
            address: row.address || '',
            cart: row.cart || '[]'
          }));
        }
      } catch (e) {
        console.error("Google Sheets Error listing all users:", e);
      }
    } else if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const firestoreUsers = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as User[];
        const localUsers = await fs.readJson(FILES.users).catch(() => []);
        const merged = [...firestoreUsers];
        localUsers.forEach((lu: User) => {
          if (!merged.some(u => u.id === lu.id)) {
            merged.push(lu);
          }
        });
        return merged;
      } catch (e) {
        console.error("Firestore Error listing users:", e);
      }
    }
    return fs.readJson(FILES.users).catch(() => []);
  },
  update: async (user: Partial<User> & { id: string }) => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        // Buscamos o usuário para atualizar as propriedades e mandar de volta
        const existing = await UserRepo.getById(user.id);
        if (existing) {
          const updated = { ...existing, ...user };
          await callGAS('register', {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            password: updated.password || '',
            phone: updated.phone || '',
            address: updated.address || ''
          });
        }
        return;
      } catch (e) {
        console.error("Google Sheets Error updating user:", e);
      }
    } else if (db) {
      try {
        const cleanedUser = cleanForFirestore(user);
        await setDoc(doc(db, 'users', user.id), cleanedUser, { merge: true });
      } catch (e) {
        console.error("Firestore Error updating user:", e);
      }
    }
    const users = await fs.readJson(FILES.users).catch(() => []);
    const index = users.findIndex((u: User) => u.id === user.id);
    if (index !== -1) {
      users[index] = { ...users[index], ...user };
      await fs.writeJson(FILES.users, users);
    }
  }
};

// Configurações
const ConfigRepo = {
  getAll: async (): Promise<Record<string, string>> => {
    const now = Date.now();
    if (cache.configs.data && (now - cache.configs.lastFetch < CACHE_TTL)) {
      return cache.configs.data;
    }

    let configObj: Record<string, string> = {};
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const res = await callGAS('getConfigs');
        if (res && typeof res === 'object') {
          configObj = res;
        }
      } catch (e) {
        console.error("Erro ao buscar configs do Google Sheets:", e);
      }
    } else if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'configs'));
        querySnapshot.docs.forEach(docSnap => {
          configObj[docSnap.id] = docSnap.data().value;
        });
      } catch (e) {
        console.error("Firestore Error fetching configs:", e);
      }
    }
    
    if (Object.keys(configObj).length === 0) {
      const configs = await fs.readJson(FILES.configs).catch(() => []);
      configs.forEach((c: Config) => configObj[c.key] = c.value);
    }

    cache.configs = { data: configObj, lastFetch: now };
    return configObj;
  },
  update: async (key: string, value: string) => {
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('updateConfig', { key, value });
        cache.configs.data = null;
        return;
      } catch (e) {
        console.error("Google Sheets Error updating config:", e);
      }
    } else if (db) {
      try {
        await setDoc(doc(db, 'configs', key), { value });
        cache.configs.data = null;
        return;
      } catch (e) {
        console.error("Firestore Error updating config:", e);
      }
    }
    const configs = await fs.readJson(FILES.configs).catch(() => []);
    const index = configs.findIndex((c: Config) => c.key === key);
    if (index !== -1) {
      configs[index].value = value;
    } else {
      configs.push({ key, value });
    }
    await fs.writeJson(FILES.configs, configs);
    cache.configs.data = null;
  }
};


// --- Web Push Keys ---
const vapidKeys = {
  publicKey: '',
  privateKey: ''
};

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

async function initWebPush() {
  try {
    const envPublic = process.env.VAPID_PUBLIC_KEY;
    const envPrivate = process.env.VAPID_PRIVATE_KEY;

    if (envPublic && envPrivate) {
      vapidKeys.publicKey = envPublic;
      vapidKeys.privateKey = envPrivate;
    } else {
      const configs = await ConfigRepo.getAll();
      if (configs['vapid_public_key'] && configs['vapid_private_key']) {
        vapidKeys.publicKey = configs['vapid_public_key'];
        vapidKeys.privateKey = configs['vapid_private_key'];
      } else {
        const keys = webpush.generateVAPIDKeys();
        vapidKeys.publicKey = keys.publicKey;
        vapidKeys.privateKey = keys.privateKey;
        await ConfigRepo.update('vapid_public_key', keys.publicKey);
        await ConfigRepo.update('vapid_private_key', keys.privateKey);
      }
    }

    webpush.setVapidDetails(
      'mailto:ale.sobral.cortes@gmail.com',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    console.log("Web Push: Inicializado com sucesso.");
  } catch (e) {
    console.error("Web Push: Erro ao inicializar:", e);
  }
}

async function sendPushNotification(subscription: PushSubscription, payload: any) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (e: any) {
    console.error(`Erro ao enviar push para endpoint ${subscription.endpoint}:`, e.message || e);
    if (e.statusCode === 410 || e.statusCode === 404) {
      await PushSubscriptionRepo.delete(subscription.endpoint);
    }
  }
}

async function notifyAdmins(title: string, body: string, url: string = '/') {
  const subscriptions = await PushSubscriptionRepo.getAll();
  const adminSubs = subscriptions.filter(s => s.role === 'admin');
  for (const sub of adminSubs) {
    await sendPushNotification(sub, { title, body, url });
  }
}

async function notifyUser(userId: string, title: string, body: string, url: string = '/') {
  const subscriptions = await PushSubscriptionRepo.getAll();
  const userSubs = subscriptions.filter(s => s.userId === userId);
  for (const sub of userSubs) {
    await sendPushNotification(sub, { title, body, url });
  }
}

// Inicializa Web Push
initWebPush().catch(console.error);

const app = express.Router();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

// --- Rotas de Push ---
app.get('/push/public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/push/subscribe', async (req, res) => {
  try {
    const { subscription, userId, role } = req.body;
    await PushSubscriptionRepo.add({ ...subscription, userId, role });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Rotas de Pagamento (Stripe) ---
app.post('/create-payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe não está configurado no servidor." });
  }

  try {
    const { amount, metadata } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'brl',
      metadata: metadata || {},
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("Erro no Stripe:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health Check
app.get('/health', async (req, res) => {
  let firestoreWriteStatus = "not_tested";
  let firestoreError: string | null = null;

  if (db) {
    try {
      const testDocRef = doc(db, 'diagnostics', 'backend_test');
      await setDoc(testDocRef, {
        testedAt: new Date().toISOString(),
        status: 'ok'
      });
      firestoreWriteStatus = "success";
    } catch (e: any) {
      firestoreWriteStatus = "failed";
      firestoreError = e.message || String(e);
      console.error("Firestore self-test error:", e);
    }
  }

  res.json({ 
    status: 'ok', 
    environment: process.env.VERCEL ? 'vercel' : 'local',
    sheetsConfigured: !!process.env.GOOGLE_SHEETS_SCRIPT_URL,
    firestoreConfigured: !!db,
    firestoreMethod: firestoreLoadMethod,
    firestoreWriteStatus,
    firestoreError,
    timestamp: new Date().toISOString()
  });
});

// --- Rotas de Produtos ---
app.get('/products', async (req, res) => {
  try {
    const products = await ProductRepo.getAll();
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/products', async (req, res) => {
  try {
    const product = req.body;
    if (!product.id) product.id = uuidv4();
    await ProductRepo.add(product);
    res.json({ success: true, id: product.id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put('/products/:id', async (req, res) => {
  try {
    const product = { ...req.body, id: req.params.id };
    await ProductRepo.update(product);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete('/products/:id', async (req, res) => {
  try {
    await ProductRepo.delete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Rotas de Pedidos ---
app.get('/orders', async (req, res) => {
  try {
    const orders = await OrderRepo.getAll();
    const activeOrders = orders.filter(o => !o.archived);
    res.json(activeOrders);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/orders/batch/status', async (req, res) => {
  try {
    const ids = (req.query.ids as string || '').split(',').filter(id => id.trim().length > 0);
    if (!ids.length) return res.json({});
    
    const orders = await OrderRepo.getAll();
    const statuses: Record<string, string> = {};
    orders.forEach((o: any) => {
      if (ids.includes(o.id)) statuses[o.id] = o.status;
    });
    res.json(statuses);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/orders/:id/status', async (req, res) => {
  try {
    const order = await OrderRepo.getById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json({ status: order.status });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/orders/user/:userId', async (req, res) => {
  try {
    const orders = await OrderRepo.getByUserId(req.params.userId);
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/orders', async (req, res) => {
  try {
    const order = req.body;
    if (!order.id) order.id = uuidv4();
    await OrderRepo.create(order);
    
    notifyAdmins('Novo Pedido!', `Pedido #${order.id.slice(-4)} de ${order.customer.name}`).catch(console.error);
    res.json({ success: true, id: order.id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put('/orders/:id', async (req, res) => {
  try {
    const order = req.body;
    order.id = req.params.id;
    
    if (order.status === 'pendente') {
      order.date = new Date().toISOString();
    }
    
    await OrderRepo.update(order);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Chat Gemini com a Vovó Grazy
app.post('/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    const products = await ProductRepo.getAll();
    const productsList = products.map(p => `- ${p.name} (R$ ${p.price.toFixed(2)})`).join('\n');

    const systemPrompt = `Você é a Vovó Grazy, dona da 'Delícias da Vovó'.
    
    DIRETRIZES DE PERSONALIDADE:
    - Seja UMA VOVÓ CRISTÃ, SÁBIA E MUITO DIRETA. Não enrole.
    - Use "filho" ou "filha". Nada de "meu anjo" ou "meu amor".
    - NUNCA use "de comer rezando". Use "uma benção".
    
    DIRETRIZES DE RESPOSTA (IMPORTANTE):
    - SEJA BREVE. Máximo de 3 frases curtas antes da sugestão.
    - OBRIGATÓRIO: Use listas com marcadores ( - ) para sugerir os itens. Pule linha entre os parágrafos.
    
    DIRETRIZES DE VENDA:
    - Se sugerir produtos, OBRIGATORIAMENTE inclua o JSON no final.
    - Formato JSON estrito:
    \`\`\`json
    { "suggestedItems": [{"name": "Nome Exato", "quantity": 10}] }
    \`\`\`
    
    Produtos:
    ${productsList}
    
    Se não souber o nome exato, use o mais próximo.`;

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("API Key do Gemini não encontrada.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const models = ["gemini-2.5-flash", "gemini-3-flash", "gemini-3"];
    let lastError = null;

    for (const modelName of models) {
      try {
        const chat = ai.chats.create({
          model: modelName,
          config: { systemInstruction: systemPrompt },
          history: history || []
        });

        const result = await chat.sendMessage({ message });
        return res.json({ text: result.text });
      } catch (e: any) {
        lastError = e;
      }
    }

    throw lastError || new Error("Nenhum modelo disponível.");
  } catch (e: any) {
    console.error("Erro no Chat da Vovó:", e);
    res.status(500).json({ error: "A vovó está tirando um cochilo agora, tente depois!", details: e.message || String(e) });
  }
});

app.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await OrderRepo.updateStatus(req.params.id, status);
    
    // Notifica Cliente
    const order = await OrderRepo.getById(req.params.id);
    if (order && order.userId) {
      const statusMap: Record<string, string> = {
        'pendente': 'Recebido',
        'preparando': 'Em Preparo',
        'saiu_entrega': 'Saiu para Entrega',
        'concluido': 'Entregue',
        'cancelado': 'Cancelado',
        'recusado': 'Recusado'
      };
      const text = statusMap[status] || status;
      notifyUser(order.userId, `Atualização do Pedido #${order.id.slice(-4)} 🥟`, `Seu pedido está agora: ${text.toUpperCase()}`).catch(console.error);
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/orders/:id/receive', async (req, res) => {
  try {
    await OrderRepo.updateStatus(req.params.id, 'concluido');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/orders/:id/archive', async (req, res) => {
  try {
    await OrderRepo.archive(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Autenticação via Google Sheets ---
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    
    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('register', { name, email, password, phone, address });
        if (data && data.success) {
          return res.json({ success: true, user: data.user });
        } else {
          return res.status(400).json({ error: data?.error || 'Erro ao cadastrar.' });
        }
      } catch (err: any) {
        return res.status(400).json({ error: err.message || 'Erro no script do Google Sheets.' });
      }
    }

    // Fallback local
    const existing = await UserRepo.findByEmail(email);
    if (existing) return res.status(400).json({ error: 'E-mail já cadastrado.' });

    const user = { 
      id: uuidv4(), 
      name, 
      email: email.toLowerCase(), 
      password, 
      phone: phone || "", 
      address: address || "", 
      cart: '[]' 
    };
    try {
      await UserRepo.create(user);
    } catch (createErr: any) {
      console.error("Erro ao gravar usuário no banco:", createErr);
      return res.status(500).json({ 
        error: 'Erro no banco de dados ao salvar o cadastro. Por favor, verifique se o Firestore está ativo e configurado corretamente.', 
        details: createErr.message || String(createErr) 
      });
    }
    res.json({ success: true, user });
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('login', { email, password });
        if (data && data.success) {
          return res.json({ success: true, user: data.user });
        } else {
          return res.status(401).json({ error: data?.error || 'E-mail ou senha incorretos.' });
        }
      } catch (err: any) {
        return res.status(401).json({ error: err.message || 'Erro de autenticação no Google Sheets.' });
      }
    }

    // Fallback local
    let user;
    try {
      user = await UserRepo.findByEmail(email);
    } catch (fetchErr: any) {
      console.error("Erro ao buscar usuário por email:", fetchErr);
      return res.status(500).json({ 
        error: 'Erro no banco de dados ao buscar o usuário. Verifique se o Firestore está ativo.', 
        details: fetchErr.message || String(fetchErr) 
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'E-mail não cadastrado.' });
    }
    if (user.password !== password) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    res.json({ success: true, user });
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/auth/sync', async (req, res) => {
  try {
    const { uid, email, name, phone, isAnonymous } = req.body;
    let user = await UserRepo.getById(uid);
    
    if (!user && email) {
      user = await UserRepo.findByEmail(email);
    }
    
    if (!user) {
      user = { 
        id: uid, 
        name: name || (isAnonymous ? 'Visitante' : 'Cliente da Vovó'), 
        email: email || '', 
        password: '', 
        phone: phone || '', 
        address: '', 
        cart: '[]' 
      };
      await UserRepo.create(user);
    } else {
      let updated = false;
      if (name && user.name === 'Visitante') { user.name = name; updated = true; }
      if (phone && !user.phone) { user.phone = phone; updated = true; }
      if (updated) {
        await UserRepo.update(user);
      }
    }
    
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch('/users/:id', async (req, res) => {
  try {
    await UserRepo.update({ id: req.params.id, ...req.body });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Configurações ---
app.get('/configs', async (req, res) => {
  try {
    const configs = await ConfigRepo.getAll();
    if (!configs['faqs']) {
      configs['faqs'] = JSON.stringify([
        { q: "Vocês entregam em quais bairros?", a: "Entregamos em Colombo e região! Confira a taxa de entrega ao finalizar o pedido." },
        { q: "Aceitam quais formas de pagamento?", a: "Aceitamos Pix (com desconto!), Cartão de Crédito e Débito na entrega." },
        { q: "Os salgados são fritos na hora?", a: "Sim! Fritamos tudo na hora para chegar quentinho e crocante na sua casa." },
        { q: "Posso agendar um pedido?", a: "Com certeza! Você pode agendar para o horário que preferir durante nosso funcionamento." }
      ]);
    }
    if (!configs['testimonials']) {
      configs['testimonials'] = JSON.stringify([
        { name: "Maria S.", text: "Melhor coxinha que já comi na vida! A massa é super leve.", stars: 5 },
        { name: "João P.", text: "Chegou super rápido e muito quente. Recomendo demais!", stars: 5 },
        { name: "Ana C.", text: "O tempero lembra muito comida de vó mesmo. Virei cliente fiel.", stars: 5 }
      ]);
    }
    res.json(configs);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/configs', async (req, res) => {
  try {
    const { key, value } = req.body;
    await ConfigRepo.update(key, value);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Presença, Estatísticas e Visitas ---
app.post('/visits', async (req, res) => {
  try {
    const { userId, isPwa, sessionId, authType } = req.body;
    await VisitRepo.add({ userId, isPwa, userAgent: req.headers['user-agent'], sessionId, authType });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/visits/auth', async (req, res) => {
  try {
    const { sessionId, userId, authType } = req.body;
    await VisitRepo.updateAuth(sessionId, userId, authType);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/presence', async (req, res) => {
  try {
    const { id, userId, userName, isShopping } = req.body;
    await PresenceRepo.update({
      id,
      userId,
      userName,
      isShopping,
      lastSeen: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/admin/stats', async (req, res) => {
  try {
    const visitStats = await VisitRepo.getStats();
    const onlineUsers = await PresenceRepo.getAll();
    const totalUsers = await UserRepo.getAll();
    const orders = await OrderRepo.getAll();
    const allVisits = await VisitRepo.getAll();
    
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const visitHistory = last7Days.map(date => ({
      date: date.split('-').slice(1).reverse().join('/'),
      count: allVisits.filter(v => {
        const ts = v.timestamp;
        return ts && ts.startsWith(date);
      }).length
    }));

    res.json({
      visits: visitStats,
      history: visitHistory,
      online: onlineUsers,
      totalUsers: totalUsers.length,
      totalOrders: orders.length,
      revenue: orders.filter(o => o.status === 'concluido').reduce((acc, o) => acc + Number(o.total), 0)
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/stats/prep-time', async (req, res) => {
  try {
    const activeOrders = await OrderRepo.countActive();
    const configs = await ConfigRepo.getAll();
    const kitchenForecast = configs['kitchen_forecast'] || '40-50 min';
    res.json({ activeOrders, forecast: kitchenForecast });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/admin/broadcast-push', async (req, res) => {
  try {
    const { title, body } = req.body;
    const subscriptions = await PushSubscriptionRepo.getAll();
    for (const sub of subscriptions) {
      await sendPushNotification(sub, { title, body, url: '/' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/admin/test-push', async (req, res) => {
  try {
    const { userId } = req.body;
    await notifyUser(userId, 'Teste de Notificação', 'Se você recebeu isso, as notificações estão funcionando!');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Cleanup de presença a cada minuto
setInterval(() => {
  PresenceRepo.cleanup().catch(console.error);
}, 60000);

const mainApp = express();
mainApp.use('/api', app); 
mainApp.use('/', app);

export default mainApp;
