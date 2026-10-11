import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupCep, formatCep } from '../src/utils/cep';

test('CEP uses a fast provider, caches only successful results and aborts a slow primary after fallback', async () => {
  const original = globalThis.fetch; let calls=0;let canceled=false;
  try {
    globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({street:'Rua de teste',neighborhood:'Bairro',city:'Cidade',state:'PR'}));};
    const address=await lookupCep('11111-111');assert.equal(address.street,'Rua de teste');
    assert.deepEqual(await lookupCep('11111111'),address);assert.equal(calls,1);
    globalThis.fetch=((url: any,options: any)=>String(url).includes('brasilapi') ? new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{canceled=true;reject(new DOMException('Canceled','AbortError'));})) : Promise.resolve(new Response(JSON.stringify({logradouro:'Rua alternativa',bairro:'Bairro',localidade:'Cidade',uf:'PR'})))) as typeof fetch;
    assert.equal((await lookupCep('22222222')).street,'Rua alternativa');assert.equal(canceled,true);
    assert.equal(formatCep('12345678999'),'12345-678');
  } finally {globalThis.fetch=original;}
});

test('CEP failures, cancellation and timeouts leave manual entry available and do not cache errors', async () => {
  const original=globalThis.fetch;
  try {
    let calls=0;globalThis.fetch=async()=>{calls++;return new Response('{}',{status:503});};
    await assert.rejects(lookupCep('33333333'),/manualmente/);await assert.rejects(lookupCep('33333333'),/manualmente/);assert.equal(calls,4);
    let aborts=0;
    globalThis.fetch=((_: any,options: any)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{aborts++;reject(new DOMException('Canceled','AbortError'));}))) as typeof fetch;
    const controller=new AbortController();const lookup=lookupCep('44444444',controller.signal);controller.abort();await assert.rejects(lookup,{name:'AbortError'});
    await assert.rejects(lookupCep('55555555'),/manualmente/);assert.ok(aborts>=3);
    await assert.rejects(lookupCep('12'),/8 números/);
  } finally {globalThis.fetch=original;}
});
