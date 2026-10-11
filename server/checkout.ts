import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { quoteDelivery } from './delivery.js';
import { productOptions } from '../src/utils/product-options.js';

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('A loja ainda precisa configurar o checkout.');
  return value;
}
const addressHash = (address: string) => createHash('sha256').update(address.trim()).digest('hex');
export function deliveryToken(address: string, latitude: string, longitude: string) {
  const payload = Buffer.from(JSON.stringify({ address: addressHash(address), latitude, longitude, expires: Date.now() + 20 * 60000 })).toString('base64url');
  return payload + '.' + createHmac('sha256', secret()).update(payload).digest('base64url');
}
function deliveryProof(token: unknown, address: string) {
  if (typeof token !== 'string' || token.length > 2000) throw new Error('Calcule novamente o frete.');
  const [payload, signature, extra] = token.split('.');
  const expected = createHmac('sha256', secret()).update(payload || '').digest('base64url');
  const actual = Buffer.from(signature || ''); const wanted = Buffer.from(expected);
  if (extra || actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) throw new Error('Calcule novamente o frete.');
  const proof = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (!Number.isFinite(proof.expires) || proof.expires < Date.now() || proof.address !== addressHash(address)) throw new Error('O endereço mudou ou o frete expirou. Calcule novamente.');
  return proof;
}
const money = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000) throw new Error('O cardápio possui um preço inválido. Contate a loja.');
  return Math.round(number * 100);
};
export function priceOrder(input: any, products: any[], configs: Record<string, any>) {
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50) throw new Error('Confira os itens da sacola.');
  let subtotal = 0;
  const items = input.items.map((line: any) => {
    const product = products.find(product => product.id === line.id);
    if (!product || product.available === false || product.active === false) throw new Error('Um item não está mais disponível. Reabra o cardápio.');
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) throw new Error('A quantidade deve ser de 1 a 99 por item.');
    const { variations, additionals: availableAdditionals } = productOptions(product);
    const variation = line.variation ? variations.find((option: any) => option.name === line.variation.name) : undefined;
    if ((line.variation && !variation) || (variations.length && !variation)) throw new Error('Confira a opção do produto.');
    if (line.additionals != null && !Array.isArray(line.additionals)) throw new Error('Confira os adicionais.');
    const names = new Set<string>();
    const additionals = (line.additionals || []).map((selected: any) => {
      const option = availableAdditionals.find((option: any) => option.name === selected.name);
      if (!option || names.has(option.name)) throw new Error('Adicional inválido ou repetido.');
      names.add(option.name); return { name: option.name, price: money(option.price) / 100 };
    });
    const base = money(product.price);
    const extra = variation ? money(variation.price) : 0;
    subtotal += (base + extra + additionals.reduce((sum: number, option: any) => sum + money(option.price), 0)) * line.quantity;
    return { id: product.id, name: product.name, price: base / 100, quantity: line.quantity,
      variation: variation ? { name: variation.name, price: extra / 100 } : undefined,
      additionals, observation: typeof line.observation === 'string' ? line.observation.slice(0, 500) : '' };
  });
  let discount = 0;
  const code = typeof input.coupon === 'string' ? input.coupon.trim().toUpperCase() : '';
  if (code) {
    const coupons = typeof configs.coupons === 'string' ? JSON.parse(configs.coupons) : configs.coupons || [];
    const coupon = coupons.find((coupon: any) => String(coupon.code).toUpperCase() === code);
    if (!coupon || coupon.active === false) throw new Error('O cupom não está mais disponível.');
    if (coupon.type === 'percent') {
      const value = Number(coupon.discount); const fraction = value > 1 ? value / 100 : value;
      if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error('Cupom inválido.');
      discount = Math.round(subtotal * fraction);
    } else if (coupon.type === 'fixed') discount = money(coupon.discount);
    else throw new Error('Cupom inválido.');
  }
  let fee = 0, distance = 0;
  if (input.type === 'entrega') {
    const proof = deliveryProof(input.deliveryToken, String(input.customer?.address || ''));
    const quote = quoteDelivery(configs, proof.latitude, proof.longitude);
    fee = money(quote.fee); distance = quote.distance;
  } else if (input.type !== 'retirada') throw new Error('Confira o tipo de entrega.');
  const total = (Math.max(0, subtotal - discount) + fee) / 100;
  const itemsSummary = items.map((item: any) => `${item.quantity}x ${item.name}${item.variation ? ` (${item.variation.name})` : ''}${item.additionals.length ? ` [${item.additionals.map((option: any) => option.name).join(', ')}]` : ''}${item.observation ? ` — ${item.observation}` : ''}`).join(', ');
  return { items, itemsSummary, total, subtotal: subtotal / 100, discount: Math.min(subtotal, discount) / 100, deliveryFee: fee / 100, deliveryDistance: distance, coupon: code };
}
export const checkoutFingerprint = (priced: ReturnType<typeof priceOrder>, address: string) => createHash('sha256').update(JSON.stringify({ ...priced, address })).digest('hex');

const geocodeCache = new Map<string, { latitude: string; longitude: string; expires: number }>();
export async function locateDeliveryAddress(address: unknown) {
  if (typeof address !== 'string' || address.trim().length < 10 || address.length > 500) throw new Error('Preencha o endereço completo de entrega.');
  const cached = geocodeCache.get(address);
  if (cached && cached.expires > Date.now()) return cached;
  const params = new URLSearchParams({ format: 'json', countrycodes: 'br', limit: '1', q: address });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': 'Delivovo/1.0 (delivery address lookup)' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('O serviço de mapas está indisponível. Tente novamente.');
  const data = await response.json();
  if (!data[0]?.lat || !data[0]?.lon) throw new Error('Não encontramos o endereço. Confira rua, número e cidade.');
  const value = { latitude: String(data[0].lat), longitude: String(data[0].lon), expires: Date.now() + 30 * 60000 };
  if (geocodeCache.size >= 100) geocodeCache.delete(geocodeCache.keys().next().value!);
  geocodeCache.set(address, value);
  return value;
}
