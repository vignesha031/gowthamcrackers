import 'dotenv/config';
import { pool } from './db';
import { runMigrations } from './db/migrate';
import { createApp } from './app';

for (const k of ['JWT_SECRET', 'DATABASE_URL']) if (!process.env[k]) throw new Error(`${k} is not set (copy .env.example to .env)`);
if (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET!.length < 32 || /change-me/i.test(process.env.JWT_SECRET!))) throw new Error('Set JWT_SECRET to a long random value before running in production');

async function main() {
  if (process.env.AUTO_MIGRATE !== 'false') await runMigrations();
  const port = Number(process.env.PORT ?? 4000);
  const server = createApp().listen(port, () => console.log(`Gowtham Crackers API listening on :${port}`));
  const stop = () => server.close(() => pool.end().then(() => process.exit(0)));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
  process.on('uncaughtException', (e) => { console.error('uncaughtException', e); process.exit(1); }); // let the process manager restart us cleanly
}
main().catch((e) => { console.error(e); process.exit(1); });
