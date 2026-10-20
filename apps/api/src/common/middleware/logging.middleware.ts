import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const logData = {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        userAgent: req.headers['user-agent'] || 'unknown',
      };

      if (res.statusCode >= 500) {
        this.logger.error(JSON.stringify(logData));
      } else if (res.statusCode >= 400) {
        this.logger.warn(JSON.stringify(logData));
      } else {
        this.logger.log(JSON.stringify(logData));
      }
    });

    next();
  }
}
