import {LEGAL_VERSION} from '../src/utils/legal';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

test('API and Apps Script preserve customer credentials, order details and duplicate receipts', async () => {
  const sheets: Record<string, any> = {};
  function createSheet() {
    const rows: any[][] = [];
    return { rows, appendRow: (row: any[]) => rows.push([...row]),
      getLastColumn: () => rows[0]?.length || 0,
      getDataRange: () => ({ getValues: () => rows.map(row => [...row]) }),
      getRange: (r: number, c: number) => ({ getValues: () => [[...(rows[r - 1] || [])]],
        setValues: (values: any[][]) => { rows[r - 1] = [...values[0]]; },
        setValue: (value: any) => { rows[r - 1][c - 1] = value; },
      }),
    };
  }
  const ss = { getSheetByName: (name: string) => sheets[name], insertSheet: (name: string) => sheets[name] = createSheet() };
  const sandbox = vm.createContext({ SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-api-secret' }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  });
  vm.runInContext(await readFile(new URL('../google-apps-script.js', import.meta.url), 'utf8'), sandbox);
  assert.match(sandbox.doGet({ parameter: { action: 'getUsers' } }).text, /Acesso não autorizado/);
  assert.equal(Object.keys(sheets).length, 0);
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any, options?: any) => {
    if (String(url).startsWith('https://sheets.example.test/')) {
      const parsed = new URL(String(url));
      const event = { parameter: Object.fromEntries(parsed.searchParams), postData: { contents: options?.body } };
      const output = options?.method === 'POST' ? sandbox.doPost(event) : sandbox.doGet(event);
      return new Response(output.text, { status: 200 });
    }
    return nativeFetch(url, options);
  }) as typeof fetch;
  process.env.NODE_ENV = 'test'; delete process.env.VERCEL;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON; delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_SHEETS_SCRIPT_URL = 'https://sheets.example.test/exec';
  process.env.GOOGLE_SHEETS_API_SECRET = 'test-api-secret';
  process.env.ADMIN_SESSION_SECRET = randomUUID() + randomUUID();
  process.env.ADMIN_PASSWORD = 'local-admin-test';
  const directory = await mkdtemp(path.join(tmpdir(), 'delivovo-sheets-test-'));
  process.env.TEST_DATA_DIR = directory;
  const { default: app } = await import('../api/index');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}/api`;
  const post = (route: string, body: any, headers: any = {}) => nativeFetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try {
    const registration = await post('/auth/register', { name: 'Cliente planilha', email: 'sheets@example.com', password: 'sheets-test-password',passwordConfirmation:'sheets-test-password' });
    assert.equal(registration.status, 200);
    assert.equal((await registration.json()).user.password, undefined);
    assert.match(sheets.Usuarios.rows[1][3], /^scrypt:/);
    const login = await post('/auth/login', { email: 'sheets@example.com', password: 'sheets-test-password',passwordConfirmation:'sheets-test-password' });
    assert.equal(login.status, 200);
    const customerCookie = login.headers.get('set-cookie')!.split(';')[0];
    const seedLogin = await post('/admin/login', { password: process.env.ADMIN_PASSWORD }, { 'X-Vovo-Admin': '1' });
    const seedCookie = seedLogin.headers.get('set-cookie')!.split(';')[0];
    await post('/products', { id: 'test', name: 'Teste', price: 12 }, { Cookie: seedCookie, 'X-Vovo-Admin': '1' });
    const body = { legalAcceptance:{accepted:true,termsVersion:LEGAL_VERSION,privacyVersion:LEGAL_VERSION}, type: 'retirada', id: randomUUID(), customer: { name: 'Cliente planilha', phone: '41999999999', address: 'Endereço teste' }, total: 12, items: [{ id: 'test', quantity: 1 }], scheduledTo: '2099-01-01T15:00:00-03:00', itemsSummary: '1x Teste' };
    const key = randomUUID();
    const headers = { 'X-Order-Request': key, Cookie: customerCookie };
    const created = await post('/orders', body, headers);
    assert.equal(created.status, 200);
    assert.equal((await post('/orders', body, headers)).status, 200);
    assert.equal(sheets.Pedidos.rows.length, 2);
    const admin = await post('/admin/login', { password: process.env.ADMIN_PASSWORD }, { 'X-Vovo-Admin': '1' });
    const orders = await nativeFetch(base + '/orders', { headers: { Cookie: admin.headers.get('set-cookie')!.split(';')[0] } });
    const data = await orders.json();
    assert.equal(data[0].customer.name, body.customer.name);
    assert.deepEqual(data[0].items, [{id:'test',name:'Teste',price:12,quantity:1,additionals:[],observation:''}]);
    assert.equal(data[0].scheduledTo, body.scheduledTo);
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.equal(path.dirname(directory), tmpdir());
    assert.ok(path.basename(directory).startsWith('delivovo-sheets-test-'));
    await rm(directory, { recursive: true });
  }
});
