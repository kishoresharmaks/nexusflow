import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface StandardErrorPayload {
  error: {
    code: string;
    message: string;
    requestId: string;
    details: unknown[];
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request as Request & { id?: string }).id ||
      'req_unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected internal server error occurred.';
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = HttpStatus[status] ?? 'HTTP_ERROR';
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const respObj = exceptionResponse as Record<string, unknown>;
        code =
          typeof respObj['error'] === 'string'
            ? respObj['error']
            : (HttpStatus[status] ?? 'HTTP_ERROR');
        if (typeof respObj['message'] === 'string') {
          message = respObj['message'];
        } else if (Array.isArray(respObj['message'])) {
          message = 'Validation failed';
          details = respObj['message'];
          code = 'VALIDATION_ERROR';
        }
      }
    } else {
      // Unhandled error: log internally with stack trace, never return to client
      const errMessage = exception instanceof Error ? exception.message : 'Unknown exception';
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`Unhandled error [${requestId}]: ${errMessage}`, stack);
    }

    const payload: StandardErrorPayload = {
      error: {
        code,
        message,
        requestId,
        details,
      },
    };

    response.status(status).json(payload);
  }
}
