import { customerName, validCustomerName } from '../src/utils/customer-name.js';
import {LEGAL_VERSION,legalReceipt,currentLegalReceipt} from '../src/utils/legal.js';
import {RevisionCache} from '../server/revision-cache.js';
import { adminCredentialStore } from '../server/admin-credentials.js';
import { MercadoPago, validMercadoPagoSignature } from '../server/mercado-pago.js';
import { PaymentCheckoutStore, hasPaymentCheckoutAccess, paymentRequestHash } from '../server/payment-checkouts.js';
import { deliveryToken, locateDeliveryAddress, priceOrder, checkoutFingerprint } from '../server/checkout.js';
import {validateSchedule,shopDate} from '../src/utils/order-schedule.js';
import {storeAvailability} from '../src/utils/store-hours.js';
import { internalStoreFields, quoteDelivery } from '../server/delivery.js';
import { validateStoreConfig } from '../server/store-config.js';
import { productOptions } from '../src/utils/product-options.js';
import { createHash } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import webpush from 'web-push';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { separateImage } from '../server/media.js';
import { configuredDatabase, Database, Query, DocumentReference } from '../server/database.js';
import { waitUntil } from '@vercel/functions';
import { rateLimit } from 'express-rate-limit';
import { hasAdminSession, setCustomerSession, requireCustomer, customerId, hashPassword, verifyPassword, orderToken, hasOrderAccess, requireAdmin, requireAdminWrite, loginAdmin, logoutAdmin, configureAdminCredentials, prepareAdminCredential, changeAdminPassword } from '../server/admin-auth.js';

dotenv.config();

const db = configuredDatabase();
export function closeDatabase() { db?.client.close(); }
const collection = (database: Database, name: string) => database.collection(name);
const doc = (database: Database, name: string, id: string) => database.collection(name).doc(id);
const getDocs = (reference: Query) => reference.get();
const getDoc = (reference: DocumentReference) => reference.get();
const setDoc = (reference: DocumentReference, data: any, options?: { merge: boolean }) => reference.set(data, options);
const updateDoc = (reference: DocumentReference, data: any) => reference.update(data);
const deleteDoc = (reference: DocumentReference) => reference.delete();
const where = (field: string, operation: '==', value: string) => ({ field, operation, value });
const query = (reference: Query, filter: ReturnType<typeof where>) => reference.where(filter.field, filter.operation, filter.value);

const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23FFFBF2'/%3E%3Ccircle cx='200' cy='180' r='100' fill='%23fef3c7' stroke='%23D97706' stroke-width='4' stroke-dasharray='10 10'/%3E%3Cpath d='M200 140 C 200 140 170 110 140 140 C 110 170 200 240 200 240 C 200 240 290 170 260 140 C 230 110 200 140 200 140 Z' fill='%23D61F1F' opacity='0.8'/%3E%3Ctext x='50%25' y='80%25' font-family='sans-serif' font-weight='900' font-size='22' fill='%23D97706' text-anchor='middle'%3EMistério Gostoso%3C/text%3E%3Ctext x='50%25' y='88%25' font-family='sans-serif' font-weight='500' font-size='14' fill='%23999' text-anchor='middle'%3E(Logo a Vovó põe a foto)%3C/text%3E%3C/svg%3E";

function cleanRecord<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanRecord(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = cleanRecord(val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

const isVercel = !!process.env.VERCEL;
function requireLocalStorage() {
  if (isVercel || db) throw new Error('Armazenamento persistente indisponível. Tente novamente mais tarde.');
}

const DATA_DIR = process.env.NODE_ENV === 'test' && process.env.TEST_DATA_DIR ? process.env.TEST_DATA_DIR : (process.env.NODE_ENV === 'production' || isVercel) ? '/tmp/data' : path.join(process.cwd(), 'data');

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
  payment?: {method: string; paid: boolean; changeFor?: number; verifiedAt?: string};
  id: string;
  date?: string;
  scheduledTo?: string;
  acknowledgedAt?: string;
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
  submissionKeyHash?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  address?: string;
  cart?: string;
  legalAcceptance?: ReturnType<typeof legalReceipt>;
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

  if (!process.env.GOOGLE_SHEETS_API_SECRET) throw new Error('A integração com a planilha precisa de uma chave privada.');
  urlObj.searchParams.set('apiSecret', process.env.GOOGLE_SHEETS_API_SECRET);
  const response = await fetch(urlObj.toString(), { ...options, signal: AbortSignal.timeout(15000) });
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
    console.error("Resposta inválida da integração com a planilha.");
    throw new Error(e.message || "Invalid response from Google Sheets Script");
  }
}

// --- Cache System ---
let cache: {
  products: { data: Product[] | null, lastFetch: number },
} = {
  products: { data: null, lastFetch: 0 }
};

const CACHE_TTL = 300000; // Local/legacy catalogs; Turso uses a shared revision.

// --- Repositórios ---

// Push Subscriptions
const PushSubscriptionRepo = {
  getAll: async (): Promise<PushSubscription[]> => {
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'push_subscriptions'));
        return querySnapshot.docs.map(docSnap => docSnap.data()) as PushSubscription[];
      } catch (e) {
        console.error("Turso: Erro ao listar push subscriptions:", e);
        throw e;
      }
    }
    requireLocalStorage();
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
        console.error("Turso: Erro ao adicionar push subscription:", e);
        throw e;
      }
    }
    const subscriptions = await fs.readJson(FILES.push_subscriptions).catch(() => []);
    const index = subscriptions.findIndex((s: PushSubscription) => s.endpoint === subscription.endpoint);
    if (index !== -1) {
      subscriptions[index] = subscription;
    } else {
      subscriptions.push(subscription);
    }
    requireLocalStorage();
    await fs.writeJson(FILES.push_subscriptions, subscriptions);
  },
  delete: async (endpoint: string) => {
    if (db) {
      try {
        const docId = encodeURIComponent(endpoint).replace(/\//g, '_');
        await deleteDoc(doc(db, 'push_subscriptions', docId));
        return;
      } catch (e) {
        console.error("Turso: Erro ao deletar push subscription:", e);
        throw e;
      }
    }
    const subscriptions = await fs.readJson(FILES.push_subscriptions).catch(() => []);
    const filtered = subscriptions.filter((s: PushSubscription) => s.endpoint !== endpoint);
    requireLocalStorage();
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
    const today = shopDate();
    
    if (db) {
      try {
        const hasVisitedToday = (await db.rows("SELECT 1 FROM visits WHERE COALESCE(json_extract(payload,'$.userAgent'),'')!='PWA_INSTALL_EVENT' AND json_extract(payload,'$.sessionId')=? AND json_extract(payload,'$.timestamp')>=? AND json_extract(payload,'$.timestamp')<? LIMIT 1", [visit.sessionId || '', today + 'T03:00:00.000Z', new Date(Date.parse(today+'T03:00:00.000Z') + 86400000).toISOString()])).length > 0;

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
        console.error("Turso: Erro ao registrar visita:", e);
        throw e;
      }
    }

    const visits = await fs.readJson(FILES.visits).catch(() => []);
    
    const hasVisitedToday = visits.some((v: any) => 
      v.userAgent !== 'PWA_INSTALL_EVENT' && (v.sessionId === visit.sessionId || (visit.userId && visit.userId !== 'anonymous' && v.userId === visit.userId)) &&
      v.timestamp.startsWith(today)
    );
    
    if (hasVisitedToday) return;

    visits.push({ id, ...visit, timestamp, sessionId: visit.sessionId || null, authType: visit.authType || 'none' });
    requireLocalStorage();
    await fs.writeJson(FILES.visits, visits);
  },
  updateAuth: async (sessionId: string, userId: string, authType: string) => {
    if (db) {
      try {
        await db.updateVisitAuth(sessionId, userId, authType);
        return;
      } catch (e) {
        console.error("Turso: Erro ao atualizar auth da visita:", e);
        throw e;
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
    if (updated) { requireLocalStorage(); await fs.writeJson(FILES.visits, visits); }
  },
  getAll: async (): Promise<Visit[]> => {
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'visits'));
        const visits = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Visit[];
        return visits.filter((v: Visit) => !VisitRepo.isBot(v.userAgent || ''));
      } catch (e) {
        console.error("Turso: Erro ao obter visitas:", e);
        throw e;
      }
    }
    const visits = await fs.readJson(FILES.visits).catch(() => []);
    return visits.filter((v: Visit) => !VisitRepo.isBot(v.userAgent || ''));
  },
  getStats: async () => {
    const visits = await VisitRepo.getAll();
    const now = new Date();
    const oneMonthAgo = new Date(shopDate(now).slice(0,7)+'-01T03:00:00.000Z');
    
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
      installs: new Set(visits.filter(v=>v.isPwa||v.userAgent==='PWA_INSTALL_EVENT').map(v=>v.sessionId||v.id)).size,
      month: actualVisits.filter((v: Visit) => new Date(v.timestamp) >= oneMonthAgo).length,
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
        console.error("Turso: Erro ao atualizar presença:", e);
        throw e;
      }
    }

    const presences = await fs.readJson(FILES.presence).catch(() => []);
    const index = presences.findIndex((p: Presence) => p.id === presence.id);

    if (index !== -1) {
      presences[index] = presence;
    } else {
      presences.push(presence);
    }
    requireLocalStorage();
    await fs.writeJson(FILES.presence, presences);
  },
  cleanup: async () => {
    const timeout = 180000; // Últimos 3 minutos
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'presence'));
        for (const docSnap of querySnapshot.docs) {
          const data = docSnap.data() || {};
          if (new Date(data.lastSeen).getTime() <= Date.now() - timeout) {
            await deleteDoc(doc(db, 'presence', docSnap.id));
          }
        }
        return;
      } catch (e) {
        console.error("Turso: Erro no cleanup de presença:", e);
        throw e;
      }
    }

    const presences = await fs.readJson(FILES.presence).catch(() => []);
    const filtered = presences.filter((p: Presence) => new Date(p.lastSeen).getTime() > Date.now() - timeout);
    requireLocalStorage();
    await fs.writeJson(FILES.presence, filtered);
  },
  getAll: async (): Promise<Presence[]> => {
    if (db) {
      try {
        const querySnapshot = await getDocs(collection(db, 'presence'));
        return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as Presence[];
      } catch (e) {
        console.error("Turso: Erro ao obter presença:", e);
        throw e;
      }
    }
    return fs.readJson(FILES.presence).catch(() => []);
  }
};

