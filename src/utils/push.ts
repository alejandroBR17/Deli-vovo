import { GAS_API_URL } from '../../constants/index';
import { adminFetch } from './admin-api';
function urlBase64ToUint8Array(value: string) {
  const raw = atob((value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
async function readyRegistration() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Use um navegador com notificações, como o Chrome no Android.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Recarregue o aplicativo e tente novamente.')), 10000);
    })]);
  } finally { clearTimeout(timer); }
}
export async function getPushSubscription() { return (await readyRegistration()).pushManager.getSubscription(); }
export async function subscribeToPush(userId?: string, role: 'admin' | 'customer' = 'customer') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') throw new Error('Permita as notificações no navegador primeiro.');
  const registration = await readyRegistration();
  const response = await fetch(`${GAS_API_URL}/push/public-key`);
  const result = await response.json();
  if (!response.ok || !result.publicKey) throw new Error(result.error || 'Os avisos ainda precisam ser configurados na loja.');
  const key = urlBase64ToUint8Array(result.publicKey);
  let subscription = await registration.pushManager.getSubscription();
  const existingKey = subscription?.options.applicationServerKey;
  if (subscription && (!existingKey || existingKey.byteLength !== key.length || !new Uint8Array(existingKey).every((byte, index) => byte === key[index]))) {
    await subscription.unsubscribe(); subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: subscription.toJSON(), userId, role }) };
  const saved = role === 'admin' ? await adminFetch('/push/subscribe', options) : await fetch(`${GAS_API_URL}/push/subscribe`, options);
  const savedResult = await saved.json();
  if (!saved.ok || savedResult.success !== true) throw new Error(savedResult.error || 'Não foi possível cadastrar os avisos. Tente novamente.');
  return true;
}
