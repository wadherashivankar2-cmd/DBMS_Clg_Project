import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

export function mapPgError(err: any): { statusCode: number; message: string } {
  if (!err || !err.code) {
    return { statusCode: 500, message: 'Internal server error' };
  }

  switch (err.code) {
    case '23P01': // exclusion_violation
    case '23505': // unique_violation
      return { statusCode: HttpStatus.CONFLICT, message: 'Resource conflict or temporal overlap' };
    case '23503': // foreign_key_violation
      return { statusCode: HttpStatus.UNPROCESSABLE_ENTITY, message: 'Referenced entity not found' };
    case '23514': // check_violation
    case '22P02': // invalid_text_representation
      return { statusCode: HttpStatus.BAD_REQUEST, message: 'Constraint validation failure or invalid payload format' };
    default:
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal database error' };
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as any).requestId || request.headers['x-request-id'] || 'none';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Internal Server Error';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const resObj = exception.getResponse();
      if (typeof resObj === 'string') {
        message = resObj;
      } else if (typeof resObj === 'object' && resObj !== null) {
        message = (resObj as any).message || exception.message;
        error = (resObj as any).error || exception.name;
        details = (resObj as any).details;
      }
    } else if ((exception as any)?.code) {
      // PostgreSQL database error mapping
      const mapped = mapPgError(exception);
      statusCode = mapped.statusCode;
      error = 'DatabaseError';
      message = mapped.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
      requestId,
      ...(details !== undefined ? { details } : {}),
    });
  }
}
