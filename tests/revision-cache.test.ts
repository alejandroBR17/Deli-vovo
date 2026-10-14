import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RevisionCache} from '../server/revision-cache';
import {Database,migrate} from '../server/database';
import {createClient} from '@libsql/client';

test('independent servers see committed settings immediately while unchanged reads reuse the payload',async()=>{
 const client=createClient({url:':memory:'}),database=new Database(client);
 try {
  await migrate(client);
  await database.collection('configs').doc('cash_enabled').set({value:'false'});
  let fullReads=0,revisionReads=0;
  const instance=()=>new RevisionCache(async()=>{revisionReads++;return database.configRevision();},async()=>{
   fullReads++;const rows=await database.rows('SELECT id,payload FROM configs');
   return Object.fromEntries(rows.map(row=>[String(row.id),JSON.parse(String(row.payload)).value]));
  });
  const first=instance(),second=instance();
  assert.equal((await first.read()).cash_enabled,'false');assert.equal((await second.read()).cash_enabled,'false');
  await first.read();await second.read();assert.equal(fullReads,2);assert.equal(revisionReads,4);
  await database.collection('configs').doc('cash_enabled').set({value:'true'});
  assert.equal((await first.read()).cash_enabled,'true');assert.equal((await second.read()).cash_enabled,'true');assert.equal(fullReads,4);
  const revision=await database.configRevision();
  await database.collection('configs').doc('cash_enabled').set({value:'true'});assert.equal(await database.configRevision(),revision);
  await migrate(client);assert.equal(await database.configRevision(),revision);
  await first.read();assert.equal(fullReads,4);
  await database.collection('configs').doc('cash_enabled').delete();assert.equal((await second.read()).cash_enabled,undefined);
  const plan=await database.rows("EXPLAIN QUERY PLAN SELECT version FROM cache_revisions WHERE id='configs'");
  assert.ok(plan.some(row=>/SEARCH.*INDEX/i.test(String(row.detail))));
 }finally{client.close();}
});

test('late reads cannot repopulate invalidated cache and concurrent payload loads are shared',async()=>{
 let revision=0,loads=0;
 let release!:(value:string)=>void,started!:()=>void;
 const begun=new Promise<void>(resolve=>{started=resolve;});
 const cache=new RevisionCache(async()=>revision,()=>{
  loads++;if(loads===1){started();return new Promise<string>(resolve=>{release=resolve;});}return Promise.resolve('new');
 });
 const old=cache.read();await begun;
 const same=cache.read();await Promise.resolve();await Promise.resolve();assert.equal(loads,1);
 revision++;cache.invalidate();assert.equal(await cache.read(),'new');release('old');assert.equal(await old,'old');assert.equal(await same,'old');
 assert.equal(await cache.read(),'new');assert.equal(loads,2);
});

test('revision or payload failures never serve stale settings and a later retry can recover',async()=>{
 let revision=0,failRevision=false,failPayload=false;
 const cache=new RevisionCache(async()=>{if(failRevision)throw Error('database unavailable');return revision;},async()=>{if(failPayload)throw Error('read failure');return revision;});
 assert.equal(await cache.read(),0);failRevision=true;await assert.rejects(cache.read());failRevision=false;revision++;failPayload=true;await assert.rejects(cache.read());failPayload=false;assert.equal(await cache.read(),1);
});
