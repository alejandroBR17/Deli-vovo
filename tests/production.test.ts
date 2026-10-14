import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

test('Vercel refuses to acknowledge an order when persistent storage is unavailable', async () => {
  process.env.VERCEL = '1'; process.env.NODE_ENV = 'test';
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON; delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_SHEETS_SCRIPT_URL;
  process.env.ADMIN_SESSION_SECRET = randomUUID() + randomUUID();
  const directory = await mkdtemp(path.join(tmpdir(), 'delivovo-production-test-'));
  process.env.TEST_DATA_DIR = directory;
  const { default: app } = await import('../api/index');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Request': randomUUID() },
      body: JSON.stringify({ id: randomUUID(), customer: { name: 'Teste', phone: '41999999999', address: 'Teste' }, items: [{ id: 'test', quantity: 1 }], total: 10 }),
    });
    assert.equal(response.status, 500);
    assert.notEqual((await response.json()).success, true);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'orders.json'), 'utf8')), []);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.equal(path.dirname(directory), tmpdir());
    assert.ok(path.basename(directory).startsWith('delivovo-production-test-'));
    await rm(directory, { recursive: true });
  }
});
