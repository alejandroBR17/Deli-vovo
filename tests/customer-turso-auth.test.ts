import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {createClient} from '@libsql/client';
import {migrate} from '../server/database';

test('empty Turso authenticates new customers without falling back to local files',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vovo-auth-'));
 process.env.NODE_ENV='test';delete process.env.VERCEL;delete process.env.GOOGLE_SHEETS_SCRIPT_URL;
 process.env.TEST_DATA_DIR=directory;process.env.TURSO_DATABASE_URL='file:'+path.join(directory,'auth.sqlite');delete process.env.TURSO_AUTH_TOKEN;
 process.env.ADMIN_SESSION_SECRET=randomUUID()+randomUUID();process.env.ADMIN_PASSWORD=randomUUID();
 const client=createClient({url:process.env.TURSO_DATABASE_URL});await migrate(client);
 const {default:app,closeDatabase}=await import('../api/index');const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+((server.address() as any).port)+'/api';
 const post=(route:string,data:unknown)=>fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
 try {
  const missing=await post('/auth/login',{email:'missing@example.test',password:'local-only-password'});assert.equal(missing.status,401);
  const body={name:'Cliente Local',email:'customer@example.test',password:'local-only-password',phone:'41999999999'};
  const registered=await post('/auth/register',body);assert.equal(registered.status,200);const result=await registered.json();assert.equal(result.success,true);assert.equal(result.user.password,undefined);
  const rows=await client.execute('SELECT payload FROM users');assert.equal(rows.rows.length,1);assert.match(JSON.parse(String(rows.rows[0].payload)).password,/^scrypt:/);
  assert.equal((await post('/auth/register',body)).status,400);
  assert.equal((await post('/auth/login',{email:body.email,password:'wrong'})).status,401);
  const login=await post('/auth/login',{email:body.email,password:body.password});assert.equal(login.status,200);assert.equal((await login.json()).user.id,result.user.id);
  const cookie=login.headers.get('set-cookie')!.split(';')[0];const patch=(id:string)=>fetch(base+'/users/'+id,{method:'PATCH',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({name:'Cliente Atualizado',phone:body.phone})});
  assert.equal((await patch(result.user.id)).status,200);
  assert.equal((await patch(randomUUID())).status,401);
  await client.execute({sql:'DELETE FROM users WHERE id=?',args:[result.user.id]});assert.equal((await patch(result.user.id)).status,404);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory,'users.json'),'utf8')),[]);
 } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));closeDatabase();client.close();assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith('vovo-auth-'));await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});
