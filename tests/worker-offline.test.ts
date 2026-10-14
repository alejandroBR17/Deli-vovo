import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('worker only caches an offline notice and keeps APIs, payments and online navigation untouched', async () => {
  const handlers = new Map<string, (event: any) => void>();
  const cached: string[] = [];
  let online = true, unavailableCache = false;
  const network = new Response('Live page');
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), {
    self: {location: {origin: 'https://shop.example'}, skipWaiting: async () => {}, addEventListener: (name: string, handler: any) => handlers.set(name, handler)},
    clients: {claim: async () => {}}, URL, Response,
    caches: {open: async (name: string) => {
      assert.equal(name, 'vovo-offline-v1');
      if (unavailableCache) throw new Error('Cache unavailable');
      return {add: async (url: string) => {cached.push(url);}, match: async (url: string) => {assert.equal(url, '/offline.html'); return new Response('Offline notice');}};
    }},
    fetch: async () => {if (!online) throw new Error('Offline'); return network;},
  });
  let installation!: Promise<void>;
  handlers.get('install')!({waitUntil: (promise: Promise<void>) => {installation = promise;}});
  await installation;
  assert.deepEqual(cached, ['/offline.html']);
  const request = (url: string, mode = 'navigate', method = 'GET') => {
    let response: Promise<Response> | undefined;
    handlers.get('fetch')!({request: {url, mode, method}, respondWith: (promise: Promise<Response>) => {response = promise;}});
    return response;
  };
  for (const [url, mode, method] of [
    ['https://shop.example/api/orders', 'navigate', 'GET'],
    ['https://shop.example/api', 'navigate', 'GET'],
    ['https://shop.example/api/payments', 'navigate', 'POST'],
    ['https://shop.example/private.json', 'cors', 'GET'],
    ['https://payment.example/', 'navigate', 'GET'],
  ]) assert.equal(request(url, mode, method), undefined);
  assert.equal(await request('https://shop.example/'), network);
  online = false;
  const offline = await request('https://shop.example/#vovo-secreta');
  assert.equal(offline!.status, 503);
  assert.equal(offline!.headers.get('cache-control'), 'no-store');
  assert.equal(await offline!.text(), 'Offline notice');
  unavailableCache = true;
  const fallback = await request('https://shop.example/');
  assert.equal(fallback!.status, 503);
  assert.match(await fallback!.text(), /Nenhum pedido pode ser enviado/);
  handlers.get('install')!({waitUntil: (promise: Promise<void>) => {installation = promise;}});
  await installation; // Cache failure must not break worker activation / notifications.
  assert.ok(handlers.has('push'));
  assert.ok(handlers.has('notificationclick'));
});
