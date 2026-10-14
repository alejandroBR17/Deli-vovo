import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
const target=path.resolve('data/vapid.private.env');
fs.mkdirSync(path.dirname(target),{recursive:true});
const keys=webpush.generateVAPIDKeys();
try {
 fs.writeFileSync(target,`VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=mailto:seu-email@example.com\n`,{flag:'wx',mode:0o600});
 console.log('Chaves salvas em data/vapid.private.env. Use um par por ambiente; não compartilhe a chave privada.');
} catch(error) {
 if(error.code==='EEXIST'){console.error('O arquivo privado já existe; ele não foi substituído.');process.exitCode=1;}
 else throw error;
}