// Produtos
const loadProducts = async (): Promise<Product[]> => {
    let products: Product[] = [];
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
        console.error("Turso Error fetching products:", e);
        throw e;
      }
    }

    if (products.length === 0 && !db) {
      products = await fs.readJson(FILES.products).catch(() => []);
    }

    products = products.map(product => ({ ...product, ...productOptions(product) }));
    return products;
};
const productCache = db ? new RevisionCache(()=>db.productRevision(),loadProducts) : null;
const ProductRepo = {
  getAll: async (): Promise<Product[]> => {
    if (productCache) return productCache.read();
    const now = Date.now();
    if (cache.products.data && now - cache.products.lastFetch < CACHE_TTL) return cache.products.data;
    const products = await loadProducts();
    cache.products = {data:products,lastFetch:now};
    return products;
  },
  add: async (product: Product) => {
    if (db) product.image = await separateImage(db, product.image);
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
        console.error("Turso Error adding product:", e);
        throw e;
      }
    }
    const products = await fs.readJson(FILES.products).catch(() => []);
    products.push(product);
    requireLocalStorage();
    await fs.writeJson(FILES.products, products);
    cache.products.data = null;
  },
  update: async (product: Product) => {
    if (db) product.image = await separateImage(db, product.image);
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
        console.error("Turso Error updating product:", e);
        throw e;
      }
    }
    const products = await fs.readJson(FILES.products).catch(() => []);
    const index = products.findIndex((p: Product) => p.id === product.id);
    if (index !== -1) {
      products[index] = product;
      requireLocalStorage();
    await fs.writeJson(FILES.products, products);
    }
    cache.products.data = null;
  },
  delete: async (id: string) => {
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
        console.error("Turso Error deleting product:", e);
        throw e;
      }
    }
    const products = await fs.readJson(FILES.products).catch(() => []);
    const filtered = products.filter((p: Product) => p.id !== id);
    requireLocalStorage();
    await fs.writeJson(FILES.products, filtered);
    cache.products.data = null;
  }
};

