import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {Database,migrate} from '../server/database';
import {PasswordRecovery} from '../server/password-recovery';
import {hashPassword,verifyPassword} from '../server/admin-auth';
test('recovery tokens are hashed, expire, bind the prior password and are consumed once atomically',async()=>{
 const client=createClient({url:':memory:'}),db=new Database(client),service=new PasswordRecovery(client);try{
 await migrate(client);const password=await hashPassword('oldsecret');const user={id:'local-user',name:'Local',email:'local@example.test',password};await db.collection('users').doc(user.id).create(user);
 const token=(await service.issue(user,100000))!;assert.equal(typeof token,'string');const rows=await client.execute('SELECT * FROM password_recovery');assert.equal(rows.rows.length,1);assert.notEqual(rows.rows[0].token_hash,token);assert.equal(JSON.stringify(rows.rows).includes(token),false);assert.equal(await service.issue(user,100001),null);
 assert.equal(await service.reset(token,'newsecret',100000+30*60000),false);assert.equal(await verifyPassword('oldsecret',(await db.collection('users').doc(user.id).get()).data().password),true);
 const fresh=(await service.issue(user,2000000))!;const results=await Promise.all([service.reset(fresh,'newsecret',2000001),service.reset(fresh,'newsecret',2000001)]);assert.equal(results.filter(Boolean).length,1);assert.equal(await service.reset(fresh,'different',2000002),false);const changed=(await db.collection('users').doc(user.id).get()).data();assert.equal(await verifyPassword('newsecret',changed.password),true);assert.ok(changed.authVersion);
 const next=(await service.issue(changed,3000000))!;await service.change(changed,'changedsecret');assert.equal(await service.reset(next,'attacker',3000001),false);assert.equal(await verifyPassword('changedsecret',(await db.collection('users').doc(user.id).get()).data().password),true);
 }finally{client.close();}
});
