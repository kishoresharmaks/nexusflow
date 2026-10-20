import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from '../src/health/health.controller';
import type { HealthService } from '../src/health/health.service';
import type { Response } from 'express';

describe('HealthController', () => {
  let controller: HealthController;
  let mockHealthService: Partial<HealthService>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockHealthService = {
      getLiveness: vi.fn().mockReturnValue({
        status: 'ok',
        timestamp: '2026-10-19T00:00:00.000Z',
        uptime: 100,
        version: '0.1.0',
        environment: 'test',
      }),
      checkReadiness: vi.fn(),
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
    };

    controller = new HealthController(mockHealthService as HealthService);
  });

  it('should return liveness result', () => {
    const res = controller.getLiveness();
    expect(res.status).toBe('ok');
    expect(res.version).toBe('0.1.0');
  });

  it('should return 200 when ready', async () => {
    vi.spyOn(mockHealthService, 'checkReadiness').mockResolvedValue({
      status: 'ready',
      timestamp: '2026-10-19T00:00:00.000Z',
      checks: {
        database: { status: 'up', latencyMs: 10 },
        redis: { status: 'up', latencyMs: 5 },
      },
    });

    const res = await controller.getReadiness(mockResponse as Response);
    expect(res.status).toBe('ready');
    expect(mockResponse.status).not.toHaveBeenCalledWith(503);
  });

  it('should set 503 HTTP status when not ready', async () => {
    vi.spyOn(mockHealthService, 'checkReadiness').mockResolvedValue({
      status: 'not_ready',
      timestamp: '2026-10-19T00:00:00.000Z',
      checks: {
        database: { status: 'down', message: 'Database connection unreachable' },
        redis: { status: 'down', message: 'Redis connection unreachable' },
      },
    });

    const res = await controller.getReadiness(mockResponse as Response);
    expect(res.status).toBe('not_ready');
    expect(mockResponse.status).toHaveBeenCalledWith(503);
  });
});
