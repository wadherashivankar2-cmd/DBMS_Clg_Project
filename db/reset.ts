import { Client } from 'pg';
import dotenv from 'dotenv';
import { runMigrations } from './migrate';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/app_db';

export async function resetDatabase(): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('Dropping public schema...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO PUBLIC;');
    console.log('Public schema recreated.');
  } finally {
    await client.end();
  }

  console.log('Running migrations...');
  await runMigrations();

  // Try loading seed if seed.ts exists
  try {
    const seedModule = await import('./seed/seed');
    if (seedModule && typeof seedModule.seed === 'function') {
      console.log('Seeding database...');
      await seedModule.seed();
      console.log('Database seeded successfully.');
    }
  } catch {
    console.log('Seed module not present or seed function not found; skipping seed in this step.');
  }
}

if (require.main === module || process.argv[1]?.endsWith('reset.ts')) {
  resetDatabase().catch((err) => {
    console.error('Database reset failed:', err);
    process.exit(1);
  });
}
