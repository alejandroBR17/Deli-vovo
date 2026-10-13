import {test} from 'node:test';import assert from 'node:assert/strict';import nodemailer from 'nodemailer';import {passwordEmailReady,sendPasswordRecovery} from '../server/password-email';
test('Gmail recovery uses TLS, app-password normalization and a fragment link, without claiming rejected mail succeeded',async context=>{
 const keys=['AUTH_SMTP_HOST','AUTH_SMTP_PORT','AUTH_SMTP_USER','AUTH_SMTP_PASSWORD','AUTH_EMAIL_FROM','AUTH_PUBLIC_URL'],before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try {Object.assign(process.env,{AUTH_SMTP_HOST:'smtp.gmail.com',AUTH_SMTP_PORT:'465',AUTH_SMTP_USER:'sender@example.test',AUTH_SMTP_PASSWORD:'abcd efgh ijkl mnop',AUTH_EMAIL_FROM:'sender@example.test',AUTH_PUBLIC_URL:'https://example.test'});assert.equal(passwordEmailReady(),true);let accepted=true,closed=0,message:any;
 context.mock.method(nodemailer,'createTransport',(options:any)=>{assert.equal(options.secure,true);assert.equal(options.requireTLS,true);assert.equal(options.auth.pass,'abcdefghijklmnop');return {sendMail:async (mail:any)=>{message=mail;return {accepted:accepted?[mail.to]:[]};},close:()=>closed++};});
 await sendPasswordRecovery('recipient@example.test','test-token');assert.equal(closed,1);assert.ok(message.text.includes('https://example.test/#recuperar-senha?token=test-token'));assert.equal(message.to,'recipient@example.test');assert.ok(!message.text.includes('abcdefghijklmnop'));
 accepted=false;await assert.rejects(sendPasswordRecovery('recipient@example.test','test-token'));assert.equal(closed,2);
 process.env.AUTH_PUBLIC_URL='https://example.test/unsafe?redirect=other';assert.equal(passwordEmailReady(),false);
 }finally{for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}
});
