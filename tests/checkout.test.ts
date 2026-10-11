import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { priceOrder, deliveryToken, checkoutFingerprint } from '../server/checkout';
import { quoteDelivery } from '../server/delivery';

const products = [{id:'p', name:'Produto real', price:10, variations:[{name:'Grande',price:2}], additionals:[{name:'Queijo',price:1.5}]}];
const input = {type:'retirada', items:[{id:'p',quantity:2,price:0.01,name:'Nome falso',variation:{name:'Grande',price:0},additionals:[{name:'Queijo',price:-100}]}]};

test('card receipt binds the confirmed schedule and cannot be reused for an immediate or different delivery', () => {
  const priced = priceOrder(input, products, {});
  const address = 'Endereço local de teste';
  const immediate = checkoutFingerprint(priced, address);
  const scheduled = checkoutFingerprint(priced, address, '2099-01-01T11:00:00-03:00');
  assert.equal(immediate, checkoutFingerprint(priced, address, undefined));
  assert.equal(scheduled, checkoutFingerprint(priced, address, '2099-01-01T11:00:00-03:00'));
  assert.notEqual(scheduled, immediate);
  assert.notEqual(scheduled, checkoutFingerprint(priced, address, '2099-01-01T12:00:00-03:00'));
  assert.notEqual(scheduled, checkoutFingerprint(priced, 'Outro endereço', '2099-01-01T11:00:00-03:00'));
});
test('JSON catalogs and mixed legacy options price delivery without losing selected options', () => {
  process.env.ADMIN_SESSION_SECRET=randomUUID()+randomUUID();
  const address='Endereço de teste Curitiba, PR';
  const configs={store_lat:'-25.35',store_lng:'-49.2',free_delivery_radius:'0.1',fee_per_km:'2',max_delivery_radius:'20'};
  for (const variations of [JSON.stringify([{name:'Grande',price:2},{name:'Queijo',price:1.5,isAdditional:true}]), [{name:'Grande',price:2},{name:'Queijo',price:1.5,isAdditional:true}]]) {
    const catalog=[{id:'p',name:'Produto real',price:10,variations}];
    for (const method of ['pix','dinheiro']) {
      const result=priceOrder({...input,type:'entrega',customer:{address},payment:{method},deliveryToken:deliveryToken(address,'-25.4','-49.2')},catalog,configs);
      assert.equal(result.subtotal,27); assert.ok(result.deliveryFee>0);assert.equal(result.total,27+result.deliveryFee);
      assert.equal(result.items[0].variation?.name,'Grande'); assert.equal(result.items[0].additionals[0].name,'Queijo');
    }
    assert.throws(()=>priceOrder({...input,items:[{...input.items[0],variation:{name:'Falsa'}}]},catalog,{}),/opção/);
    assert.throws(()=>priceOrder({...input,items:[{...input.items[0],additionals:[{name:'Falso'}]}]},catalog,{}),/Adicional/);
  }
  const onlyExtras=[{id:'p',name:'Produto real',price:10,variations:JSON.stringify([{name:'Queijo',price:1.5,isAdditional:true}])}];
  assert.equal(priceOrder({...input,items:[{...input.items[0],variation:undefined}]},onlyExtras,{}).total,23);
  const separate=[{id:'p',name:'Produto real',price:10,variations:JSON.stringify([{name:'Grande',price:2}]),additionals:JSON.stringify([{name:'Queijo',price:1.5}])}];
  assert.equal(priceOrder(input,separate,{}).total,27);
  assert.throws(()=>priceOrder(input,[{...separate[0],variations:'broken JSON'}],{}));
});
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
  const configs={store_lat:'-25.35',store_lng:'-49.2',free_delivery_radius:'0',fee_per_km:'2',max_delivery_radius:'5'};
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

test('delivery requires explicit rates, preserves zero and refuses inconsistent areas', () => {
  const configs={store_lat:'-25.35',store_lng:'-49.2',free_delivery_radius:'0',fee_per_km:'0',max_delivery_radius:'0'};
  assert.deepEqual(quoteDelivery(configs,'-25.35','-49.2'),{fee:0,distance:0});
  assert.throws(()=>quoteDelivery(configs,'-25.36','-49.2'),/até 0 km/);
  for(const key of ['free_delivery_radius','fee_per_km','max_delivery_radius']) {
    for(const value of [undefined,'',' ', '-1','NaN','Infinity']) assert.throws(()=>quoteDelivery({...configs,[key]:value},'-25.35','-49.2'),/configurar/);
  }
  assert.throws(()=>quoteDelivery({...configs,free_delivery_radius:'1'},'-25.35','-49.2'),/gratuita/);
  assert.ok(quoteDelivery({...configs,max_delivery_radius:'5',fee_per_km:'1,5'},'-25.36','-49.2').fee>1.5);
});
