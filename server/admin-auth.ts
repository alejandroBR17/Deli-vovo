import { createHash, createHmac, timingSafeEqual, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';

const cookieName = 'vovo_admin_session';
const lifetime = 60 * 60 * 24 * 7;

function equal(a: string, b: string) {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

function configured() {
  return !!process.env.ADMIN_PASSWORD && (process.env.ADMIN_SESSION_SECRET?.length || 0) >= 32;
}

function sign(value: string) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET!).update(value).digest('base64url');
}

export function hasAdminSession(req: Request) {
  if (!configured()) return false;
  const raw = (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!raw) return false;
  const [expires, signature, extra] = raw.split('.');
  if (!signature || extra || !/^\d+$/.test(expires)) return false;
  return Number(expires) > Math.floor(Date.now() / 1000) && equal(signature, sign(expires));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  if (!hasAdminSession(req)) {
    res.status(401).json({ error: 'Entre no painel para continuar.' });
    return;
  }
  next();
}

// The browser must supply this header on writes; cross-origin forms cannot do so.
export function requireAdminWrite(req: Request, res: Response, next: NextFunction) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-vovo-admin'] !== '1') {
    res.status(403).json({ error: 'Solicitação administrativa inválida.' });
    return;
  }
  requireAdmin(req, res, next);
}

export function loginAdmin(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) {
    res.status(503).json({ error: 'O acesso ao painel ainda precisa ser configurado.' });
    return;
  }
  if (req.headers['x-vovo-admin'] !== '1') {
    res.status(403).json({ error: 'Solicitação inválida.' });
    return;
  }
  if (typeof req.body.password !== 'string' || !equal(req.body.password, process.env.ADMIN_PASSWORD!)) {
    res.status(401).json({ error: 'Senha incorreta.' });
    return;
  }
  const expires = String(Math.floor(Date.now() / 1000) + lifetime);
  res.cookie(cookieName, `${expires}.${sign(expires)}`, {
    httpOnly: true, secure: !!process.env.VERCEL || process.env.NODE_ENV === 'production',
    sameSite: 'strict', path: '/', maxAge: lifetime * 1000,
  });
  res.json({ success: true });
}

export function logoutAdmin(_req: Request, res: Response) {
  res.clearCookie(cookieName, { path: '/', httpOnly: true, sameSite: 'strict',
    secure: !!process.env.VERCEL || process.env.NODE_ENV === 'production' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true });
}

export function orderToken(id: string) {
  if ((process.env.ADMIN_SESSION_SECRET?.length || 0) < 32) throw new Error('A segurança dos pedidos ainda precisa ser configurada.');
  return sign(`order:${id}`);
}

export function hasOrderAccess(req: Request) {
  const token = req.headers['x-order-token'];
  return hasAdminSession(req) || (typeof token === 'string' && (process.env.ADMIN_SESSION_SECRET?.length || 0) >= 32 && equal(token, orderToken(String(req.params.id))));
}

export function setCustomerSession(res: Response, id: string) {
  const value = Buffer.from(JSON.stringify({ id, expires: Date.now() + lifetime * 1000 })).toString('base64url');
  res.cookie('vovo_customer_session', `${value}.${sign(value)}`, {
    httpOnly: true, sameSite: 'strict', secure: !!process.env.VERCEL || process.env.NODE_ENV === 'production',
    path: '/', maxAge: lifetime * 1000,
  });
}

export function customerId(req: Request) {
  if ((process.env.ADMIN_SESSION_SECRET?.length || 0) < 32) return null;
  const raw = (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith('vovo_customer_session='))?.slice('vovo_customer_session='.length);
  if (!raw) return null;
  const [value, signature, extra] = raw.split('.');
  if (!signature || extra || !equal(signature, sign(value))) return null;
  try { const data = JSON.parse(Buffer.from(value, 'base64url').toString()); return data.expires > Date.now() && typeof data.id === 'string' ? data.id : null; }
  catch { return null; }
}

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id || req.params.userId);
  if (!hasAdminSession(req) && customerId(req) !== id) {
    res.status(401).json({ error: 'Entre na sua conta para acessar esses dados.' }); return;
  }
  res.setHeader('Cache-Control', 'no-store'); next();
}

const deriveKey = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await deriveKey(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith('scrypt:')) return equal(password, stored);
  const [, salt, expected] = stored.split(':');
  const hash = await deriveKey(password, salt, 64) as Buffer;
  return equal(hash.toString('hex'), expected || '');
}
