import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {Database,migrate} from '../server/database';
test('installation counting deduplicates browsers and calendar statistics use shop time',async()=>{
 const client=createClient({url:':memory:'}),db=new Database(client);try{
 await migrate(client);
 for(const [id,sessionId,timestamp,isPwa,userAgent] of [
 ['prior-month','browser-a','2026-10-01T02:59:59.000Z',false,'Chrome'],
 ['month-start','browser-a','2026-10-01T03:00:00.000Z',true,'Chrome'],
 ['app-repeat','browser-a','2026-10-13T02:00:00.000Z',true,'Chrome'],
 ['install','browser-a','2026-10-13T03:10:00.000Z',true,'PWA_INSTALL_EVENT'],
 ['other-install','browser-b','2026-10-13T03:10:00.000Z',true,'PWA_INSTALL_EVENT'],
 ['today','browser-c','2026-10-13T03:20:00.000Z',false,'Chrome'],
 ] as const)await db.collection('visits').doc(id).create({sessionId,timestamp,isPwa,userAgent});
 const now=new Date('2026-10-13T04:00:00.000Z');
 await db.collection('presence').doc('active').create({lastSeen:'2026-10-13T03:58:00.000Z'});
 await db.collection('presence').doc('stale').create({lastSeen:'2026-10-13T03:56:59.000Z'});
 const s=await db.stats(now);
 assert.equal(s.visits.installs,2);assert.equal(s.visits.total,4);assert.equal(s.visits.month,3);assert.equal(s.visits.pwa,2);
 assert.deepEqual(s.history.slice(-2),[{date:'12/10',count:1},{date:'13/10',count:1}]);assert.equal(s.online.length,1);
 }finally{client.close();}
});