// Pedidos
const OrderRepo = {
  getAll: async (): Promise<Order[]> => {
    if (db) return db.panelOrders() as Promise<Order[]>;
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('getOrders');
        if (Array.isArray(data)) {
          return data.map((row: any) => ({
            id: row.id,
            date: row.date,
            submissionKeyHash: row.submissionKeyHash || '',
            scheduledTo: row.scheduledTo || undefined,
            refusalReason: row.refusalReason || undefined,
            customer: row.customer || {
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
          const data = docSnap.data() || {};
          return {
            id: docSnap.id,
            date: data.date,
            submissionKeyHash: data.submissionKeyHash || '',
            scheduledTo: data.scheduledTo || undefined,
            acknowledgedAt: data.acknowledgedAt || undefined,
            refusalReason: data.refusalReason || undefined,
            customer: data.customer || { name: '', phone: '', address: '' },
            total: Number(data.total) || 0,
            itemsSummary: data.itemsSummary || '',
            items: typeof data.items === 'string' ? JSON.parse(data.items || '[]') : data.items || [],
            paymentMethod: data.paymentMethod || '',
            payment: data.payment,
            status: data.status || 'pendente',
            type: data.type || '',
            userId: data.userId || '',
            archived: data.archived === true
          };
        }) as Order[];
      } catch (e) {
        console.error("Turso Error fetching orders:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    return orders;
  },
  getById: async (id: string): Promise<Order | null> => {
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const orders = await OrderRepo.getAll();
        return orders.find(o => o.id === id) || null;
      } catch (e) {
        console.error("Google Sheets Error getting order status:", e);
      }
    } else if (db) {
      try {
        const docSnap = await getDoc(doc(db, 'orders', id));
        if (docSnap.exists) {
          const data = docSnap.data() || {};
          return {
            id: docSnap.id,
            date: data.date,
            submissionKeyHash: data.submissionKeyHash || '',
            scheduledTo: data.scheduledTo || undefined,
            acknowledgedAt: data.acknowledgedAt || undefined,
            refusalReason: data.refusalReason || undefined,
            customer: data.customer || { name: '', phone: '', address: '' },
            total: Number(data.total) || 0,
            itemsSummary: data.itemsSummary || '',
            items: typeof data.items === 'string' ? JSON.parse(data.items || '[]') : data.items || [],
            paymentMethod: data.paymentMethod || '',
            payment: data.payment,
            status: data.status || 'pendente',
            type: data.type || '',
            userId: data.userId || '',
            archived: data.archived === true
          } as Order;
        }
        return null;
      } catch (e) {
        console.error("Turso Error getting order status:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    return orders.find((o: Order) => o.id === id) || null;
  },
  getByUserId: async (userId: string): Promise<Order[]> => {
    if (db) return db.customerOrders(userId) as Promise<Order[]>;
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('getUserOrders', undefined, { userId });
        if (Array.isArray(data)) {
          return data.map((row: any) => ({
            id: row.id,
            date: row.date,
            submissionKeyHash: row.submissionKeyHash || '',
            scheduledTo: row.scheduledTo || undefined,
            refusalReason: row.refusalReason || undefined,
            customer: row.customer || {
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
        const q = query(collection(db, 'orders'), where('userId', '==', userId)).orderBy('date').limit(50);
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnap => {
          const data = docSnap.data() || {};
          return {
            id: docSnap.id,
            ...data,
            total: Number(data.total) || 0,
            items: typeof data.items === 'string' ? JSON.parse(data.items || '[]') : data.items || [],
          };
        }).filter((o: any) => !o.archived) as Order[];
      } catch (e) {
        console.error("Turso Error fetching user orders:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    return orders.filter((o: Order) => o.userId === userId && !o.archived);
  },
  create: async (order: Order) => {
    const formattedOrder = {
      ...order,
      date: order.date || new Date().toISOString(),
      status: 'pendente',
      acknowledgedAt: undefined,
      archived: false
    };

    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
          items: JSON.stringify(formattedOrder.items || []),
          submissionKeyHash: formattedOrder.submissionKeyHash, scheduledTo: formattedOrder.scheduledTo || ''
        });
        return;
      } catch (e) {
        console.error("Google Sheets Error creating order:", e);
      }
    } else if (db) {
      try {
        await doc(db, 'orders', formattedOrder.id).create(formattedOrder);
        return;
      } catch (e) {
        console.error("Turso Error creating order:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    orders.push(formattedOrder);
    requireLocalStorage();
    await fs.writeJson(FILES.orders, orders);
  },
  update: async (order: Order) => {
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
        console.error("Turso Error updating order:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    const index = orders.findIndex((o: Order) => o.id === order.id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...order };
      requireLocalStorage();
    await fs.writeJson(FILES.orders, orders);
    }
  },
  updateStatus: async (id: string, status: string) => {
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
        console.error("Turso Error updating status:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    const index = orders.findIndex((o: Order) => o.id === id);
    if (index !== -1) {
      orders[index].status = status;
      requireLocalStorage();
    await fs.writeJson(FILES.orders, orders);
    }
  },
  countActive: async (): Promise<number> => {
    if (db) return db.activeCount();
    const orders = await OrderRepo.getAll();
    return orders.filter((o: Order) => o.status === 'pendente' || o.status === 'preparando').length;
  },
  archive: async (id: string) => {
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
        console.error("Turso Error archiving order:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const orders = await fs.readJson(FILES.orders).catch(() => []);
    const index = orders.findIndex((o: Order) => o.id === id);
    if (index !== -1) {
      orders[index].archived = true;
      requireLocalStorage();
    await fs.writeJson(FILES.orders, orders);
    }
  }
};

// Usuários (Auth via Google Sheets!)
const UserRepo = {
  getById: async (id: string): Promise<User | null> => {
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const users = await UserRepo.getAll();
        return users.find(u => u.id === id) || null;
      } catch (e) {
        console.error("Google Sheets Error getting user by ID:", e);
      }
    } else if (db) {
      try {
        const docSnap = await getDoc(doc(db, 'users', id));
        if (docSnap.exists) {
          return { id: docSnap.id, ...docSnap.data() } as User;
        }
        return null;
      } catch (e) {
        console.error("Turso Error getting user by ID:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const users = await fs.readJson(FILES.users).catch(() => []);
    return users.find((u: User) => u.id === id) || null;
  },
  findByEmail: async (email: string): Promise<User | null> => {
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const users = await UserRepo.getAll();
        return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
      } catch (e) {
        console.error("Google Sheets Error getting user by email:", e);
      }
    } else if (db) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase())).limit(1);
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          return { id: docSnap.id, ...docSnap.data() } as User;
        }
        return null;
      } catch (e) {
        console.error("Turso Error getting user by email:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const users = await fs.readJson(FILES.users).catch(() => []);
    return users.find((u: User) => u.email.toLowerCase() === email.toLowerCase()) || null;
  },
  create: async (user: User) => {
    let savedInTurso = false;
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
        const cleanedUser = cleanRecord({
          ...user,
          email: user.email.toLowerCase()
        });
        await setDoc(doc(db, 'users', user.id), cleanedUser);
        savedInTurso = true;
      } catch (e) {
        console.error("Turso Error creating user:", e);
        throw e;
      }
    }
    if (savedInTurso) return;
    // Arquivo local apenas em desenvolvimento
    requireLocalStorage();
    const users = await fs.readJson(FILES.users).catch(() => []);
    if (!users.some((u: User) => u.id === user.id)) {
      users.push(user);
      requireLocalStorage();
    await fs.writeJson(FILES.users, users);
    }
  },
  getAll: async (): Promise<User[]> => {
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('getUsers');
        if (Array.isArray(data)) {
          return data.map((row: any) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            password: row.password || '',
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
        const databaseUsers = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })) as User[];
        return databaseUsers;
      } catch (e) {
        console.error("Turso Error listing users:", e);
        throw e;
      }
    }
    requireLocalStorage();
    return fs.readJson(FILES.users).catch(() => []);
  },
  update: async (user: Partial<User> & { id: string }) => {
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        // Buscamos o usuário para atualizar as propriedades e mandar de volta
        const existing = await UserRepo.getById(user.id);
        if (existing) {
          const updated = { ...existing, ...user };
          await callGAS('updateUser', {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            password: updated.password || '',
            phone: updated.phone || '',
            address: updated.address || '', cart: updated.cart || '[]'
          });
        }
        return;
      } catch (e) {
        console.error("Google Sheets Error updating user:", e);
      }
    } else if (db) {
      try {
        const cleanedUser = cleanRecord(user);
        await setDoc(doc(db, 'users', user.id), cleanedUser, { merge: true });
        return;
      } catch (e) {
        console.error("Turso Error updating user:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const users = await fs.readJson(FILES.users).catch(() => []);
    const index = users.findIndex((u: User) => u.id === user.id);
    if (index !== -1) {
      users[index] = { ...users[index], ...user };
      requireLocalStorage();
    await fs.writeJson(FILES.users, users);
    }
  }
};

// Configurações
async function loadConfigs(): Promise<Record<string, string>> {
    let configObj: Record<string, string> = {};
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
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
        console.error("Turso Error fetching configs:", e);
        throw e;
      }
    }
    
    if (Object.keys(configObj).length === 0 && !db) {
      requireLocalStorage();
    const configs = await fs.readJson(FILES.configs).catch(() => []);
      configs.forEach((c: Config) => configObj[c.key] = c.value);
    }

    return Object.freeze(configObj);
}
const configCache = db ? new RevisionCache(() => db.configRevision(), loadConfigs) : null;
const ConfigRepo = {
  getAll: () => configCache ? configCache.read() : loadConfigs(),
  update: async (key: string, value: string) => {
    if (db && key === "story_image") value = await separateImage(db, value) || "";
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        await callGAS('updateConfig', { key, value });
        configCache?.invalidate();
        return;
      } catch (e) {
        console.error("Google Sheets Error updating config:", e);
      }
    } else if (db) {
      try {
        await setDoc(doc(db, 'configs', key), { value });
        configCache?.invalidate();
        return;
      } catch (e) {
        console.error("Turso Error updating config:", e);
        throw e;
      }
    }
    requireLocalStorage();
    const configs = await fs.readJson(FILES.configs).catch(() => []);
    const index = configs.findIndex((c: Config) => c.key === key);
    if (index !== -1) {
      configs[index].value = value;
    } else {
      configs.push({ key, value });
    }
    requireLocalStorage();
    await fs.writeJson(FILES.configs, configs);
    configCache?.invalidate();
  },
  updateMany: async (updates: Record<string,string>) => {
    if (db) {
      await db.client.batch(Object.entries(updates).map(([key,value])=>({sql:'INSERT INTO configs(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',args:[key,JSON.stringify({value})]})),'write');
    } else {
      requireLocalStorage();
      if (process.env.GOOGLE_SHEETS_SCRIPT_URL) throw new Error('O salvamento em conjunto exige o banco atual da loja.');
      const configs: Config[] = await fs.readJson(FILES.configs).catch(()=>[]);
      for (const [key,value] of Object.entries(updates)) {
        const index = configs.findIndex(config=>config.key===key);
        if (index < 0) configs.push({key,value}); else configs[index].value=value;
      }
      await fs.writeJson(FILES.configs,configs);
    }
    configCache?.invalidate();
  },
};


// --- Web Push Keys ---
const vapidKeys = {
  publicKey: '',
  privateKey: ''
};

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const closedOrderMessage = 'A loja está fechada para pedidos imediatos. Escolha uma entrega agendada dentro do expediente.';
function acceptsImmediateOrders(configs: Record<string, string>) {
  // Stored settings cannot enable the development-only opening bypass online.
  return storeAvailability({...configs, preview_mode: process.env.DELIVERY_PREVIEW_MODE === 'true' && !isVercel ? 'true' : 'false'}).open;
}

async function initWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error('As chaves de notificações ainda precisam ser configuradas.');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:ale.sobral.cortes@gmail.com', publicKey, privateKey);
  vapidKeys.publicKey = publicKey;
  vapidKeys.privateKey = privateKey;
}

