import { describe, it, expect } from 'vitest';
import { QueueManager, QUEUE_NAMES } from '../src/queues/queue-manager';

describe('Worker QueueManager', () => {
  it('should initialize with correct queue definitions', () => {
    const manager = new QueueManager('redis://localhost:6379');
    expect(manager.getRedisUrl()).toBe('redis://localhost:6379');

    const status = manager.getStatus();
    expect(status.isRunning).toBe(false);
    expect(status.queues).toContain(QUEUE_NAMES.CATALOG_IMPORT);
    expect(status.queues).toContain(QUEUE_NAMES.POST_PUBLISHING);
    expect(status.queues).toContain(QUEUE_NAMES.ANALYTICS_SYNC);
    expect(status.queues).toContain(QUEUE_NAMES.TOKEN_REFRESH);
  });

  it('should start in standby mode without throwing', async () => {
    const manager = new QueueManager('redis://localhost:6379');
    await manager.start();
    expect(manager.getStatus().isRunning).toBe(true);
    await manager.stop();
    expect(manager.getStatus().isRunning).toBe(false);
  });
});
