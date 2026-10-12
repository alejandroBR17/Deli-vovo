import fs from 'fs-extra';
import path from 'node:path';
import type { Database } from './database';
export type AdminCredential = { hash: string; version: string };

export function adminCredentialStore(database: Database | null, directory: string, requireLocal: () => void) {
  const file = path.join(directory, 'admin-security.json');
  let writes: Promise<unknown> = Promise.resolve();
  function validate(value: AdminCredential | null) {
    if (value && (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value.hash) || !/^[A-Za-z0-9_-]{24}$/.test(value.version))) throw new Error('Configuração de acesso inválida.');
    return value;
  }
  async function read(): Promise<AdminCredential | null> {
    if (database) {
      const rows = await database.rows("SELECT password_hash,version FROM admin_security WHERE id='owner'");
      return validate(rows.length ? { hash: String(rows[0].password_hash), version: String(rows[0].version) } : null);
    }
    requireLocal();
    try { return validate(await fs.readJson(file)); }
    catch (error: any) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function change(expected: string, next: AdminCredential) {
    if (database) {
      const result = await database.client.execute({
        sql: "INSERT INTO admin_security(id,password_hash,version) VALUES ('owner',?,?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,version=excluded.version WHERE admin_security.version=?",
        args: [next.hash, next.version, expected],
      });
      return result.rowsAffected === 1;
    }
    requireLocal();
    const task = writes.then(async () => {
      const current = await read();
      if (current && current.version !== expected) return false;
      await fs.outputJson(file, next); return true;
    });
    writes = task.catch(() => {});
    return task;
  }
  return {read, change};
}
