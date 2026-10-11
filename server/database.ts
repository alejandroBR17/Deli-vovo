import { createClient, type Client, type InValue } from '@libsql/client';

export const tables = ['products', 'orders', 'users', 'configs', 'push_subscriptions', 'visits', 'presence', 'media'] as const;
type Table = typeof tables[number];
const fields = ['userId', 'sessionId', 'email', 'status', 'archived', 'date', 'timestamp', 'lastSeen', 'role'] as const;
function field(name: string) {
  if (!(fields as readonly string[]).includes(name)) throw new Error('Campo de consulta inválido.');
  return `json_extract(payload, '$.${name}')`;
}
function table(name: string): Table {
  if (!(tables as readonly string[]).includes(name)) throw new Error('Tabela inválida.');
  return name as Table;
}
const snapshot = (id: string, payload?: string) => ({ id, exists: payload !== undefined, data: (): any => payload ? JSON.parse(payload) : undefined });

// Schemas are applied explicitly by db:migrate, never when a function starts.
export async function migrate(client: Client) {
  await client.batch(tables.map(name => `CREATE TABLE IF NOT EXISTS ${name} (id TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)))`), 'write');
  const indexes: [Table, string[]][] = [
    ['orders', ['userId', 'date']], ['orders', ['status', 'date']], ['orders', ['date']],
    ['users', ['email']], ['visits', ['sessionId', 'timestamp']], ['visits', ['timestamp']],
    ['presence', ['lastSeen']], ['push_subscriptions', ['role']], ['push_subscriptions', ['userId']],
  ];
  await client.batch(indexes.map(([name, keys]) => `CREATE INDEX IF NOT EXISTS ${name}_${keys.join('_')} ON ${name} (${keys.map(field).join(',')})`), 'write');
  await client.execute(`CREATE INDEX IF NOT EXISTS orders_visible_status_date ON orders (COALESCE(${field('archived')},0),${field('status')},${field('date')})`);
  await client.execute(`CREATE INDEX IF NOT EXISTS orders_history_page ON orders (${field('date')} DESC,id DESC)`);
}

