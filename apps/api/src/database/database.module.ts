import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => {
        const pool = new Pool({
          connectionString:
            process.env.DATABASE_URL ||
            'postgresql://postgres:postgres@localhost:5432/app_db',
          max: 10,
        });
        return pool;
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor() {}

  async onModuleDestroy() {
    // Gracefully handled on container termination
  }
}
