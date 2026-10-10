import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  @ApiOperation({ summary: 'API and database connectivity health check' })
  @ApiResponse({ status: 200, description: 'Health check passed' })
  async checkHealth() {
    let dbStatus = 'down';
    try {
      await this.pool.query('SELECT 1');
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    return {
      status: 'ok',
      db: dbStatus,
      time: new Date().toISOString(),
    };
  }
}
