import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitlementsService } from '../src/billing/entitlements.service';
import { SubscriptionStatus } from '@commercepilot/database';
import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';

describe('EntitlementsService', () => {
  let service: EntitlementsService;
  let mockPrisma: any;

  const workspaceId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    mockPrisma = {
      subscription: {
        findFirst: vi.fn(),
      },
      post: {
        count: vi.fn(),
      },
      socialAccount: {
        count: vi.fn(),
      },
      membership: {
        count: vi.fn(),
      },
    };

    service = new EntitlementsService(mockPrisma as unknown as PrismaService);
  });

  describe('Post Creation Entitlements', () => {
    it('allows post creation when under FREE tier quota of 10 posts', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId,
        planId: 'FREE',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(Date.now() - 86400000),
        currentPeriodEnd: new Date(Date.now() + 86400000 * 29),
      });

      mockPrisma.post.count.mockResolvedValue(5);

      await expect(service.enforceCanCreatePost(workspaceId)).resolves.not.toThrow();
    });

    it('rejects post creation when FREE tier quota of 10 posts is reached', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        workspaceId,
        planId: 'FREE',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(Date.now() - 86400000),
        currentPeriodEnd: new Date(Date.now() + 86400000 * 29),
      });

      mockPrisma.post.count.mockResolvedValue(10);

      await expect(service.enforceCanCreatePost(workspaceId)).rejects.toThrow(ForbiddenException);
    });

    it('allows more posts when on GROWTH tier (limit 200)', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-growth',
        workspaceId,
        planId: 'GROWTH',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(Date.now() - 86400000),
        currentPeriodEnd: new Date(Date.now() + 86400000 * 29),
      });

      mockPrisma.post.count.mockResolvedValue(50);

      await expect(service.enforceCanCreatePost(workspaceId)).resolves.not.toThrow();
    });
  });

  describe('Social Account Connection Entitlements', () => {
    it('allows social account connection under plan limit', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-starter',
        workspaceId,
        planId: 'STARTER',
        status: SubscriptionStatus.ACTIVE,
      });

      mockPrisma.socialAccount.count.mockResolvedValue(2); // limit is 3

      await expect(service.enforceCanConnectSocialAccount(workspaceId)).resolves.not.toThrow();
    });

    it('rejects social account connection when plan limit is reached', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-starter',
        workspaceId,
        planId: 'STARTER',
        status: SubscriptionStatus.ACTIVE,
      });

      mockPrisma.socialAccount.count.mockResolvedValue(3); // limit is 3

      await expect(service.enforceCanConnectSocialAccount(workspaceId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Team Member Seat Entitlements', () => {
    it('rejects team invite when seat limit is reached', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-free',
        workspaceId,
        planId: 'FREE',
        status: SubscriptionStatus.ACTIVE,
      });

      mockPrisma.membership.count.mockResolvedValue(1); // FREE limit is 1

      await expect(service.enforceCanAddTeamMember(workspaceId)).rejects.toThrow(ForbiddenException);
    });
  });
});