export class Database {
  constructor(readonly client: Client) {}
  collection(name: string) { return new Query(this, table(name)); }
  async rows(sql: string, args: InValue[] = []) { return (await this.client.execute({ sql, args })).rows; }
  async updateVisitAuth(sessionId: string, userId: string, authType: string, now = new Date()) {
    const start = now.toISOString().slice(0, 10) + 'T00:00:00.000Z';
    const end = new Date(Date.parse(start) + 86400000).toISOString();
    // One indexed update of today's visit; old visits and unchanged rows stay untouched.
    return this.client.execute({
      sql: `UPDATE visits SET payload=json_set(payload,'$.userId',?,'$.authType',?)
        WHERE ${field('sessionId')}=? AND ${field('timestamp')}>=? AND ${field('timestamp')}<?
        AND (COALESCE(${field('userId')},'')!=? OR COALESCE(json_extract(payload,'$.authType'),'')!=?)`,
      args: [userId, authType, sessionId, start, end, userId, authType],
    });
  }
  async statuses(ids: string[]) {
    if (!ids.length) return {};
    const rows = await this.rows(`SELECT id, ${field('status')} AS status FROM orders WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
    return Object.fromEntries(rows.map(row => [String(row.id), String(row.status)]));
  }
  async panelOrders() {
    // Keep every active order; limit only terminal history. Both branches use indexes.
    const rows = await this.rows(`SELECT id, payload FROM orders WHERE COALESCE(${field('archived')},0)=0 AND ${field('status')} NOT IN ('concluido','cancelado','pix_recusado','recusado')
      UNION SELECT id, payload FROM (SELECT id,payload FROM orders WHERE COALESCE(${field('archived')},0)=0 AND ${field('status')} IN ('concluido','cancelado','pix_recusado','recusado') ORDER BY ${field('date')} DESC LIMIT 100)`);
    return rows.map(row => ({ ...JSON.parse(String(row.payload)), id: String(row.id) }));
  }
  async activeCount() {
    const rows = await this.rows(`SELECT count(*) AS count FROM orders WHERE ${field('status')} IN ('pendente','preparando')`);
    return Number(rows[0].count);
  }
  async customerOrders(userId: string) {
    const rows = await this.rows(`SELECT id,payload FROM orders WHERE ${field('userId')}=? AND COALESCE(${field('archived')},0)=0 AND ${field('status')} NOT IN ('concluido','cancelado','pix_recusado','recusado')
      UNION SELECT id,payload FROM (SELECT id,payload FROM orders WHERE ${field('userId')}=? AND COALESCE(${field('archived')},0)=0 AND ${field('status')} IN ('concluido','cancelado','pix_recusado','recusado') ORDER BY ${field('date')} DESC LIMIT 50)`,[userId,userId]);
    return rows.map(row => ({ ...JSON.parse(String(row.payload)),id: String(row.id) }));
  }
  async history(cursor?: string) {
    const previous = cursor ? await this.collection('orders').doc(cursor).get() : undefined;
    if (cursor && !previous?.exists) throw new Error('Página inválida.');
    const date = previous?.data()?.date || '';
    const rows = await this.rows(`SELECT id,payload FROM orders WHERE COALESCE(${field('archived')},0)=0${cursor ? ` AND (${field('date')}<? OR (${field('date')}=? AND id<?))` : ''} ORDER BY ${field('date')} DESC,id DESC LIMIT 101`, cursor ? [date, date, cursor] : []);
    return { orders: rows.slice(0,100).map(row => ({ ...JSON.parse(String(row.payload)), id: String(row.id) })), nextCursor: rows.length > 100 ? String(rows[99].id) : null };
  }
  async finance(since: string) {
    const results = await this.client.batch([
      { sql: `SELECT count(*) AS count,COALESCE(sum(json_extract(payload,'$.total')),0) AS totalRevenue,
        COALESCE(sum(CASE WHEN lower(json_extract(payload,'$.paymentMethod')) LIKE '%pix%' THEN json_extract(payload,'$.total') ELSE 0 END),0) AS pixRevenue,
        COALESCE(sum(CASE WHEN lower(json_extract(payload,'$.paymentMethod')) LIKE '%cart%' OR lower(json_extract(payload,'$.paymentMethod')) LIKE '%stripe%' THEN json_extract(payload,'$.total') ELSE 0 END),0) AS cardRevenue
        FROM orders WHERE ${field('status')}='concluido' AND ${field('date')}>=?`, args: [since] },
      { sql: `SELECT id,payload FROM orders WHERE ${field('status')}='concluido' AND ${field('date')}>=? ORDER BY ${field('date')} DESC LIMIT 20`, args: [since] },
    ], 'read');
    const values = results[0].rows[0];
    return { count: Number(values.count), totalRevenue: Number(values.totalRevenue), pixRevenue: Number(values.pixRevenue), cardRevenue: Number(values.cardRevenue),
      recent: results[1].rows.map(row => ({ ...JSON.parse(String(row.payload)), id: String(row.id) })) };
  }
  async stats() {
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const week = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const results = await this.client.batch([
      { sql: `SELECT count(*) AS total, COALESCE(sum(CASE WHEN json_extract(payload,'$.isPwa')=1 THEN 1 ELSE 0 END),0) AS pwa,
        COALESCE(sum(CASE WHEN ${field('timestamp')}>=? THEN 1 ELSE 0 END),0) AS month FROM visits WHERE COALESCE(json_extract(payload,'$.userAgent'),'')!='PWA_INSTALL_EVENT'`, args: [since] },
      `SELECT count(*) AS installs FROM visits WHERE json_extract(payload,'$.userAgent')='PWA_INSTALL_EVENT'`,
      `SELECT COALESCE(json_extract(payload,'$.authType'),'none') AS authType,count(*) AS count FROM visits WHERE COALESCE(json_extract(payload,'$.userAgent'),'')!='PWA_INSTALL_EVENT' GROUP BY authType`,
      { sql: `SELECT substr(${field('timestamp')},1,10) AS day,count(*) AS count FROM visits WHERE ${field('timestamp')}>=? AND COALESCE(json_extract(payload,'$.userAgent'),'')!='PWA_INSTALL_EVENT' GROUP BY day`, args: [week] },
      `SELECT count(*) AS count FROM users`,
      `SELECT count(*) AS count, COALESCE(sum(CASE WHEN ${field('status')}='concluido' THEN json_extract(payload,'$.total') ELSE 0 END),0) AS revenue FROM orders`,
      { sql: `SELECT payload FROM presence WHERE ${field('lastSeen')}>=? LIMIT 100`, args: [new Date(Date.now() - 60000).toISOString()] },
    ], 'read');
    const authStats = { none: 0, guest: 0, registered: 0 };
    for (const row of results[2].rows) if (String(row.authType) in authStats) authStats[row.authType as keyof typeof authStats] = Number(row.count);
    const history = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.now() - (6 - index) * 86400000).toISOString().slice(0, 10);
      return { date: date.slice(5).split('-').reverse().join('/'), count: Number(results[3].rows.find(row => row.day === date)?.count || 0) };
    });
    return { visits: { ...results[0].rows[0], installs: Number(results[1].rows[0].installs), authStats }, history,
      online: results[6].rows.map(row => JSON.parse(String(row.payload))), totalUsers: Number(results[4].rows[0].count),
      totalOrders: Number(results[5].rows[0].count), revenue: Number(results[5].rows[0].revenue) };
  }
}

export class Query {
  constructor(readonly database: Database, readonly name: Table, readonly filters: { key: string; value: InValue }[] = [], readonly maximum?: number, readonly sort?: string) {}
  doc(id: string) { return new DocumentReference(this.database, this.name, id); }
  where(key: string, _op: '==', value: InValue) { field(key); return new Query(this.database, this.name, [...this.filters, { key, value }], this.maximum, this.sort); }
  limit(maximum: number) { return new Query(this.database, this.name, this.filters, maximum, this.sort); }
  orderBy(key: string) { field(key); return new Query(this.database, this.name, this.filters, this.maximum, key); }
  async get() {
    const sql = `SELECT id,payload FROM ${this.name}${this.filters.length ? ' WHERE ' + this.filters.map(filter => `${field(filter.key)}=?`).join(' AND ') : ''}${this.sort ? ` ORDER BY ${field(this.sort)} DESC` : ''}${this.maximum ? ' LIMIT ?' : ''}`;
    const rows = await this.database.rows(sql, [...this.filters.map(filter => filter.value), ...(this.maximum ? [this.maximum] : [])]);
    const docs = rows.map(row => snapshot(String(row.id), String(row.payload)));
    return { docs, empty: docs.length === 0 };
  }
}

export class DocumentReference {
  constructor(readonly database: Database, readonly name: Table, readonly id: string) {}
  async get() {
    const rows = await this.database.rows(`SELECT payload FROM ${this.name} WHERE id=?`, [this.id]);
    return snapshot(this.id, rows[0] ? String(rows[0].payload) : undefined);
  }
  async create(data: any) { await this.database.client.execute({ sql: `INSERT INTO ${this.name}(id,payload) VALUES (?,?)`, args: [this.id, JSON.stringify(data)] }); }
  async set(data: any, options?: { merge: boolean }) {
    const values = Object.entries(data).filter(([, value]) => value !== undefined);
    const merge = values.length ? `json_set(${this.name}.payload,${values.map(() => '?,json(?)').join(',')})` : `${this.name}.payload`;
    await this.database.client.execute({ sql: `INSERT INTO ${this.name}(id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=${options?.merge ? merge : 'excluded.payload'}`,
      args: [this.id, JSON.stringify(data), ...(options?.merge ? values.flatMap(([key, value]) => [`$.${key}`, JSON.stringify(value)]) : [])] });
  }
  async update(data: any) {
    const values = Object.entries(data).filter(([, value]) => value !== undefined);
    if (!values.length) return;
    const result = await this.database.client.execute({ sql: `UPDATE ${this.name} SET payload=json_set(payload,${values.map(() => '?,json(?)').join(',')}) WHERE id=?`, args: [...values.flatMap(([key,value]) => [`$.${key}`, JSON.stringify(value)]), this.id] });
    if (!result.rowsAffected) throw new Error('Registro não encontrado.');
  }
  async delete() { await this.database.client.execute({ sql: `DELETE FROM ${this.name} WHERE id=?`, args: [this.id] }); }
}

export function configuredDatabase() {
  const url = process.env.TURSO_DATABASE_URL || process.env.STORAGE_TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.STORAGE_TURSO_AUTH_TOKEN;
  if (!url) return null;
  if (url.startsWith('file:') && process.env.VERCEL) throw new Error('Banco local não é permitido na Vercel.');
  if (!url.startsWith('file:') && !authToken) throw new Error('Credencial privada do Turso ausente.');
  return new Database(createClient({ url, authToken }));
}
