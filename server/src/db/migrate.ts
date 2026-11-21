import 'dotenv/config';
import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';

export const runMigrations = () => migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });

if (require.main === module) {
  runMigrations().then(() => { console.log('Migrations applied'); return pool.end(); }).catch((e) => { console.error(e); process.exit(1); });
}
