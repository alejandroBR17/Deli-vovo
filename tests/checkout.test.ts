import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { priceOrder, deliveryToken } from '../server/checkout';
import { quoteDelivery } from '../server/delivery';

const products = [{id:'p', name:'Produto real', price:10, variations:[{name:'Grande',price:2}], additionals:[{name:'Queijo',price:1.5}]}];
const input = {type:'retirada', items:[{id:'p',quantity:2,price:0.01,name:'Nome falso',variation:{name:'Grande',price:0},additionals:[{name:'Queijo',price:-100}]}]};
test('catalog prices replace submitted prices and coupons apply to subtotal in cents', () => {
  const result = priceOrder({...input,coupon:'DEZ'}, products, {coupons:JSON.stringify([{code:'DEZ',type:'percent',discount:10}])});
  assert.equal(result.subtotal,27); assert.equal(result.total,24.3); assert.equal(result.items[0].price,10);
  assert.equal(result.items[0].name,'Produto real'); assert.equal(result.items[0].variation?.price,2);
  assert.equal(result.items[0].additionals[0].price,1.5);
  assert.equal(priceOrder({...input,coupon:'FIXO'},products,{coupons:[{code:'FIXO',type:'fixed',discount:99}]}).total,0);
});
test('unavailable items, invalid quantities, forged options and repeated extras are rejected', () => {
  for (const items of [[], [{id:'missing',quantity:1}], [{...input.items[0],quantity:-1}], [{...input.items[0],quantity:1.5}], [{...input.items[0],quantity:100}], [{...input.items[0],variation:{name:'Falsa'}}], [{...input.items[0],variation:null}], [{...input.items[0],additionals:[{name:'Queijo'},{name:'Queijo'}]}]]) {
    assert.throws(()=>priceOrder({...input,items},products,{}));
  }
  assert.throws(()=>priceOrder({...input,coupon:'FALSO'},products,{}));
});
test('signed delivery quote is tied to address, expires and rechecks configured delivery radius', () => {
  process.env.ADMIN_SESSION_SECRET=randomUUID()+randomUUID();
  const address='Rua de teste, 123, Curitiba, PR';
  const token=deliveryToken(address,'-25.35','-49.2');
  const order={...input,type:'entrega',customer:{address},deliveryToken:token};
  const configs={store_lat:'-25.35',store_lng:'-49.2',fee_per_km:'2',max_delivery_radius:'5'};
  assert.equal(priceOrder(order,products,configs).total,27);
  assert.throws(()=>priceOrder({...order,customer:{address:'Outro endereço'}},products,configs));
  assert.throws(()=>priceOrder({...order,deliveryToken:token+'x'},products,configs));
  assert.throws(()=>priceOrder({...order,deliveryToken:null},products,configs));
  const originalNow=Date.now;
  try { Date.now=()=>originalNow()+21*60000; assert.throws(()=>priceOrder(order,products,configs)); }
  finally { Date.now=originalNow; }
  assert.throws(()=>quoteDelivery(configs,0,0));
  assert.ok(quoteDelivery(configs,'-25.36','-49.2').fee>2);
});
