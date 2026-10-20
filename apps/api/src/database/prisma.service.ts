import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@commercepilot/database';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// If DATABASE_URL is not set in environment, search for monorepo root .env
if (!process.env['DATABASE_URL']) {
  const candidateEnvPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      if (process.env['DATABASE_URL']) break;
    }
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url = process.env['DATABASE_URL'];
    super({
      ...(url ? { datasourceUrl: url } : {}),
      log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma database client connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.warn(`Initial database connection failed or deferred: ${message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma database client disconnected');
  }

  async checkReadiness(): Promise<{ status: 'up' | 'down'; latencyMs?: number; message?: string }> {
    const startTime = Date.now();
    try {
      await this.$runCommandRaw({ ping: 1 });
      const latencyMs = Date.now() - startTime;
      return { status: 'up', latencyMs };
    } catch {
      // Redacted and safe: never expose DB credentials, connection strings, or full stack traces
      return { status: 'down', message: 'Database connection unreachable or ping failed' };
    }
  }
}
