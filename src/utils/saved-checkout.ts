import { customerName } from './customer-name.js';
export type DeliveryAddress = { street: string; number: string; neighborhood: string; city: string; state: string; cep: string };
export type CustomerDetails = { name: string; phone: string; address: string; deliveryAddress?: DeliveryAddress };
export type SavedCustomer = CustomerDetails & { id: string };
export const emptyCustomer: CustomerDetails = { name: '', phone: '', address: '' };
const key = 'vovoh_saved_checkout';
const validAddress = (address: unknown): address is DeliveryAddress => !!address && ['street','number','neighborhood','city','state','cep'].every(field => typeof (address as Record<string, unknown>)[field] === 'string');
export function addressParts(customer: CustomerDetails): DeliveryAddress {
  if (validAddress(customer.deliveryAddress)) return customer.deliveryAddress;
  const parts = customer.address.split(',').map(part => part.trim());
  const number = (parts[1] || '').split(' - ');
  const city = (parts[2] || '').split(' - ');
  return { street: parts[0] || '', number: number[0] || '', neighborhood: number.slice(1).join(' - '), city: city[0] || '', state: city[1] || '', cep: parts[3] || '' };
}
export function readSavedCustomers(storage?: Storage): SavedCustomer[] {
  try {
    const data = JSON.parse((storage || localStorage).getItem(key) || '[]');
    return Array.isArray(data) ? data.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.phone === 'string' && typeof item.address === 'string' && (!item.deliveryAddress || ['street','number','neighborhood','city','state','cep'].every(field => typeof item.deliveryAddress[field] === 'string'))).slice(0, 8) : [];
  } catch { return []; }
}
export function rememberCustomer(customer: CustomerDetails, storage?: Storage): SavedCustomer[] {
  try {
  const target = storage || localStorage;
  const phone = customer.phone.replace(/\D/g, '');
  if (!customer.name.trim() || !/^(?:\d{10,11}|55\d{10,11})$/.test(phone) || !customer.address.trim()) return readSavedCustomers(target);
  const previous = readSavedCustomers(target);
  const same = (item: CustomerDetails) => item.name === customer.name.trim() && item.phone === phone && item.address === customer.address;
  const existing = previous.find(same);
  const current = {...customer, name: customer.name.trim(), phone, id: existing?.id || crypto.randomUUID()};
  const saved = [current, ...previous.filter(item => !same(item))].slice(0, 8);
  try { target.setItem(key, JSON.stringify(saved)); } catch { /* The order can succeed even when local storage is unavailable. */ }
  return saved;
  } catch { return readSavedCustomers(storage); }
}

export function lastCustomer(storage?: Storage): CustomerDetails {
  const saved = readSavedCustomers(storage)[0];
  if (saved) return {...saved, name:customerName(saved.name)};
  try {
    const orders = JSON.parse((storage || localStorage).getItem('vovoh_active_orders') || '[]');
    const customer = Array.isArray(orders) ? orders[0]?.customer : undefined;
    if (customer && ['name','phone','address'].every(field => typeof customer[field] === 'string')) return {name:customerName(customer.name), address:customer.address, phone:customer.phone.replace(/\D/g,''), ...(validAddress(customer.deliveryAddress) ? {deliveryAddress:customer.deliveryAddress} : {})};
  } catch { /* Missing or unavailable history is equivalent to no saved details. */ }
  return {...emptyCustomer};
}
