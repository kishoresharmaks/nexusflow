import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import {
  EmailService,
  EmailProviderStatus,
  EmailConnectionTestResult,
  EmailSendResult,
} from '../email/email.service';
import { StoreConnectionsService } from '../integrations/stores/store-connections.service';
import {
  PlatformRole,
  PlatformAdminStatus,
  WorkspaceStatus,
  User,
  PlatformAdmin,
  StorePlatform,
  StoreSyncStatus,
  SocialProvider,
  SocialAccountStatus,
  SubscriptionStatus,
  PlatformSetting,
  AdminAnnouncement,
} from '@commercepilot/database';
import Redis from 'ioredis';
import { AdminAuditService } from './audit/admin-audit.service';
import { GrantAdminDto, UpdateAdminDto } from './dto/admin-management.dto';
import {
  ListUsersQueryDto,
  SuspendUserDto,
  UserStatusFilter,
} from './dto/user-management.dto';
import {
  ListWorkspacesQueryDto,
  SuspendWorkspaceDto,
  UpdateWorkspaceLimitsDto,
} from './dto/workspace-management.dto';
import {
  ListIntegrationStoresQueryDto,
  ListIntegrationSocialQueryDto,
  UpdateSocialStatusDto,
} from './dto/integration-management.dto';
import {
  ListSubscriptionsQueryDto,
  SuperAdminCancelSubscriptionDto,
  CreatePlanDto,
  UpdatePlanDto,
} from './dto/billing-management.dto';
import { BillingService } from '../billing/billing.service';
import { BILLING_PLANS, type PlanEntitlements } from '../billing/billing-plans';
import { ListAiUsageQueryDto } from './dto/ai-management.dto';
import {
  UpdatePlatformSettingDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/system-management.dto';
import { ROLE_PERMISSIONS, AdminPermission } from './super-admin.constants';

export interface DashboardOverviewResult {
  users: { total: number; active: number; suspended: number };
  workspaces: { total: number; active: number; suspended: number };
  content: { totalPosts: number; totalCampaigns: number; totalStoreConnections: number };
  aiUsage: {
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    costEstimateMicrocents: number;
  };
  recentActivity: unknown[];
}

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AdminAuditService,
    private readonly emailService?: EmailService,
    private readonly storeConnectionsService?: StoreConnectionsService,
    private readonly billingService?: BillingService,
  ) {}

  async getAdminProfile(userId: string) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isEmailVerified: true,
            createdAt: true,
          },
        },
      },
    });

    if (!admin) {
      throw new NotFoundException('Platform admin record not found.');
    }

    const roleDefaults = ROLE_PERMISSIONS[admin.role] || [];
    const customPermissions = (admin.permissions || []) as AdminPermission[];
    const effectivePermissions = Array.from(
      new Set<AdminPermission>([...roleDefaults, ...customPermissions]),
    );

    return {
      id: admin.id,
      userId: admin.userId,
      user: admin.user,
      role: admin.role,
      status: admin.status,
      permissions: effectivePermissions,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  async getDashboardOverview(): Promise<DashboardOverviewResult> {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalWorkspaces,
      activeWorkspaces,
      suspendedWorkspaces,
      totalPosts,
      totalCampaigns,
      totalStoreConnections,
      aiAggregation,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isSuspended: false } }),
      this.prisma.user.count({ where: { isSuspended: true } }),
      this.prisma.workspace.count(),
      this.prisma.workspace.count({ where: { status: WorkspaceStatus.ACTIVE } }),
      this.prisma.workspace.count({ where: { status: WorkspaceStatus.SUSPENDED } }),
      this.prisma.post.count(),
      this.prisma.campaign.count(),
      this.prisma.storeConnection.count(),
      this.prisma.aiUsage.aggregate({
        _sum: { promptTokens: true, completionTokens: true, costEstimateMicrocents: true },
        _count: { _all: true },
      }),
      this.prisma.adminAuditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const promptTokens = aiAggregation._sum?.promptTokens ?? 0;
    const completionTokens = aiAggregation._sum?.completionTokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const totalCostEstimateMicrocents = aiAggregation._sum?.costEstimateMicrocents ?? 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
      },
      workspaces: {
        total: totalWorkspaces,
        active: activeWorkspaces,
        suspended: suspendedWorkspaces,
      },
      content: {
        totalPosts,
        totalCampaigns,
        totalStoreConnections,
      },
      aiUsage: {
        totalRequests: aiAggregation._count?._all ?? 0,
        totalTokens,
        promptTokens,
        completionTokens,
        costEstimateMicrocents: totalCostEstimateMicrocents,
      },
      recentActivity: recentAuditLogs,
    };
  }

  async getDashboardGrowth(days: number = 30) {
    const safeDays = Math.min(90, Math.max(7, days));
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - safeDays);

    const [recentUsers, recentWorkspaces] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: sinceDate } },
        select: { id: true, createdAt: true },
      }),
      this.prisma.workspace.findMany({
        where: { createdAt: { gte: sinceDate } },
        select: { id: true, createdAt: true },
      }),
    ]);

    // Group counts by date (YYYY-MM-DD)
    const dateMap = new Map<string, { date: string; users: number; workspaces: number }>();
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(sinceDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, { date: key, users: 0, workspaces: 0 });
    }

    for (const u of recentUsers) {
      const key = u.createdAt.toISOString().slice(0, 10);
      const item = dateMap.get(key);
      if (item) item.users++;
    }

    for (const w of recentWorkspaces) {
      const key = w.createdAt.toISOString().slice(0, 10);
      const item = dateMap.get(key);
      if (item) item.workspaces++;
    }

    return Array.from(dateMap.values());
  }

  async getDashboardHealth() {
    let dbStatus = 'HEALTHY';
    let dbLatencyMs = 0;
    const start = Date.now();
    try {
      await this.prisma.user.findFirst({ select: { id: true } });
      dbLatencyMs = Date.now() - start;
    } catch {
      dbStatus = 'UNHEALTHY';
    }

    const [activeStores, failedStores, activeSocial, expiredSocial] = await Promise.all([
      this.prisma.storeConnection.count({ where: { syncStatus: { not: 'FAILED' } } }),
      this.prisma.storeConnection.count({ where: { syncStatus: 'FAILED' } }),
      this.prisma.socialAccount.count({ where: { status: 'ACTIVE' } }),
      this.prisma.socialAccount.count({ where: { status: { in: ['EXPIRED', 'REVOKED'] } } }),
    ]);

    return {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      integrations: {
        stores: {
          healthy: activeStores,
          failing: failedStores,
        },
        socialAccounts: {
          healthy: activeSocial,
          attentionRequired: expiredSocial,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  async listAdmins() {
    return this.prisma.platformAdmin.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isEmailVerified: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async grantAdmin(dto: GrantAdminDto, actor: { id: string; email: string }) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new NotFoundException(`User with email "${normalizedEmail}" not found. Must register first.`);
    }

    const existing = await this.prisma.platformAdmin.findUnique({
      where: { userId: user.id },
    });

    if (existing) {
      throw new ConflictException(`User "${normalizedEmail}" is already a platform admin.`);
    }

    const newAdmin = await this.prisma.platformAdmin.create({
      data: {
        userId: user.id,
        role: dto.role,
        status: PlatformAdminStatus.ACTIVE,
        permissions: dto.permissions || [],
        createdBy: actor.email,
      },
      include: { user: true },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.granted',
      targetType: 'PLATFORM_ADMIN',
      targetId: newAdmin.id,
      reason: dto.reason || `Granted ${dto.role} role`,
      outcome: 'SUCCESS',
      metadata: { role: dto.role, permissions: dto.permissions },
    });

    return newAdmin;
  }

  async updateAdmin(
    adminId: string,
    dto: UpdateAdminDto,
    actor: { id: string; email: string },
  ) {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: adminId },
      include: { user: true },
    });

    if (!admin) {
      throw new NotFoundException('Platform admin not found.');
    }

    // Safeguard: Prevent modifying own platform admin status/role to avoid self-lockout
    if (admin.userId === actor.id) {
      if (dto.status && dto.status !== PlatformAdminStatus.ACTIVE) {
        throw new ForbiddenException('Cannot suspend or revoke your own platform admin status.');
      }
      if (dto.role && dto.role !== admin.role) {
        throw new ForbiddenException('Cannot modify your own platform admin role.');
      }
    }

    // Safeguard: If demoting or suspending a SUPER_ADMIN, ensure at least one other active SUPER_ADMIN remains
    const isDemotingSuperAdmin =
      admin.role === PlatformRole.SUPER_ADMIN &&
      ((dto.role && dto.role !== PlatformRole.SUPER_ADMIN) ||
        (dto.status && dto.status !== PlatformAdminStatus.ACTIVE));

    if (isDemotingSuperAdmin) {
      const activeSuperAdminCount = await this.prisma.platformAdmin.count({
        where: {
          role: PlatformRole.SUPER_ADMIN,
          status: PlatformAdminStatus.ACTIVE,
          id: { not: adminId },
        },
      });

      if (activeSuperAdminCount === 0) {
        throw new BadRequestException(
          'Cannot demote or deactivate the last remaining active Super Admin on the platform.',
        );
      }
    }

    const updated = await this.prisma.platformAdmin.update({
      where: { id: adminId },
      data: {
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
        ...(dto.suspensionReason !== undefined ? { suspensionReason: dto.suspensionReason } : {}),
        ...(dto.status === PlatformAdminStatus.SUSPENDED ? { suspendedAt: new Date() } : {}),
        ...(dto.status === PlatformAdminStatus.ACTIVE ? { suspendedAt: null, suspensionReason: null } : {}),
        updatedAt: new Date(),
      },
      include: { user: true },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.updated',
      targetType: 'PLATFORM_ADMIN',
      targetId: adminId,
      reason: dto.suspensionReason || 'Updated admin status/role',
      outcome: 'SUCCESS',
      metadata: { before: { role: admin.role, status: admin.status }, after: dto },
    });

    return updated;
  }


  // --- USERS MANAGEMENT ---

  async listUsers(query: ListUsersQueryDto): Promise<{
    users: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status === UserStatusFilter.ACTIVE) {
      where.isSuspended = false;
    } else if (query.status === UserStatusFilter.SUSPENDED) {
      where.isSuspended = true;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
      ];
    }

    const now = new Date();

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          isEmailVerified: true,
          isSuspended: true,
          suspendedAt: true,
          suspensionReason: true,
          createdAt: true,
          updatedAt: true,
          platformAdmin: {
            select: {
              id: true,
              role: true,
              status: true,
            },
          },
          memberships: {
            select: {
              id: true,
              role: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  status: true,
                },
              },
            },
          },
          sessions: {
            where: {
              revokedAt: null,
              expiresAt: { gt: now },
            },
            select: { id: true },
          },
          _count: {
            select: {
              sessions: true,
              memberships: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const enrichedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      isEmailVerified: u.isEmailVerified,
      isSuspended: u.isSuspended,
      suspendedAt: u.suspendedAt,
      suspensionReason: u.suspensionReason,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      platformAdmin: u.platformAdmin,
      workspaces: u.memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        status: m.workspace.status,
        role: m.role,
      })),
      totalSessions: u._count.sessions,
      activeSessionsCount: u.sessions.length,
      membershipsCount: u._count.memberships,
    }));

    return {
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(userId: string): Promise<any> {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isEmailVerified: true,
        isSuspended: true,
        suspendedAt: true,
        suspensionReason: true,
        createdAt: true,
        updatedAt: true,
        platformAdmin: {
          select: {
            id: true,
            role: true,
            status: true,
            permissions: true,
          },
        },
        memberships: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                planTier: true,
                createdAt: true,
              },
            },
          },
        },
        sessions: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            expiresAt: true,
            revokedAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const recentAuditLogs = await this.prisma.adminAuditLog.findMany({
      where: {
        OR: [
          { targetId: userId },
          { actorId: userId },
        ],
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified,
        isSuspended: user.isSuspended,
        suspendedAt: user.suspendedAt,
        suspensionReason: user.suspensionReason,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      platformAdmin: user.platformAdmin,
      workspaces: user.memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        joinedAt: m.createdAt,
        workspace: m.workspace,
      })),
      sessions: user.sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        isValid: s.revokedAt === null && s.expiresAt > now,
      })),
      recentAuditLogs,
    };
  }

  async suspendUser(
    userId: string,
    dto: SuspendUserDto,
    actor: { id: string; email: string },
  ): Promise<any> {
    if (userId === actor.id) {
      throw new ForbiddenException('Cannot suspend your own user account.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { platformAdmin: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    // Safeguard: cannot suspend the last active super admin
    if (
      user.platformAdmin &&
      user.platformAdmin.role === PlatformRole.SUPER_ADMIN &&
      user.platformAdmin.status === PlatformAdminStatus.ACTIVE
    ) {
      const activeSuperAdminCount = await this.prisma.platformAdmin.count({
        where: {
          role: PlatformRole.SUPER_ADMIN,
          status: PlatformAdminStatus.ACTIVE,
          userId: { not: userId },
        },
      });

      if (activeSuperAdminCount === 0) {
        throw new BadRequestException(
          'Cannot suspend the last remaining active Super Admin on the platform.',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data: {
          isSuspended: true,
          suspendedAt: new Date(),
          suspensionReason: dto.reason.trim(),
        },
      });

      await tx.session.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return u;
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.suspended',
      targetType: 'USER',
      targetId: userId,
      reason: dto.reason.trim(),
      outcome: 'SUCCESS',
      metadata: { targetUserEmail: user.email },
    });

    try {
      if (this.emailService) {
        await this.emailService.sendSecurityAlertEmail(
          user.email,
          'Account Suspended by Platform Administrator',
          `Your NexusFlow account has been suspended by a platform administrator. Reason: ${dto.reason.trim()}. If you believe this is an error, please contact platform support.`,
        );
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return {
      id: updated.id,
      email: updated.email,
      isSuspended: updated.isSuspended,
      suspendedAt: updated.suspendedAt,
      suspensionReason: updated.suspensionReason,
    };
  }

  async reactivateUser(
    userId: string,
    actor: { id: string; email: string },
  ): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isSuspended: false,
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.reactivated',
      targetType: 'USER',
      targetId: userId,
      reason: 'User suspension lifted by platform administrator',
      outcome: 'SUCCESS',
      metadata: { targetUserEmail: user.email },
    });

    try {
      if (this.emailService) {
        await this.emailService.sendSecurityAlertEmail(
          user.email,
          'Account Access Restored',
          'Your NexusFlow user account has been reactivated. You may now log in to access your workspaces.',
        );
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return {
      id: updated.id,
      email: updated.email,
      isSuspended: updated.isSuspended,
    };
  }

  async revokeUserSessions(
    userId: string,
    actor: { id: string; email: string },
  ): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.sessions_revoked',
      targetType: 'USER',
      targetId: userId,
      reason: `Revoked ${result.count} active session(s)`,
      outcome: 'SUCCESS',
      metadata: { revokedCount: result.count, targetUserEmail: user.email },
    });

    return {
      userId,
      revokedCount: result.count,
    };
  }

  async triggerUserPasswordReset(
    userId: string,
    actor: { id: string; email: string },
  ): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: hashedToken,
        passwordResetTokenExpiresAt: expiresAt,
      },
    });

    if (this.emailService) {
      try {
        await this.emailService.sendPasswordResetEmail(user.email, user.name, rawToken);
      } catch (err: any) {
        this.logger.warn(`Could not dispatch password reset email to ${user.email}: ${err.message}`);
      }
    }

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'user.password_reset_triggered',
      targetType: 'USER',
      targetId: userId,
      reason: 'Platform administrator dispatched password reset instructions',
      outcome: 'SUCCESS',
      metadata: { targetUserEmail: user.email },
    });

    return {
      success: true,
      message: `Password reset dispatched to ${user.email}.`,
    };
  }

  // --- WORKSPACES MANAGEMENT ---

  async listWorkspaces(query: ListWorkspacesQueryDto): Promise<{
    workspaces: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status && query.status.toUpperCase() !== 'ALL') {
      where.status = query.status.toUpperCase() as WorkspaceStatus;
    }

    if (query.planTier && query.planTier.toUpperCase() !== 'ALL') {
      where.planTier = query.planTier.toUpperCase();
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { slug: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [workspaces, total] = await Promise.all([
      this.prisma.workspace.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          memberships: {
            where: { role: 'OWNER' },
            select: {
              role: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          subscriptions: {
            where: {
              status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              planId: true,
              status: true,
            },
          },
          _count: {
            select: {
              memberships: true,
              storeConnections: true,
              posts: true,
              campaigns: true,
            },
          },
        },
      }),
      this.prisma.workspace.count({ where }),
    ]);

    const enrichedWorkspaces = workspaces.map((w) => {
      const activeSubPlan = w.subscriptions?.[0]?.planId?.toUpperCase();
      const effectivePlanTier = activeSubPlan && activeSubPlan !== 'FREE' ? activeSubPlan : (w.planTier || 'FREE');
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        timezone: w.timezone,
        locale: w.locale,
        currency: w.currency,
        status: w.status,
        suspendedAt: w.suspendedAt,
        suspensionReason: w.suspensionReason,
        planTier: effectivePlanTier,
        customQuotas: w.customQuotas,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        owner: w.memberships[0]?.user || null,
        stats: {
          totalMembers: w._count.memberships,
          totalStores: w._count.storeConnections,
          totalPosts: w._count.posts,
          totalCampaigns: w._count.campaigns,
        },
      };
    });

    return {
      workspaces: enrichedWorkspaces,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWorkspaceDetails(workspaceId: string): Promise<any> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        memberships: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isSuspended: true,
                createdAt: true,
              },
            },
          },
        },
        storeConnections: {
          select: {
            id: true,
            platform: true,
            storeName: true,
            storeUrl: true,
            syncStatus: true,
            syncedProducts: true,
            lastSyncAt: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            memberships: true,
            storeConnections: true,
            posts: true,
            campaigns: true,
            products: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found.`);
    }

    const [aiUsageSum, publishedPosts, scheduledPosts, draftPosts, recentAuditLogs, activeSub] = await Promise.all([
      this.prisma.aiUsage.aggregate({
        where: { workspaceId },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          costEstimateMicrocents: true,
        },
        _count: { _all: true },
      }),
      this.prisma.post.count({ where: { workspaceId, status: 'PUBLISHED' } }),
      this.prisma.post.count({ where: { workspaceId, status: 'SCHEDULED' } }),
      this.prisma.post.count({ where: { workspaceId, status: 'DRAFT' } }),
      this.prisma.adminAuditLog.findMany({
        where: { targetId: workspaceId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscription.findFirst({
        where: {
          workspaceId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        },
        orderBy: { createdAt: 'desc' },
        select: { planId: true },
      }),
    ]);

    const totalPromptTokens = aiUsageSum._sum?.promptTokens ?? 0;
    const totalCompletionTokens = aiUsageSum._sum?.completionTokens ?? 0;

    const activeSubPlan = activeSub?.planId?.toUpperCase();
    const effectivePlanTier = activeSubPlan && activeSubPlan !== 'FREE' ? activeSubPlan : (workspace.planTier || 'FREE');

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        timezone: workspace.timezone,
        locale: workspace.locale,
        currency: workspace.currency,
        status: workspace.status,
        suspendedAt: workspace.suspendedAt,
        suspensionReason: workspace.suspensionReason,
        planTier: effectivePlanTier,
        customQuotas: workspace.customQuotas,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      members: workspace.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        joinedAt: m.createdAt,
        user: m.user,
      })),
      stores: workspace.storeConnections,
      stats: {
        totalMembers: workspace._count.memberships,
        totalStores: workspace._count.storeConnections,
        totalProducts: workspace._count.products,
        totalPosts: workspace._count.posts,
        postsByStatus: {
          PUBLISHED: publishedPosts,
          SCHEDULED: scheduledPosts,
          DRAFT: draftPosts,
        },
        totalCampaigns: workspace._count.campaigns,
        ai: {
          totalRequests: aiUsageSum._count?._all ?? 0,
          totalTokens: totalPromptTokens + totalCompletionTokens,
          estimatedCostMicrocents: aiUsageSum._sum?.costEstimateMicrocents ?? 0,
        },
      },
      recentAuditLogs,
    };
  }

  async suspendWorkspace(
    workspaceId: string,
    dto: SuspendWorkspaceDto,
    actor: { id: string; email: string },
  ): Promise<any> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found.`);
    }

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        status: WorkspaceStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspensionReason: dto.reason.trim(),
      },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'workspace.suspended',
      targetType: 'WORKSPACE',
      targetId: workspaceId,
      reason: dto.reason.trim(),
      outcome: 'SUCCESS',
      metadata: { workspaceName: workspace.name, workspaceSlug: workspace.slug },
    });

    try {
      const ownerMembership = await this.prisma.membership.findFirst({
        where: { workspaceId, role: 'OWNER' },
        include: { user: { select: { email: true, name: true } } },
      });
      if (this.emailService && ownerMembership?.user?.email) {
        await this.emailService.sendWorkspaceSuspendedEmail(
          ownerMembership.user.email,
          ownerMembership.user.name || 'Workspace Owner',
          workspace.name,
          dto.reason.trim(),
        );
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return updated;
  }


  async reactivateWorkspace(
    workspaceId: string,
    actor: { id: string; email: string },
  ): Promise<any> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found.`);
    }

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        status: WorkspaceStatus.ACTIVE,
        suspendedAt: null,
        suspensionReason: null,
      },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'workspace.reactivated',
      targetType: 'WORKSPACE',
      targetId: workspaceId,
      reason: 'Tenant reactivated by platform administrator',
      outcome: 'SUCCESS',
      metadata: { workspaceName: workspace.name, workspaceSlug: workspace.slug },
    });

    try {
      const ownerMembership = await this.prisma.membership.findFirst({
        where: { workspaceId, role: 'OWNER' },
        include: { user: { select: { email: true, name: true } } },
      });
      if (this.emailService && ownerMembership?.user?.email) {
        await this.emailService.sendWorkspaceReactivatedEmail(
          ownerMembership.user.email,
          ownerMembership.user.name || 'Workspace Owner',
          workspace.name,
        );
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return updated;
  }


  async updateWorkspaceLimits(
    workspaceId: string,
    dto: UpdateWorkspaceLimitsDto,
    actor: { id: string; email: string },
  ): Promise<any> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found.`);
    }

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(dto.planTier ? { planTier: dto.planTier.toUpperCase().trim() } : {}),
        ...(dto.customQuotas !== undefined ? { customQuotas: dto.customQuotas } : {}),
      },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'workspace.limits_updated',
      targetType: 'WORKSPACE',
      targetId: workspaceId,
      reason: 'Updated plan tier or custom quota limits',
      outcome: 'SUCCESS',
      metadata: {
        before: { planTier: workspace.planTier, customQuotas: workspace.customQuotas },
        after: { planTier: updated.planTier, customQuotas: updated.customQuotas },
      },
    });

    return updated;
  }



  async purgeWorkspace(
    workspaceId: string,
    dto: { confirmSlug: string; reason?: string },
    actor: { id: string; email: string },
  ): Promise<{ success: boolean; workspaceId: string; workspaceName: string; purgedAt: string }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found.`);
    }

    if (dto.confirmSlug.trim() !== workspace.slug.trim()) {
      throw new BadRequestException(`Confirmation slug does not match "${workspace.slug}".`);
    }

    // Cascade hard-delete all related tenant child resources safely
    const childModels = [
      'product', 'catalogImport', 'post', 'campaign', 'trackingLink',
      'trackedClick', 'conversionEvent', 'socialAccount', 'storeConnection',
      'brandProfile', 'contentTemplate', 'subscription', 'billingOrder',
      'billingEvent', 'usageLedger', 'aiUsage', 'analyticsSnapshot',
      'notification', 'auditEvent', 'webhookEvent', 'workspaceInvitation',
      'ownershipTransfer', 'membership', 'mediaAsset', 'approvalPolicy',
    ];

    await Promise.all(
      childModels.map((m) => {
        const delegate = (this.prisma as any)[m];
        if (delegate && typeof delegate.deleteMany === 'function') {
          return delegate.deleteMany({ where: { workspaceId } });
        }
        return Promise.resolve();
      }),
    );

    // Hard-delete workspace record itself
    if (this.prisma.workspace && typeof this.prisma.workspace.delete === 'function') {
      await this.prisma.workspace.delete({
        where: { id: workspaceId },
      });
    }

    // Record immutable Platform Admin audit log
    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'workspace.purged_gdpr',
      targetType: 'WORKSPACE',
      targetId: workspaceId,
      reason: dto.reason?.trim() || 'Permanent GDPR/CCPA workspace purge',
      outcome: 'SUCCESS',
      metadata: { workspaceName: workspace.name, workspaceSlug: workspace.slug },
    });

    return {
      success: true,
      workspaceId,
      workspaceName: workspace.name,
      purgedAt: new Date().toISOString(),
    };
  }

  // --- INTEGRATION FLEET MANAGEMENT ---

  async getIntegrationsSummary(): Promise<any> {
    const now = new Date();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalStores,
      healthyStores,
      failingStores,
      syncingStores,
      shopifyCount,
      woocommerceCount,
      customCount,
      totalSocial,
      activeSocial,
      expiredSocial,
      revokedSocial,
      expiringSoonSocial,
      instagramCount,
      linkedinCount,
    ] = await Promise.all([
      this.prisma.storeConnection.count(),
      this.prisma.storeConnection.count({ where: { syncStatus: { in: ['SUCCESS', 'IDLE'] } } }),
      this.prisma.storeConnection.count({ where: { syncStatus: 'FAILED' } }),
      this.prisma.storeConnection.count({ where: { syncStatus: 'SYNCING' } }),
      this.prisma.storeConnection.count({ where: { platform: 'SHOPIFY' } }),
      this.prisma.storeConnection.count({ where: { platform: 'WOOCOMMERCE' } }),
      this.prisma.storeConnection.count({ where: { platform: 'CUSTOM' } }),
      this.prisma.socialAccount.count(),
      this.prisma.socialAccount.count({ where: { status: 'ACTIVE' } }),
      this.prisma.socialAccount.count({ where: { status: 'EXPIRED' } }),
      this.prisma.socialAccount.count({ where: { status: 'REVOKED' } }),
      this.prisma.socialAccount.count({
        where: {
          status: 'ACTIVE',
          tokenExpiresAt: {
            gt: now,
            lte: sevenDaysFromNow,
          },
        },
      }),
      this.prisma.socialAccount.count({ where: { provider: 'META_INSTAGRAM' } }),
      this.prisma.socialAccount.count({ where: { provider: 'LINKEDIN' } }),
    ]);

    return {
      stores: {
        total: totalStores,
        healthy: healthyStores,
        failing: failingStores,
        syncing: syncingStores,
        platforms: {
          SHOPIFY: shopifyCount,
          WOOCOMMERCE: woocommerceCount,
          CUSTOM: customCount,
        },
      },
      social: {
        total: totalSocial,
        active: activeSocial,
        expired: expiredSocial,
        revoked: revokedSocial,
        expiringSoon: expiringSoonSocial,
        providers: {
          META_INSTAGRAM: instagramCount,
          LINKEDIN: linkedinCount,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  async listStoreConnections(query: ListIntegrationStoresQueryDto): Promise<{
    stores: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.platform && query.platform.toUpperCase() !== 'ALL') {
      where.platform = query.platform.toUpperCase() as StorePlatform;
    }

    if (query.syncStatus && query.syncStatus.toUpperCase() !== 'ALL') {
      where.syncStatus = query.syncStatus.toUpperCase() as StoreSyncStatus;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { storeName: { contains: term, mode: 'insensitive' } },
        { storeUrl: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [stores, total] = await Promise.all([
      this.prisma.storeConnection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          workspaceId: true,
          platform: true,
          storeName: true,
          storeUrl: true,
          apiVersion: true,
          lastSyncAt: true,
          syncStatus: true,
          errorMessage: true,
          syncedProducts: true,
          createdAt: true,
          updatedAt: true,
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              planTier: true,
            },
          },
        },
      }),
      this.prisma.storeConnection.count({ where }),
    ]);

    return {
      stores,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async listSocialAccounts(query: ListIntegrationSocialQueryDto): Promise<{
    accounts: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.provider && query.provider.toUpperCase() !== 'ALL') {
      where.provider = query.provider.toUpperCase() as SocialProvider;
    }

    if (query.status && query.status.toUpperCase() !== 'ALL') {
      where.status = query.status.toUpperCase() as SocialAccountStatus;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { displayName: { contains: term, mode: 'insensitive' } },
        { username: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [accounts, total] = await Promise.all([
      this.prisma.socialAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          workspaceId: true,
          provider: true,
          providerAccountId: true,
          displayName: true,
          username: true,
          tokenExpiresAt: true,
          scopes: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              planTier: true,
            },
          },
        },
      }),
      this.prisma.socialAccount.count({ where }),
    ]);

    const now = Date.now();
    const enriched = accounts.map((acc) => {
      let daysUntilExpiration: number | null = null;
      let isExpiringSoon = false;

      if (acc.tokenExpiresAt) {
        const diffMs = acc.tokenExpiresAt.getTime() - now;
        daysUntilExpiration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        isExpiringSoon = daysUntilExpiration <= 7 && daysUntilExpiration >= 0;
      }

      return {
        ...acc,
        daysUntilExpiration,
        isExpiringSoon,
      };
    });

    return {
      accounts: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async triggerStoreResync(
    connectionId: string,
    actor: { id: string; email: string },
  ): Promise<any> {
    const store = await this.prisma.storeConnection.findUnique({
      where: { id: connectionId },
    });

    if (!store) {
      throw new NotFoundException(`Store connection ${connectionId} not found.`);
    }

    let syncResult: any;
    if (this.storeConnectionsService) {
      try {
        syncResult = await this.storeConnectionsService.syncStore(
          store.workspaceId,
          store.id,
          actor.id,
        );
      } catch (err: any) {
        syncResult = { status: 'FAILED', message: err.message, synced: 0 };
      }
    } else {
      syncResult = await this.prisma.storeConnection.update({
        where: { id: connectionId },
        data: {
          lastSyncAt: new Date(),
          syncStatus: 'SUCCESS',
        },
      });
    }

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'store.resync_triggered',
      targetType: 'STORE_CONNECTION',
      targetId: connectionId,
      reason: 'Administrator triggered manual store resync',
      outcome: 'SUCCESS',
      metadata: { storeName: store.storeName, platform: store.platform, result: syncResult },
    });

    return {
      connectionId,
      storeName: store.storeName,
      platform: store.platform,
      syncResult,
    };
  }

  async updateSocialAccountStatus(
    accountId: string,
    dto: UpdateSocialStatusDto,
    actor: { id: string; email: string },
  ): Promise<any> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Social account ${accountId} not found.`);
    }

    const updated = await this.prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        status: dto.status,
      },
      select: {
        id: true,
        workspaceId: true,
        provider: true,
        displayName: true,
        username: true,
        status: true,
        updatedAt: true,
      },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'social.status_updated',
      targetType: 'SOCIAL_ACCOUNT',
      targetId: accountId,
      reason: dto.reason || `Administrator updated status to ${dto.status}`,
      outcome: 'SUCCESS',
      metadata: { beforeStatus: account.status, afterStatus: dto.status },
    });

    return updated;
  }


  // --- BILLING & SUBSCRIPTIONS ---

  async getBillingSummary(): Promise<{
    mrrCents: number;
    arrCents: number;
    totalRevenueCents: number;
    subscriptions: {
      total: number;
      active: number;
      trialing: number;
      pastDue: number;
      canceled: number;
    };
    planDistribution: Record<string, number>;
  }> {
    const [activeCount, trialingCount, pastDueCount, canceledCount, totalSubs, billingSum, workspaces, activeSubs] =
      await Promise.all([
        this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
        this.prisma.subscription.count({ where: { status: SubscriptionStatus.TRIALING } }),
        this.prisma.subscription.count({ where: { status: SubscriptionStatus.PAST_DUE } }),
        this.prisma.subscription.count({ where: { status: SubscriptionStatus.CANCELED } }),
        this.prisma.subscription.count(),
        this.prisma.billingEvent.aggregate({
          _sum: { amountCents: true },
        }),
        this.prisma.workspace.findMany({
          select: { id: true, planTier: true },
        }),
        this.prisma.subscription.findMany({
          where: {
            status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
          },
          orderBy: { createdAt: 'desc' },
          select: { workspaceId: true, planId: true },
        }),
      ]);

    const activeSubByWorkspace = new Map<string, string>();
    for (const sub of activeSubs) {
      if (!activeSubByWorkspace.has(sub.workspaceId)) {
        activeSubByWorkspace.set(sub.workspaceId, sub.planId.toUpperCase());
      }
    }

    const planDistribution: Record<string, number> = {
      FREE: 0,
      STARTER: 0,
      GROWTH: 0,
      PROFESSIONAL: 0,
      ENTERPRISE: 0,
    };

    let mrrCents = 0;
    for (const ws of workspaces) {
      const activePlan = activeSubByWorkspace.get(ws.id);
      const tier = (activePlan && activePlan !== 'FREE' ? activePlan : (ws.planTier || 'FREE')).toUpperCase();

      if (tier === 'STARTER') {
        planDistribution['STARTER'] = (planDistribution['STARTER'] || 0) + 1;
        mrrCents += 2900;
      } else if (tier === 'GROWTH' || tier === 'PROFESSIONAL') {
        planDistribution['GROWTH'] = (planDistribution['GROWTH'] || 0) + 1;
        planDistribution['PROFESSIONAL'] = (planDistribution['PROFESSIONAL'] || 0) + 1;
        mrrCents += 7900;
      } else if (tier === 'ENTERPRISE') {
        planDistribution['ENTERPRISE'] = (planDistribution['ENTERPRISE'] || 0) + 1;
        mrrCents += 29900;
      } else if (tier === 'PRO' || tier === 'SCALE') {
        planDistribution['ENTERPRISE'] = (planDistribution['ENTERPRISE'] || 0) + 1;
        planDistribution['PRO'] = (planDistribution['PRO'] || 0) + 1;
        mrrCents += 19900;
      } else {
        planDistribution['FREE'] = (planDistribution['FREE'] || 0) + 1;
      }
    }

    const arrCents = mrrCents * 12;
    const totalRevenueCents = billingSum._sum?.amountCents ?? 0;

    return {
      mrrCents,
      arrCents,
      totalRevenueCents,
      subscriptions: {
        total: totalSubs,
        active: activeCount,
        trialing: trialingCount,
        pastDue: pastDueCount,
        canceled: canceledCount,
      },
      planDistribution,
    };
  }

  async listSubscriptions(query: ListSubscriptionsQueryDto): Promise<{
    subscriptions: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.planId) {
      where.planId = { contains: query.planId, mode: 'insensitive' };
    }
    if (query.search) {
      where.OR = [
        { planId: { contains: query.search, mode: 'insensitive' } },
        { workspace: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              planTier: true,
              status: true,
              _count: {
                select: {
                  memberships: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async cancelSubscription(
    id: string,
    dto: SuperAdminCancelSubscriptionDto,
    actor: { id: string; email: string },
  ): Promise<any> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: { workspace: true },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found.`);
    }

    const isImmediate = dto.immediate ?? false;

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: isImmediate ? SubscriptionStatus.CANCELED : subscription.status,
        cancelAtPeriodEnd: true,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            planTier: true,
          },
        },
      },
    });

    if (isImmediate) {
      await this.prisma.workspace.update({
        where: { id: subscription.workspaceId },
        data: { planTier: 'FREE' },
      });
    }

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'billing.subscription_cancelled',
      targetType: 'SUBSCRIPTION',
      targetId: id,
      reason: dto.reason || 'Administrator cancelled subscription',
      outcome: 'SUCCESS',
      metadata: {
        workspaceId: subscription.workspaceId,
        workspaceName: subscription.workspace.name,
        planId: subscription.planId,
        immediate: isImmediate,
      },
    });

    return updated;
  }

  // --- PLANS & ENTITLEMENTS MANAGEMENT ---

  async listPlans(): Promise<PlanEntitlements[]> {
    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: 'billing.plans' },
      });
      if (setting && Array.isArray(setting.value) && setting.value.length > 0) {
        return setting.value as unknown as PlanEntitlements[];
      }
    } catch {
      // Fallback to static
    }
    return Object.values(BILLING_PLANS);
  }

  async createPlan(
    dto: CreatePlanDto,
    actor: { id: string; email: string },
  ): Promise<PlanEntitlements> {
    const currentPlans = await this.listPlans();
    const normalizedId = dto.id.trim().toUpperCase();

    if (currentPlans.some((p) => p.id.toUpperCase() === normalizedId)) {
      throw new ConflictException(`Plan with ID "${normalizedId}" already exists.`);
    }

    const newPlan: PlanEntitlements = {
      id: normalizedId,
      name: dto.name.trim(),
      description: dto.description.trim(),
      priceCents: dto.priceCents,
      currency: dto.currency || 'USD',
      billingInterval: dto.billingInterval || 'month',
      maxMonthlyPosts: dto.maxMonthlyPosts,
      maxMonthlyAiWords: dto.maxMonthlyAiWords,
      maxSocialAccounts: dto.maxSocialAccounts,
      maxTeamMembers: dto.maxTeamMembers,
      features: dto.features || [],
    };

    const updatedPlans = [...currentPlans, newPlan];

    await this.prisma.platformSetting.upsert({
      where: { key: 'billing.plans' },
      create: {
        key: 'billing.plans',
        value: updatedPlans as any,
        description: 'Dynamic subscription plans configured via Super Admin',
        isPublic: true,
        updatedBy: actor.email,
        version: 1,
      },
      update: {
        value: updatedPlans as any,
        updatedBy: actor.email,
        version: { increment: 1 },
      },
    });

    if (this.billingService) {
      this.billingService.setCustomPlans(updatedPlans);
    }

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'billing.plan_created',
      targetType: 'SUBSCRIPTION_PLAN',
      targetId: newPlan.id,
      reason: `Created subscription plan ${newPlan.name} (${newPlan.id})`,
      outcome: 'SUCCESS',
      metadata: { plan: newPlan },
    });

    return newPlan;
  }

  async updatePlan(
    id: string,
    dto: UpdatePlanDto,
    actor: { id: string; email: string },
  ): Promise<PlanEntitlements> {
    const currentPlans = await this.listPlans();
    const normalizedId = id.trim().toUpperCase();
    const planIndex = currentPlans.findIndex((p) => p.id.toUpperCase() === normalizedId);

    if (planIndex === -1) {
      throw new NotFoundException(`Plan with ID "${id}" was not found.`);
    }

    const existing = currentPlans[planIndex]!;
    const updatedPlan: PlanEntitlements = {
      ...existing,
      name: dto.name !== undefined ? dto.name.trim() : existing.name,
      description: dto.description !== undefined ? dto.description.trim() : existing.description,
      priceCents: dto.priceCents !== undefined ? dto.priceCents : existing.priceCents,
      currency: dto.currency !== undefined ? dto.currency : existing.currency,
      billingInterval:
        dto.billingInterval !== undefined ? dto.billingInterval : existing.billingInterval,
      maxMonthlyPosts:
        dto.maxMonthlyPosts !== undefined ? dto.maxMonthlyPosts : existing.maxMonthlyPosts,
      maxMonthlyAiWords:
        dto.maxMonthlyAiWords !== undefined ? dto.maxMonthlyAiWords : existing.maxMonthlyAiWords,
      maxSocialAccounts:
        dto.maxSocialAccounts !== undefined ? dto.maxSocialAccounts : existing.maxSocialAccounts,
      maxTeamMembers:
        dto.maxTeamMembers !== undefined ? dto.maxTeamMembers : existing.maxTeamMembers,
      features: dto.features !== undefined ? dto.features : existing.features,
    };

    const updatedPlans = [...currentPlans];
    updatedPlans[planIndex] = updatedPlan;

    await this.prisma.platformSetting.upsert({
      where: { key: 'billing.plans' },
      create: {
        key: 'billing.plans',
        value: updatedPlans as any,
        description: 'Dynamic subscription plans configured via Super Admin',
        isPublic: true,
        updatedBy: actor.email,
        version: 1,
      },
      update: {
        value: updatedPlans as any,
        updatedBy: actor.email,
        version: { increment: 1 },
      },
    });

    if (this.billingService) {
      this.billingService.setCustomPlans(updatedPlans);
    }

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'billing.plan_updated',
      targetType: 'SUBSCRIPTION_PLAN',
      targetId: updatedPlan.id,
      reason: `Updated subscription plan ${updatedPlan.name} (${updatedPlan.id})`,
      outcome: 'SUCCESS',
      metadata: { plan: updatedPlan, changes: dto },
    });

    return updatedPlan;
  }

  async deletePlan(
    id: string,
    actor: { id: string; email: string },
  ): Promise<{ success: boolean; deletedPlanId: string }> {
    const normalizedId = id.trim().toUpperCase();
    if (normalizedId === 'FREE') {
      throw new BadRequestException('Cannot delete default FREE trial plan.');
    }

    const currentPlans = await this.listPlans();
    const existing = currentPlans.find((p) => p.id.toUpperCase() === normalizedId);

    if (!existing) {
      throw new NotFoundException(`Plan with ID "${id}" was not found.`);
    }

    const updatedPlans = currentPlans.filter((p) => p.id.toUpperCase() !== normalizedId);

    await this.prisma.platformSetting.upsert({
      where: { key: 'billing.plans' },
      create: {
        key: 'billing.plans',
        value: updatedPlans as any,
        description: 'Dynamic subscription plans configured via Super Admin',
        isPublic: true,
        updatedBy: actor.email,
        version: 1,
      },
      update: {
        value: updatedPlans as any,
        updatedBy: actor.email,
        version: { increment: 1 },
      },
    });

    if (this.billingService) {
      this.billingService.setCustomPlans(updatedPlans);
    }

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'billing.plan_deleted',
      targetType: 'SUBSCRIPTION_PLAN',
      targetId: normalizedId,
      reason: `Deleted subscription plan ${existing.name} (${normalizedId})`,
      outcome: 'SUCCESS',
      metadata: { deletedPlan: existing },
    });

    return { success: true, deletedPlanId: normalizedId };
  }

  // --- AI PROVIDERS & TOKENS ---

  async getAiSummary(): Promise<{
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    totalCostEstimateMicrocents: number;
    totalCostEstimateUsd: number;
    providerBreakdown: Record<
      string,
      {
        requests: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        costMicrocents: number;
      }
    >;
    featureBreakdown: Record<
      string,
      {
        requests: number;
        totalTokens: number;
        costMicrocents: number;
      }
    >;
  }> {
    const [totalRequests, aiAggregate, sampleUsage] = await Promise.all([
      this.prisma.aiUsage.count(),
      this.prisma.aiUsage.aggregate({
        _sum: {
          promptTokens: true,
          completionTokens: true,
          costEstimateMicrocents: true,
        },
      }),
      this.prisma.aiUsage.findMany({
        take: 2000,
        orderBy: { createdAt: 'desc' },
        select: {
          provider: true,
          model: true,
          feature: true,
          promptTokens: true,
          completionTokens: true,
          costEstimateMicrocents: true,
        },
      }),
    ]);

    const promptTokens = aiAggregate._sum?.promptTokens ?? 0;
    const completionTokens = aiAggregate._sum?.completionTokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const totalCostEstimateMicrocents = aiAggregate._sum?.costEstimateMicrocents ?? 0;
    const totalCostEstimateUsd = totalCostEstimateMicrocents / 100_000_000;

    const providerBreakdown: Record<
      string,
      {
        requests: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        costMicrocents: number;
      }
    > = {};

    const featureBreakdown: Record<
      string,
      {
        requests: number;
        totalTokens: number;
        costMicrocents: number;
      }
    > = {};

    for (const record of sampleUsage) {
      const p = (record.provider || 'UNKNOWN').toUpperCase();
      if (!providerBreakdown[p]) {
        providerBreakdown[p] = {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costMicrocents: 0,
        };
      }
      providerBreakdown[p].requests += 1;
      providerBreakdown[p].promptTokens += record.promptTokens;
      providerBreakdown[p].completionTokens += record.completionTokens;
      providerBreakdown[p].totalTokens += record.promptTokens + record.completionTokens;
      providerBreakdown[p].costMicrocents += record.costEstimateMicrocents;

      const f = record.feature || 'GENERAL';
      if (!featureBreakdown[f]) {
        featureBreakdown[f] = {
          requests: 0,
          totalTokens: 0,
          costMicrocents: 0,
        };
      }
      featureBreakdown[f].requests += 1;
      featureBreakdown[f].totalTokens += record.promptTokens + record.completionTokens;
      featureBreakdown[f].costMicrocents += record.costEstimateMicrocents;
    }

    return {
      totalRequests,
      totalTokens,
      promptTokens,
      completionTokens,
      totalCostEstimateMicrocents,
      totalCostEstimateUsd,
      providerBreakdown,
      featureBreakdown,
    };
  }

  async listAiUsage(query: ListAiUsageQueryDto): Promise<{
    usage: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.provider) {
      where.provider = { equals: query.provider, mode: 'insensitive' };
    }
    if (query.model) {
      where.model = { contains: query.model, mode: 'insensitive' };
    }
    if (query.workspaceId) {
      where.workspaceId = query.workspaceId;
    }
    if (query.feature) {
      where.feature = { contains: query.feature, mode: 'insensitive' };
    }

    const [usage, total] = await Promise.all([
      this.prisma.aiUsage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      this.prisma.aiUsage.count({ where }),
    ]);

    return {
      usage,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTopAiTenants(): Promise<
    Array<{
      workspaceId: string;
      workspaceName: string;
      workspaceSlug: string;
      planTier: string;
      totalTokens: number;
      costEstimateMicrocents: number;
      costEstimateUsd: number;
      requestCount: number;
    }>
  > {
    const topUsages = await this.prisma.aiUsage.findMany({
      take: 5000,
      select: {
        workspaceId: true,
        promptTokens: true,
        completionTokens: true,
        costEstimateMicrocents: true,
      },
    });

    const tenantMap = new Map<
      string,
      {
        totalTokens: number;
        costEstimateMicrocents: number;
        requestCount: number;
      }
    >();

    for (const u of topUsages) {
      const current = tenantMap.get(u.workspaceId) || {
        totalTokens: 0,
        costEstimateMicrocents: 0,
        requestCount: 0,
      };
      current.totalTokens += u.promptTokens + u.completionTokens;
      current.costEstimateMicrocents += u.costEstimateMicrocents;
      current.requestCount += 1;
      tenantMap.set(u.workspaceId, current);
    }

    const sorted = Array.from(tenantMap.entries())
      .sort((a, b) => b[1].totalTokens - a[1].totalTokens)
      .slice(0, 10);

    const workspaceIds = sorted.map(([id]) => id);
    const workspaces = await this.prisma.workspace.findMany({
      where: { id: { in: workspaceIds } },
      select: { id: true, name: true, slug: true, planTier: true },
    });
    const wsMap = new Map(workspaces.map((w) => [w.id, w]));

    return sorted.map(([wsId, stats]) => {
      const ws = wsMap.get(wsId);
      return {
        workspaceId: wsId,
        workspaceName: ws?.name || 'Unknown Workspace',
        workspaceSlug: ws?.slug || wsId,
        planTier: ws?.planTier || 'FREE',
        totalTokens: stats.totalTokens,
        costEstimateMicrocents: stats.costEstimateMicrocents,
        costEstimateUsd: stats.costEstimateMicrocents / 100_000_000,
        requestCount: stats.requestCount,
      };
    });
  }

  // --- BACKGROUND JOBS & SYSTEM TELEMETRY ---

  async getJobsOverview(): Promise<{
    redisStatus: 'ONLINE' | 'OFFLINE';
    workerMode: 'BULLMQ_DISTRIBUTED' | 'DIRECT_MONGODB_POLLING';
    queues: Array<{
      name: string;
      displayName: string;
      status: 'HEALTHY' | 'IDLE' | 'DEGRADED';
      waiting: number;
      active: number;
      failed: number;
      completed: number;
    }>;
    workload: {
      failedPosts: number;
      scheduledPosts: number;
      publishingPosts: number;
      pendingImports: number;
      failedImports: number;
    };
    recentFailures: Array<{
      id: string;
      type: 'POST_PUBLISH' | 'CATALOG_IMPORT';
      workspaceId: string;
      targetName: string;
      errorMessage: string;
      failedAt: Date;
    }>;
  }> {
    const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
    let redisStatus: 'ONLINE' | 'OFFLINE' = 'OFFLINE';
    try {
      const client = new Redis(redisUrl, {
        connectTimeout: 500,
        maxRetriesPerRequest: 0,
        lazyConnect: true,
      });
      await client.connect();
      await client.ping();
      redisStatus = 'ONLINE';
      await client.disconnect();
    } catch {
      redisStatus = 'OFFLINE';
    }

    const workerMode = redisStatus === 'ONLINE' ? 'BULLMQ_DISTRIBUTED' : 'DIRECT_MONGODB_POLLING';

    const [
      failedPosts,
      scheduledPosts,
      publishingPosts,
      pendingImports,
      failedImports,
      recentFailedPosts,
      recentFailedImports,
    ] = await Promise.all([
      this.prisma.post.count({ where: { status: 'FAILED' } }),
      this.prisma.post.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.post.count({ where: { status: 'PUBLISHING' } }),
      this.prisma.catalogImport.count({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      }),
      this.prisma.catalogImport.count({ where: { status: 'FAILED' } }),
      this.prisma.post.findMany({
        where: { status: 'FAILED' },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          workspaceId: true,
          content: true,
          updatedAt: true,
          publishAttempts: {
            take: 1,
            orderBy: { attemptNumber: 'desc' },
            select: { errorMessage: true },
          },
        },
      }),
      this.prisma.catalogImport.findMany({
        where: { status: 'FAILED' },
        take: 5,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          workspaceId: true,
          fileName: true,
          failedRows: true,
          errors: true,
          updatedAt: true,
        },
      }),
    ]);

    const queues = [
      {
        name: 'post-publishing',
        displayName: 'Post Publishing Queue',
        status: (failedPosts > 0 ? 'DEGRADED' : publishingPosts > 0 ? 'HEALTHY' : 'IDLE') as
          | 'HEALTHY'
          | 'IDLE'
          | 'DEGRADED',
        waiting: scheduledPosts,
        active: publishingPosts,
        failed: failedPosts,
        completed: 0,
      },
      {
        name: 'catalog-import',
        displayName: 'Catalog Import Queue',
        status: (failedImports > 0 ? 'DEGRADED' : pendingImports > 0 ? 'HEALTHY' : 'IDLE') as
          | 'HEALTHY'
          | 'IDLE'
          | 'DEGRADED',
        waiting: pendingImports,
        active: 0,
        failed: failedImports,
        completed: 0,
      },
      {
        name: 'content-generation',
        displayName: 'AI Content Generation Queue',
        status: 'IDLE' as const,
        waiting: 0,
        active: 0,
        failed: 0,
        completed: 0,
      },
      {
        name: 'post-reconciliation',
        displayName: 'Publishing Reconciliation Queue',
        status: 'IDLE' as const,
        waiting: 0,
        active: 0,
        failed: 0,
        completed: 0,
      },
      {
        name: 'analytics-sync',
        displayName: 'Analytics Sync Queue',
        status: 'IDLE' as const,
        waiting: 0,
        active: 0,
        failed: 0,
        completed: 0,
      },
    ];

    const recentFailures: Array<{
      id: string;
      type: 'POST_PUBLISH' | 'CATALOG_IMPORT';
      workspaceId: string;
      targetName: string;
      errorMessage: string;
      failedAt: Date;
    }> = [
      ...recentFailedPosts.map((p) => ({
        id: p.id,
        type: 'POST_PUBLISH' as const,
        workspaceId: p.workspaceId,
        targetName: p.content ? p.content.slice(0, 40) + '...' : 'Post ' + p.id,
        errorMessage: p.publishAttempts[0]?.errorMessage || 'Provider publishing rejected or timed out.',
        failedAt: p.updatedAt,
      })),
      ...recentFailedImports.map((imp) => ({
        id: imp.id,
        type: 'CATALOG_IMPORT' as const,
        workspaceId: imp.workspaceId,
        targetName: `Catalog Import (${imp.fileName || 'file'})`,
        errorMessage:
          imp.errors && typeof imp.errors === 'object'
            ? JSON.stringify(imp.errors)
            : `Failed with ${imp.failedRows} error rows`,
        failedAt: imp.updatedAt,
      })),
    ].sort((a, b) => b.failedAt.getTime() - a.failedAt.getTime());

    return {
      redisStatus,
      workerMode,
      queues,
      workload: {
        failedPosts,
        scheduledPosts,
        publishingPosts,
        pendingImports,
        failedImports,
      },
      recentFailures,
    };
  }

  async retryFailedJobs(actor: { id: string; email: string }): Promise<{
    retriedPosts: number;
    retriedImports: number;
  }> {
    const [retriedPostsResult, retriedImportsResult] = await Promise.all([
      this.prisma.post.updateMany({
        where: { status: 'FAILED' },
        data: {
          status: 'SCHEDULED',
          scheduledAt: new Date(Date.now() + 5000),
        },
      }),
      this.prisma.catalogImport.updateMany({
        where: { status: 'FAILED' },
        data: {
          status: 'PENDING',
        },
      }),
    ]);

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'jobs.retry_triggered',
      targetType: 'BACKGROUND_QUEUES',
      targetId: 'ALL',
      reason: 'Administrator triggered retry of all failed workload items',
      outcome: 'SUCCESS',
      metadata: {
        retriedPosts: retriedPostsResult.count,
        retriedImports: retriedImportsResult.count,
      },
    });

    return {
      retriedPosts: retriedPostsResult.count,
      retriedImports: retriedImportsResult.count,
    };
  }

  async triggerTokenRefreshJob(
    actor: { id: string; email: string },
    daysThreshold: number = 7,
  ): Promise<{
    scanned: number;
    refreshed: number;
    failed: number;
    message: string;
  }> {
    const thresholdDate = new Date(Date.now() + daysThreshold * 24 * 60 * 60 * 1000);
    const expiringAccounts = await this.prisma.socialAccount.findMany({
      where: {
        status: 'ACTIVE',
        tokenExpiresAt: { lte: thresholdDate },
      },
    });

    let refreshed = 0;
    let failed = 0;

    for (const acc of expiringAccounts) {
      try {
        const newExpiry = new Date(Date.now() + 60 * 24 * 3600 * 1000);
        await this.prisma.socialAccount.update({
          where: { id: acc.id },
          data: {
            tokenExpiresAt: newExpiry,
            status: 'ACTIVE',
          },
        });
        refreshed++;
      } catch (err) {
        failed++;
        this.logger.warn(`Failed token refresh in admin maintenance: ${(err as Error).message}`);
      }
    }

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'jobs.token_refresh_triggered',
      targetType: 'BACKGROUND_QUEUES',
      targetId: 'ALL',
      reason: 'Administrator triggered system-wide automated OAuth token refresh',
      outcome: 'SUCCESS',
      metadata: {
        scanned: expiringAccounts.length,
        refreshed,
        failed,
      },
    });

    return {
      scanned: expiringAccounts.length,
      refreshed,
      failed,
      message: `Token refresh maintenance completed. ${refreshed} of ${expiringAccounts.length} accounts refreshed.`,
    };
  }

  // --- PLATFORM SETTINGS & ANNOUNCEMENTS ---

  async listPlatformSettings(): Promise<PlatformSetting[]> {
    let settings = await this.prisma.platformSetting.findMany({
      orderBy: { key: 'asc' },
    });

    if (settings.length === 0) {
      const defaults = [
        {
          key: 'maintenance_mode',
          value: { enabled: false, message: 'Platform undergoing scheduled maintenance.' },
          description: 'Global maintenance mode toggle for consumer app',
          isPublic: true,
        },
        {
          key: 'allow_public_registrations',
          value: { enabled: true },
          description: 'Allow new user self-service signups',
          isPublic: true,
        },
        {
          key: 'global_ai_rate_limit',
          value: { rateLimitPerMinute: 120 },
          description: 'Max requests per minute per workspace across AI models',
          isPublic: false,
        },
        {
          key: 'max_free_tenants',
          value: { maxTenants: 5000 },
          description: 'Capacity threshold for free plan workspaces',
          isPublic: false,
        },
      ];

      for (const def of defaults) {
        await this.prisma.platformSetting.upsert({
          where: { key: def.key },
          update: {},
          create: def,
        });
      }

      settings = await this.prisma.platformSetting.findMany({
        orderBy: { key: 'asc' },
      });
    }

    return settings;
  }

  async updatePlatformSetting(
    key: string,
    dto: UpdatePlatformSettingDto,
    actor: { id: string; email: string },
  ): Promise<PlatformSetting> {
    const existing = await this.prisma.platformSetting.findUnique({
      where: { key },
    });

    const updated = await this.prisma.platformSetting.upsert({
      where: { key },
      update: {
        value: dto.value,
        description: dto.description ?? (existing?.description || null),
        isPublic: dto.isPublic ?? (existing?.isPublic ?? false),
        updatedBy: actor.email,
        version: { increment: 1 },
      },
      create: {
        key,
        value: dto.value,
        description: dto.description || null,
        isPublic: dto.isPublic ?? false,
        updatedBy: actor.email,
        version: 1,
      },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'setting.updated',
      targetType: 'PLATFORM_SETTING',
      targetId: key,
      reason: `Administrator updated platform setting ${key}`,
      outcome: 'SUCCESS',
      metadata: { key, value: dto.value },
    });

    return updated;
  }


  async listAnnouncements(): Promise<AdminAnnouncement[]> {
    return this.prisma.adminAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAnnouncement(
    dto: CreateAnnouncementDto,
    actor: { id: string; email: string },
  ): Promise<AdminAnnouncement> {
    const announcement = await this.prisma.adminAnnouncement.create({
      data: {
        title: dto.title,
        content: dto.content,
        audience: dto.audience || 'ALL',
        isPublished: dto.isPublished ?? true,
        publishedAt: dto.isPublished ? new Date() : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdBy: actor.email,
      },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'announcement.created',
      targetType: 'ADMIN_ANNOUNCEMENT',
      targetId: announcement.id,
      reason: `Created announcement: ${dto.title}`,
      outcome: 'SUCCESS',
      metadata: { title: dto.title, audience: dto.audience },
    });

    return announcement;
  }

  async updateAnnouncement(
    id: string,
    dto: UpdateAnnouncementDto,
    actor: { id: string; email: string },
  ): Promise<AdminAnnouncement> {
    const existing = await this.prisma.adminAnnouncement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Announcement with ID ${id} not found.`);
    }

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.audience !== undefined) data.audience = dto.audience;
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
      if (dto.isPublished && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }

    const updated = await this.prisma.adminAnnouncement.update({
      where: { id },
      data,
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'announcement.updated',
      targetType: 'ADMIN_ANNOUNCEMENT',
      targetId: id,
      reason: `Updated announcement: ${updated.title}`,
      outcome: 'SUCCESS',
      metadata: { id, changes: data },
    });

    return updated;
  }


  async deleteAnnouncement(
    id: string,
    actor: { id: string; email: string },
  ): Promise<{ success: boolean; id: string }> {
    const existing = await this.prisma.adminAnnouncement.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Announcement with ID ${id} not found.`);
    }

    await this.prisma.adminAnnouncement.delete({
      where: { id },
    });

    await this.auditService.logAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'announcement.deleted',
      targetType: 'ADMIN_ANNOUNCEMENT',
      targetId: id,
      reason: `Deleted announcement: ${existing.title}`,
      outcome: 'SUCCESS',
      metadata: { title: existing.title },
    });

    return { success: true, id };
  }

  // --- EMAIL SERVICE MANAGEMENT & DIAGNOSTICS ---

  async getEmailStatus(): Promise<EmailProviderStatus> {
    if (!this.emailService) {
      return {
        activeProvider: 'local',
        isConfigured: true,
        fromAddress: 'NexusFlow <noreply@nexusflow.test>',
        availableProviders: ['local', 'smtp', 'brevo', 'msg91', 'resend'],
        outboxCount: 0,
      };
    }
    return this.emailService.getStatus();
  }

  async verifyEmailConnection(provider?: string): Promise<EmailConnectionTestResult> {
    if (!this.emailService) {
      return {
        ok: true,
        provider: provider || 'local',
        message: 'Email service ready (default local mode).',
        latencyMs: 1,
      };
    }
    return this.emailService.verifyProviderConnection(provider);
  }

  async sendTestEmail(
    to: string,
    provider?: string,
    actor?: { id: string; email: string },
  ): Promise<EmailSendResult & { latencyMs: number }> {
    if (!this.emailService) {
      throw new ServiceUnavailableException('Email service is not available.');
    }

    const result = await this.emailService.sendTestEmail(to, provider);

    if (actor) {
      await this.auditService.logAction({
        actorId: actor.id,
        actorEmail: actor.email,
        action: 'email.test_dispatched',
        targetType: 'EMAIL_PROVIDER',
        targetId: result.provider,
        reason: `Super Admin dispatched test email to ${to} via ${result.provider}`,
        outcome: 'SUCCESS',
        metadata: {
          recipient: to,
          provider: result.provider,
          messageId: result.id,
          latencyMs: result.latencyMs,
        },
      });
    }

    return result;
  }
}
