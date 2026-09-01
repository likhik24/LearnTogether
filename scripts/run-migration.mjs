#!/usr/bin/env node
/**
 * Runs a single .sql migration file against the local Postgres.
 * Usage: node scripts/run-migration.mjs <path-to-sql>
 * Uses the `pg` client already present in node_modules.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/run-migration.mjs <path-to-sql>');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8');
const connectionString =
  process.env.DATABASE_URL ||
  'postgres://learnbuild:learnbuild@localhost:5432/learnbuild';

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied migration: ${file}`);
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
