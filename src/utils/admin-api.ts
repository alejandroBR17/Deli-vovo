import { GAS_API_URL } from '../../constants/index';

export async function adminFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set('X-Vovo-Admin', '1');
  const response = await fetch(`${GAS_API_URL}${path}`, { ...options, headers, credentials: 'same-origin', signal: options.signal || AbortSignal.timeout(15000) });
  if (response.status === 401 && path !== '/admin/login') {
    window.dispatchEvent(new Event('vovo-admin-session-expired'));
    throw new Error('Sua sessão terminou. Entre novamente.');
  }
  return response;
}
