import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {Client} from '@libsql/client';
import {hashPassword} from './admin-auth.js';
const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export class PasswordRecovery {
 constructor(readonly client:Client){}
 async issue(user:{id:string;password:string},now=Date.now()){
  const token=randomBytes(32).toString('base64url');
  const result=await this.client.execute({sql:'INSERT INTO password_recovery(user_id,token_hash,password_hash,issued_at,expires_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,password_hash=excluded.password_hash,issued_at=excluded.issued_at,expires_at=excluded.expires_at WHERE password_recovery.issued_at<=?',args:[user.id,tokenHash(token),user.password,now,now+30*60000,now-60000]});
  return result.rowsAffected?token:null;
 }
 async reset(token:string,password:string,now=Date.now()){
  if(!/^[a-zA-Z0-9_-]{43}$/.test(token))return false;
  const hash=tokenHash(token),next=await hashPassword(password),version=randomUUID();
  const results=await this.client.batch([
   {sql:"UPDATE users SET payload=json_set(payload,'$.password',?,'$.authVersion',?) WHERE id=(SELECT user_id FROM password_recovery WHERE token_hash=? AND expires_at>?) AND json_extract(payload,'$.password')=(SELECT password_hash FROM password_recovery WHERE token_hash=?)",args:[next,version,hash,now,hash]},
   {sql:'DELETE FROM password_recovery WHERE token_hash=?',args:[hash]},
  ],'write');return results[0].rowsAffected===1;
 }
 async change(user:{id:string;password:string},password:string){
  const next=await hashPassword(password),version=randomUUID();
  const results=await this.client.batch([{sql:"UPDATE users SET payload=json_set(payload,'$.password',?,'$.authVersion',?) WHERE id=? AND json_extract(payload,'$.password')=?",args:[next,version,user.id,user.password]},{sql:'DELETE FROM password_recovery WHERE user_id=?',args:[user.id]}],'write');
  return results[0].rowsAffected===1?version:null;
 }
}
