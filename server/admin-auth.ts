import { createHash, createHmac, timingSafeEqual, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';
import type { AdminCredential } from './admin-credentials';

const cookieName = 'vovo_admin_session';
const lifetime = 60 * 60 * 24 * 7;
type Credential = { version: string; hash?: string; password?: string };
let credentialStore: { read(): Promise<AdminCredential | null>; change(expected: string, next: AdminCredential): Promise<boolean> } | undefined;
const requestCredentials = new WeakMap<Request, Credential>();
export function configureAdminCredentials(store: NonNullable<typeof credentialStore>) { credentialStore = store; }
function bootstrap(): Credential { return {password: process.env.ADMIN_PASSWORD, version: (process.env.ADMIN_SESSION_SECRET?.length || 0) >= 32 ? sign('bootstrap:'+(process.env.ADMIN_PASSWORD || '')) : 'unconfigured'}; }
function credential(req: Request) { return requestCredentials.get(req) || bootstrap(); }
export async function prepareAdminCredential(req: Request, res: Response, next: NextFunction) {
  if ((process.env.ADMIN_SESSION_SECRET?.length || 0) < 32) return next();
  if (req.path !== '/admin/login' && !signedSession(req)) return next();
  try { requestCredentials.set(req, await credentialStore?.read() || bootstrap()); next(); }
  catch { res.status(503).json({error:'Não foi possível verificar o acesso ao painel. Tente novamente.'}); }
}

function equal(a: string, b: string) {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

function configured(req: Request) {
  const current = credential(req);
  return !!(current.hash || current.password) && (process.env.ADMIN_SESSION_SECRET?.length || 0) >= 32;
}

function sign(value: string) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET!).update(value).digest('base64url');
}

function signedSession(req: Request) {
  if ((process.env.ADMIN_SESSION_SECRET?.length || 0) < 32) return null;
  const raw = (req.headers.cookie || '').split(';').map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!raw) return null;
  const parts = raw.split('.');
  const [expires, version, signature] = parts;
  if (!/^\d+$/.test(expires) || Number(expires) <= Math.floor(Date.now()/1000)) return null;
  if (parts.length === 2 && equal(version,sign(expires))) return parts;
  if (parts.length === 3 && !!signature && equal(signature,sign(expires+'.'+version))) return parts;
  return null;
}
export function hasAdminSession(req: Request) {
  if (!configured(req)) return false;
  const parts=signedSession(req),current=credential(req);
  return !!parts && (parts.length === 2 ? !current.hash : parts[1] === current.version);
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

function issueAdminSession(res: Response, version: string) {
  const expires = String(Math.floor(Date.now() / 1000) + lifetime);
  res.cookie(cookieName, `${expires}.${version}.${sign(expires+'.'+version)}`, {
    httpOnly: true, secure: !!process.env.VERCEL || process.env.NODE_ENV === 'production',
    sameSite: 'strict', path: '/', maxAge: lifetime * 1000,
  });
}
async function matchesPassword(password: string, current: Credential) { return current.hash ? verifyPassword(password,current.hash) : !!current.password && equal(password,current.password); }
export async function loginAdmin(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured(req)) {
    res.status(503).json({ error: 'O acesso ao painel ainda precisa ser configurado.' });
    return;
  }
  if (req.headers['x-vovo-admin'] !== '1') {
    res.status(403).json({ error: 'Solicitação inválida.' });
    return;
  }
  if (typeof req.body.password !== 'string' || req.body.password.length > 128 || !await matchesPassword(req.body.password,credential(req))) {
    res.status(401).json({ error: 'Senha incorreta.' });
    return;
  }
  issueAdminSession(res,credential(req).version);
  res.json({ success: true });
}

export async function changeAdminPassword(req: Request, res: Response) {
  res.setHeader('Cache-Control','no-store');
  const {currentPassword,newPassword,confirmation}=req.body;
  if (typeof currentPassword !== 'string' || currentPassword.length > 128 || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128 || !newPassword.trim() || confirmation !== newPassword) return res.status(400).json({error:'Confira a confirmação e use uma nova senha de 8 a 128 caracteres.'});
  const current=credential(req);
  if (!await matchesPassword(currentPassword,current)) return res.status(400).json({error:'A senha atual está incorreta.'});
  if (currentPassword === newPassword) return res.status(400).json({error:'Escolha uma senha diferente da atual.'});
  const next={hash:await hashPassword(newPassword),version:randomBytes(18).toString('base64url')};
  if (!credentialStore || !await credentialStore.change(current.version,next)) return res.status(409).json({error:'O acesso mudou. Entre no painel novamente antes de trocar a senha.'});
  requestCredentials.set(req,next);issueAdminSession(res,next.version);
  res.json({success:true});
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

export function setCustomerSession(res: Response, id: string, version='') {
  const value = Buffer.from(JSON.stringify({ id, version,expires: Date.now() + lifetime * 1000 })).toString('base64url');
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
export function customerSessionMatches(req:Request,user:{id:string;authVersion?:string}) {
 if(customerId(req)!==user.id)return false;
 try {const raw=(req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith('vovo_customer_session='))!.slice('vovo_customer_session='.length);const data=JSON.parse(Buffer.from(raw.split('.')[0],'base64url').toString());return (data.version||'')===(user.authVersion||'');}catch{return false;}
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
