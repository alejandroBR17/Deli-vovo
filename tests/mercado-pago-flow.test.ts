import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {randomUUID,createHmac} from 'node:crypto';
import {migrate} from '../server/database';
import {PaymentCheckoutStore,hasPaymentCheckoutAccess,paymentRequestHash} from '../server/payment-checkouts';

test('private checkout finalizes one order across two instances and preserves quoted scheduling',async()=>{
  const client=createClient({url:'file::memory:'});
  try {
    await migrate(client);const a=new PaymentCheckoutStore(client);const b=new PaymentCheckoutStore(client);
    const key=randomUUID();const checkout={orderId:randomUUID(),requestHash:paymentRequestHash(key),fingerprint:'a'.repeat(64),total:6.5,
      order:{id:'replaced-below',customer:{name:'Local test',phone:'41999999999',address:'Local test only'},total:6.5,scheduledTo:'2026-01-01T12:00:00-03:00'}};
    checkout.order.id=checkout.orderId;
    assert.equal(await a.create(checkout),true);assert.equal(await b.create(checkout),false);
    assert.equal(hasPaymentCheckoutAccess(checkout,key),true);assert.equal(hasPaymentCheckoutAccess(checkout,randomUUID()),false);
    await a.savePreference(checkout.orderId,{checkoutUrl:'https://www.mercadopago.com.br/checkout',preferenceId:'pref'});
    assert.equal((await b.get(checkout.orderId))?.preferenceId,'pref');
    const first=await a.finalize(checkout,'123');const second=await b.finalize(checkout,'123');
    assert.equal(first.created,true);assert.equal(second.created,false);
    assert.equal((await b.finalize(checkout,'999')).created,false);
    assert.equal((await a.get(checkout.orderId) as any).paymentId,'123');
    const rows=await client.execute('SELECT payload FROM orders');assert.equal(rows.rows.length,1);
    const order=JSON.parse(String(rows.rows[0].payload));assert.equal(order.payment.paid,true);
    assert.equal(order.status,'pendente');assert.equal(order.scheduledTo,checkout.order.scheduledTo);
    await migrate(client);assert.equal((await a.get(checkout.orderId))?.preferenceId,'pref');
    assert.equal(await a.revokePayment(checkout.orderId,'999','refunded'),false);
    assert.equal(await a.revokePayment(checkout.orderId,'123','refunded'),true);
    assert.equal(await b.revokePayment(checkout.orderId,'123','refunded'),false);
    const revoked=JSON.parse(String((await client.execute('SELECT payload FROM orders')).rows[0].payload));
    assert.equal(revoked.payment.paid,false);assert.equal(revoked.status,'pendente');
  } finally {client.close();}
});