async function sendPushNotification(subscription: PushSubscription, payload: any) {
  try {
    await ensureWebPush();
    await webpush.sendNotification(subscription, JSON.stringify(payload), { timeout: 10000 });
    return true;
  } catch (e: any) {
    console.error('Erro ao enviar notificação:', e.statusCode || 'network');
    if (e.statusCode === 410 || e.statusCode === 404) {
      await PushSubscriptionRepo.delete(subscription.endpoint);
    }
    return false;
  }
}

async function notifyAdmins(title: string, body: string, url: string = '/#vovo-secreta') {
  const subscriptions = await PushSubscriptionRepo.getAll();
  const adminSubs = subscriptions.filter(s => s.role === 'admin');
  for (const sub of adminSubs) {
    await sendPushNotification(sub, { title, body, url });
  }
}

// Inicializa Web Push
let pushReady: Promise<void> | undefined;
function ensureWebPush() {
  return pushReady ||= initWebPush().catch(error => { pushReady = undefined; throw error; });
}
function backgroundNotification(task: Promise<unknown>) {
  const safeTask = task.catch(() => console.error('Falha ao enviar avisos de pedidos.'));
  if (isVercel) waitUntil(safeTask);
}

const app = express.Router();
configureAdminCredentials(adminCredentialStore(db, DATA_DIR, requireLocalStorage));

// Middleware
app.use(cors());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
app.use((req,res,next)=>req.path==='/admin/login'?next():prepareAdminCredential(req,res,next));
app.post('/admin/login', loginLimiter, prepareAdminCredential, loginAdmin);
app.post('/admin/password', requireAdminWrite, rateLimit({windowMs:15*60*1000,limit:6,standardHeaders:'draft-7',legacyHeaders:false}), async (req,res) => {
  try { await changeAdminPassword(req,res); }
  catch { res.status(503).json({error:'Não foi possível alterar a senha. Confira a conexão e tente novamente.'}); }
});
app.get('/admin/session', requireAdmin, (_req, res) => res.json({ authenticated: true }));
app.post('/admin/logout', requireAdminWrite, logoutAdmin);
app.use('/admin', requireAdminWrite);

// --- Rotas de Push ---
app.get('/push/public-key', async (_req, res) => {
  try {
    await ensureWebPush(); res.setHeader('Cache-Control', 'no-store');
    res.json({ publicKey: vapidKeys.publicKey });
  } catch { res.status(503).json({ error: 'As notificações ainda precisam ser configuradas.' }); }
});

app.post('/push/subscribe', async (req, res) => {
  try {
    const { subscription, role } = req.body;
    if (role !== 'admin') return res.status(403).json({ error: 'Os avisos de pedidos são exclusivos do painel da Vovó.' });
    if (!hasAdminSession(req) || req.headers['x-vovo-admin'] !== '1') return res.status(401).json({ error: 'Entre no painel para ativar os alertas.' });
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return res.status(400).json({ error: 'Cadastro de notificações inválido.' });
    }
    let endpoint: URL;
    try { endpoint = new URL(subscription.endpoint); } catch { return res.status(400).json({ error: 'Endpoint inválido.' }); }
    const trustedHost = endpoint.hostname === 'fcm.googleapis.com' ||
      endpoint.hostname === 'updates.push.services.mozilla.com' ||
      endpoint.hostname.endsWith('.notify.windows.com') || endpoint.hostname.endsWith('.push.apple.com');
    if (endpoint.protocol !== 'https:' || endpoint.port || endpoint.username || endpoint.password || !trustedHost) {
      return res.status(400).json({ error: 'Serviço de notificações não reconhecido.' });
    }
    await ensureWebPush();
    await PushSubscriptionRepo.add({ endpoint: subscription.endpoint, keys: subscription.keys, userId: 'admin-user', role: 'admin' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const mercadoPago = process.env.MERCADO_PAGO_ACCESS_TOKEN && process.env.MERCADO_PAGO_SELLER_ID && ['test','live'].includes(process.env.MERCADO_PAGO_MODE || '')
  ? new MercadoPago({accessToken:process.env.MERCADO_PAGO_ACCESS_TOKEN,sellerId:process.env.MERCADO_PAGO_SELLER_ID,mode:process.env.MERCADO_PAGO_MODE as 'test'|'live'}) : null;
const paymentCheckouts = db ? new PaymentCheckoutStore(db.client) : null;
function paymentOrigin() {
  // Deployment hostname comes from Vercel, never the client-controlled Host header.
  if(process.env.VERCEL_ENV==='production' && !process.env.MERCADO_PAGO_RETURN_ORIGIN) throw new Error('Configure o domínio público da loja para pagamentos.');
  const origin=process.env.MERCADO_PAGO_RETURN_ORIGIN || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  const url=new URL(origin); if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash) throw new Error('Endereço de pagamento incompleto.');
  return url.origin;
}
function mercadoPagoReady() {
  if(!mercadoPago || !paymentCheckouts || !process.env.MERCADO_PAGO_WEBHOOK_SECRET || process.env.MERCADO_PAGO_CHECKOUT_ENABLED!=='true') return false;
  try {paymentOrigin();return true;} catch {return false;}
}
app.get('/payments/config',(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json({provider:mercadoPagoReady()?'mercado_pago':'stripe',mode:process.env.MERCADO_PAGO_MODE==='live'?'live':'test'});
});
const paymentStartLimiter=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:'draft-7',legacyHeaders:false});
async function acceptNewOrder(req:express.Request,res:express.Response) {
  const id=customerId(req);
  const user=id?await UserRepo.getById(id):null;
  if(!id || !user){res.status(401).json({error:'Entre com sua conta ou identifique-se como convidado antes de pedir.'});return null;}
  const previous=currentLegalReceipt(user.legalAcceptance,id);if(previous)return previous;
  try {return legalReceipt(req.body.legalAcceptance,id);}
  catch(error){res.status(400).json({error:error instanceof Error?error.message:'Confira os documentos do pedido.'});return null;}
}
app.post('/payments/mercado-pago/checkout',paymentStartLimiter,async(req,res)=>{
  if(!mercadoPagoReady()) return res.status(503).json({error:'O cartão ainda está sendo configurado. Use Pix por enquanto.'});
  try {
    const input=req.body; const key=req.headers['x-order-request'];
    if(typeof input.id!=='string' || !/^[a-zA-Z0-9-]{8,64}$/.test(input.id) || typeof key!=='string' || !/^[a-zA-Z0-9-]{32,64}$/.test(key)) return res.status(400).json({error:'Reabra a sacola para iniciar o pagamento.'});
    const existing=await paymentCheckouts!.get(input.id);
    if(existing) {
      if(!hasPaymentCheckoutAccess(existing,key)) return res.status(409).json({error:'Este pagamento pertence a outra sacola.'});
      if(!existing.checkoutUrl) return res.status(409).json({error:'Pagamento em preparação. Aguarde antes de tentar novamente.'});
      return res.json({id:input.id,checkoutUrl:existing.checkoutUrl,mode:process.env.MERCADO_PAGO_MODE});
    }
    if(await OrderRepo.getById(input.id)) return res.status(409).json({error:'Este pedido já foi recebido. Consulte o acompanhamento.'});
    const acceptance=await acceptNewOrder(req,res);if(!acceptance)return;
    if(!validCustomerName(input.customer?.name) || typeof input.customer?.phone!=='string' || !/^\d{10,13}$/.test(input.customer.phone.replace(/\D/g,'')) ||
       typeof input.customer?.address!=='string' || input.customer.address.length<10 || input.customer.address.length>500) return res.status(400).json({error:'Confira nome, WhatsApp e endereço antes de pagar.'});
    const configs=await ConfigRepo.getAll();
    const scheduledTo=validateSchedule(input.scheduledTo,configs);
    if(!scheduledTo && !acceptsImmediateOrders(configs)) return res.status(409).json({error:closedOrderMessage});
    const priced=priceOrder(input,await ProductRepo.getAll(),configs);
    if(!Number.isFinite(input.total) || Math.abs(input.total-priced.total)>0.009) return res.status(409).json({error:'Os valores mudaram. Reabra a sacola e confira.'});
    const requestHash=paymentRequestHash(key);
    const order={...priced,id:input.id,customer:{name:customerName(input.customer.name),phone:input.customer.phone,address:input.customer.address},
      type:input.type,userId:acceptance.userId,legalAcceptance:acceptance,scheduledTo,submissionKeyHash:requestHash,
      timing:{createdAt:new Date().toISOString()},itemsSummary:priced.items.map((item:any)=>`${item.quantity}x ${item.name}`).join(', ')};
    const checkout={orderId:input.id,requestHash,order,total:priced.total,fingerprint:checkoutFingerprint(priced,order.customer.address,scheduledTo)};
    if(!await paymentCheckouts!.create(checkout)) return res.status(409).json({error:'Pagamento em preparação. Aguarde antes de tentar novamente.'});
    const origin=paymentOrigin();
    const preference=await mercadoPago!.createPreference(checkout,origin,`${origin}/api/payments/mercado-pago/webhook`);
    await paymentCheckouts!.savePreference(checkout.orderId,preference);
    return res.json({id:checkout.orderId,checkoutUrl:preference.checkoutUrl,mode:preference.mode});
  } catch {return res.status(400).json({error:'Não foi possível preparar o cartão. Confira a sacola ou escolha Pix.'});}
});

async function reconcileMercadoPago(paymentId:string, expectedOrderId?:string) {
  const payment=await mercadoPago!.getPayment(paymentId);
  if(expectedOrderId && payment.external_reference!==expectedOrderId) throw new Error('Pagamento não corresponde à sacola.');
  if(typeof payment.external_reference!=='string') return false;
  const checkout=await paymentCheckouts!.get(payment.external_reference);
  if(!checkout) return false;
  const verified=await mercadoPago!.verifyPayment(payment,checkout);
  if(!verified.approved || !verified.paymentId) {
    const state=Number(payment.transaction_amount_refunded)>0?'refunded':String(payment.status);
    if(['refunded','charged_back','cancelled'].includes(state) && await paymentCheckouts!.revokePayment(checkout.orderId,String(payment.id),state)) {
      backgroundNotification(notifyAdmins('Confira o pagamento',`Pedido #${checkout.orderId.slice(-4)}: pagamento devolvido ou contestado. Abra o painel.`,`/?order=${encodeURIComponent(checkout.orderId)}#vovo-secreta`));
    }
    return {approved:false,status:state};
  }
  const result=await paymentCheckouts!.finalize(checkout,verified.paymentId,verified.paymentType);
  if(result.created) backgroundNotification(notifyAdmins('Novo pedido',`Pedido #${checkout.orderId.slice(-4)}. Abra o painel para conferir.`,`/?order=${encodeURIComponent(checkout.orderId)}#vovo-secreta`));
  return {approved:true,status:'approved'};
}
app.post('/payments/mercado-pago/webhook',async(req,res)=>{
  if(!mercadoPagoReady()) return res.sendStatus(503);
  const id=req.query['data.id'];
  if(!validMercadoPagoSignature(process.env.MERCADO_PAGO_WEBHOOK_SECRET||'',req.headers['x-signature'],req.headers['x-request-id'],id)) return res.sendStatus(401);
  if(req.body.type!=='payment' || String(req.body.data?.id)!==id) return res.sendStatus(400);
  try {await reconcileMercadoPago(String(id));return res.sendStatus(200);}
  catch {return res.sendStatus(503);}
});
app.post('/payments/mercado-pago/:id/status',rateLimit({windowMs:60000,limit:10,standardHeaders:'draft-7',legacyHeaders:false}),async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(!mercadoPagoReady()) return res.status(503).json({error:'O cartão ainda está sendo configurado.'});
  try {
    const id=String(req.params.id);const checkout=await paymentCheckouts!.get(id);
    if(!checkout || !hasPaymentCheckoutAccess(checkout,req.headers['x-order-request'])) return res.status(401).json({error:'Abra o pagamento pelo aparelho em que iniciou a compra.'});
    const paymentState=req.body.paymentId ? await reconcileMercadoPago(String(req.body.paymentId),id) : null;
    const order=await OrderRepo.getById(id);
    if(!order) return res.json({status:'pending',paymentState:paymentState && paymentState.status,checkoutUrl:checkout.checkoutUrl});
    if(order.submissionKeyHash!==checkout.requestHash || !/^(Cartão|Saldo) Online Mercado Pago/.test(order.paymentMethod||'')) return res.status(409).json({error:'Este pedido precisa ser conferido pela loja.'});
    if(!order.payment?.paid) return res.json({status:'pending',paymentState:'refunded'});
    const {submissionKeyHash: _privateHash,...publicOrder}=order;
    return res.json({status:'approved',order:{...publicOrder,timing:checkout.order.timing,accessToken:orderToken(id)}});
  } catch {return res.status(400).json({error:'Não foi possível confirmar o pagamento. Tente consultar novamente.'});}
});

