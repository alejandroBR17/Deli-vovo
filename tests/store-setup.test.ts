import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeSetup } from '../src/utils/store-setup';
import { adminFetch } from '../src/utils/admin-api';

test('store setup requires explicit saved data and accepts a zero delivery fee', () => {
  assert.equal(storeSetup({}, 0).filter(check => !check.ready).length, 5);
  const configs = { store_street:'Rua de teste', store_number:'1', store_city:'Cidade de teste', store_lat:'-25', store_lng:'-49', fee_per_km:'0', free_delivery_radius:'0', max_delivery_radius:'5', opening_start:'18:00', opening_end:'02:00', working_days:'[1,2,3]', pix_key:'chave-de-teste' };
  assert.ok(storeSetup(configs, 1).every(check => check.ready));
  for (const [key, value, id] of [['store_lat','','location'],['store_lng','190','location'],['fee_per_km','-1','delivery'],['max_delivery_radius','NaN','delivery'],['opening_start','25:00','hours'],['working_days','[]','hours'],['working_days','[7]','hours'],['pix_key',' ','pix']]) {
    assert.equal(storeSetup({ ...configs, [key]:value },1).find(check=>check.id===id)?.ready,false);
  }
  assert.equal(storeSetup({ ...configs, free_delivery_radius:'10' },1).find(check=>check.id==='delivery')?.ready,false);
});

test('failed administrative writes reject instead of allowing false success', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({error:'Banco indisponível'}),{status:503,headers:{'Content-Type':'application/json'}});
    await assert.rejects(adminFetch('/products',{method:'POST',body:'{}'}),/Banco indisponível/);
    await assert.rejects(adminFetch('/products/test',{method:'DELETE'}),/Banco indisponível/);
    assert.equal((await adminFetch('/products')).status,503);
    globalThis.fetch = async () => new Response('upstream error',{status:502});
    await assert.rejects(adminFetch('/configs',{method:'POST'}),/Não foi possível salvar/);
    globalThis.fetch = async () => new Response('{}',{status:200});
    assert.equal((await adminFetch('/configs',{method:'POST'})).status,200);
    globalThis.fetch = async () => new Response('{}',{status:401});
    assert.equal((await adminFetch('/admin/login',{method:'POST'})).status,401);
  } finally { globalThis.fetch = original; }
});
