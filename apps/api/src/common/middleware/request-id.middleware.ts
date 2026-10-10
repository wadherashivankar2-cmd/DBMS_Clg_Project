import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headerId = req.headers['x-request-id'] as string;
    const requestId = headerId || randomUUID();

    req.headers['x-request-id'] = requestId;
    (req as any).requestId = requestId;
    res.setHeader('x-request-id', requestId);

    next();
  }
}
