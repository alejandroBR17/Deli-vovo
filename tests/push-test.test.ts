import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import webpush from 'web-push';

test('admin delayed test acknowledges scheduling before delivery, requires session and only targets registered admin', async () => {
  process.env.NODE_ENV='test'; delete process.env.VERCEL;
  process.env.TEST_DATA_DIR=await fs.mkdtemp(path.join(process.cwd(),'data/push-test-'));
  process.env.ADMIN_PASSWORD=randomUUID();process.env.ADMIN_SESSION_SECRET=randomUUID()+randomUUID();
  const vapid=webpush.generateVAPIDKeys();process.env.VAPID_PUBLIC_KEY=vapid.publicKey;process.env.VAPID_PRIVATE_KEY=vapid.privateKey;
  const endpoint='https://fcm.googleapis.com/fcm/send/local-test';
  await fs.writeFile(path.join(process.env.TEST_DATA_DIR,'push_subscriptions.json'),JSON.stringify([{endpoint,role:'admin',userId:'admin-user',keys:{p256dh:'local',auth:'local'}}]));
  const {default:app}=await import('../api/index');const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+((server.address() as any).port)+'/api',sent: any[]=[];
  const original=webpush.sendNotification;
  webpush.sendNotification=(async (subscription:any,payload:any)=>{sent.push({subscription,payload:JSON.parse(payload)});return {statusCode:201,body:'',headers:{}};}) as typeof original;
  const request=(url:string,body:any,cookie='')=>fetch(base+url,{method:'POST',headers:{'content-type':'application/json','x-vovo-admin':'1',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
  try {
    assert.equal((await request('/admin/test-push',{endpoint,delaySeconds:10})).status,401);
    const login=await request('/admin/login',{password:process.env.ADMIN_PASSWORD});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await request('/admin/test-push',{endpoint:'missing',delaySeconds:10},cookie)).status,404);
    assert.equal((await request('/admin/test-push',{endpoint,delaySeconds:600},cookie)).status,400);
    assert.equal((await request('/admin/test-push',{endpoint},cookie)).status,200);assert.equal(sent.length,1);
    const scheduled=await request('/admin/test-push',{endpoint,delaySeconds:10},cookie);assert.equal(scheduled.status,202);assert.equal((await scheduled.json()).scheduled,true);assert.equal(sent.length,1);
    await new Promise(resolve=>setTimeout(resolve,10100));assert.equal(sent.length,2);assert.equal(sent[1].subscription.endpoint,endpoint);assert.equal(sent[1].payload.title,'Teste com a tela bloqueada');
  } finally {
    webpush.sendNotification=original;await new Promise<void>(resolve=>server.close(()=>resolve()));
    const directory=process.env.TEST_DATA_DIR!;
    assert.equal(path.dirname(directory),path.resolve('data'));assert.ok(path.basename(directory).startsWith('push-test-'));
    await fs.rm(directory,{recursive:true,force:true});
  }
});