// --- Rotas de Pagamento (Stripe) ---
app.post('/create-payment-intent', async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe não está configurado no servidor." });
  }

  try {
    if(!await acceptNewOrder(req,res))return;
    if (!validCustomerName(req.body.customer?.name)) return res.status(400).json({error:'Informe seu nome antes de pagar.'});
    const configs = await ConfigRepo.getAll();
    try { req.body.scheduledTo = validateSchedule(req.body.scheduledTo,configs); }
    catch(error) { return res.status(400).json({error:error instanceof Error ? error.message : 'Confira o agendamento.'}); }
    if (!req.body.scheduledTo && !acceptsImmediateOrders(configs)) return res.status(409).json({error:closedOrderMessage});
    const priced = priceOrder(req.body, await ProductRepo.getAll(), configs);
    if (!Number.isFinite(req.body.total) || Math.abs(req.body.total - priced.total) > 0.009) return res.status(409).json({ error: 'Os valores mudaram. Reabra a sacola e confira o pedido.' });
    const orderId = uuidv4();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(priced.total * 100),
      currency: 'brl',
      metadata: { orderId, checkout: checkoutFingerprint(priced, req.body.customer?.address || '', req.body.scheduledTo) },
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret, orderId });
  } catch (error: any) {
    console.error("Erro no Stripe:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health Check
app.get('/health', (_req, res) => res.json({ status: db || process.env.GOOGLE_SHEETS_SCRIPT_URL || !isVercel ? 'ok' : 'unavailable' }));

// --- Rotas de Produtos ---
app.get('/media/:id', async (req, res) => {
  if (!db || !/^[a-f0-9]{64}$/.test(String(req.params.id))) return res.sendStatus(404);
  try {
    const image = await doc(db, 'media', String(req.params.id)).get();
    if (!image.exists) return res.sendStatus(404);
    const data = image.data();
    res.setHeader('Content-Type', data.type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(Buffer.from(data.base64, 'base64'));
  } catch { return res.sendStatus(503); }
});

app.get('/products', async (req, res) => {
  try {
    const products = await ProductRepo.getAll();
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/products', requireAdminWrite, async (req, res) => {
  try {
    const product = req.body;
    if (!product.id) product.id = uuidv4();
    await ProductRepo.add(product);
    res.json({ success: true, id: product.id });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put('/products/:id', requireAdminWrite, async (req, res) => {
  try {
    const product = { ...req.body, id: String(req.params.id) };
    await ProductRepo.update(product);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete('/products/:id', requireAdminWrite, async (req, res) => {
  try {
    await ProductRepo.delete(String(req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Rotas de Pedidos ---
app.get('/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await OrderRepo.getAll();
    const activeOrders = orders.filter(o => !o.archived);
    res.json(activeOrders);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/orders/history', requireAdmin, async (req, res) => {
  try {
    if (db) return res.json(await db.history(typeof req.query.cursor === 'string' ? req.query.cursor : undefined));
    const all = (await OrderRepo.getAll()).filter(order => !order.archived).sort((a,b) => String(b.date).localeCompare(String(a.date)) || b.id.localeCompare(a.id));
    const index = req.query.cursor ? all.findIndex(order => order.id === req.query.cursor) + 1 : 0;
    const page = all.slice(index, index + 100);
    return res.json({ orders: page, nextCursor: all.length > index + 100 ? page.at(-1)?.id : null });
  } catch { res.status(503).json({ error: 'Não foi possível carregar o histórico.' }); }
});
app.get('/admin/finance', async (req, res) => {
  try {
    const since = typeof req.query.since === 'string' ? req.query.since : '';
    if (since && (!Number.isFinite(Date.parse(since)) || since.length > 40)) return res.sendStatus(400);
    if (db) return res.json(await db.finance(since));
    const orders = (await OrderRepo.getAll()).filter(order => order.status === 'concluido' && (!since || String(order.date) >= since));
    const total = (values: Order[]) => values.reduce((sum, order) => sum + Number(order.total),0);
    res.json({ count: orders.length, totalRevenue: total(orders), pixRevenue: total(orders.filter(order => order.paymentMethod.toLowerCase().includes('pix'))),
      cardRevenue: total(orders.filter(order => /cart|stripe/i.test(order.paymentMethod))), recent: orders.sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0,20) });
  } catch { res.status(503).json({ error: 'Não foi possível carregar o financeiro.' }); }
});

app.get('/orders/batch/status', rateLimit({ windowMs: 60000, limit: 60, legacyHeaders: false }), async (req, res) => {
  try {
    const ids = (req.query.ids as string || '').split(',').filter(id => id.trim().length > 0);
    if (!ids.length) return res.json({});
    
    if (ids.length > 50) return res.status(400).json({ error: 'Consulte no máximo 50 pedidos.' });
    const details = req.query.details === '1';
    if (db) return res.json(await db.statuses(ids,details));
    const orders = await OrderRepo.getAll();
    const statuses: Record<string, unknown> = {};
    orders.forEach((o: any) => {
      if (ids.includes(o.id)) statuses[o.id] = details ? {status:o.status,acknowledgedAt:o.acknowledgedAt || null} : o.status;
    });
    res.json(statuses);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/orders/:id/status', async (req, res) => {
  try {
    const order = await OrderRepo.getById(String(req.params.id));
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json({ status: order.status });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/orders/user/:userId', requireCustomer, async (req, res) => {
  try {
    const orders = await OrderRepo.getByUserId(String(req.params.userId));
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/orders', async (req, res) => {
  try {
    const order = req.body;
    if (!order.id) order.id = uuidv4();
    if (typeof order.id !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(order.id) ||
        !order.customer?.name || !order.customer?.phone || !order.customer?.address ||
        !Array.isArray(order.items) || !order.items.length || !Number.isFinite(order.total) || order.total < 0) {
      return res.status(400).json({ error: 'Confira os itens e os dados do pedido.' });
    }
    const requestKey = req.headers['x-order-request'];
    if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9-]{32,64}$/.test(requestKey)) return res.status(400).json({ error: 'Reabra a sacola e tente novamente.' });
    const submissionKeyHash = createHash('sha256').update(requestKey).digest('hex');
    const accessToken = orderToken(order.id);
    const existing = await OrderRepo.getById(order.id);
    if (existing) {
      const previousToken = req.headers['x-order-token'];
      if (previousToken !== accessToken && existing.submissionKeyHash !== submissionKeyHash) return res.status(409).json({ error: 'Este pedido já foi recebido. Consulte o acompanhamento.' });
      return res.json({ success: true, id: order.id, accessToken });
    }
    if(paymentCheckouts && await paymentCheckouts.get(order.id)) return res.status(409).json({error:'Este pedido está vinculado ao pagamento por cartão. Consulte o pagamento antes de enviar novamente.'});
    const acceptance=await acceptNewOrder(req,res);if(!acceptance)return;
    order.legalAcceptance=acceptance;
    if (isVercel && !db && !process.env.GOOGLE_SHEETS_SCRIPT_URL) throw new Error('Banco indisponível.');
    if (!validCustomerName(order.customer.name)) return res.status(400).json({ error: 'Informe seu nome antes de enviar o pedido.' });
    order.customer.name = customerName(order.customer.name);
    const configs = await ConfigRepo.getAll();
    try { order.scheduledTo = validateSchedule(order.scheduledTo,configs); }
    catch(error) { return res.status(400).json({error:error instanceof Error ? error.message : 'Confira o agendamento.'}); }
    const paymentMethod = order.payment?.method ?? 'pix';
    if (!['pix', 'cartao_online', 'dinheiro'].includes(paymentMethod)) return res.status(400).json({ error: 'Escolha uma forma de pagamento válida.' });
    // A card may have succeeded just as the shop closed. Its Stripe receipt is
    // still verified below; only initiation is blocked outside opening hours.
    if (!order.scheduledTo && paymentMethod !== 'cartao_online' && !acceptsImmediateOrders(configs)) return res.status(409).json({error:closedOrderMessage});
    if (paymentMethod === 'dinheiro' && configs.cash_enabled !== 'true') return res.status(400).json({ error: 'A loja não está aceitando dinheiro. Escolha Pix ou cartão online.' });
    let priced;
    try { priced = priceOrder(order, await ProductRepo.getAll(), configs); }
    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Confira a sacola.' }); }
    if (Math.abs(order.total - priced.total) > 0.009) return res.status(409).json({ error: 'Os valores mudaram. Reabra a sacola e confira o pedido.' });
    Object.assign(order, priced);
    order.date = new Date().toISOString();
    order.submissionKeyHash = submissionKeyHash;
    if (order.payment?.method === 'cartao_online') {
      if (!stripe || typeof order.paymentIntentId !== 'string') return res.status(400).json({ error: 'Pagamento não confirmado.' });
      const payment = await stripe.paymentIntents.retrieve(order.paymentIntentId);
      if (payment.status !== 'succeeded' || payment.currency !== 'brl' || payment.amount !== Math.round(order.total * 100) || payment.metadata.orderId !== order.id || payment.metadata.checkout !== checkoutFingerprint(priced, order.customer.address, order.scheduledTo)) return res.status(400).json({ error: 'Pagamento não corresponde ao pedido.' });
      order.paymentMethod = `Cartão Online (Pago - ID: ${payment.id})`;
      order.payment = { method: 'cartao_online', paid: true };
    } else if (paymentMethod === 'dinheiro') {
      const changeFor = order.payment.changeFor;
      if (changeFor !== undefined && (typeof changeFor !== 'number' || !Number.isFinite(changeFor) || !Number.isSafeInteger(Math.round(changeFor * 100)) || changeFor < order.total)) return res.status(400).json({ error: 'O valor para troco deve cobrir o total do pedido.' });
      order.paymentMethod = changeFor === undefined ? 'Dinheiro na entrega (Valor exato)' : `Dinheiro na entrega (Troco para R$ ${changeFor.toFixed(2)})`;
      order.payment = { method: 'dinheiro', paid: false, ...(changeFor === undefined ? {} : { changeFor }) };
    } else { order.paymentMethod = 'Pix (Conferir Recibo)'; order.payment = { method: 'pix', paid: false }; }
    order.status = 'pendente'; order.archived = false; order.userId = customerId(req) || '';
    await OrderRepo.create(order);
    
    backgroundNotification(notifyAdmins('Novo pedido', `Pedido #${order.id.slice(-4)}. Abra o painel para conferir.`, `/?order=${encodeURIComponent(order.id)}#vovo-secreta`));
    res.json({ success: true, id: order.id, accessToken });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put('/orders/:id', requireAdminWrite, async (req, res) => {
  try {
    const order = req.body;
    order.id = String(req.params.id);
    
    if (order.status === 'pendente') {
      order.date = new Date().toISOString();
    }
    
    await OrderRepo.update(order);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/orders/:id/acknowledge', requireAdminWrite, async (req, res) => {
  try {
    const current = await OrderRepo.getById(String(req.params.id));
    if (!current) return res.status(404).json({error:'Pedido não encontrado.'});
    if (current.status !== 'pendente' || current.archived) return res.status(409).json({error:'Este pedido não está aguardando confirmação.'});
    if (current.acknowledgedAt) return res.json({success:true,acknowledgedAt:current.acknowledgedAt});
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) return res.status(503).json({error:'Confirmação indisponível no banco legado.'});
    const acknowledgedAt = new Date().toISOString();
    if (db) await updateDoc(doc(db,'orders',current.id),{acknowledgedAt});
    else await OrderRepo.update({...current,acknowledgedAt});
    res.json({success:true,acknowledgedAt});
  } catch { res.status(503).json({error:'Não foi possível confirmar o pedido. Tente novamente.'}); }
});

app.post('/orders/:id/payment/confirm', requireAdminWrite, async (req, res) => {
  try {
    const current = await OrderRepo.getById(String(req.params.id));
    if (!current) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (!current.payment || !['pix','dinheiro'].includes(current.payment.method) || ['cancelado','recusado','pix_recusado'].includes(current.status)) return res.status(409).json({ error: 'Este pagamento não pode ser confirmado manualmente.' });
    if (current.payment.paid === true) return res.json({success:true,payment:current.payment});
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) return res.status(503).json({ error: 'Confirmação indisponível no banco legado.' });
    const payment = {...current.payment, paid:true, verifiedAt:new Date().toISOString()};
    if (db) await updateDoc(doc(db,'orders',current.id), {payment});
    else await OrderRepo.update({...current,payment});
    res.json({success:true,payment});
  } catch { res.status(503).json({error:'Não foi possível confirmar o recebimento. Tente novamente.'}); }
});

app.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!hasOrderAccess(req) && customerId(req) !== (await OrderRepo.getById(String(req.params.id)))?.userId) return res.status(401).json({ error: 'Este aparelho não tem acesso a esse pedido.' });
    if (hasAdminSession(req) && req.headers['x-vovo-admin'] !== '1') return res.status(403).json({ error: 'Solicitação inválida.' });
    const current = await OrderRepo.getById(String(req.params.id));
    if (!current) return res.status(404).json({ error: 'Pedido não encontrado.' });
    if (status === 'concluido' && current.payment?.method === 'dinheiro' && current.payment.paid !== true) return res.status(409).json({error:'Confirme o dinheiro recebido antes de finalizar o pedido.'});
    if (!hasAdminSession(req) && (status !== 'cancelado' || current.status !== 'pendente')) {
      return res.status(403).json({ error: 'O preparo já começou. Entre em contato com a loja.' });
    }
    if (!['pendente', 'preparando', 'forno', 'entrega', 'saiu_entrega', 'concluido', 'cancelado', 'pix_recusado', 'recusado'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido.' });
    }
    await OrderRepo.updateStatus(String(req.params.id), status);
    
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/orders/:id/receive', async (req, res) => {
  try {
    if (!hasOrderAccess(req)) return res.status(401).json({ error: 'Este aparelho não tem acesso a esse pedido.' });
    const order = await OrderRepo.getById(String(req.params.id));
    if (!order || !['entrega', 'saiu_entrega'].includes(order.status)) return res.status(409).json({ error: 'O pedido ainda não saiu para entrega.' });
    if (order.payment?.method === 'dinheiro' && order.payment.paid !== true) return res.status(409).json({error:'A loja ainda precisa confirmar o dinheiro recebido. Entre em contato para concluir.'});
    await OrderRepo.updateStatus(String(req.params.id), 'concluido');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/orders/:id/archive', requireAdminWrite, async (req, res) => {
  try {
    await OrderRepo.archive(String(req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const publicUser = (user: User) => { const { password, ...profile } = user; return profile; };
app.get('/auth/session',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const id=customerId(req);if(!id)return res.status(401).json({error:'Identifique-se para continuar.'});
  try {const user=await UserRepo.getById(id);if(!user)return res.status(401).json({error:'Identifique-se novamente.'});return res.json({success:true,user:publicUser(user),legalVersion:LEGAL_VERSION});}
  catch {return res.status(503).json({error:'Não foi possível conferir seu acesso. Tente novamente.'});}
});
app.use('/auth',(req,res,next)=>{
  if(req.method==='GET')return next();
  const origin=req.headers.origin;
  if(req.headers['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Use o site da loja para se identificar.'});
  if(origin){try {const source=new URL(origin);if(!['http:','https:'].includes(source.protocol)||source.host!==(req.headers.host||'').toLowerCase())throw new Error();}catch{return res.status(403).json({error:'Use o site da loja para se identificar.'});}}
  next();
});
app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, legacyHeaders: false }));
app.post('/auth/guest',async(req,res)=>{
  try {
    const name=customerName(req.body.name),phone=typeof req.body.phone==='string'?req.body.phone.replace(/\D/g,''):'';
    if(!validCustomerName(name) || name.length>100 || !/^(?:\d{10,11}|55\d{10,11})$/.test(phone))return res.status(400).json({error:'Informe seu nome e WhatsApp com DDD para continuar.'});
    orderToken('configuration-check');
    const currentId=customerId(req);const previous=currentId?.startsWith('CONV-')?await UserRepo.getById(currentId):null;
    const user={...(previous||{}),id:previous?.id||'CONV-'+uuidv4(),name,phone,email:'',password:'',address:previous?.address||'',cart:previous?.cart||'[]'};
    if(previous)await UserRepo.update(user);else await UserRepo.create(user);
    setCustomerSession(res,user.id);res.setHeader('Cache-Control','no-store');return res.json({success:true,user:publicUser(user)});
  } catch {return res.status(503).json({error:'Não foi possível registrar seu acesso de convidado. Tente novamente.'});}
});
app.post('/auth/legal-acceptance',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try {
    const id=customerId(req),user=id?await UserRepo.getById(id):null;
    if(!id||!user)return res.status(401).json({error:'Identifique-se antes de aceitar os documentos.'});
    const previous=currentLegalReceipt(user.legalAcceptance,id);
    let receipt=previous;
    if(!receipt){try{receipt=legalReceipt(req.body.legalAcceptance,id);}catch{return res.status(400).json({error:'Leia e aceite a versão atual dos documentos.'});}await UserRepo.update({id,legalAcceptance:receipt});}
    return res.json({success:true,legalAcceptance:receipt});
  } catch{return res.status(503).json({error:'Não foi possível registrar o aceite. Tente novamente antes de pagar.'});}
});
app.post('/auth/logout', (_req, res) => { res.clearCookie('vovo_customer_session', { path: '/' }); res.json({ success: true }); });

// --- Autenticação via Google Sheets ---
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Preencha nome, e-mail e uma senha com pelo menos 8 caracteres.' });
    orderToken('configuration-check');
    const storedPassword = await hashPassword(password);
    
    if (!db && process.env.GOOGLE_SHEETS_SCRIPT_URL) {
      try {
        const data = await callGAS('register', { name, email, password: storedPassword, phone, address });
        if (data && data.success) {
          setCustomerSession(res, data.user.id);
          return res.json({ success: true, user: publicUser(data.user) });
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
      password: storedPassword,
      phone: phone || "", 
      address: address || "", 
      cart: '[]' 
    };
    try {
      await UserRepo.create(user);
    } catch (createErr: any) {
      console.error("Erro ao gravar usuário no banco:", createErr);
      return res.status(500).json({ 
        error: 'Não foi possível criar sua conta agora. Tente novamente em alguns instantes.',
        details: createErr.message || String(createErr) 
      });
    }
    if (!user.password?.startsWith('scrypt:')) { user.password = await hashPassword(password); await UserRepo.update(user); }
    setCustomerSession(res, user.id);
    res.json({ success: true, user: publicUser(user) });
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Confira e-mail e senha.' });
    orderToken('configuration-check');

    // Fallback local
    let user;
    try {
      user = await UserRepo.findByEmail(email);
    } catch (fetchErr: any) {
      console.error("Erro ao buscar usuário por email:", fetchErr);
      return res.status(500).json({ 
        error: 'Não foi possível entrar agora. Tente novamente em alguns instantes.',
        details: fetchErr.message || String(fetchErr) 
      });
    }

    if (!user) {
      return res.status(401).json({ error: 'E-mail não cadastrado.' });
    }
    if (!user.password || !await verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    if (!user.password.startsWith('scrypt:')) { user.password = await hashPassword(password); await UserRepo.update(user); }
    setCustomerSession(res, user.id);
    res.json({ success: true, user: publicUser(user) });
  } catch (e: any) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/auth/sync', async (req, res) => {
  try {
    const { uid, email, name, phone, isAnonymous } = req.body;
    if (customerId(req) !== uid) return res.status(401).json({ error: 'Entre na sua conta.' });
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
    
    setCustomerSession(res, user.id);
    res.json({ success: true, user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch('/users/:id', requireCustomer, async (req, res) => {
  try {
    const current = await UserRepo.getById(String(req.params.id));
    if (!current) return res.status(404).json({ error: 'Conta não encontrada.' });
    const { name, phone, address, cart } = req.body;
    await UserRepo.update({ ...current, name: name ?? current.name, phone: phone ?? current.phone, address: address ?? current.address, cart: cart ?? current.cart });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- Configurações ---
app.post('/delivery/quote', rateLimit({ windowMs: 60000, limit: 10, legacyHeaders: false }), async (req, res) => {
  try {
    const configs = await ConfigRepo.getAll();
    quoteDelivery(configs, configs.store_lat, configs.store_lng);
    const location = await locateDeliveryAddress(req.body.address);
    const quote = quoteDelivery(configs, location.latitude, location.longitude);
    res.json({ ...quote, token: deliveryToken(req.body.address, location.latitude, location.longitude) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Não foi possível calcular o frete.' });
  }
});

app.get('/configs', async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const allConfigs = await ConfigRepo.getAll();
    const configs = Object.fromEntries(Object.entries(allConfigs).filter(([key]) => !/vapid|secret|password|token|private/i.test(key) && (hasAdminSession(req) || !internalStoreFields.has(key))));
    configs.preview_mode = process.env.DELIVERY_PREVIEW_MODE === 'true' && !process.env.VERCEL ? 'true' : 'false';
    if (!configs['faqs']) configs['faqs'] = '[]';
    if (!configs['testimonials']) {
      configs['testimonials'] = '[]';
    }
    res.json(configs);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/configs', requireAdminWrite, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (typeof key !== 'string' || /vapid|secret|password|token|private/i.test(key)) return res.status(400).json({ error: 'Configuração inválida.' });
    const saved = await ConfigRepo.getAll();
    let validated;
    try { validated = validateStoreConfig(key, value, saved); }
    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Confira a configuração.' }); }
    await ConfigRepo.update(key, validated);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/configs/batch', requireAdminWrite, async (req,res) => {
  const updates=req.body?.updates;
  const allowed=['free_delivery_radius','fee_per_km','max_delivery_radius','opening_start','opening_end','working_days'];
  if (!updates || typeof updates!=='object' || Array.isArray(updates) || !Object.keys(updates).length || !Object.keys(updates).every(key=>allowed.includes(key))) return res.status(400).json({error:'Confira as configurações enviadas.'});
  try {
    const saved=await ConfigRepo.getAll(); const merged={...saved,...updates};
    const validated:Record<string,string>={};
    try { for(const [key,value] of Object.entries(updates)) validated[key]=validateStoreConfig(key,value,merged); }
    catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Confira os valores.'});}
    await ConfigRepo.updateMany(validated);
    res.json({success:true,values:validated});
  }catch{res.status(503).json({error:'Não foi possível salvar. Confira a conexão e tente novamente.'});}
});

// --- Presença, Estatísticas e Visitas ---
app.post('/visits/install',rateLimit({windowMs:15*60*1000,limit:10,legacyHeaders:false}),async(req,res)=>{
  const sessionId=req.body.sessionId;
  if(typeof sessionId!=='string'||!/^session-[a-zA-Z0-9-]{6,64}$/.test(sessionId))return res.status(400).json({error:'Identificador de navegador inválido.'});
  if(VisitRepo.isBot(req.headers['user-agent']||''))return res.json({success:true});
  try {
    const id='install-'+createHash('sha256').update(sessionId).digest('hex');
    const visit={id,sessionId,userId:customerId(req)||'anonymous',isPwa:true,userAgent:'PWA_INSTALL_EVENT',timestamp:new Date().toISOString(),authType:'none'};
    if(db)await db.client.execute({sql:'INSERT INTO visits(id,payload) VALUES (?,?) ON CONFLICT(id) DO NOTHING',args:[id,JSON.stringify(visit)]});
    else {requireLocalStorage();const visits=await fs.readJson(FILES.visits).catch(()=>[]);if(!visits.some((v:Visit)=>v.id===id)){visits.push(visit);await fs.writeJson(FILES.visits,visits);}}
    statsCache=undefined;return res.json({success:true});
  }catch{return res.status(503).json({error:'Não foi possível registrar a instalação.'});}
});
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

let statsCache: { value: any; expires: number } | undefined;
let statsRequest: Promise<any> | undefined;
app.get('/admin/stats', async (req, res) => {
  res.setHeader('Cache-Control','no-store');
  try {
    if (db) {
      if (statsCache && statsCache.expires > Date.now()) return res.json(statsCache.value);
      statsRequest ||= db.stats().then(value => { statsCache = { value, expires: Date.now() + 60000 }; return value; }).finally(() => { statsRequest = undefined; });
      return res.json(await statsRequest);
    }
    const visitStats = await VisitRepo.getStats();
    const onlineUsers = (await PresenceRepo.getAll()).filter(p=>Date.parse(p.lastSeen)>=Date.now()-180000);
    const totalUsers = await UserRepo.getAll();
    const orders = await OrderRepo.getAll();
    const allVisits = await VisitRepo.getAll();
    
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return shopDate(d);
    }).reverse();

    const visitHistory = last7Days.map(date => ({
      date: date.split('-').slice(1).reverse().join('/'),
      count: allVisits.filter(v => {
        const ts = v.timestamp;
        return ts && shopDate(new Date(ts))===date && v.userAgent!=='PWA_INSTALL_EVENT';
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

let prepCache: { value: number; expires: number } | undefined;
let prepRequest: Promise<number> | undefined;
app.get('/stats/prep-time', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const activeRequest = prepCache && prepCache.expires > Date.now()
      ? Promise.resolve(prepCache.value)
      : (prepRequest ||= OrderRepo.countActive().then(value => {
          prepCache = { value, expires: Date.now() + 60000 }; return value;
        }).finally(() => { prepRequest = undefined; }));
    const [activeOrders, configs] = await Promise.all([activeRequest, ConfigRepo.getAll()]);
    res.json({ activeOrders, forecast: configs['kitchen_forecast'] || '40-50 min' });
  } catch { res.status(503).json({ error: 'Previsão indisponível.' }); }
});

app.post('/admin/broadcast-push', async (req, res) => {
  try {
    const { title, body } = req.body;
    const subscriptions = await PushSubscriptionRepo.getAll();
    for (const sub of subscriptions.filter(subscription => subscription.role === 'admin')) {
      await sendPushNotification(sub, { title, body, url: '/#vovo-secreta' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/admin/test-push', async (req, res) => {
  try {
    const { endpoint } = req.body;
    const subscription = (await PushSubscriptionRepo.getAll()).find(sub => sub.endpoint === endpoint && sub.role === 'admin');
    if (!subscription) return res.status(404).json({ error: 'Ative os avisos neste aparelho primeiro.' });
    if (req.body.delaySeconds !== undefined && req.body.delaySeconds !== 10) return res.status(400).json({error:'O teste pode ser imediato ou em 10 segundos.'});
    if (req.body.delaySeconds === 10) {
      backgroundNotification((async () => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        await sendPushNotification(subscription, {title:'Teste com a tela bloqueada',body:'Avisos da loja funcionando. Este não é um pedido novo.',url:'/#vovo-secreta',tag:'vovo-test'});
      })());
      return res.status(202).json({success:true,scheduled:true});
    }
    const sent = await sendPushNotification(subscription, { title: 'Teste de aviso', body: 'Este é um teste. Não há um pedido novo.', url: '/#vovo-secreta', tag: 'vovo-test' });
    if (!sent) return res.status(502).json({ error: 'O serviço não aceitou o aviso. Ative novamente e tente outra vez.' });
    res.json({ success: true });
  } catch {
    res.status(503).json({ error: 'Não foi possível enviar o aviso de teste.' });
  }
});


const mainApp = express();
mainApp.use('/api', app); 
mainApp.use('/', app);

export default mainApp;
