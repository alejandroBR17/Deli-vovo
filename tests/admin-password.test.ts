import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID,createHmac } from 'node:crypto';
import { createClient } from '@libsql/client';
import { Database,migrate } from '../server/database';
import { adminCredentialStore } from '../server/admin-credentials';
import { hashPassword } from '../server/admin-auth';

test('admin password is hashed, persistent, changes only with current password and invalidates old sessions without exposing credentials',async()=>{
  const directory=await fs.mkdtemp(path.join(tmpdir(),'vovo-admin-password-'));
  process.env.NODE_ENV='test';delete process.env.VERCEL;process.env.TEST_DATA_DIR=directory;
  process.env.TURSO_DATABASE_URL='file:'+path.join(directory,'security.sqlite');
  delete process.env.TURSO_AUTH_TOKEN;delete process.env.GOOGLE_SHEETS_SCRIPT_URL;
  process.env.ADMIN_PASSWORD='local-initial-password';process.env.ADMIN_SESSION_SECRET=randomUUID()+randomUUID();
  const client=createClient({url:process.env.TURSO_DATABASE_URL});await migrate(client);
  const {default:app,closeDatabase}=await import('../api/index');const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+((server.address() as any).port)+'/api';
  const request=(url:string,body?:any,cookie='',header=true)=>fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(header?{'x-vovo-admin':'1'}:{}),...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  try {
    const login=await request('/admin/login',{password:process.env.ADMIN_PASSWORD});assert.equal(login.status,200);const old=login.headers.get('set-cookie')!.split(';')[0];
    const next='local-new-password',change={currentPassword:process.env.ADMIN_PASSWORD,newPassword:next,confirmation:next};
    assert.equal((await request('/admin/password',change)).status,401);
    assert.equal((await request('/admin/password',change,old,false)).status,403);
    assert.equal((await request('/admin/password',{...change,currentPassword:'wrong'},old)).status,400);
    assert.equal((await request('/admin/session',undefined,old)).status,200,'Wrong current password must not end a valid session');
    assert.equal((await request('/admin/password',{...change,newPassword:'short',confirmation:'short'},old)).status,400);
    assert.equal((await request('/admin/password',{...change,confirmation:'different'},old)).status,400);
    const changed=await request('/admin/password',change,old);assert.equal(changed.status,200);const fresh=changed.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await request('/admin/session',undefined,fresh)).status,200);
    assert.equal((await request('/admin/session',undefined,old)).status,401);
    const expires=String(Math.floor(Date.now()/1000)+600),signature=createHmac('sha256',process.env.ADMIN_SESSION_SECRET!).update(expires).digest('base64url');
    assert.equal((await request('/admin/session',undefined,'vovo_admin_session='+expires+'.'+signature)).status,401,'Legacy session cannot bypass a password change');
    assert.equal((await request('/admin/login',{password:process.env.ADMIN_PASSWORD})).status,401);
    assert.equal((await request('/admin/login',{password:next})).status,200);
    for(const cookie of ['',fresh]){const data=await(await request('/configs',undefined,cookie)).json();assert.ok(!JSON.stringify(data).includes('scrypt:'));assert.ok(!JSON.stringify(data).includes(next));}
    const stored=(await client.execute("SELECT password_hash FROM admin_security WHERE id='owner'")).rows[0];assert.match(String(stored.password_hash),/^scrypt:/);assert.ok(!String(stored.password_hash).includes(next));
    const a=adminCredentialStore(new Database(client),directory,()=>{}),second=createClient({url:process.env.TURSO_DATABASE_URL});
    try {const b=adminCredentialStore(new Database(second),directory,()=>{}),before=(await a.read())!;assert.deepEqual(await b.read(),before);const hash=await hashPassword('another-local-password');const results=await Promise.all([a.change(before.version,{hash,version:'A'.repeat(24)}),b.change(before.version,{hash,version:'B'.repeat(24)})]);assert.equal(results.filter(Boolean).length,1,'Concurrent changes cannot overwrite each other');await migrate(client);assert.ok(await b.read());}finally{second.close();}
  } finally {
    await new Promise<void>(resolve=>server.close(()=>resolve()));closeDatabase();client.close();
    assert.equal(path.dirname(directory),tmpdir());assert.ok(path.basename(directory).startsWith('vovo-admin-password-'));await fs.rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});
