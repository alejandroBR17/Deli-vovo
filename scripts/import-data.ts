import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { configuredDatabase, tables } from '../server/database';
import { separateImage } from '../server/media';

// A reviewable export is required; this command neither reads nor deletes the old database.
const database = configuredDatabase();
if (!database) throw new Error('Configure o banco de destino.');
const source = process.argv[2];
if (!source) throw new Error('Uso: npm run db:import -- caminho-do-export.json [--apply]');
const bundle = JSON.parse(await readFile(source, 'utf8')) as Record<string, any[]>;
const apply = process.argv.includes('--apply');
try {
  const entries = tables.filter(table => table !== 'presence' && table !== 'media');
  for (const name of Object.keys(bundle)) if (!(entries as readonly string[]).includes(name)) throw new Error(`Coleção inesperada: ${name}`);
  // Validate the entire export before any write; duplicate IDs and missing identity fail closed.
  for (const name of entries) {
    const seen = new Set<string>();
    if (bundle[name] !== undefined && !Array.isArray(bundle[name])) throw new Error(`Formato inválido: ${name}`);
    for (const record of bundle[name] || []) {
      const id = record.id || (name === 'configs' ? record.key : name === 'push_subscriptions' ? encodeURIComponent(record.endpoint).replace(/\//g,'_') : '');
      if (typeof id !== 'string' || !id || seen.has(id)) throw new Error(`Identidade inválida ou repetida em ${name}`);
      seen.add(id);
      if (name === 'orders' && (typeof record.date !== 'string' || !Number.isFinite(Date.parse(record.date)))) throw new Error(`Data inválida no pedido ${id}. Corrija a origem antes de importar.`);
    }
    console.log(`${name}: ${(bundle[name] || []).length} registros`);
  }
  if (!apply) { console.log('Prévia apenas. Revise o export e use --apply para importar em um banco vazio.'); }
  else {
    for (const name of tables) if (Number((await database.rows(`SELECT count(*) AS count FROM ${name}`))[0].count)) throw new Error('O destino precisa estar vazio. Nenhum registro será sobrescrito.');
    // The destination is separate and offline until verified; retries require reviewing/clearing that destination only.
    for (const name of entries) {
      for (const record of bundle[name] || []) {
        const data = { ...record };
        const id = data.id || (name === 'configs' ? data.key : encodeURIComponent(data.endpoint).replace(/\//g,'_'));
        if (name === 'products') data.image = await separateImage(database, data.image);
        if (name === 'configs' && id === 'story_image') data.value = await separateImage(database, data.value);
        if (name === 'orders') { data.date = new Date(data.date).toISOString(); data.archived = data.archived === true; }
        if (name === 'users' && data.email) data.email = data.email.toLowerCase();
        await database.collection(name).doc(id).create(data);
      }
      const count = Number((await database.rows(`SELECT count(*) AS count FROM ${name}`))[0].count);
      if (count !== (bundle[name] || []).length) throw new Error(`Contagem divergente: ${name}`);
    }
    console.log('Importação concluída; contagens conferidas. Confira valores e pedidos antes de trocar a produção.');
  }
} finally { database.client.close(); }
