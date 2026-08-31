#!/usr/bin/env node
/**
 * Tracked SQL migration runner.
 *
 * Applies every `deploy/migrations/*.sql` file in ascending filename order,
 * recording each applied file in the `schema_migrations` table so it is never
 * run twice. Each file runs inside its own transaction: if a file fails, its
 * changes roll back and the runner stops (later files are not applied).
 *
 * The migration set is designed to reconstruct the full schema from an empty
 * database, so this is the single entry point for bringing any database — a
 * fresh local Postgres or a production RDS instance — up to the current schema
 * with TypeORM `synchronize` disabled (DB_SYNCHRONIZE=false).
 *
 * Usage:
 *   node scripts/migrate.mjs            # apply all pending migrations
 *   node scripts/migrate.mjs --status   # list applied vs pending, apply nothing
 *   node scripts/migrate.mjs --dir DIR  # use a different migrations directory
 *
 * Connection:
 *   DATABASE_URL   Postgres connection string
 *                  (default: postgres://learnbuild:learnbuild@localhost:5432/learnbuild)
 *   PGSSLMODE=require or DATABASE_SSL=true enables TLS (needed for most RDS setups).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the `pg` package. It is a dependency of the services rather than the
 * repo root, and pnpm does not hoist a top-level `node_modules/pg` symlink, so
 * a bare `require('pg')` from this root-level script can miss it. Try normal
 * resolution first, then fall back to the pnpm content-addressed store.
 */
function loadPg() {
  try {
    return require('pg');
  } catch {
    const glob = readdirSync(resolve(__dirname, '..', 'node_modules', '.pnpm')).find(
      (name) => /^pg@\d/.test(name),
    );
    if (!glob) {
      throw new Error(
        "Could not find the 'pg' package. Run `pnpm install` first.",
      );
    }
    return require(
      resolve(__dirname, '..', 'node_modules', '.pnpm', glob, 'node_modules', 'pg'),
    );
  }
}

const { Client } = loadPg();

function parseArgs(argv) {
  const args = { status: false, dir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--status') args.status = true;
    else if (arg === '--dir') args.dir = argv[(i += 1)];
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

function migrationsDir(customDir) {
  if (customDir) return resolve(customDir);
  // Default: <repo>/deploy/migrations (this script lives in <repo>/scripts).
  return resolve(__dirname, '..', 'deploy', 'migrations');
}

function listMigrationFiles(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

/** Tracking key for a migration file: its name without the `.sql` suffix. */
function versionOf(file) {
  return file.replace(/\.sql$/, '');
}

function sslConfig() {
  const wantsSsl =
    process.env.DATABASE_SSL === 'true' ||
    (process.env.PGSSLMODE && process.env.PGSSLMODE !== 'disable');
  // RDS presents a chain that isn't in Node's default trust store; the app
  // talks to it over a private network, so relax cert verification rather than
  // shipping the RDS CA bundle. Tighten this if you pin the RDS CA.
  return wantsSsl ? { rejectUnauthorized: false } : undefined;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    varchar(64) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

async function appliedVersions(client) {
  const { rows } = await client.query('SELECT version FROM schema_migrations');
  return new Set(rows.map((r) => r.version));
}

async function main() {
  const args = parseArgs(process.argv);
  const dir = migrationsDir(args.dir);
  const files = listMigrationFiles(dir);

  const connectionString =
    process.env.DATABASE_URL ||
    'postgres://learnbuild:learnbuild@localhost:5432/learnbuild';

  const client = new Client({ connectionString, ssl: sslConfig() });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await appliedVersions(client);
    const pending = files.filter((f) => !applied.has(versionOf(f)));

    if (args.status) {
      console.log(`Migrations directory: ${dir}`);
      console.log(`Applied (${files.length - pending.length}):`);
      for (const f of files.filter((f) => applied.has(versionOf(f)))) console.log(`  ✓ ${f}`);
      console.log(`Pending (${pending.length}):`);
      for (const f of pending) console.log(`  • ${f}`);
      return;
    }

    if (pending.length === 0) {
      console.log('No pending migrations. Database is up to date.');
      return;
    }

    for (const file of pending) {
      const sql = readFileSync(join(dir, file), 'utf8');
      process.stdout.write(`Applying ${file} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        // Record the migration inside the same transaction so tracking and
        // schema change commit atomically. Record without the `.sql` suffix so
        // it matches the version strings the existing migration files insert
        // themselves (avoids duplicate tracking rows).
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
          [versionOf(file)],
        );
        await client.query('COMMIT');
        console.log('done');
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('FAILED');
        console.error(`\nMigration ${file} failed and was rolled back:`);
        console.error(err.message);
        process.exitCode = 1;
        return;
      }
    }

    console.log(`\nApplied ${pending.length} migration(s). Database is up to date.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration runner error:', err.message);
  process.exit(1);
});
