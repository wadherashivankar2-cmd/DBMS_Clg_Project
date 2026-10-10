import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/app_db';

export async function runMigrations(): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Fetch applied migrations
    const res = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations'
    );
    const appliedSet = new Set(res.rows.map((row) => row.filename));

    // Read migration files in lexical order
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`FATAL: Migration failed on file ${file}:`, err);
        throw err;
      }
    }

    console.log('All migrations applied successfully.');
  } finally {
    await client.end();
  }
}

if (require.main === module || process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations().catch((err) => {
    console.error('Migration runner failed:', err);
    process.exit(1);
  });
}
