import { describe, it, expect } from 'vitest';
import { createPrismaClient, prisma } from '../src/index.js';

describe('Database package', () => {
  it('should export prisma singleton and factory', () => {
    expect(prisma).toBeDefined();
    expect(typeof createPrismaClient).toBe('function');
  });
});
