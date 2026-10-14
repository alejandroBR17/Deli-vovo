import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startVisiblePolling } from '../src/utils/visible-polling';

test('hidden/offline tabs pause, returning refreshes once, failures back off and calls never overlap', async context => {
  const doc=Object.assign(new EventTarget(),{visibilityState:'visible'});
  const win=new EventTarget(); const nav={onLine:true};
  Object.defineProperty(globalThis,'document',{value:doc,configurable:true});
  Object.defineProperty(globalThis,'window',{value:win,configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:nav,configurable:true});
  context.mock.timers.enable({apis:['setTimeout']});
  let calls=0; let release: ((value:unknown)=>void)|undefined;
  const stop=startVisiblePolling(()=>{calls++;return new Promise(resolve=>{release=resolve;});},1000);
  const flush=async()=>{for(let i=0;i<5;i++) await Promise.resolve();};
  assert.equal(calls,1);
  win.dispatchEvent(new Event('online')); context.mock.timers.tick(10000); assert.equal(calls,1);
  release!(false); await flush();
  context.mock.timers.tick(1000); assert.equal(calls,1);
  context.mock.timers.tick(1000); assert.equal(calls,2);
  doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));
  release!(true);await flush();context.mock.timers.tick(20000);assert.equal(calls,2);
  doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,3);
  nav.onLine=false;win.dispatchEvent(new Event('offline'));release!(true);await flush();
  context.mock.timers.tick(20000);assert.equal(calls,3);
  nav.onLine=true;win.dispatchEvent(new Event('online'));assert.equal(calls,4);
  stop();release!(true);await flush();context.mock.timers.tick(20000);assert.equal(calls,4);
  context.mock.timers.reset();
});

test('a ten-minute poll is not shortened to five minutes by the backoff ceiling', async context => {
  Object.defineProperty(globalThis,'document',{value:Object.assign(new EventTarget(),{visibilityState:'visible'}),configurable:true});
  Object.defineProperty(globalThis,'window',{value:new EventTarget(),configurable:true});
  Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
  context.mock.timers.enable({apis:['setTimeout']});
  let calls=0;
  const stop=startVisiblePolling(async()=>{calls++;},600000);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(calls,1);
  context.mock.timers.tick(599999);assert.equal(calls,1);
  context.mock.timers.tick(1);assert.equal(calls,2);
  stop();context.mock.timers.reset();
});
