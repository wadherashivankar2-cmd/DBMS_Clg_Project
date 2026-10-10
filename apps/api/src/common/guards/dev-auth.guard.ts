import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';

// PHASE 5: replace DevAuthGuard with JWT guard; controllers must not change.
@Injectable()
export class DevAuthGuard implements CanActivate {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.headers['x-user-id'];

    if (!userId) {
      throw new UnauthorizedException('Missing x-user-id header');
    }

    try {
      const userRes = await this.pool.query(
        `SELECT u.id, u.email, u.full_name, u.status,
                COALESCE(json_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '[]') as roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         WHERE u.id = $1
         GROUP BY u.id`,
        [userId]
      );

      if (userRes.rows.length === 0) {
        throw new UnauthorizedException(`User not found for id: ${userId}`);
      }

      req.user = userRes.rows[0];
      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid x-user-id header');
    }
  }
}
