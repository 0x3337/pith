import knex from 'knex';
import './globals.mjs';
import { onShutdown } from './shutdown.mjs';

const databaseConfig = config('database');

if (!databaseConfig) {
  throw new Error('Missing app/config/database.js: declare the connection used by @ariolo/pith/db.');
}

const { client = 'pg', ...connection } = databaseConfig;

const db = knex({ client, connection });

onShutdown(() => db.destroy());

export default db;
