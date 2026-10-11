import { normalizeCoordinate } from '../utils/geo.js';

export const internalStoreFields = new Set(['store_street', 'store_number', 'store_neighborhood', 'store_city', 'store_state', 'store_cep', 'store_lat', 'store_lng']);

export function quoteDelivery(configs: Record<string, any>, latitude?: unknown, longitude?: unknown) {
  const valid = (value: unknown, limit: number) => {
    if (value == null || String(value).trim() === '') return false;
    const coordinate = Number(String(value).replace(',', '.'));
    return Number.isFinite(coordinate) && Math.abs(coordinate) <= limit;
  };
  if (!valid(configs.store_lat, 90) || !valid(configs.store_lng, 180)) throw new Error('A loja precisa confirmar sua localização para calcular o frete.');
  if (!valid(latitude, 90) || !valid(longitude, 180)) throw new Error('Não conseguimos localizar o endereço de entrega.');
  const lat = normalizeCoordinate(String(latitude)), lng = normalizeCoordinate(String(longitude));
  const storeLat = normalizeCoordinate(configs.store_lat), storeLng = normalizeCoordinate(configs.store_lng);
  const radians = Math.PI / 180;
  const a = Math.sin((lat - storeLat) * radians / 2) ** 2 + Math.cos(storeLat * radians) * Math.cos(lat * radians) * Math.sin((lng - storeLng) * radians / 2) ** 2;
  const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const freeRadius = Number(configs.free_delivery_radius || 0), perKm = Number(configs.fee_per_km || 0), maxRadius = Number(configs.max_delivery_radius || 999);
  if (![freeRadius, perKm, maxRadius].every(value => Number.isFinite(value) && value >= 0)) throw new Error('A loja precisa revisar as taxas de entrega.');
  if (distance > maxRadius) throw new Error(`Entregamos até ${maxRadius} km. Seu endereço está a aproximadamente ${distance.toFixed(1)} km.`);
  return { fee: Math.round(Math.max(0, distance - freeRadius) * perKm * 100) / 100, distance };
}
