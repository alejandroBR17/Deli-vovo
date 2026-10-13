import {test} from 'node:test';import assert from 'node:assert/strict';import nodemailer from 'nodemailer';import {passwordEmailReady,sendPasswordRecovery} from '../server/password-email';
import {recoveryEmailContent} from '../server/password-email-template';
test('Gmail recovery uses TLS, app-password normalization and a fragment link, without claiming rejected mail succeeded',async context=>{
 const keys=['AUTH_SMTP_HOST','AUTH_SMTP_PORT','AUTH_SMTP_USER','AUTH_SMTP_PASSWORD','AUTH_EMAIL_FROM','AUTH_PUBLIC_URL'],before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try {Object.assign(process.env,{AUTH_SMTP_HOST:'smtp.gmail.com',AUTH_SMTP_PORT:'465',AUTH_SMTP_USER:'sender@example.test',AUTH_SMTP_PASSWORD:'abcd efgh ijkl mnop',AUTH_EMAIL_FROM:'sender@example.test',AUTH_PUBLIC_URL:'https://example.test'});assert.equal(passwordEmailReady(),true);let accepted=true,closed=0,message:any;
 context.mock.method(nodemailer,'createTransport',(options:any)=>{assert.equal(options.secure,true);assert.equal(options.requireTLS,true);assert.equal(options.auth.pass,'abcdefghijklmnop');return {sendMail:async (mail:any)=>{message=mail;return {accepted:accepted?[mail.to]:[]};},close:()=>closed++};});
 await sendPasswordRecovery('recipient@example.test','test-token','dark');assert.equal(closed,1);assert.ok(message.text.includes('https://example.test/#recuperar-senha?token=test-token'));assert.equal(message.to,'recipient@example.test');assert.ok(!message.text.includes('abcdefghijklmnop'));assert.ok(message.html.includes('background-color:#191b20'));
 assert.ok(message.html.includes('Delícias da Vovó Grazy'));assert.ok(message.html.includes('Escolher nova senha'));assert.ok(message.html.includes('https://example.test/#recuperar-senha?token=test-token'));assert.ok(!message.html.includes('abcdefghijklmnop'));
 accepted=false;await assert.rejects(sendPasswordRecovery('recipient@example.test','test-token'));assert.equal(closed,2);
 process.env.AUTH_PUBLIC_URL='https://example.test/unsafe?redirect=other';assert.equal(passwordEmailReady(),false);
 }finally{for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}
});

test('branded recovery email preserves secure links and readable text without external assets',()=>{
 const message=recoveryEmailContent('https://delivovo.vercel.app','"><script>alert(1)</script>');
 assert.ok(message.text.includes('30 minutos'));assert.ok(message.text.includes('Não compartilhe este link'));
 assert.ok(message.html.includes('lang="pt-BR"'));assert.ok(message.html.includes('role="presentation"'));assert.ok(message.html.includes('max-width:560px'));
 assert.ok(!/<script|<form|<img|<iframe|<link\b/i.test(message.html));assert.ok(!message.html.includes('alert(1)</script>'));
 assert.ok(message.html.includes('https://delivovo.vercel.app/#recuperar-senha?token=%22%3E%3Cscript%3E'));
 for(const url of ['http://delivovo.vercel.app','https://user:secret@delivovo.vercel.app','https://delivovo.vercel.app/other','https://delivovo.vercel.app/?redirect=evil'])assert.throws(()=>recoveryEmailContent(url,'token'));
});

test('email themes keep the same reset link and text while using app colors and a visible button',()=>{
 const light=recoveryEmailContent('https://delivovo.vercel.app','token','light'),dark=recoveryEmailContent('https://delivovo.vercel.app','token','dark');
 assert.equal(light.text,dark.text);assert.ok(light.html.includes('background-color:#fff7ed'));assert.ok(dark.html.includes('background-color:#191b20'));assert.ok(dark.html.includes('background-color:#252830'));assert.ok(dark.html.includes('color:#f7ecdf'));assert.ok(dark.html.includes('color:#ff9d8a'));assert.ok(dark.html.includes('background-color:#dc171c;color:#fff'));assert.ok(dark.html.includes('content="dark"'));
 for(const value of [light,dark])assert.ok(value.html.includes('href="https://delivovo.vercel.app/#recuperar-senha?token=token"'));
});
