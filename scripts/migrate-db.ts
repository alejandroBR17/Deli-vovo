import 'dotenv/config';
import { configuredDatabase, migrate } from '../server/database';
import { seedStoreDefaults } from '../server/store-defaults';
const database = configuredDatabase();
if (!database) throw new Error('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no ambiente privado.');
try { await migrate(database.client); await seedStoreDefaults(database.client, process.env.VERCEL_ENV === 'preview' || process.env.DELIVERY_PREVIEW_MODE === 'true'); console.log('Tabelas, índices e endereço inicial preparados. Configurações preenchidas foram preservadas.'); }
finally { database.client.close(); }
