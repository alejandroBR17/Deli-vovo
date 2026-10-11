import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

const nativeFetch = globalThis.fetch;
let server: Server;
let base: string;
let directory: string;
let adminCookie: string;
let customerCookie: string;
let customer: any;
let order: any;
let requestKey: string;
let accessToken: string;
before(async () => {
  globalThis.fetch = ((url: any, options?: any) => String(url).startsWith('https://nominatim.openstreetmap.org/')
    ? Promise.resolve(new Response(JSON.stringify([{lat: '-25.35', lon: '-49.2'}]), { status: 200 })) : nativeFetch(url, options)) as typeof fetch;
  process.env.NODE_ENV = 'test';
  delete process.env.VERCEL; delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS; delete process.env.GOOGLE_SHEETS_SCRIPT_URL;
  delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
  process.env.ADMIN_PASSWORD = 'local-test-password';
  process.env.ADMIN_SESSION_SECRET = randomUUID() + randomUUID();
  directory = await mkdtemp(path.join(tmpdir(), 'delivovo-tests-'));
  process.env.TEST_DATA_DIR = directory;
  const { default: app } = await import('../api/index');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}/api`;
});
after(async () => {
  globalThis.fetch = nativeFetch;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  assert.equal(path.dirname(directory), tmpdir());
  assert.ok(path.basename(directory).startsWith('delivovo-tests-'));
  await rm(directory, { recursive: true });
});
function request(url: string, body?: any, headers: Record<string, string> = {}, method?: string) {
  return fetch(base + url, { method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}
test('administrative data and writes require a real session on both mount paths', async () => {
  assert.equal((await request('/orders')).status, 401);
  assert.equal((await fetch(base.replace('/api', '') + '/orders')).status, 401);
  assert.equal((await request('/products', { name: 'invalid' })).status, 403);
  assert.equal((await request('/admin/login', { password: 'vovo123' }, { 'X-Vovo-Admin': '1' })).status, 401);
  const login = await request('/admin/login', { password: process.env.ADMIN_PASSWORD }, { 'X-Vovo-Admin': '1' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Strict/i);
  adminCookie = cookie.split(';')[0];
  assert.equal((await request('/orders', undefined, { Cookie: adminCookie })).status, 200);
  assert.equal((await request('/configs', { key: 'x', value: 'y' }, { Cookie: adminCookie })).status, 403);
  assert.equal((await request('/orders', undefined, { Cookie: adminCookie + 'invalid' })).status, 401);
});
test('private configuration never appears in public responses', async () => {
  await writeFile(path.join(directory, 'configs.json'), JSON.stringify([
    { key: 'vapid_private_key', value: 'private-test-value' }, { key: 'store_name', value: 'Loja de teste' },
    { key: 'store_street', value: 'Rua interna de teste' }, { key: 'store_number', value: '123' },
    { key: 'store_lat', value: '-25.35' }, { key: 'store_lng', value: '-49.2' },
    { key: 'max_delivery_radius', value: '5' }, { key: 'fee_per_km', value: '2' }, { key: 'free_delivery_radius', value: '0' },
  ]));
  const response = await request('/configs');
  const text = await response.text();
  assert.ok(!text.includes('private-test-value')); assert.ok(text.includes('Loja de teste'));
  assert.ok(!text.includes('Rua interna de teste')); assert.ok(!text.includes('store_lat'));
  const internal = await request('/configs', undefined, { Cookie: adminCookie });
  const internalText = await internal.text();
  assert.ok(internalText.includes('Rua interna de teste')); assert.ok(!internalText.includes('private-test-value'));
});

test('delivery quote uses private store coordinates and enforces delivery radius', async () => {
  const nearby = await request('/delivery/quote', { address: 'Rua de teste, 123, Curitiba, PR' });
  assert.equal(nearby.status, 200); const result = await nearby.json(); assert.equal(result.fee, 0); assert.equal(result.distance, 0); assert.ok(result.token);
  assert.ok(!('store_lat' in result));
  assert.equal((await request('/delivery/quote', { address: null })).status, 400);
  assert.equal((await request('/chat', { message: 'oi' })).status, 404);
});
test('customer registration hashes credentials and protects customer profiles', async () => {
  const result = await request('/auth/register', { name: 'Cliente teste', email: 'test@example.com', password: 'customer-test-password' });
  assert.equal(result.status, 200);
  customerCookie = result.headers.get('set-cookie')!.split(';')[0];
  customer = (await result.json()).user;
  assert.equal(customer.password, undefined);
  const stored = JSON.parse(await readFile(path.join(directory, 'users.json'), 'utf8'));
  assert.match(stored[0].password, /^scrypt:/); assert.notEqual(stored[0].password, 'customer-test-password');
  assert.equal((await request('/users/' + customer.id, { name: 'Hacked' }, {}, 'PATCH')).status, 401);
  assert.equal((await request('/users/' + customer.id, { id: 'other-user', name: 'Atualizado' }, { Cookie: customerCookie }, 'PATCH')).status, 200);
  assert.equal((await request('/orders/user/other-user', undefined, { Cookie: customerCookie })).status, 401);
  const login = await request('/auth/login', { email: 'test@example.com', password: 'customer-test-password' });
  assert.equal(login.status, 200); assert.equal((await login.json()).user.password, undefined);
});
test('an acknowledged order persists once and cannot be overwritten by a customer', async () => {
  await request('/products', {id: 'test-product', name: 'Produto teste', price: 10}, { Cookie: adminCookie, 'X-Vovo-Admin': '1' });
  order = { type: 'retirada', id: randomUUID(), customer: { name: 'Teste', phone: '41999999999', address: 'Endereço de teste' }, items: [{ id: 'test-product', name: 'Produto teste', quantity: 1, price: 10 }], total: 10, payment: { method: 'pix', paid: true } };
  requestKey = randomUUID();
  assert.equal((await request('/orders', {...order,total:0.01,items:[{...order.items[0],price:0.01}]}, { 'X-Order-Request': requestKey })).status,409);
  assert.equal((await request('/orders', {...order,coupon:'INVENTADO'}, { 'X-Order-Request': requestKey })).status,400);
  const result = await request('/orders', order, { 'X-Order-Request': requestKey, Cookie: customerCookie });
  assert.equal(result.status, 200);
  accessToken = (await result.json()).accessToken;
  assert.ok(accessToken);
  const duplicate = await request('/orders', order, { 'X-Order-Request': requestKey });
  assert.equal(duplicate.status, 200); assert.equal((await duplicate.json()).accessToken, accessToken);
  assert.equal(JSON.parse(await readFile(path.join(directory, 'orders.json'), 'utf8')).length, 1);
  assert.equal(JSON.parse(await readFile(path.join(directory, 'orders.json'), 'utf8'))[0].payment.paid, false);
  assert.equal((await request('/orders', order, { 'X-Order-Request': randomUUID() })).status, 409);
  assert.equal((await request('/orders/' + order.id, { status: 'concluido' }, {}, 'PUT')).status, 403);
  assert.equal((await request('/orders/' + order.id + '/status', { status: 'preparando' }, { 'X-Order-Token': accessToken }, 'PATCH')).status, 403);
  assert.equal((await request('/orders/' + order.id + '/status', { status: 'cancelado' }, { 'X-Order-Token': accessToken }, 'PATCH')).status, 200);
});
test('push configuration and subscriptions cannot claim success without working setup', async () => {
  assert.equal((await request('/push/public-key')).status, 503);
  assert.equal((await request('/push/subscribe', { role: 'admin', subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: 'x', auth: 'y' } } })).status, 401);
  assert.equal((await request('/admin/test-push', { endpoint: 'missing' }, { Cookie: adminCookie, 'X-Vovo-Admin': '1' })).status, 404);
});

test('cash requires explicit saved opt-in and cannot claim payment or invalid change', async () => {
  const cashOrder = (payment: any) => ({ ...order, id: randomUUID(), payment });
  const headers = () => ({ 'X-Order-Request': randomUUID() });
  const adminHeaders = { Cookie: adminCookie, 'X-Vovo-Admin': '1' };
  assert.equal((await request('/orders', cashOrder({ method: 'dinheiro', paid: true }), headers())).status, 400);
  assert.equal((await request('/orders', cashOrder({ method: 'unknown', paid: true }), headers())).status, 400);
  assert.equal((await request('/configs', { key: 'cash_enabled', value: 'yes' }, adminHeaders)).status, 400);
  assert.equal((await request('/configs', { key: 'cash_enabled', value: 'true' }, adminHeaders)).status, 200);
  for (const changeFor of [5, -1, '20', null]) {
    assert.equal((await request('/orders', cashOrder({ method: 'dinheiro', changeFor }), headers())).status, 400);
  }
  for (const changeFor of [undefined, 20]) {
    const candidate = cashOrder({ method: 'dinheiro', changeFor, paid: true });
    assert.equal((await request('/orders', candidate, headers())).status, 200);
    const stored = JSON.parse(await readFile(path.join(directory, 'orders.json'), 'utf8')).find((entry: any) => entry.id === candidate.id);
    assert.equal(stored.payment.paid, false);
    assert.equal(stored.payment.method, 'dinheiro');
    assert.equal(stored.payment.changeFor, changeFor);
    assert.equal(stored.status, 'pendente');
    assert.match(stored.paymentMethod, changeFor === undefined ? /Valor exato/ : /Troco para R\$ 20\.00/);
  }
  assert.equal((await request('/configs', { key: 'cash_enabled', value: 'false' }, adminHeaders)).status, 200);
  assert.equal((await request('/orders', cashOrder({ method: 'dinheiro' }), headers())).status, 400);
});

test('invalid shop settings are refused without overwriting saved delivery and hours', async () => {
  const headers={ Cookie: adminCookie, 'X-Vovo-Admin': '1' };
  for(const [key,value] of [['fee_per_km',''],['fee_per_km','-1'],['max_delivery_radius','Infinity'],['free_delivery_radius','6'],['working_days','[7]'],['working_days','false'],['opening_start','25:00'],['force_closed','yes']]) {
    const response=await request('/configs',{key,value},headers);
    assert.equal(response.status,400);
    assert.ok((await response.json()).error);
  }
  const saved=await (await request('/configs',undefined,{ Cookie: adminCookie })).json();
  assert.equal(saved.fee_per_km,'2'); assert.equal(saved.free_delivery_radius,'0'); assert.equal(saved.max_delivery_radius,'5');
  assert.equal((await request('/configs',{key:'fee_per_km',value:'1,50'},headers)).status,200);
  assert.equal((await (await request('/configs',undefined,{ Cookie: adminCookie })).json()).fee_per_km,'1.5');
  assert.equal((await request('/configs',{key:'opening_start',value:'18:00'},headers)).status,200);
  assert.equal((await request('/configs',{key:'opening_end',value:'18:00'},headers)).status,400);
  assert.equal((await request('/configs',{key:'opening_end',value:'02:00'},headers)).status,200);
  assert.equal((await request('/configs',{key:'working_days',value:'[]'},headers)).status,200);
});
