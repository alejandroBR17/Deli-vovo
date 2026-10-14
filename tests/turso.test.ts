import {LEGAL_VERSION} from '../src/utils/legal';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Database, migrate } from '../server/database';
import { separateImage } from '../server/media';
import { RevisionCache } from '../server/revision-cache';

test('catalog revisions refresh empty/changed/deleted products across instances without rescanning unchanged catalogs',async()=>{
 const client=createClient({url:':memory:'});const database=new Database(client);
 try {
  await migrate(client);let loadsA=0,loadsB=0;
  const load=async()=> (await database.collection('products').get()).docs.map(doc=>doc.data());
  const a=new RevisionCache(()=>database.productRevision(),()=>{loadsA++;return load()});
  const b=new RevisionCache(()=>database.productRevision(),()=>{loadsB++;return load()});
  assert.deepEqual(await a.read(),[]);assert.deepEqual(await b.read(),[]);
  await database.collection('products').doc('local').create({name:'Local SQLite fixture',price:5});
  assert.equal((await a.read())[0].price,5);assert.equal((await b.read())[0].price,5);
  await a.read();await b.read();assert.equal(loadsA,2);assert.equal(loadsB,2);
  await database.collection('products').doc('local').update({price:6});
  assert.equal((await a.read())[0].price,6);assert.equal((await b.read())[0].price,6);
  const revision=await database.productRevision();
  await database.collection('products').doc('local').update({price:6});assert.equal(await database.productRevision(),revision);
  await a.read();await b.read();assert.equal(loadsA,3);assert.equal(loadsB,3);
  await database.collection('products').doc('local').delete();assert.deepEqual(await a.read(),[]);assert.deepEqual(await b.read(),[]);
  const final=await database.productRevision();await migrate(client);assert.equal(await database.productRevision(),final);
 } finally {client.close();}
});

test('indexed status lookup, bounded history and complete financial totals use real SQLite', async () => {
  const client = createClient({ url: ':memory:' });
  const database = new Database(client);
  try {
    await migrate(client);
    await migrate(client); // Schema operation is repeatable without deleting data.
    await client.batch(Array.from({ length: 125 }, (_, index) => ({ sql: 'INSERT INTO orders(id,payload) VALUES (?,?)', args: [String(index).padStart(8,'0'), JSON.stringify({ userId: 'customer-test', date: '2026-10-10T12:00:00.000Z', status: 'concluido', total: 10, paymentMethod: 'Pix', archived: false })] })), 'write');
    await database.collection('orders').doc('old-active').create({ userId: 'customer-test', date: '2025-01-01T12:00:00.000Z', status: 'pendente', total: 5, archived: false });
    assert.equal((await database.panelOrders()).length,101);
    assert.ok((await database.panelOrders()).some(order => order.id === 'old-active'));
    assert.equal((await database.customerOrders('customer-test')).length,51);
    assert.ok((await database.customerOrders('customer-test')).some(order => order.id === 'old-active'));
    assert.deepEqual(await database.customerOrders('another-customer'),[]);
    const first = await database.history();
    const second = await database.history(first.nextCursor!);
    assert.equal(first.orders.length,100);
    assert.equal(second.orders.length,26);
    assert.equal(new Set([...first.orders,...second.orders].map(order => order.id)).size,126);
    assert.equal(second.nextCursor,null);
    const finance = await database.finance('');
    assert.equal(finance.count,125); assert.equal(finance.totalRevenue,1250);
    assert.equal(finance.pixRevenue,1250); assert.equal(finance.recent.length,20);
    assert.deepEqual(await database.statuses(['old-active','missing']),{ 'old-active': 'pendente' });
    assert.deepEqual(await database.statuses(['old-active'],true),{'old-active':{status:'pendente',acknowledgedAt:null}});
    await database.collection('orders').doc('old-active').update({acknowledgedAt:'2026-10-12T15:00:00.000Z'});
    assert.deepEqual(await database.statuses(['old-active','missing'],true),{'old-active':{status:'pendente',acknowledgedAt:'2026-10-12T15:00:00.000Z'}});
    assert.equal((await database.panelOrders()).find(order=>order.id==='old-active')?.acknowledgedAt,'2026-10-12T15:00:00.000Z');
    const plan = await database.rows('EXPLAIN QUERY PLAN SELECT id,json_extract(payload,\'$.status\') FROM orders WHERE id IN (?)',['old-active']);
    assert.ok(plan.some(row => /SEARCH.*INDEX/i.test(String(row.detail))));
    await assert.rejects(database.collection('orders').doc('old-active').create({ status: 'cancelado' }));
    await database.collection('orders').doc('old-active').set({ status: 'preparando', refusalReason: null },{ merge: true });
    assert.equal((await database.collection('orders').doc('old-active').get()).data().total,5);
    assert.equal((await database.collection('orders').doc('old-active').get()).data().refusalReason,null);
    await assert.rejects(database.collection('orders').doc('missing').update({ status: 'cancelado' }));
    const stats = await database.stats();
    assert.equal(stats.totalOrders,126); assert.equal(stats.revenue,1250);
  } finally { client.close(); }
});

