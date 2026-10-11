import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { migrate } from '../server/database';
import { seedStoreDefaults } from '../server/store-defaults';
import { parseMoneyInput, formatMoneyInput } from '../src/utils/money-input';

test('confirmed address and preview-only values are initialized without replacing edited settings', async()=>{
  const client=createClient({url:':memory:'});
  try {
    await migrate(client);await seedStoreDefaults(client,false);
    const get=async(key:string)=>{const result=await client.execute({sql:'SELECT payload FROM configs WHERE id=?',args:[key]});return result.rows[0]?JSON.parse(String(result.rows[0].payload)).value:undefined;};
    assert.equal(await get('store_number'),'2429');assert.equal(await get('store_lat'),'-25.3498099');assert.equal(await get('fee_per_km'),undefined);
    await seedStoreDefaults(client,true);assert.equal(await get('free_delivery_radius'),'2');assert.equal(await get('fee_per_km'),'2');
    await client.execute({sql:'UPDATE configs SET payload=? WHERE id=?',args:[JSON.stringify({value:'3'}),'fee_per_km']});
    await seedStoreDefaults(client,true);assert.equal(await get('fee_per_km'),'3');
    await client.execute({sql:'UPDATE configs SET payload=? WHERE id=?',args:[JSON.stringify({value:''}),'store_number']});
    await seedStoreDefaults(client,true);assert.equal(await get('store_number'),'2429');
  }finally{client.close();}
});

test('Brazilian monetary input keeps reais, cents and pasted formatted values without accepting invalid prices',()=>{
  assert.equal(parseMoneyInput('5,50'),5.5);assert.equal(parseMoneyInput('1.234,56'),1234.56);assert.equal(parseMoneyInput('R$ 10,00'),10);assert.equal(parseMoneyInput('5.50'),5.5);
  assert.equal(formatMoneyInput('5,5'),'5,50');assert.equal(formatMoneyInput(0),'0,00');
  for(const value of ['', '-1','1,234','abc','NaN',Infinity])assert.equal(parseMoneyInput(value),null);
});