test('API creates no order before approval, verifies signed provider response, rejects guessed return and duplicate submission',async()=>{
  const fs=await import('node:fs/promises');const path=await import('node:path');const os=await import('node:os');
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vovo-mp-flow-'));
  process.env.NODE_ENV='test';delete process.env.VERCEL;delete process.env.GOOGLE_SHEETS_SCRIPT_URL;
  process.env.TEST_DATA_DIR=directory;process.env.TURSO_DATABASE_URL='file:'+path.join(directory,'flow.sqlite');
  delete process.env.TURSO_AUTH_TOKEN;
  process.env.ADMIN_SESSION_SECRET=randomUUID()+randomUUID();process.env.ADMIN_PASSWORD='local-test-only';
  process.env.MERCADO_PAGO_ACCESS_TOKEN='local-provider-fixture';process.env.MERCADO_PAGO_SELLER_ID='123';process.env.MERCADO_PAGO_MODE='test';
  process.env.MERCADO_PAGO_CHECKOUT_ENABLED='true';process.env.MERCADO_PAGO_WEBHOOK_SECRET='local-webhook-fixture';
  process.env.MERCADO_PAGO_RETURN_ORIGIN='https://delivery.example';process.env.DELIVERY_PREVIEW_MODE='true';
  const client=createClient({url:process.env.TURSO_DATABASE_URL});await migrate(client);
  await client.execute({sql:'INSERT INTO products(id,payload) VALUES (?,?)',args:['local-product',JSON.stringify({name:'Local fixture',price:6.5,available:true})]});
  let preference:any;let paid=false;let preferenceCalls=0;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    if(String(url)==='https://api.mercadopago.com/users/me')return Response.json({id:123,tags:['test_user']});
    if(String(url)==='https://api.mercadopago.com/checkout/preferences') {
      preferenceCalls++;preference=JSON.parse(String(options?.body));
      return Response.json({id:'local-pref',collector_id:123,init_point:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=local-pref'});
    }
    if(String(url)==='https://api.mercadopago.com/v1/payments/456')return Response.json({id:456,collector_id:123,live_mode:false,currency_id:'BRL',transaction_amount:6.5,payment_type_id:'credit_card',
      external_reference:preference.external_reference,metadata:preference.metadata,status:paid?'approved':'pending'});
    return originalFetch(url,options);
  };
  const {default:app,closeDatabase}=await import('../api/index');const server=app.listen(0);await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}/api`;
  const id=randomUUID(),key=randomUUID();const headers={'Content-Type':'application/json','X-Order-Request':key};
  const input={id,customer:{name:'Local Customer',phone:'41999999999',address:'Local test pickup address'},type:'retirada',total:6.5,items:[{id:'local-product',quantity:1}]};
  const post=(route:string,body:any,h:any=headers)=>originalFetch(base+route,{method:'POST',headers:h,body:JSON.stringify(body)});
  try {
    const start=await post('/payments/mercado-pago/checkout',input);assert.equal(start.status,200,await start.text());
    const retry=await post('/payments/mercado-pago/checkout',input);assert.equal(retry.status,200);assert.equal(preferenceCalls,1);
    assert.equal((await client.execute('SELECT count(*) AS count FROM orders')).rows[0].count,0);
    const guessed=await post(`/payments/mercado-pago/${id}/status`,{}, {'Content-Type':'application/json','X-Order-Request':randomUUID()});assert.equal(guessed.status,401);
    const pending=await post(`/payments/mercado-pago/${id}/status`,{paymentId:'456'});assert.equal((await pending.json()).status,'pending');
    const unsigned=await post('/payments/mercado-pago/webhook?data.id=456',{type:'payment',data:{id:'456'}});assert.equal(unsigned.status,401);
    const collision=await post('/orders',{...input,payment:{method:'pix',paid:true}});assert.equal(collision.status,409);
    paid=true;const ts='1781009491',requestId='local-request';
    const digest=createHmac('sha256',process.env.MERCADO_PAGO_WEBHOOK_SECRET!).update(`id:456;request-id:${requestId};ts:${ts};`).digest('hex');
    const webhookHeaders={'Content-Type':'application/json','X-Request-Id':requestId,'X-Signature':`ts=${ts},v1=${digest}`};
    assert.equal((await post('/payments/mercado-pago/webhook?data.id=456',{type:'payment',data:{id:'456'}},webhookHeaders)).status,200);
    assert.equal((await post('/payments/mercado-pago/webhook?data.id=456',{type:'payment',data:{id:'456'}},webhookHeaders)).status,200);
    const final=await post(`/payments/mercado-pago/${id}/status`,{});const result=await final.json();assert.equal(result.status,'approved');assert.equal(result.order.payment.paid,true);
    assert.ok(result.order.accessToken);assert.ok(result.order.timing.createdAt);assert.equal(result.order.submissionKeyHash,undefined);
    assert.equal((await client.execute('SELECT count(*) AS count FROM orders')).rows[0].count,1);
  } finally {
    globalThis.fetch=originalFetch;server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));closeDatabase();client.close();
    await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
