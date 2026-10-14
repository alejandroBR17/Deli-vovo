import { test } from 'node:test';
import assert from 'node:assert/strict';

test('worker initialization retries after failure and shares concurrent activation without waiting for page load', async () => {
  const nav=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  const win=Object.getOwnPropertyDescriptor(globalThis,'window');
  let calls=0,activate!:()=>void;
  const registration={active:{state:'activated'}};
  Object.defineProperty(globalThis,'window',{configurable:true,value:{isSecureContext:true}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{register:async(url:string,options:any)=>{
    assert.equal(url,'/sw.js');assert.equal(options.scope,'/');calls++;
    if(calls===1)throw new Error('Registration refused');
    await new Promise<void>(resolve=>{activate=resolve;});return registration;
  }}}});
  try {
    const {ensureServiceWorker}=await import('../src/utils/service-worker');
    await assert.rejects(ensureServiceWorker(),/não conseguiu preparar/);
    const first=ensureServiceWorker(),second=ensureServiceWorker();assert.equal(first,second);assert.equal(calls,2);
    activate();assert.equal(await first,registration);assert.equal(await second,registration);assert.equal(await ensureServiceWorker(),registration);assert.equal(calls,2);
    (globalThis as any).window.isSecureContext=false;await assert.rejects(ensureServiceWorker(),/HTTPS/);
  } finally {
    if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete (globalThis as any).navigator;
    if(win)Object.defineProperty(globalThis,'window',win);else delete (globalThis as any).window;
  }
});
