import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SuperAdminService } from '../src/super-admin/super-admin.service';
import { SuperAdminGuard, AuthenticatedAdminRequest } from '../src/super-admin/guards/super-admin.guard';
import { SuperAdminBootstrapService } from '../src/super-admin/bootstrap/super-admin-bootstrap.service';
import { AdminAuditService } from '../src/super-admin/audit/admin-audit.service';
import { AdminPermission, ADMIN_PERMISSIONS_METADATA_KEY } from '../src/super-admin/super-admin.constants';
import { PlatformRole, PlatformAdminStatus } from '@commercepilot/database';

describe('SuperAdmin Module', () => {
  let mockPrisma: any;
  let mockAudit: any;
  let mockAuth: any;
  let mockReflector: any;
  let superAdminService: SuperAdminService;
  let superAdminGuard: SuperAdminGuard;
  let bootstrapService: SuperAdminBootstrapService;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn().mockImplementation((cb) => (typeof cb === 'function' ? cb(mockPrisma) : Promise.all(cb))),
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(100),
        update: vi.fn(),
      },
      session: {
        updateMany: vi.fn().mockResolvedValue({ count: 3 }),
      },
      workspace: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn().mockResolvedValue(25),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      post: {
        count: vi.fn().mockResolvedValue(50),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      product: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
      campaign: { count: vi.fn().mockResolvedValue(10) },
      catalogImport: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      subscription: {
        count: vi.fn().mockResolvedValue(10),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      billingEvent: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { amountCents: 45000 },
        }),
      },
      platformSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      adminAnnouncement: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      storeConnection: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(5),
        update: vi.fn(),
      },
      socialAccount: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(8),
        update: vi.fn(),
      },
      aiUsage: {
        count: vi.fn().mockResolvedValue(42),
        aggregate: vi.fn().mockResolvedValue({
          _sum: { promptTokens: 100000, completionTokens: 50000, costEstimateMicrocents: 12000 },
          _count: { _all: 30 },
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      adminAuditLog: {
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'log-1', ...data })),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      platformAdmin: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(1),
      },
    };

    mockAudit = {
      logAction: vi.fn().mockResolvedValue({ id: 'log-1' }),
      listLogs: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    };

    mockAuth = {
      validateSession: vi.fn(),
    };

    mockReflector = {
      getAllAndOverride: vi.fn(),
    };

    superAdminService = new SuperAdminService(mockPrisma as any, mockAudit as any);
    superAdminGuard = new SuperAdminGuard(mockReflector as any, mockAuth as any, mockPrisma as any);
    bootstrapService = new SuperAdminBootstrapService(
      mockPrisma as any,
      { get: vi.fn() } as any,
      mockAudit as any,
    );
  });

  describe('SuperAdminGuard Authorization Gate', () => {
    it('throws UnauthorizedException when no Authorization header or session cookie is present', async () => {
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      };

      await expect(superAdminGuard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when session is expired or revoked', async () => {
      mockAuth.validateSession.mockResolvedValue(null);
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer invalid_or_expired_token' },
          }),
        }),
      };

      await expect(superAdminGuard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when a standard user without PlatformAdmin record attempts access', async () => {
      mockAuth.validateSession.mockResolvedValue({
        id: 'sess-1',
        user: { id: 'user-standard', email: 'user@example.com', isSuspended: false },
      });
      mockPrisma.platformAdmin.findUnique.mockResolvedValue(null);

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer valid_token' },
          }),
        }),
      };

      await expect(superAdminGuard.canActivate(mockContext)).rejects.toThrow(
        /Platform administrator access required/,
      );
    });

    it('throws ForbiddenException when user account is marked suspended', async () => {
      mockAuth.validateSession.mockResolvedValue({
        id: 'sess-1',
        user: { id: 'user-suspended', email: 'bad@example.com', isSuspended: true },
      });

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer valid_token' },
          }),
        }),
      };

      await expect(superAdminGuard.canActivate(mockContext)).rejects.toThrow(
        /Account has been suspended/,
      );
    });

    it('throws ForbiddenException when PlatformAdmin status is SUSPENDED or REVOKED', async () => {
      mockAuth.validateSession.mockResolvedValue({
        id: 'sess-1',
        user: { id: 'admin-1', email: 'admin@example.com', isSuspended: false },
      });
      mockPrisma.platformAdmin.findUnique.mockResolvedValue({
        id: 'pa-1',
        userId: 'admin-1',
        role: PlatformRole.SUPER_ADMIN,
        status: PlatformAdminStatus.SUSPENDED,
      });

      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer valid_token' },
          }),
        }),
      };

      await expect(superAdminGuard.canActivate(mockContext)).rejects.toThrow(
        /Platform administrator access has been suspended/,
      );
    });

    it('enforces granular permission check: rejects SUPPORT_ADMIN when route requires admin.admins.manage', async () => {
      mockAuth.validateSession.mockResolvedValue({
        id: 'sess-1',
        user: { id: 'support-1', email: 'support@example.com', isSuspended: false },
      });
      mockPrisma.platformAdmin.findUnique.mockResolvedValue({
        id: 'pa-support',
        userId: 'support-1',
        role: PlatformRole.SUPPORT_ADMIN,
        status: PlatformAdminStatus.ACTIVE,
        permissions: [],
      });
      // Route requires ADMINS_MANAGE
      mockReflector.getAllAndOverride.mockReturnValue([AdminPermission.ADMINS_MANAGE]);

      const mockContext: any = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: 'Bearer valid_token' },
          }),
        }),
      };

      await expect(superAdminGuard.canActivate(mockContext)).rejects.toThrow(
        /Missing required platform admin permission/,
      );
    });

    it('allows SUPER_ADMIN and populates request with platformAdmin and effective permissions', async () => {
      const mockUser = { id: 'super-1', email: 'boss@example.com', isSuspended: false };
      const mockAdmin = {
        id: 'pa-super',
        userId: 'super-1',
        role: PlatformRole.SUPER_ADMIN,
        status: PlatformAdminStatus.ACTIVE,
        permissions: [],
      };
      mockAuth.validateSession.mockResolvedValue({ id: 'sess-1', user: mockUser });
      mockPrisma.platformAdmin.findUnique.mockResolvedValue(mockAdmin);
      mockReflector.getAllAndOverride.mockReturnValue([AdminPermission.ADMINS_MANAGE]);

      const req: any = { headers: { authorization: 'Bearer super_token' } };
      const mockContext: any = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      };

      const result = await superAdminGuard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(req.platformAdmin).toBeDefined();
      expect(req.adminPermissions).toContain(AdminPermission.ADMINS_MANAGE);
      expect(req.adminPermissions).toContain(AdminPermission.DASHBOARD_READ);
    });
  });

  describe('SuperAdminService', () => {
    it('aggregates real platform KPIs in getDashboardOverview without fake metrics', async () => {
      const overview = await superAdminService.getDashboardOverview();
      expect(overview.users.total).toBe(100);
      expect(overview.workspaces.total).toBe(25);
      expect(overview.content.totalPosts).toBe(50);
      expect(overview.content.totalCampaigns).toBe(10);
      expect(overview.content.totalStoreConnections).toBe(5);
      expect(overview.aiUsage.totalTokens).toBe(150000);
      expect(overview.aiUsage.totalRequests).toBe(30);
    });

    it('grants platform admin access to a registered user and records audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-new-admin',
        email: 'analyst@example.com',
      });
      mockPrisma.platformAdmin.findUnique.mockResolvedValue(null);
      mockPrisma.platformAdmin.create.mockResolvedValue({
        id: 'pa-created',
        userId: 'user-new-admin',
        role: PlatformRole.SUPPORT_ADMIN,
        status: PlatformAdminStatus.ACTIVE,
      });

      const result = await superAdminService.grantAdmin(
        { email: 'analyst@example.com', role: PlatformRole.SUPPORT_ADMIN, reason: 'Hired support engineer' },
        { id: 'super-1', email: 'owner@example.com' },
      );

      expect(result.id).toBe('pa-created');
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admin.granted',
          actorEmail: 'owner@example.com',
          targetId: 'pa-created',
        }),
      );
    });

    it('prevents duplicate admin promotion when user is already a platform admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'existing@example.com' });
      mockPrisma.platformAdmin.findUnique.mockResolvedValue({ id: 'pa-1', userId: 'u-1' });

      await expect(
        superAdminService.grantAdmin(
          { email: 'existing@example.com', role: PlatformRole.SUPER_ADMIN },
          { id: 'super-1', email: 'owner@example.com' },
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('prevents self-demotion or self-suspension of the calling administrator', async () => {
      mockPrisma.platformAdmin.findUnique.mockResolvedValue({
        id: 'pa-current',
        userId: 'super-1',
        role: PlatformRole.SUPER_ADMIN,
        status: PlatformAdminStatus.ACTIVE,
      });

      await expect(
        superAdminService.updateAdmin(
          'pa-current',
          { status: PlatformAdminStatus.SUSPENDED },
          { id: 'super-1', email: 'owner@example.com' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents demoting the last remaining active Super Admin on the platform', async () => {
      mockPrisma.platformAdmin.findUnique.mockResolvedValue({
        id: 'pa-target',
        userId: 'other-user',
        role: PlatformRole.SUPER_ADMIN,
        status: PlatformAdminStatus.ACTIVE,
      });
      // Count of other active super admins is 0
      mockPrisma.platformAdmin.count.mockResolvedValue(0);

      await expect(
        superAdminService.updateAdmin(
          'pa-target',
          { role: PlatformRole.SUPPORT_ADMIN },
          { id: 'super-1', email: 'owner@example.com' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Users Management', () => {
    it('lists paginated users with active sessions and memberships count', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'u-1',
          email: 'user1@example.com',
          name: 'User One',
          isEmailVerified: true,
          isSuspended: false,
          suspendedAt: null,
          suspensionReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          platformAdmin: null,
          memberships: [
            {
              id: 'm-1',
              role: 'OWNER',
              workspace: {
                id: 'ws-1',
                name: 'Workspace One',
                slug: 'workspace-one',
                status: 'ACTIVE',
              },
            },
          ],
          sessions: [{ id: 's-1' }, { id: 's-2' }],
          _count: { sessions: 4, memberships: 1 },
        },
      ]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await superAdminService.listUsers({ page: 1, limit: 10 });
      expect(result.users).toHaveLength(1);
      expect(result.users[0].email).toBe('user1@example.com');
      expect(result.users[0].activeSessionsCount).toBe(2);
      expect(result.users[0].totalSessions).toBe(4);
      expect(result.pagination.total).toBe(1);
    });

    it('returns full user details with sessions, workspaces, and audit history', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'user1@example.com',
        name: 'User One',
        isEmailVerified: true,
        isSuspended: false,
        suspendedAt: null,
        suspensionReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        platformAdmin: null,
        memberships: [
          {
            id: 'm-1',
            role: 'OWNER',
            createdAt: new Date(),
            workspace: {
              id: 'ws-1',
              name: 'Workspace One',
              slug: 'ws-one',
              status: 'ACTIVE',
              planTier: 'FREE',
              createdAt: new Date(),
            },
          },
        ],
        sessions: [
          {
            id: 's-1',
            ipAddress: '127.0.0.1',
            userAgent: 'Mozilla/5.0',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 100000),
            revokedAt: null,
          },
        ],
      });

      const details = await superAdminService.getUserDetails('u-1');
      expect(details.user.email).toBe('user1@example.com');
      expect(details.sessions[0].isValid).toBe(true);
      expect(details.workspaces[0].workspace.name).toBe('Workspace One');
    });

    it('suspends user, revokes active sessions, and records audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-target',
        email: 'badactor@example.com',
        platformAdmin: null,
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'u-target',
        email: 'badactor@example.com',
        isSuspended: true,
        suspendedAt: new Date(),
        suspensionReason: 'Terms of service violation',
      });

      const res = await superAdminService.suspendUser(
        'u-target',
        { reason: 'Terms of service violation' },
        { id: 'admin-1', email: 'admin@platform.com' },
      );

      expect(res.isSuspended).toBe(true);
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u-target', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.suspended',
          targetId: 'u-target',
        }),
      );
    });

    it('prevents administrator from suspending their own account', async () => {
      await expect(
        superAdminService.suspendUser(
          'admin-1',
          { reason: 'Self-sabotage' },
          { id: 'admin-1', email: 'admin@platform.com' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents suspending the last active super admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'last-super',
        email: 'lastsuper@platform.com',
        platformAdmin: {
          role: PlatformRole.SUPER_ADMIN,
          status: PlatformAdminStatus.ACTIVE,
        },
      });
      mockPrisma.platformAdmin.count.mockResolvedValue(0);

      await expect(
        superAdminService.suspendUser(
          'last-super',
          { reason: 'Test' },
          { id: 'other-admin', email: 'other@platform.com' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('reactivates a suspended user and records audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-suspended',
        email: 'reinstated@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: 'u-suspended',
        email: 'reinstated@example.com',
        isSuspended: false,
      });

      const res = await superAdminService.reactivateUser('u-suspended', {
        id: 'admin-1',
        email: 'admin@platform.com',
      });

      expect(res.isSuspended).toBe(false);
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.reactivated',
          targetId: 'u-suspended',
        }),
      );
    });

    it('revokes all active sessions for a user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-target',
        email: 'target@example.com',
      });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 5 });

      const res = await superAdminService.revokeUserSessions('u-target', {
        id: 'admin-1',
        email: 'admin@platform.com',
      });

      expect(res.revokedCount).toBe(5);
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.sessions_revoked',
          targetId: 'u-target',
        }),
      );
    });

    it('triggers secure password reset token dispatch', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u-reset',
        name: 'Reset User',
        email: 'reset@example.com',
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'u-reset' });

      const res = await superAdminService.triggerUserPasswordReset('u-reset', {
        id: 'admin-1',
        email: 'admin@platform.com',
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-reset' },
          data: expect.objectContaining({
            passwordResetToken: expect.any(String),
            passwordResetTokenExpiresAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('Workspaces Management', () => {
    it('lists paginated workspaces with owner and aggregated stats', async () => {
      mockPrisma.workspace.findMany.mockResolvedValue([
        {
          id: 'ws-1',
          name: 'Brand Store',
          slug: 'brand-store',
          timezone: 'UTC',
          locale: 'en-US',
          currency: 'USD',
          status: 'ACTIVE',
          suspendedAt: null,
          suspensionReason: null,
          planTier: 'GROWTH',
          customQuotas: { maxPostsPerMonth: 500 },
          createdAt: new Date(),
          updatedAt: new Date(),
          memberships: [
            {
              role: 'OWNER',
              user: { id: 'u-owner', name: 'Brand Owner', email: 'owner@brand.com' },
            },
          ],
          _count: { memberships: 4, storeConnections: 2, posts: 45, campaigns: 3 },
        },
      ]);
      mockPrisma.workspace.count.mockResolvedValue(1);

      const res = await superAdminService.listWorkspaces({ page: 1, limit: 10 });
      expect(res.workspaces).toHaveLength(1);
      expect(res.workspaces[0].name).toBe('Brand Store');
      expect(res.workspaces[0].owner.email).toBe('owner@brand.com');
      expect(res.workspaces[0].stats.totalMembers).toBe(4);
      expect(res.workspaces[0].stats.totalStores).toBe(2);
    });

    it('returns full workspace details including stores, members, post breakdown, and AI usage', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        name: 'Brand Store',
        slug: 'brand-store',
        timezone: 'UTC',
        locale: 'en-US',
        currency: 'USD',
        status: 'ACTIVE',
        suspendedAt: null,
        suspensionReason: null,
        planTier: 'GROWTH',
        customQuotas: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [
          {
            id: 'm-1',
            role: 'OWNER',
            createdAt: new Date(),
            user: { id: 'u-1', name: 'Owner', email: 'owner@test.com', isSuspended: false, createdAt: new Date() },
          },
        ],
        storeConnections: [
          {
            id: 'sc-1',
            platform: 'SHOPIFY',
            storeName: 'My Shopify Store',
            storeUrl: 'https://store.myshopify.com',
            syncStatus: 'SUCCESS',
            syncedProducts: 42,
            lastSyncAt: new Date(),
            createdAt: new Date(),
          },
        ],
        _count: { memberships: 1, storeConnections: 1, posts: 10, campaigns: 2, products: 42 },
      });

      mockPrisma.post.count
        .mockResolvedValueOnce(5) // published
        .mockResolvedValueOnce(3) // scheduled
        .mockResolvedValueOnce(2); // draft

      const details = await superAdminService.getWorkspaceDetails('ws-1');
      expect(details.workspace.name).toBe('Brand Store');
      expect(details.stores).toHaveLength(1);
      expect(details.stats.postsByStatus.PUBLISHED).toBe(5);
      expect(details.stats.postsByStatus.SCHEDULED).toBe(3);
      expect(details.stats.postsByStatus.DRAFT).toBe(2);
    });

    it('suspends workspace and records audit log', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-suspend',
        name: 'Problematic Tenant',
        slug: 'problematic-tenant',
      });
      mockPrisma.workspace.update.mockResolvedValue({
        id: 'ws-suspend',
        status: 'SUSPENDED',
        suspendedAt: new Date(),
        suspensionReason: 'Payment fraud detection',
      });

      const res = await superAdminService.suspendWorkspace(
        'ws-suspend',
        { reason: 'Payment fraud detection' },
        { id: 'admin-1', email: 'admin@platform.com' },
      );

      expect(res.status).toBe('SUSPENDED');
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'workspace.suspended',
          targetId: 'ws-suspend',
        }),
      );
    });

    it('reactivates workspace and records audit log', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-reopen',
        name: 'Reopened Tenant',
        slug: 'reopened-tenant',
      });
      mockPrisma.workspace.update.mockResolvedValue({
        id: 'ws-reopen',
        status: 'ACTIVE',
      });

      const res = await superAdminService.reactivateWorkspace('ws-reopen', {
        id: 'admin-1',
        email: 'admin@platform.com',
      });

      expect(res.status).toBe('ACTIVE');
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'workspace.reactivated',
          targetId: 'ws-reopen',
        }),
      );
    });

    it('updates workspace plan tier and custom quota limits', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws-quota',
        planTier: 'FREE',
        customQuotas: null,
      });
      mockPrisma.workspace.update.mockResolvedValue({
        id: 'ws-quota',
        planTier: 'ENTERPRISE',
        customQuotas: { maxPostsPerMonth: 2000, maxMembers: 50 },
      });

      const res = await superAdminService.updateWorkspaceLimits(
        'ws-quota',
        { planTier: 'ENTERPRISE', customQuotas: { maxPostsPerMonth: 2000, maxMembers: 50 } },
        { id: 'admin-1', email: 'admin@platform.com' },
      );

      expect(res.planTier).toBe('ENTERPRISE');
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'workspace.limits_updated',
          targetId: 'ws-quota',
        }),
      );
    });

    it('purges workspace and all child records when slug confirmation matches', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: 'ws-purge-1',
        slug: 'acme-archive',
        name: 'Acme Archive Store',
      });
      mockPrisma.workspace.delete.mockResolvedValueOnce({ id: 'ws-purge-1' });

      const res = await superAdminService.purgeWorkspace(
        'ws-purge-1',
        { confirmSlug: 'acme-archive', reason: 'GDPR right to be forgotten' },
        { id: 'admin-1', email: 'admin@platform.com' },
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.product.deleteMany).toHaveBeenCalledWith({ where: { workspaceId: 'ws-purge-1' } });
      expect(mockPrisma.workspace.delete).toHaveBeenCalledWith({ where: { id: 'ws-purge-1' } });
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'workspace.purged_gdpr',
          targetId: 'ws-purge-1',
        }),
      );
    });

    it('rejects purge when confirmation slug does not match', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValueOnce({
        id: 'ws-purge-1',
        slug: 'acme-archive',
        name: 'Acme Archive Store',
      });

      await expect(
        superAdminService.purgeWorkspace(
          'ws-purge-1',
          { confirmSlug: 'wrong-slug' },
          { id: 'admin-1', email: 'admin@platform.com' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Integration Fleet Management', () => {
    it('returns integrations summary with store and social account health breakdowns', async () => {
      mockPrisma.storeConnection.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(9) // healthy
        .mockResolvedValueOnce(1) // failing
        .mockResolvedValueOnce(0) // syncing
        .mockResolvedValueOnce(8) // shopify
        .mockResolvedValueOnce(1) // woocommerce
        .mockResolvedValueOnce(1); // custom

      mockPrisma.socialAccount.count
        .mockResolvedValueOnce(15) // total
        .mockResolvedValueOnce(12) // active
        .mockResolvedValueOnce(2) // expired
        .mockResolvedValueOnce(1) // revoked
        .mockResolvedValueOnce(3) // expiringSoon
        .mockResolvedValueOnce(9) // instagram
        .mockResolvedValueOnce(6); // linkedin

      const summary = await superAdminService.getIntegrationsSummary();

      expect(summary.stores.total).toBe(10);
      expect(summary.stores.failing).toBe(1);
      expect(summary.social.total).toBe(15);
      expect(summary.social.expiringSoon).toBe(3);
      expect(summary.social.providers.META_INSTAGRAM).toBe(9);
    });

    it('lists paginated store connections with workspace details and sync health', async () => {
      mockPrisma.storeConnection.findMany.mockResolvedValue([
        {
          id: 'sc-1',
          workspaceId: 'ws-1',
          platform: 'SHOPIFY',
          storeName: 'Nordic Apparel',
          storeUrl: 'https://nordic-apparel.myshopify.com',
          apiVersion: '2026-01',
          lastSyncAt: new Date(),
          syncStatus: 'SUCCESS',
          errorMessage: null,
          syncedProducts: 142,
          createdAt: new Date(),
          updatedAt: new Date(),
          workspace: {
            id: 'ws-1',
            name: 'Nordic Brands',
            slug: 'nordic-brands',
            status: 'ACTIVE',
            planTier: 'GROWTH',
          },
        },
      ]);
      mockPrisma.storeConnection.count.mockResolvedValue(1);

      const res = await superAdminService.listStoreConnections({ page: 1, limit: 10 });
      expect(res.stores).toHaveLength(1);
      expect(res.stores[0].storeName).toBe('Nordic Apparel');
      expect(res.stores[0].platform).toBe('SHOPIFY');
      expect(res.stores[0].workspace.name).toBe('Nordic Brands');
      expect(res.pagination.total).toBe(1);
    });

    it('lists paginated social accounts with days until expiration calculation', async () => {
      const expiringDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000); // 4 days from now
      mockPrisma.socialAccount.findMany.mockResolvedValue([
        {
          id: 'sa-1',
          workspaceId: 'ws-1',
          provider: 'META_INSTAGRAM',
          providerAccountId: 'ig-123',
          displayName: 'Nordic IG',
          username: 'nordic_apparel',
          tokenExpiresAt: expiringDate,
          scopes: ['instagram_basic', 'instagram_content_publish'],
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          workspace: {
            id: 'ws-1',
            name: 'Nordic Brands',
            slug: 'nordic-brands',
            status: 'ACTIVE',
            planTier: 'GROWTH',
          },
        },
      ]);
      mockPrisma.socialAccount.count.mockResolvedValue(1);

      const res = await superAdminService.listSocialAccounts({ page: 1, limit: 10 });
      expect(res.accounts).toHaveLength(1);
      expect(res.accounts[0].displayName).toBe('Nordic IG');
      expect(res.accounts[0].isExpiringSoon).toBe(true);
      expect(res.accounts[0].daysUntilExpiration).toBeLessThanOrEqual(4);
      expect(res.accounts[0].workspace.name).toBe('Nordic Brands');
    });

    it('triggers manual store resync and logs audit action', async () => {
      mockPrisma.storeConnection.findUnique.mockResolvedValue({
        id: 'sc-1',
        workspaceId: 'ws-1',
        platform: 'SHOPIFY',
        storeName: 'Nordic Apparel',
      });
      mockPrisma.storeConnection.update.mockResolvedValue({
        id: 'sc-1',
        lastSyncAt: new Date(),
        syncStatus: 'SUCCESS',
      });

      const res = await superAdminService.triggerStoreResync('sc-1', {
        id: 'admin-1',
        email: 'operator@platform.com',
      });

      expect(res.connectionId).toBe('sc-1');
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'store.resync_triggered',
          targetId: 'sc-1',
        }),
      );
    });

    it('updates social account status with reason and logs audit event', async () => {
      mockPrisma.socialAccount.findUnique.mockResolvedValue({
        id: 'sa-1',
        status: 'ACTIVE',
      });
      mockPrisma.socialAccount.update.mockResolvedValue({
        id: 'sa-1',
        workspaceId: 'ws-1',
        provider: 'LINKEDIN',
        displayName: 'Nordic LinkedIn',
        username: 'nordic-co',
        status: 'REVOKED',
        updatedAt: new Date(),
      });

      const res = await superAdminService.updateSocialAccountStatus(
        'sa-1',
        { status: 'REVOKED' as any, reason: 'Security token compromised' },
        { id: 'admin-1', email: 'operator@platform.com' },
      );

      expect(res.status).toBe('REVOKED');
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'social.status_updated',
          targetId: 'sa-1',
        }),
      );
    });
  });

  describe('Billing & Subscriptions Management', () => {
    it('aggregates platform billing summary correctly with MRR, ARR, and plan tiers', async () => {
      mockPrisma.subscription.count
        .mockResolvedValueOnce(5) // active
        .mockResolvedValueOnce(2) // trialing
        .mockResolvedValueOnce(1) // pastDue
        .mockResolvedValueOnce(3) // canceled
        .mockResolvedValueOnce(11); // total

      mockPrisma.billingEvent.aggregate.mockResolvedValue({
        _sum: { amountCents: 154000 },
      });

      mockPrisma.workspace.findMany.mockResolvedValue([
        { planTier: 'FREE' },
        { planTier: 'STARTER' },
        { planTier: 'PROFESSIONAL' },
        { planTier: 'ENTERPRISE' },
      ]);

      const res = await superAdminService.getBillingSummary();
      expect(res.totalRevenueCents).toBe(154000);
      expect(res.subscriptions.total).toBe(11);
      expect(res.subscriptions.active).toBe(5);
      expect(res.subscriptions.trialing).toBe(2);
      expect(res.subscriptions.pastDue).toBe(1);
      expect(res.subscriptions.canceled).toBe(3);
      // STARTER (2900) + PROFESSIONAL (7900) + ENTERPRISE (29900) = 40700 cents
      expect(res.mrrCents).toBe(40700);
      expect(res.arrCents).toBe(40700 * 12);
      expect(res.planDistribution['STARTER']).toBe(1);
    });

    it('paginates subscriptions with tenant workspace info', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          planId: 'pro_monthly',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          workspace: {
            id: 'ws-1',
            name: 'Acme Corp',
            slug: 'acme-corp',
            planTier: 'PROFESSIONAL',
            status: 'ACTIVE',
            _count: { memberships: 4 },
          },
        },
      ]);
      mockPrisma.subscription.count.mockResolvedValue(1);

      const res = await superAdminService.listSubscriptions({ page: 1, limit: 10 });
      expect(res.subscriptions).toHaveLength(1);
      expect(res.subscriptions[0].planId).toBe('pro_monthly');
      expect(res.subscriptions[0].workspace.name).toBe('Acme Corp');
      expect(res.pagination.total).toBe(1);
    });

    it('cancels subscription immediately and downgrades workspace to FREE', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        workspaceId: 'ws-1',
        planId: 'pro_monthly',
        status: 'ACTIVE',
        workspace: { name: 'Acme Corp' },
      });
      mockPrisma.subscription.update.mockResolvedValue({
        id: 'sub-1',
        status: 'CANCELED',
        cancelAtPeriodEnd: true,
      });

      const res = await superAdminService.cancelSubscription(
        'sub-1',
        { reason: 'Customer requested immediate cancellation', immediate: true },
        { id: 'admin-1', email: 'operator@platform.com' },
      );

      expect(mockPrisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-1' },
          data: { planTier: 'FREE' },
        }),
      );
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'billing.subscription_cancelled',
          targetId: 'sub-1',
        }),
      );
    });
  });

  describe('AI Providers & Quota Control', () => {
    it('aggregates AI provider summary with token totals and provider breakdown', async () => {
      mockPrisma.aiUsage.count.mockResolvedValue(150);
      mockPrisma.aiUsage.aggregate.mockResolvedValue({
        _sum: {
          promptTokens: 800000,
          completionTokens: 200000,
          costEstimateMicrocents: 5000000,
        },
      });
      mockPrisma.aiUsage.findMany.mockResolvedValue([
        {
          provider: 'OPENAI',
          model: 'gpt-4o',
          feature: 'CAPTION_GENERATION',
          promptTokens: 4000,
          completionTokens: 1000,
          costEstimateMicrocents: 25000,
        },
        {
          provider: 'ANTHROPIC',
          model: 'claude-3-5-sonnet',
          feature: 'STORE_ANALYSIS',
          promptTokens: 8000,
          completionTokens: 2000,
          costEstimateMicrocents: 50000,
        },
      ]);

      const res = await superAdminService.getAiSummary();
      expect(res.totalRequests).toBe(150);
      expect(res.totalTokens).toBe(1000000);
      expect(res.totalCostEstimateMicrocents).toBe(5000000);
      expect(res.totalCostEstimateUsd).toBe(0.05);
      expect(res.providerBreakdown['OPENAI'].requests).toBe(1);
      expect(res.providerBreakdown['ANTHROPIC'].requests).toBe(1);
      expect(res.featureBreakdown['CAPTION_GENERATION'].totalTokens).toBe(5000);
    });

    it('returns top consuming AI tenants sorted by token count', async () => {
      mockPrisma.aiUsage.findMany.mockResolvedValue([
        {
          workspaceId: 'ws-1',
          promptTokens: 10000,
          completionTokens: 5000,
          costEstimateMicrocents: 30000,
        },
        {
          workspaceId: 'ws-2',
          promptTokens: 20000,
          completionTokens: 10000,
          costEstimateMicrocents: 60000,
        },
      ]);
      mockPrisma.workspace.findMany.mockResolvedValue([
        { id: 'ws-2', name: 'Power Seller', slug: 'power-seller', planTier: 'ENTERPRISE' },
        { id: 'ws-1', name: 'Small Store', slug: 'small-store', planTier: 'STARTER' },
      ]);

      const res = await superAdminService.getTopAiTenants();
      expect(res).toHaveLength(2);
      expect(res[0].workspaceName).toBe('Power Seller');
      expect(res[0].totalTokens).toBe(30000);
      expect(res[1].workspaceName).toBe('Small Store');
      expect(res[1].totalTokens).toBe(15000);
    });
  });

  describe('Background Jobs & System Telemetry', () => {
    it('returns jobs overview with queues and workload metrics', async () => {
      mockPrisma.post.count
        .mockResolvedValueOnce(3) // failedPosts
        .mockResolvedValueOnce(12) // scheduledPosts
        .mockResolvedValueOnce(1); // publishingPosts

      mockPrisma.catalogImport.count
        .mockResolvedValueOnce(2) // pendingImports
        .mockResolvedValueOnce(1); // failedImports

      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'post-failed-1',
          workspaceId: 'ws-1',
          content: 'Autumn Promo Reel',
          updatedAt: new Date(),
          publishAttempts: [{ errorMessage: 'Rate limit exceeded on provider.' }],
        },
      ]);

      mockPrisma.catalogImport.findMany.mockResolvedValue([
        {
          id: 'imp-failed-1',
          workspaceId: 'ws-1',
          fileName: 'products.csv',
          failedRows: 15,
          errors: ['Invalid SKU format at row 4'],
          updatedAt: new Date(),
        },
      ]);

      const res = await superAdminService.getJobsOverview();
      expect(res.workload.failedPosts).toBe(3);
      expect(res.workload.scheduledPosts).toBe(12);
      expect(res.workload.pendingImports).toBe(2);
      expect(res.workload.failedImports).toBe(1);
      expect(res.recentFailures).toHaveLength(2);
      expect(res.queues.find((q) => q.name === 'post-publishing')?.status).toBe('DEGRADED');
    });

    it('triggers retry of failed workload and records audit log', async () => {
      const res = await superAdminService.retryFailedJobs({
        id: 'admin-1',
        email: 'operator@platform.com',
      });

      expect(res.retriedPosts).toBe(2);
      expect(res.retriedImports).toBe(1);
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'jobs.retry_triggered',
          targetType: 'BACKGROUND_QUEUES',
        }),
      );
    });
  });

  describe('Platform Settings & Announcements Management', () => {
    it('seeds default settings when none exist in database', async () => {
      mockPrisma.platformSetting.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { key: 'maintenance_mode', value: { enabled: false } },
          { key: 'allow_public_registrations', value: { enabled: true } },
        ]);
      mockPrisma.platformSetting.upsert.mockResolvedValue({});

      const settings = await superAdminService.listPlatformSettings();
      expect(mockPrisma.platformSetting.upsert).toHaveBeenCalled();
      expect(settings).toHaveLength(2);
    });

    it('updates platform setting and logs audit trail', async () => {
      mockPrisma.platformSetting.findUnique.mockResolvedValue({
        key: 'maintenance_mode',
        value: { enabled: false },
        description: 'Global maintenance mode',
      });
      mockPrisma.platformSetting.upsert.mockResolvedValue({
        key: 'maintenance_mode',
        value: { enabled: true, message: 'Upgrading database' },
        description: 'Global maintenance mode',
        version: 2,
        updatedBy: 'operator@platform.com',
      });

      const res = await superAdminService.updatePlatformSetting(
        'maintenance_mode',
        { value: { enabled: true, message: 'Upgrading database' } },
        { id: 'admin-1', email: 'operator@platform.com' },
      );

      expect(res.version).toBe(2);
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'setting.updated',
          targetId: 'maintenance_mode',
        }),
      );
    });

    it('creates, updates, and deletes broadcast announcements', async () => {
      // Create
      mockPrisma.adminAnnouncement.create.mockResolvedValue({
        id: 'ann-1',
        title: 'Platform Maintenance Notice',
        content: 'System will be unavailable for 15 mins.',
        audience: 'ALL',
        isPublished: true,
      });

      const created = await superAdminService.createAnnouncement(
        { title: 'Platform Maintenance Notice', content: 'System will be unavailable for 15 mins.' },
        { id: 'admin-1', email: 'operator@platform.com' },
      );
      expect(created.id).toBe('ann-1');
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'announcement.created' }),
      );

      // Update
      mockPrisma.adminAnnouncement.findUnique.mockResolvedValue({ id: 'ann-1', title: 'Platform Maintenance Notice' });
      mockPrisma.adminAnnouncement.update.mockResolvedValue({
        id: 'ann-1',
        title: 'Updated Maintenance Notice',
      });

      const updated = await superAdminService.updateAnnouncement(
        'ann-1',
        { title: 'Updated Maintenance Notice' },
        { id: 'admin-1', email: 'operator@platform.com' },
      );
      expect(updated.title).toBe('Updated Maintenance Notice');

      // Delete
      mockPrisma.adminAnnouncement.delete.mockResolvedValue({ id: 'ann-1' });
      const deleted = await superAdminService.deleteAnnouncement('ann-1', {
        id: 'admin-1',
        email: 'operator@platform.com',
      });
      expect(deleted.success).toBe(true);
      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'announcement.deleted' }),
      );
    });
  });
});
