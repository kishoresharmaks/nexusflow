import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService } from '../src/health/health.service';
import type { PrismaService } from '../src/database/prisma.service';
import type { ConfigService } from '@nestjs/config';

describe('HealthService', () => {
  let service: HealthService;
  let mockPrismaService: Partial<PrismaService>;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockPrismaService = {
      checkReadiness: vi.fn(),
    };
    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        return defaultValue;
      }),
    };

    service = new HealthService(
      mockPrismaService as PrismaService,
      mockConfigService as ConfigService,
    );
  });

  describe('getLiveness', () => {
    it('should return ok status without sensitive information', () => {
      const result = service.getLiveness();
      expect(result.status).toBe('ok');
      expect(result.version).toBe('0.1.0');
      expect(result.environment).toBe('test');
      expect(typeof result.uptime).toBe('number');
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
      // Ensure no credentials or URLs leaked
      const stringified = JSON.stringify(result);
      expect(stringified).not.toContain('mongodb');
      expect(stringified).not.toContain('redis://');
      expect(stringified).not.toContain('password');
    });
  });

  describe('checkReadiness', () => {
    it('should report not_ready when database is down', async () => {
      vi.spyOn(mockPrismaService, 'checkReadiness').mockResolvedValue({
        status: 'down',
        message: 'Database connection unreachable or ping failed',
      });

      const result = await service.checkReadiness();
      expect(result.status).toBe('not_ready');
      expect(result.checks.database.status).toBe('down');
      // Verify no sensitive credentials leaked
      const stringified = JSON.stringify(result);
      expect(stringified).not.toContain('password');
      expect(stringified).not.toContain('mongodb+srv');
    });

    it('should report ready when both database and redis are up', async () => {
      vi.spyOn(mockPrismaService, 'checkReadiness').mockResolvedValue({
        status: 'up',
        latencyMs: 10,
      });

      // Mock redis check inside service
      // @ts-expect-error accessing private method for test mocking
      vi.spyOn(service, 'checkRedisReadiness').mockResolvedValue({
        status: 'up',
        latencyMs: 5,
      });

      const result = await service.checkReadiness();
      expect(result.status).toBe('ready');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.redis.status).toBe('up');
    });

    it('should report ready when database is up and redis is down but optional', async () => {
      vi.spyOn(mockPrismaService, 'checkReadiness').mockResolvedValue({
        status: 'up',
        latencyMs: 12,
      });

      // @ts-expect-error accessing private method for test mocking
      vi.spyOn(service, 'checkRedisReadiness').mockResolvedValue({
        status: 'down',
        message: 'Redis not configured (operating in standalone database mode)',
      });

      const result = await service.checkReadiness();
      expect(result.status).toBe('ready');
      expect(result.checks.database.status).toBe('up');
      expect(result.checks.redis.status).toBe('down');
    });
  });
});