test('visit authentication only updates the current day and skips unchanged rows', async () => {
  const client = createClient({ url: ':memory:' });
  const database = new Database(client);
  try {
    await migrate(client);
    for (const [id, sessionId, timestamp] of [
      ['old', 'same-browser', '2026-10-09T12:00:00.000Z'],
      ['today', 'same-browser', '2026-10-10T12:00:00.000Z'],
      ['other', 'other-browser', '2026-10-10T12:00:00.000Z'],
      ['tomorrow', 'same-browser', '2026-10-11T03:00:00.000Z'],
    ]) await database.collection('visits').doc(id).create({ sessionId, timestamp, userId: 'anonymous', authType: 'none' });
    const now = new Date('2026-10-10T23:00:00.000Z');
    assert.equal((await database.updateVisitAuth('same-browser','customer','registered',now)).rowsAffected,1);
    assert.equal((await database.updateVisitAuth('same-browser','customer','registered',now)).rowsAffected,0);
    for (const id of ['old','other','tomorrow']) assert.equal((await database.collection('visits').doc(id).get()).data().userId,'anonymous');
    assert.equal((await database.collection('visits').doc('today').get()).data().userId,'customer');
  } finally { client.close(); }
});

test('API stores orders durably, isolates images from catalog responses and protects new read routes', async (context) => {
  context.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-12T15:00:00Z')});
  delete process.env.DELIVERY_PREVIEW_MODE;
  const directory = await mkdtemp(path.join(tmpdir(),'delivovo-turso-test-'));
  process.env.NODE_ENV='test'; delete process.env.VERCEL;
  process.env.STORAGE_TURSO_DATABASE_URL='file:' + path.join(directory,'test.db').replace(/\\/g,'/');
  delete process.env.TURSO_DATABASE_URL; delete process.env.TURSO_AUTH_TOKEN; delete process.env.GOOGLE_SHEETS_SCRIPT_URL;
  process.env.TEST_DATA_DIR=directory;
  process.env.ADMIN_PASSWORD='test-only'; process.env.ADMIN_SESSION_SECRET=randomUUID()+randomUUID();
  const client=createClient({url:process.env.STORAGE_TURSO_DATABASE_URL});
  const database=new Database(client); await migrate(client);
  const { default: app }=await import('../api/index');
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}/api`;
  const request=(url:string,body?:any,headers:Record<string,string>={})=>fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
  try {
    assert.equal((await request('/orders/history')).status,401);
    assert.equal((await request('/admin/finance')).status,401);
    const login=await request('/admin/login',{password:'test-only'},{'X-Vovo-Admin':'1'});
    const cookie=login.headers.get('set-cookie')!.split(';')[0];
    const headers={Cookie:cookie,'X-Vovo-Admin':'1'};
    assert.equal((await request('/visits/install',{sessionId:''})).status,400);
    assert.equal((await request('/visits/install',{sessionId:'session-local-install'})).status,200);
    assert.equal((await request('/visits/install',{sessionId:'session-local-install'})).status,200);
    assert.equal((await database.rows("SELECT id FROM visits WHERE json_extract(payload,'$.userAgent')='PWA_INSTALL_EVENT'")).length,1);
    assert.equal((await database.stats()).visits.installs,1);
    assert.equal((await database.stats()).visits.total,0);
    assert.equal((await request('/visits',{sessionId:'session-local-install',isPwa:true})).status,200);
    assert.equal((await database.stats()).visits.total,1);
    assert.equal((await database.stats()).visits.installs,1);
    assert.equal((await (await request('/configs')).json()).cash_enabled,undefined);
    // Simulate another server writing: the API's local cache is not invalidated.
    await database.collection('configs').doc('cash_enabled').set({value:'true'});
    assert.equal((await (await request('/configs')).json()).cash_enabled,'true');
    assert.match((await request('/configs')).headers.get('cache-control')!, /private, no-store/);
    assert.equal((await (await request('/stats/prep-time')).json()).forecast,'40-50 min');
    await database.collection('configs').doc('kitchen_forecast').set({value:'25-35 min'});
    assert.equal((await (await request('/stats/prep-time')).json()).forecast,'25-35 min');
    const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7dcAAAAASUVORK5CYII=';
    const product=await request('/products',{id:'test-product',name:'Teste',price:10,image},headers);
    assert.equal(product.status,200);
    const catalog=await (await request('/products')).json();
    assert.match(catalog[0].image,/^\/api\/media\/[a-f0-9]{64}$/);
    assert.ok(!JSON.stringify(catalog).includes('base64'));
    const media=await request(catalog[0].image.replace('/api',''));
    assert.equal(media.status,200); assert.match(media.headers.get('cache-control')!,/immutable/);
    assert.equal(media.headers.get('content-type'),'image/png');
    const delivery={free_delivery_radius:'2',fee_per_km:'2',max_delivery_radius:'20'};
    assert.equal((await request('/configs/batch',{updates:delivery},headers)).status,200);
    await client.execute("CREATE TRIGGER fail_config_save BEFORE UPDATE ON configs WHEN NEW.id='fee_per_km' AND json_extract(NEW.payload,'$.value')='9' BEGIN SELECT RAISE(ABORT,'simulated write failure'); END");
    const revisionBeforeFailure=await database.configRevision();
    assert.equal((await request('/configs/batch',{updates:{free_delivery_radius:'3',fee_per_km:'9',max_delivery_radius:'30'}},headers)).status,503);
    assert.equal(await database.configRevision(),revisionBeforeFailure);
    for(const [key,value] of Object.entries(delivery)) assert.equal((await database.collection('configs').doc(key).get()).data().value,value);
    await client.execute('DROP TRIGGER fail_config_save');
    const id=randomUUID(); const nonce=randomUUID();
    const body={id,type:'retirada',customer:{name:'Teste',phone:'41999999999',address:'Endereço fictício'},items:[{id:'test-product',quantity:1}],total:10};
    const guest=await request('/auth/guest',{name:'Teste Local',phone:'41999999999'});assert.equal(guest.status,200);const guestCookie=guest.headers.get('set-cookie')!.split(';')[0];Object.assign(body,{legalAcceptance:{accepted:true,termsVersion:LEGAL_VERSION,privacyVersion:LEGAL_VERSION}});
    const receipt=await request('/orders',body,{'X-Order-Request':nonce,Cookie:guestCookie});
    assert.equal(receipt.status,200); assert.equal((await receipt.json()).success,true);
    assert.equal((await request('/orders',body,{'X-Order-Request':nonce})).status,200);
    assert.equal((await database.rows('SELECT count(*) AS count FROM orders'))[0].count,1);
    assert.deepEqual(await (await request('/orders/batch/status?ids='+id)).json(),{[id]:'pendente'});
    assert.equal((await request('/orders/batch/status?ids='+Array(51).fill(id).join(','))).status,400);
    assert.equal((await (await request('/orders/history',undefined,headers)).json()).orders.length,1);
    await database.collection('orders').doc(id).update({status:'entrega',payment:{method:'dinheiro',paid:false}});
    await client.execute("CREATE TRIGGER fail_payment_save BEFORE UPDATE ON orders WHEN json_extract(NEW.payload,'$.payment.paid')=1 BEGIN SELECT RAISE(ABORT,'simulated receipt failure'); END");
    assert.equal((await request('/orders/'+id+'/payment/confirm',{},headers)).status,503);
    assert.equal((await database.collection('orders').doc(id).get()).data().payment.paid,false);
    await client.execute('DROP TRIGGER fail_payment_save');
    const confirmation=await request('/orders/'+id+'/payment/confirm',{},headers);
    assert.equal(confirmation.status,200);
    const persisted=(await database.collection('orders').doc(id).get()).data();
    assert.equal(persisted.status,'entrega');assert.equal(persisted.total,10);assert.equal(persisted.payment.paid,true);assert.ok(persisted.payment.verifiedAt);
    // DB errors must fail, never acknowledge a write to ephemeral filesystem storage.
    await client.execute('DROP TABLE orders');
    const failure=await request('/orders',{...body,id:randomUUID()},{'X-Order-Request':randomUUID(),Cookie:guestCookie});
    assert.equal(failure.status,500);
    await assert.rejects(separateImage(database,'data:image/png;base64,'));
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    client.close();
    // The API also owns a connection; release it before cleaning up the Windows test directory.
    const { closeDatabase }=await import('../api/index'); closeDatabase();
    assert.equal(path.dirname(directory),tmpdir());
    await rm(directory,{recursive:true,maxRetries:10,retryDelay:100});
  }
});
