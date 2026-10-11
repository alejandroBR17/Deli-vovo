import 'dotenv/config';
import { configuredDatabase, migrate } from '../server/database';
const database = configuredDatabase();
if (!database) throw new Error('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no ambiente privado.');
try { await migrate(database.client); console.log('Tabelas e índices preparados. Nenhum dado existente foi excluído.'); }
finally { database.client.close(); }
