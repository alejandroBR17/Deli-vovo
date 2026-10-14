import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Standalone ESM repository hygiene script.
import {secretKinds} from '../scripts/check-secrets.mjs';
test('repository check flags credential patterns without printing values, allowing only the known local fixture',()=>{
 assert.deepEqual(secretKinds(['sk','live', 'x'.repeat(32)].join('_')),['provider-token']);
 assert.deepEqual(secretKinds('-----BEGIN '+ 'PRIVATE KEY-----'),['private-key']);
 assert.deepEqual(secretKinds('AI'+'za'+'x'.repeat(35)),['google-api-key']);
 assert.deepEqual(secretKinds(['APP','USR'].join('_')+'-1234567890-12345678-'+ 'a'.repeat(32)+'-123456789'),['mercado-pago-token']);
 assert.deepEqual(secretKinds(['sk','test','local','fixture','no','network'].join('_')),[]);
 assert.deepEqual(secretKinds('MERCADO_PAGO_ACCESS_TOKEN=\nAUTH_SMTP_PASSWORD=\n'),[]);
});
