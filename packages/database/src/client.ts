import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// If DATABASE_URL is not set in environment, search for monorepo root .env
if (!process.env['DATABASE_URL']) {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../../../.env'),
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      if (process.env['DATABASE_URL']) {
        break;
      }
    }
  }
}

declare global {
  var __commercepilot_prisma__: PrismaClient | undefined;
}

export function createPrismaClient(): PrismaClient {
  const url = process.env['DATABASE_URL'];
  return new PrismaClient({
    ...(url ? { datasourceUrl: url } : {}),
    log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma: PrismaClient = global.__commercepilot_prisma__ ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  global.__commercepilot_prisma__ = prisma;
}
