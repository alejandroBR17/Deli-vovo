import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { MercadoPago, validMercadoPagoSignature } from '../server/mercado-pago.js';

const config = {accessToken:'private-test-token',sellerId:'123',mode:'test' as const};
const expected = {orderId:'12345678-abcd',fingerprint:'a'.repeat(64),total:6.5};
const payment = {id:456,collector_id:123,live_mode:false,currency_id:'BRL',external_reference:expected.orderId,
  metadata:{checkout:expected.fingerprint},transaction_amount:6.5,status:'approved',payment_type_id:'credit_card'};

test('preference contains canonical total, reference and hosted return without customer data while keeping mandatory MP balance',async()=>{
  let captured:any;
  const client = new MercadoPago(config,async (url, options)=>{
    assert.equal(url,'https://api.mercadopago.com/checkout/preferences');
    assert.equal(options?.redirect,'error');
    assert.equal((options?.headers as any).Authorization,'Bearer private-test-token');
    captured=JSON.parse(String(options?.body));
    return Response.json({id:'pref-123',collector_id:123,init_point:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-123'});
  });
  const result=await client.createPreference(expected,'https://delivery.example','https://delivery.example/api/payments/mercado-pago/webhook');
  assert.equal(result.mode,'test');
  assert.equal(captured.items[0].unit_price,6.5);
  assert.equal(captured.external_reference,expected.orderId);
  assert.equal(captured.metadata.checkout,expected.fingerprint);
  assert.equal(captured.back_urls.success,'https://delivery.example/?payment_return=12345678-abcd');
  assert.equal(captured.payer,undefined);
  assert.ok(captured.payment_methods.excluded_payment_types.some((type:any)=>type.id==='bank_transfer'));
  assert.ok(!captured.payment_methods.excluded_payment_types.some((type:any)=>type.id==='account_money'));
});

test('untrusted destinations, redirected checkout and wrong collector fail closed',async()=>{
  let calls=0;
  const client=new MercadoPago(config,async()=>{calls++;return Response.json({id:'pref',collector_id:123,init_point:'https://evil.example/'});});
  await assert.rejects(client.createPreference(expected,'http://delivery.example','http://delivery.example/api/payments/mercado-pago/webhook'));
  await assert.rejects(client.createPreference(expected,'https://delivery.example','https://evil.example/api/payments/mercado-pago/webhook'));
  assert.equal(calls,0);
  await assert.rejects(client.createPreference(expected,'https://delivery.example','https://delivery.example/api/payments/mercado-pago/webhook'));
  const wrong=new MercadoPago(config,async()=>Response.json({id:'pref',collector_id:999,init_point:'https://www.mercadopago.com.br/checkout'}));
  await assert.rejects(wrong.createPreference(expected,'https://delivery.example','https://delivery.example/api/payments/mercado-pago/webhook'));
});

test('only approved matching amount, seller, BRL, order, fingerprint and environment can be paid',()=>{
  const client=new MercadoPago(config);
  assert.deepEqual(client.verifyPayment(payment,expected),{approved:true,paymentId:'456',paymentType:'credit_card'});
  assert.deepEqual(client.verifyPayment({...payment,payment_type_id:'account_money'},expected),{approved:true,paymentId:'456',paymentType:'account_money'});
  for(const override of [{collector_id:999},{live_mode:true},{currency_id:'USD'},{transaction_amount:0.1},
    {external_reference:'another-order'},{metadata:{checkout:'b'.repeat(64)}},{payment_type_id:'bank_transfer'},{id:'../users/me'}]) {
    assert.throws(()=>client.verifyPayment({...payment,...override},expected));
  }
  for(const status of ['pending','in_process','rejected','cancelled','refunded','charged_back']) {
    assert.deepEqual(client.verifyPayment({...payment,status},expected),{approved:false});
  }
  assert.deepEqual(client.verifyPayment({...payment,transaction_amount_refunded:1},expected),{approved:false});
});

test('provider failure does not leak its body or credentials; payment ids cannot alter path',async()=>{
  let calls=0;
  const client=new MercadoPago(config,async()=>{calls++;return new Response('private-test-token',{status:401});});
  await assert.rejects(client.getPayment('../users/me'));
  assert.equal(calls,0);
  await assert.rejects(client.getPayment('456'),error=>!String(error).includes(config.accessToken));
});

test('webhook signature authenticates resource and request; malformed or unsigned events fail',()=>{
  const secret='private-webhook-secret'; const ts='1781009491';
  const digest=createHmac('sha256',secret).update(`id:456;request-id:request-123;ts:${ts};`).digest('hex');
  const signature=`ts=${ts},v1=${digest}`;
  assert.equal(validMercadoPagoSignature(secret,signature,'request-123','456'),true);
  for(const args of [[signature,'request-123','457'],[signature,'request-124','456'],['','request-123','456'],
    [signature+',ts=1','request-123','456'],[signature,'request-123','../payments'],[undefined,'request-123','456']]) {
    assert.equal(validMercadoPagoSignature(secret,...args as [unknown,unknown,unknown]),false);
  }
});
