import 'dotenv/config';
import { createSign } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import firebaseConfig from '../firebase-applet-config.json';

// Read-only export through the official Firestore REST API. No Firebase SDK is used by the application.
const credentialFile = process.env.LEGACY_FIREBASE_SERVICE_ACCOUNT_FILE;
if (!credentialFile) throw new Error('Defina LEGACY_FIREBASE_SERVICE_ACCOUNT_FILE com o caminho privado da conta de serviço. Não envie a chave pela conversa.');
const account = JSON.parse(await readFile(credentialFile, 'utf8'));
const encode = (value: any) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key).toString('base64url');
const authorization = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signature }), signal: AbortSignal.timeout(15000) });
if (!authorization.ok) throw new Error(`Autorização recusada (${authorization.status}).`);
const { access_token } = await authorization.json() as any;
const project = process.env.LEGACY_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const database = process.env.LEGACY_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';
const decode = (value: any): any => {
  if ('nullValue' in value) return null;
  for (const key of ['stringValue','timestampValue','booleanValue','doubleValue','referenceValue']) if (key in value) return value[key];
  if ('integerValue' in value) return Number(value.integerValue);
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decode(item)]));
  if ('geoPointValue' in value) return value.geoPointValue;
  throw new Error('Formato de campo inesperado. Revise o exportador.');
};
const bundle: Record<string,any[]> = {};
for (const collection of ['products','orders','users','configs','visits']) {
  bundle[collection] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/${encodeURIComponent(database)}/documents/${collection}`);
    url.searchParams.set('pageSize','100'); if (pageToken) url.searchParams.set('pageToken',pageToken);
    const response = await fetch(url,{headers:{Authorization:`Bearer ${access_token}`},signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Não foi possível exportar ${collection} (${response.status}). A origem não foi alterada.`);
    const page = await response.json() as any;
    for (const document of page.documents || []) {
      const id = document.name.split('/').at(-1);
      if (collection === 'configs' && /vapid|secret|password|token|private/i.test(id)) continue;
      const data = Object.fromEntries(Object.entries(document.fields || {}).map(([key,value]) => [key,decode(value)]));
      bundle[collection].push({ ...data,id });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  console.log(`${collection}: ${bundle[collection].length} registros`);
}
const destination = path.resolve(process.argv[2] || 'data/migration/export.json');
await mkdir(path.dirname(destination),{recursive:true});
await writeFile(destination,JSON.stringify(bundle),{flag:'wx',mode:0o600});
console.log('Export privado salvo, sem sobrescrever arquivos existentes. Notificações precisam ser recadastradas com as novas chaves.');
