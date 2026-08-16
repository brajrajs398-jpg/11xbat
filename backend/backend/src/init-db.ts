import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = await fs.readFile(path.resolve(__dirname, '../sql/schema.sql'), 'utf8');
await pool.query(schema);
console.log('PlayVault database schema is ready.');
await pool.end();
