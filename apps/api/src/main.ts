import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Ensure environment variables are loaded across monorepo layouts
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    if (process.env['DATABASE_URL']) break;
  }
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 4000);
  const corsOrigins = configService.get<string[]>('corsOrigins', ['http://localhost:3000']);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Security Headers Enforcement
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (process.env['NODE_ENV'] === 'production' || process.env['NODE_ENV'] === 'staging') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'ready', 'api/v1/health', 'api/v1/ready', 'api/integrations/(.*)'],
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CommercePilot API')
    .setDescription('CommercePilot REST API documentation')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('Health')
    .addTag('Authentication')
    .addTag('Workspaces')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  logger.log(`API server running on http://localhost:${port}`);
  logger.log(`API documentation available on http://localhost:${port}/api/docs`);
  logger.log(`Health check: http://localhost:${port}/health`);
  logger.log(`Readiness check: http://localhost:${port}/ready`);
}

bootstrap().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Unknown bootstrap error';
  console.error('Fatal error during bootstrap:', message);
  process.exit(1);
});
