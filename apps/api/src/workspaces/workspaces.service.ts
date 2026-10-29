import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Optional,
  Logger,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  OwnershipTransferStatus,
  WorkspaceRole,
  WorkspaceStatus,
  SocialAccountStatus,
  PostStatus,
  StoreSyncStatus,
  MembershipStatus,
  InvitationStatus,
  EmailDeliveryStatus,
} from '@commercepilot/database';
import { EmailService, sanitizeEmail, sanitizeErrorMessage } from '../email/email.service';
import { EntitlementsService } from '../billing/entitlements.service';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto';
import type { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import type { StartOwnershipTransferDto } from './dto/ownership-transfer.dto';
import type { UpdateApprovalPolicyDto } from './dto/approval-policy.dto';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    @Optional() private readonly entitlementsService?: EntitlementsService,
  ) {}

  async createWorkspace(userId: string, dto: CreateWorkspaceDto, ipAddress?: string) {
    const rawName = dto.name.trim();
    const baseSlug =
      dto.slug?.trim().toLowerCase() ||
      rawName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') ||
      'workspace';

    let slug = baseSlug;
    let attempts = 0;
    while (attempts < 5) {
      const existing = await this.prisma.workspace.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${baseSlug}-${randomBytes(2).toString('hex')}`;
      attempts++;
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        name: rawName,
        slug,
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
      },
    });

    const membership = await this.prisma.membership.create({
      data: {
        userId,
        workspaceId: workspace.id,
        role: WorkspaceRole.OWNER,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
      },
    });

    await this.auditService.record({
      workspaceId: workspace.id,
      userId,
      action: 'WORKSPACE_CREATED',
      resourceType: 'Workspace',
      resourceId: workspace.id,
      ipAddress,
      metadata: { name: workspace.name, slug: workspace.slug },
    });

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        timezone: workspace.timezone,
        locale: workspace.locale,
        currency: workspace.currency,
        createdAt: workspace.createdAt,
      },
      role: membership.role,
    };
  }

  async getUserWorkspaces(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: {
        workspace: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      timezone: m.workspace.timezone,
      locale: m.workspace.locale,
      currency: m.workspace.currency,
      joinedAt: m.createdAt,
    }));
  }

  async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        _count: {
          select: { memberships: true, products: true, posts: true },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      timezone: workspace.timezone,
      locale: workspace.locale,
      currency: workspace.currency,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      counts: workspace._count,
    };
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
    ipAddress?: string,
  ): Promise<any> {
    let customQuotasUpdate: Record<string, unknown> | undefined = undefined;
    if (dto.logoUrl !== undefined) {
      const existing = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
      const existingQuotas = (existing?.customQuotas as Record<string, unknown>) || {};
      customQuotasUpdate = { ...existingQuotas, logoUrl: dto.logoUrl };
    }

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.timezone ? { timezone: dto.timezone.trim() } : {}),
        ...(dto.locale ? { locale: dto.locale.trim() } : {}),
        ...(dto.currency ? { currency: dto.currency.trim() } : {}),
        ...(customQuotasUpdate !== undefined ? { customQuotas: customQuotasUpdate as any } : {}),
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'WORKSPACE_UPDATED',
      resourceType: 'Workspace',
      resourceId: workspaceId,
      ipAddress,
      metadata: { ...dto },
    });

    return { ...updated, logoUrl: (updated.customQuotas as any)?.logoUrl || null };
  }

  async getMembers(workspaceId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: {
        workspaceId,
        status: { not: MembershipStatus.REMOVED },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isEmailVerified: true,
            emailVerifiedAt: true,
            accountStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt ?? m.createdAt,
      user: m.user,
    }));
  }

  async updateMemberStatus(
    workspaceId: string,
    currentUserId: string,
    currentRole: WorkspaceRole,
    membershipId: string,
    dto: UpdateMemberStatusDto,
    ipAddress?: string,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: { id: true, email: true, name: true, isEmailVerified: true, emailVerifiedAt: true, accountStatus: true },
        },
      },
    });

    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundException('Membership record not found in this workspace.');
    }

    if (membership.role === WorkspaceRole.OWNER) {
      throw new BadRequestException('Cannot suspend or modify the status of the workspace owner.');
    }

    if (membership.userId === currentUserId && dto.status === MembershipStatus.SUSPENDED) {
      throw new BadRequestException('You cannot suspend your own membership.');
    }

    if (currentRole === WorkspaceRole.ADMIN && membership.role === WorkspaceRole.ADMIN) {
      throw new ForbiddenException('An admin cannot change the status of another admin.');
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: {
        status: dto.status,
        suspendedAt: dto.status === MembershipStatus.SUSPENDED ? new Date() : null,
        suspensionReason: dto.status === MembershipStatus.SUSPENDED ? (dto.reason || 'Suspended by administrator') : null,
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, isEmailVerified: true, emailVerifiedAt: true, accountStatus: true },
        },
      },
    });

    await this.auditService.record({
      workspaceId,
      userId: currentUserId,
      action: dto.status === MembershipStatus.SUSPENDED ? 'MEMBERSHIP_SUSPENDED' : 'MEMBERSHIP_REACTIVATED',
      resourceType: 'Membership',
      resourceId: membershipId,
      ipAddress,
      metadata: {
        targetUserId: membership.userId,
        previousStatus: membership.status,
        newStatus: dto.status,
        reason: dto.reason,
      },
    });

    return {
      membershipId: updated.id,
      role: updated.role,
      status: updated.status,
      joinedAt: updated.joinedAt ?? updated.createdAt,
      user: updated.user,
    };
  }

  async createInvitation(
    workspaceId: string,
    currentUserId: string,
    currentRole: WorkspaceRole,
    dto: InviteMemberDto,
    ipAddress?: string,
  ) {
    const email = dto.email.toLowerCase().trim();
    this.assertAssignableRole(currentRole, dto.role);

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await this.prisma.membership.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      });
      if (existingMembership) throw new ConflictException('This user is already a member.');
    }

    const activeInvitation = await this.prisma.workspaceInvitation.findFirst({
      where: { workspaceId, emailNormalized: email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (activeInvitation) throw new ConflictException('An active invitation already exists for this email.');

    const rawToken = randomBytes(32).toString('base64url');
    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        emailNormalized: email,
        role: dto.role,
        tokenHash: this.hashInvitationToken(rawToken),
        invitedByUserId: currentUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        emailDeliveryStatus: EmailDeliveryStatus.PENDING,
      },
    });

    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    const inviter = await this.prisma.user.findUnique({ where: { id: currentUserId }, select: { name: true } });
    let emailDeliveryStatus: EmailDeliveryStatus = EmailDeliveryStatus.PENDING;
    let emailDeliveryError: string | null = null;
    try {
      await this.emailService.sendWorkspaceInvitationEmail(email, workspace.name, dto.role, rawToken, inviter?.name);
      emailDeliveryStatus = EmailDeliveryStatus.SENT;
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { emailDeliveryStatus: EmailDeliveryStatus.SENT, emailDeliveryError: null },
      });
    } catch (err: unknown) {
      emailDeliveryStatus = EmailDeliveryStatus.FAILED;
      emailDeliveryError = sanitizeErrorMessage(err);
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { emailDeliveryStatus: EmailDeliveryStatus.FAILED, emailDeliveryError },
      });
      this.logger.error(`Failed to dispatch invitation email to ${sanitizeEmail(email)}: ${emailDeliveryError}`);
    }

    await this.auditService.record({
      workspaceId,
      userId: currentUserId,
      action: 'INVITATION_CREATED',
      resourceType: 'WorkspaceInvitation',
      resourceId: invitation.id,
      ipAddress,
      metadata: { targetEmail: email, role: dto.role, emailDeliveryStatus },
    });

    return {
      id: invitation.id,
      email: invitation.emailNormalized,
      role: invitation.role,
      status: invitation.status,
      emailDeliveryStatus,
      ...(emailDeliveryError ? { emailDeliveryError } : {}),
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  async getInvitations(workspaceId: string) {
    const rawList = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        emailNormalized: true,
        role: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        emailDeliveryStatus: true,
        emailDeliveryError: true,
      },
    });

    const now = new Date();
    return rawList.map((item) => {
      let status: InvitationStatus = item.status;
      if (item.revokedAt) {
        status = InvitationStatus.REVOKED;
      } else if (item.acceptedAt) {
        status = InvitationStatus.ACCEPTED;
      } else if (item.expiresAt <= now) {
        status = InvitationStatus.EXPIRED;
      } else {
        status = InvitationStatus.PENDING;
      }
      return {
        id: item.id,
        emailNormalized: item.emailNormalized,
        role: item.role,
        status,
        emailDeliveryStatus: item.emailDeliveryStatus,
        emailDeliveryError: item.emailDeliveryError,
        expiresAt: item.expiresAt,
        acceptedAt: item.acceptedAt,
        revokedAt: item.revokedAt,
        createdAt: item.createdAt,
      };
    });
  }

  async revokeInvitation(workspaceId: string, invitationId: string, currentUserId: string, ipAddress?: string) {
    const invitation = await this.prisma.workspaceInvitation.findFirst({ where: { id: invitationId, workspaceId } });
    if (!invitation) throw new NotFoundException('Invitation not found in this workspace.');
    if (invitation.acceptedAt || invitation.revokedAt) throw new BadRequestException('Only active invitations can be revoked.');
    await this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
    await this.auditService.record({ workspaceId, userId: currentUserId, action: 'INVITATION_REVOKED', resourceType: 'WorkspaceInvitation', resourceId: invitationId, ipAddress });
    return { success: true };
  }

  async acceptInvitation(
    token: string,
    userId: string,
    userEmail: string,
    isEmailVerified: boolean,
    ipAddress?: string,
  ) {
    if (!isEmailVerified) throw new ForbiddenException('Verify your email address before accepting an invitation.');
    const tokenHash = this.hashInvitationToken(token);
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.workspaceInvitation.findUnique({ where: { tokenHash } });
      if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now) {
        throw new BadRequestException('This invitation is invalid, expired, or no longer active.');
      }
      if (invitation.emailNormalized !== userEmail.toLowerCase().trim()) {
        throw new ForbiddenException('Sign in with the email address that received this invitation.');
      }
      const existing = await tx.membership.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
      });
      if (existing) throw new ConflictException('You are already a member of this workspace.');

      const claimed = await tx.workspaceInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { status: InvitationStatus.ACCEPTED, acceptedAt: now },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('This invitation was already used or revoked.');
      }
      const membership = await tx.membership.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          status: MembershipStatus.ACTIVE,
          joinedAt: now,
        },
      });
      return { invitation, membership };
    });
    const { invitation, membership } = result;
    const workspace = await this.prisma.workspace.findUnique({ where: { id: invitation.workspaceId }, select: { name: true } });
    const inviter = await this.prisma.user.findUnique({ where: { id: invitation.invitedByUserId }, select: { email: true, name: true } });
    if (inviter) {
      await this.emailService.sendInvitationAcceptedNotification(
        inviter.email,
        inviter.name,
        userEmail,
        userEmail,
        workspace?.name ?? 'Workspace',
        invitation.role,
      );
    }
    await this.auditService.record({ workspaceId: invitation.workspaceId, userId, action: 'INVITATION_ACCEPTED', resourceType: 'Membership', resourceId: membership.id, ipAddress, metadata: { role: invitation.role } });
    return { workspaceId: invitation.workspaceId, role: membership.role };
  }

  async updateMemberRole(
    workspaceId: string,
    currentUserId: string,
    currentRole: WorkspaceRole,
    membershipId: string,
    dto: UpdateMemberRoleDto,
    ipAddress?: string,
  ) {
    this.assertAssignableRole(currentRole, dto.role);
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundException('Membership record not found in this workspace.');
    }
    if (currentRole === WorkspaceRole.ADMIN && membership.role === WorkspaceRole.ADMIN) {
      throw new ForbiddenException('An admin cannot change another admin role.');
    }

    if (membership.role === WorkspaceRole.OWNER) throw new BadRequestException('Use the ownership transfer flow to change an owner.');

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { role: dto.role },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    await this.auditService.record({
      workspaceId,
      userId: currentUserId,
      action: 'ROLE_CHANGED',
      resourceType: 'Membership',
      resourceId: membershipId,
      ipAddress,
      metadata: {
        previousRole: membership.role,
        newRole: dto.role,
        targetUserId: membership.userId,
      },
    });

    if (updated.user?.email) {
      try {
        const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
        await this.emailService.sendMemberRoleUpdatedEmail(
          updated.user.email,
          updated.user.name || 'Team Member',
          ws?.name || 'Workspace',
          membership.role,
          dto.role,
        );
      } catch {
        // Non-blocking notification dispatch
      }
    }

    return {
      membershipId: updated.id,
      role: updated.role,
      user: updated.user,
    };
  }

  async removeMember(
    workspaceId: string,
    currentUserId: string,
    currentRole: WorkspaceRole,
    membershipId: string,
    ipAddress?: string,
  ) {
    const membership = await this.prisma.membership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.workspaceId !== workspaceId) {
      throw new NotFoundException('Membership record not found in this workspace.');
    }
    if (currentRole === WorkspaceRole.ADMIN && membership.role === WorkspaceRole.ADMIN) {
      throw new ForbiddenException('An admin cannot remove another admin.');
    }

    if (membership.role === WorkspaceRole.OWNER) throw new BadRequestException('An owner cannot be removed. Transfer ownership first.');

    const [memberUser, ws] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: membership.userId }, select: { email: true, name: true } }),
      this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    ]);

    await this.prisma.membership.delete({
      where: { id: membershipId },
    });

    await this.auditService.record({
      workspaceId,
      userId: currentUserId,
      action: 'MEMBER_REMOVED',
      resourceType: 'Membership',
      resourceId: membershipId,
      ipAddress,
      metadata: { removedUserId: membership.userId, role: membership.role },
    });

    if (memberUser?.email) {
      try {
        await this.emailService.sendMemberRemovedEmail(
          memberUser.email,
          memberUser.name || 'Team Member',
          ws?.name || 'Workspace',
        );
      } catch {
        // Non-blocking notification dispatch
      }
    }

    return { success: true };
  }

  async startOwnershipTransfer(workspaceId: string, currentUserId: string, dto: StartOwnershipTransferDto, ipAddress?: string) {
    const [currentOwner, recipient] = await Promise.all([
      this.prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId: currentUserId } } }),
      this.prisma.membership.findUnique({ where: { id: dto.membershipId }, include: { user: { select: { isEmailVerified: true, email: true } } } }),
    ]);
    if (currentOwner?.role !== WorkspaceRole.OWNER) throw new ForbiddenException('Only the workspace owner can transfer ownership.');
    if (!recipient || recipient.workspaceId !== workspaceId || recipient.userId === currentUserId) throw new BadRequestException('Choose another member of this workspace.');
    if (!recipient.user.isEmailVerified) throw new BadRequestException('The new owner must verify their email first.');
    await this.prisma.ownershipTransfer.updateMany({ where: { workspaceId, status: OwnershipTransferStatus.PENDING }, data: { status: OwnershipTransferStatus.CANCELLED, cancelledAt: new Date() } });
    const transfer = await this.prisma.ownershipTransfer.create({ data: { workspaceId, fromUserId: currentUserId, toUserId: recipient.userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    if (!workspace) throw new NotFoundException('Workspace not found.');
    await this.emailService.sendOwnershipTransferEmail(recipient.user.email, workspace.name, transfer.id);
    await this.auditService.record({ workspaceId, userId: currentUserId, action: 'OWNERSHIP_TRANSFER_STARTED', resourceType: 'OwnershipTransfer', resourceId: transfer.id, ipAddress, metadata: { toUserId: recipient.userId } });
    return { id: transfer.id, expiresAt: transfer.expiresAt };
  }

  async acceptOwnershipTransfer(transferId: string, currentUserId: string, ipAddress?: string) {
    const transfer = await this.prisma.ownershipTransfer.findUnique({ where: { id: transferId } });
    if (!transfer || transfer.status !== OwnershipTransferStatus.PENDING || transfer.expiresAt <= new Date()) throw new BadRequestException('This ownership transfer is no longer active.');
    if (transfer.toUserId !== currentUserId) throw new ForbiddenException('Only the selected recipient can accept this transfer.');
    const [fromMembership, toMembership] = await Promise.all([
      this.prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId: transfer.workspaceId, userId: transfer.fromUserId } } }),
      this.prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId: transfer.workspaceId, userId: transfer.toUserId } } }),
    ]);
    if (fromMembership?.role !== WorkspaceRole.OWNER || !toMembership) throw new BadRequestException('Workspace memberships changed; start a new transfer.');
    await this.prisma.$transaction([
      this.prisma.membership.update({ where: { id: fromMembership.id }, data: { role: WorkspaceRole.ADMIN } }),
      this.prisma.membership.update({ where: { id: toMembership.id }, data: { role: WorkspaceRole.OWNER } }),
      this.prisma.ownershipTransfer.update({ where: { id: transfer.id }, data: { status: OwnershipTransferStatus.ACCEPTED, acceptedAt: new Date() } }),
    ]);
    await this.auditService.record({ workspaceId: transfer.workspaceId, userId: currentUserId, action: 'OWNERSHIP_TRANSFER_ACCEPTED', resourceType: 'OwnershipTransfer', resourceId: transfer.id, ipAddress, metadata: { fromUserId: transfer.fromUserId } });

    try {
      const [fromUser, toUser, ws] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: transfer.fromUserId }, select: { email: true, name: true } }),
        this.prisma.user.findUnique({ where: { id: transfer.toUserId }, select: { email: true, name: true } }),
        this.prisma.workspace.findUnique({ where: { id: transfer.workspaceId }, select: { name: true } }),
      ]);

      if (toUser?.email) {
        await this.emailService.sendOwnershipTransferredConfirmationEmail(
          toUser.email,
          toUser.name || 'Owner',
          ws?.name || 'Workspace',
          true,
        );
      }
      if (fromUser?.email) {
        await this.emailService.sendOwnershipTransferredConfirmationEmail(
          fromUser.email,
          fromUser.name || 'Administrator',
          ws?.name || 'Workspace',
          false,
        );
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return { workspaceId: transfer.workspaceId, role: WorkspaceRole.OWNER };
  }

  private assertAssignableRole(currentRole: WorkspaceRole, targetRole: WorkspaceRole): void {
    if (targetRole === WorkspaceRole.OWNER) throw new BadRequestException('Use the ownership transfer flow to assign OWNER.');
    if (currentRole === WorkspaceRole.ADMIN && targetRole === WorkspaceRole.ADMIN) throw new ForbiddenException('Only the workspace owner can assign ADMIN.');
  }

  private hashInvitationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async getAdminSummary(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    const now = new Date();
    const staleThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const [
      teamMembersCount,
      unverifiedMembersCount,
      pendingInvitationsCount,
      activeProductsCount,
      staleProductsCount,
      connectedSocialAccountsCount,
      expiredSocialAccountsCount,
      connectedStoresCount,
      draftsAwaitingApprovalCount,
      scheduledPostsCount,
      publishedPostsCount,
      failedPostsCount,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.membership.count({ where: { workspaceId } }),
      this.prisma.membership.count({
        where: { workspaceId, user: { isEmailVerified: false } },
      }),
      this.prisma.workspaceInvitation.count({
        where: {
          workspaceId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.product.count({ where: { workspaceId } }),
      this.prisma.product.count({
        where: { workspaceId, updatedAt: { lt: staleThreshold } },
      }),
      this.prisma.socialAccount.count({
        where: { workspaceId, status: SocialAccountStatus.ACTIVE },
      }),
      this.prisma.socialAccount.count({
        where: {
          workspaceId,
          OR: [
            { status: SocialAccountStatus.EXPIRED },
            {
              status: SocialAccountStatus.ACTIVE,
              tokenExpiresAt: { not: null, lt: now },
            },
          ],
        },
      }),
      this.prisma.storeConnection.count({
        where: { workspaceId },
      }),
      this.prisma.post.count({
        where: { workspaceId, status: PostStatus.AWAITING_APPROVAL },
      }),
      this.prisma.post.count({
        where: { workspaceId, status: PostStatus.SCHEDULED },
      }),
      this.prisma.post.count({
        where: { workspaceId, status: PostStatus.PUBLISHED },
      }),
      this.prisma.post.count({
        where: { workspaceId, status: PostStatus.FAILED },
      }),
      this.prisma.auditEvent.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ]);

    let planInfo = {
      planId: 'FREE',
      planName: 'Free Trial',
      status: 'ACTIVE',
      currentPeriodEnd: null as Date | null,
      limits: {
        maxPosts: 10,
        currentPosts: publishedPostsCount + scheduledPostsCount,
        maxSocialAccounts: 3,
        currentSocialAccounts: connectedSocialAccountsCount,
        maxTeamMembers: 1,
        currentTeamMembers: teamMembersCount,
      },
    };

    if (this.entitlementsService) {
      try {
        const { subscription, plan } = await this.entitlementsService.getActivePlan(workspaceId);
        const monthlyPosts = await this.prisma.post.count({
          where: {
            workspaceId,
            createdAt: {
              gte: subscription.currentPeriodStart,
              lte: subscription.currentPeriodEnd,
            },
          },
        });
        planInfo = {
          planId: plan.id,
          planName: plan.name,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          limits: {
            maxPosts: plan.maxMonthlyPosts,
            currentPosts: monthlyPosts,
            maxSocialAccounts: plan.maxSocialAccounts,
            currentSocialAccounts: connectedSocialAccountsCount,
            maxTeamMembers: plan.maxTeamMembers,
            currentTeamMembers: teamMembersCount,
          },
        };
      } catch {
        // Fall back gracefully
      }
    }

    const actionCards = [];
    if (unverifiedMembersCount > 0) {
      actionCards.push({
        id: 'unverified-members',
        level: 'warning',
        title: `${unverifiedMembersCount} unverified team member${unverifiedMembersCount > 1 ? 's' : ''}`,
        description:
          'Members with unverified email addresses cannot accept ownership transfers or perform sensitive actions.',
        actionHref: '/settings/team',
        actionLabel: 'Manage Team',
      });
    }
    if (pendingInvitationsCount > 0) {
      actionCards.push({
        id: 'pending-invitations',
        level: 'info',
        title: `${pendingInvitationsCount} pending invitation${pendingInvitationsCount > 1 ? 's' : ''}`,
        description: 'Invited collaborators have not yet accepted their invitation tokens.',
        actionHref: '/settings/team',
        actionLabel: 'View Invitations',
      });
    }
    if (draftsAwaitingApprovalCount > 0) {
      actionCards.push({
        id: 'pending-approvals',
        level: 'urgent',
        title: `${draftsAwaitingApprovalCount} post${draftsAwaitingApprovalCount > 1 ? 's' : ''} awaiting approval`,
        description:
          'Marketing content is awaiting editorial review before it can be scheduled or published.',
        actionHref: '/posts',
        actionLabel: 'Review Posts',
      });
    }
    if (expiredSocialAccountsCount > 0) {
      actionCards.push({
        id: 'expired-accounts',
        level: 'urgent',
        title: `${expiredSocialAccountsCount} expired social account connection${expiredSocialAccountsCount > 1 ? 's' : ''}`,
        description: 'OAuth tokens have expired or been revoked. Reconnect to resume publishing.',
        actionHref: '/social-accounts',
        actionLabel: 'Reconnect Channels',
      });
    }
    if (failedPostsCount > 0) {
      actionCards.push({
        id: 'failed-posts',
        level: 'warning',
        title: `${failedPostsCount} failed post publication${failedPostsCount > 1 ? 's' : ''}`,
        description: 'Recent posts encountered provider errors during publishing.',
        actionHref: '/posts',
        actionLabel: 'Check Pipeline',
      });
    }
    if (staleProductsCount > 0 && activeProductsCount > 0) {
      actionCards.push({
        id: 'stale-products',
        level: 'info',
        title: `${staleProductsCount} catalog item${staleProductsCount > 1 ? 's' : ''} not updated in > 48h`,
        description:
          'Catalog facts, prices, or inventory may be stale. Synchronize your store to refresh data.',
        actionHref: '/integrations',
        actionLabel: 'Sync Catalog',
      });
    }

    const postQuotaPct =
      planInfo.limits.maxPosts > 0
        ? (planInfo.limits.currentPosts / planInfo.limits.maxPosts) * 100
        : 0;
    if (postQuotaPct >= 80) {
      actionCards.push({
        id: 'quota-posts',
        level: postQuotaPct >= 100 ? 'urgent' : 'warning',
        title: `Post quota ${postQuotaPct >= 100 ? 'reached' : 'nearing limit'} (${planInfo.limits.currentPosts}/${planInfo.limits.maxPosts})`,
        description:
          'Upgrade your subscription plan to continue creating and scheduling posts without interruption.',
        actionHref: '/billing',
        actionLabel: 'Upgrade Plan',
      });
    }

    const sanitizedAuditLogs = recentAuditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      createdAt: log.createdAt,
      actor: log.user ? { name: log.user.name, email: log.user.email } : null,
      metadata: this.redactAuditMetadata(log.metadata),
    }));

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        timezone: workspace.timezone,
        locale: workspace.locale,
        currency: workspace.currency,
        createdAt: workspace.createdAt,
      },
      plan: planInfo,
      counts: {
        teamMembers: teamMembersCount,
        pendingInvitations: pendingInvitationsCount,
        activeProducts: activeProductsCount,
        connectedSocialAccounts: connectedSocialAccountsCount,
        connectedStores: connectedStoresCount,
        draftsAwaitingApproval: draftsAwaitingApprovalCount,
        scheduledPosts: scheduledPostsCount,
        publishedPosts: publishedPostsCount,
        failedPosts: failedPostsCount,
      },
      actionCards,
      recentActivity: sanitizedAuditLogs,
    };
  }

  async getApprovalPolicy(workspaceId: string) {
    const policy = await this.prisma.approvalPolicy.findUnique({
      where: { workspaceId },
    });

    if (!policy) {
      return {
        workspaceId,
        requiresApprovalBeforeSchedule: false,
        requiresApprovalBeforePublish: true,
        allowedApproverRoles: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN],
        updatedAt: null,
      };
    }

    return {
      id: policy.id,
      workspaceId: policy.workspaceId,
      requiresApprovalBeforeSchedule: policy.requiresApprovalBeforeSchedule,
      requiresApprovalBeforePublish: policy.requiresApprovalBeforePublish,
      allowedApproverRoles: policy.allowedApproverRoles,
      updatedByUserId: policy.updatedByUserId,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }

  async updateApprovalPolicy(
    workspaceId: string,
    userId: string,
    dto: UpdateApprovalPolicyDto,
    ipAddress?: string,
  ) {
    const policy = await this.prisma.approvalPolicy.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        requiresApprovalBeforeSchedule: dto.requiresApprovalBeforeSchedule ?? false,
        requiresApprovalBeforePublish: dto.requiresApprovalBeforePublish ?? true,
        allowedApproverRoles: dto.allowedApproverRoles ?? [
          WorkspaceRole.OWNER,
          WorkspaceRole.ADMIN,
        ],
        updatedByUserId: userId,
      },
      update: {
        ...(dto.requiresApprovalBeforeSchedule !== undefined
          ? { requiresApprovalBeforeSchedule: dto.requiresApprovalBeforeSchedule }
          : {}),
        ...(dto.requiresApprovalBeforePublish !== undefined
          ? { requiresApprovalBeforePublish: dto.requiresApprovalBeforePublish }
          : {}),
        ...(dto.allowedApproverRoles !== undefined
          ? { allowedApproverRoles: dto.allowedApproverRoles }
          : {}),
        updatedByUserId: userId,
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'APPROVAL_POLICY_UPDATED',
      resourceType: 'ApprovalPolicy',
      resourceId: policy.id,
      ipAddress,
      metadata: { ...dto },
    });

    return policy;
  }

  async resendInvitation(
    workspaceId: string,
    invitationId: string,
    currentUserId: string,
    ipAddress?: string,
  ) {
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: { id: invitationId, workspaceId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found in this workspace.');
    }
    if (invitation.acceptedAt || invitation.revokedAt) {
      throw new BadRequestException('Only active invitations can be resent.');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const updated = await this.prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.PENDING,
        tokenHash: this.hashInvitationToken(rawToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        emailDeliveryStatus: EmailDeliveryStatus.PENDING,
      },
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    const inviter = await this.prisma.user.findUnique({ where: { id: currentUserId }, select: { name: true } });

    let emailDeliveryStatus: EmailDeliveryStatus = EmailDeliveryStatus.PENDING;
    let emailDeliveryError: string | null = null;
    try {
      await this.emailService.sendWorkspaceInvitationEmail(
        invitation.emailNormalized,
        workspace.name,
        invitation.role,
        rawToken,
        inviter?.name,
      );
      emailDeliveryStatus = EmailDeliveryStatus.SENT;
      await this.prisma.workspaceInvitation.update({
        where: { id: invitationId },
        data: { emailDeliveryStatus: EmailDeliveryStatus.SENT, emailDeliveryError: null },
      });
    } catch (err: unknown) {
      emailDeliveryStatus = EmailDeliveryStatus.FAILED;
      emailDeliveryError = sanitizeErrorMessage(err);
      await this.prisma.workspaceInvitation.update({
        where: { id: invitationId },
        data: { emailDeliveryStatus: EmailDeliveryStatus.FAILED, emailDeliveryError },
      });
      this.logger.error(
        `Failed to dispatch resent invitation email to ${sanitizeEmail(invitation.emailNormalized)}: ${emailDeliveryError}`,
      );
    }

    await this.auditService.record({
      workspaceId,
      userId: currentUserId,
      action: 'INVITATION_RESENT',
      resourceType: 'WorkspaceInvitation',
      resourceId: invitationId,
      ipAddress,
      metadata: { targetEmail: invitation.emailNormalized, role: invitation.role, emailDeliveryStatus },
    });

    return {
      success: true,
      id: updated.id,
      expiresAt: updated.expiresAt,
      emailDeliveryStatus,
      ...(emailDeliveryError ? { emailDeliveryError } : {}),
    };
  }

  private redactAuditMetadata(metadata: unknown): unknown {
    if (!metadata || typeof metadata !== 'object') return metadata;
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'accessToken',
      'refreshToken',
      'tokenHash',
      'rawToken',
      'authorizationCode',
      'cookie',
      'signature',
    ];
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(metadata as Record<string, unknown>)) {
      if (sensitiveKeys.some((sk) => k.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[k] = '[REDACTED]';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        sanitized[k] = this.redactAuditMetadata(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  async archiveWorkspace(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    confirmSlug: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Only the workspace owner can delete or archive this workspace.');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${workspaceId} not found.`);
    }

    if (confirmSlug.trim() !== workspace.slug.trim()) {
      throw new BadRequestException(`Confirmation slug does not match "${workspace.slug}".`);
    }

    // Cancel active subscriptions
    await this.prisma.subscription.updateMany({
      where: { workspaceId, status: 'ACTIVE' },
      data: { status: 'CANCELED', cancelAtPeriodEnd: false },
    });

    // Mark workspace status as ARCHIVED
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        status: WorkspaceStatus.ARCHIVED,
        suspendedAt: new Date(),
        suspensionReason: 'Owner requested workspace deletion & archival.',
      },
    });

    await this.auditService.record({
      workspaceId,
      userId,
      action: 'WORKSPACE_ARCHIVED',
      resourceType: 'Workspace',
      resourceId: workspaceId,
      ipAddress,
      metadata: { slug: workspace.slug, name: workspace.name },
    });

    return {
      success: true,
      message: `Workspace "${workspace.name}" has been successfully archived.`,
    };
  }

  async getDataPrivacySummary(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true, createdAt: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    const [members, invitations, products, mediaAssets, posts, socialAccounts, stores] = await Promise.all([
      this.prisma.membership.count({ where: { workspaceId } }),
      this.prisma.workspaceInvitation.count({ where: { workspaceId } }),
      this.prisma.product.count({ where: { workspaceId } }),
      this.prisma.mediaAsset.count({ where: { workspaceId } }),
      this.prisma.post.count({ where: { workspaceId } }),
      this.prisma.socialAccount.count({ where: { workspaceId } }),
      this.prisma.storeConnection.count({ where: { workspaceId } }),
    ]);

    return {
      workspace,
      data: { members, invitations, products, mediaAssets, posts, socialAccounts, stores },
      export: {
        personalExportEndpoint: '/api/v1/auth/export-data',
        workspaceExportStatus: 'NOT_CONFIGURED',
        note: 'Workspace-wide exports are unavailable until retention, authorization, and operational handling are approved.',
      },
      deletion: {
        status: 'REQUEST_ONLY',
        note: 'Submitting a request creates an audit record only. No data is deleted or archived by this workflow.',
      },
    };
  }

  async requestWorkspaceDeletionReview(workspaceId: string, userId: string, ipAddress?: string) {
    await this.auditService.record({
      workspaceId,
      userId,
      action: 'WORKSPACE_DELETION_REVIEW_REQUESTED',
      resourceType: 'Workspace',
      resourceId: workspaceId,
      ipAddress,
      metadata: { workflow: 'manual_review_required', destructiveActionTaken: false },
    });
    return {
      accepted: true,
      status: 'REVIEW_REQUIRED',
      message: 'Deletion review request recorded. No workspace data has been deleted, archived, or scheduled for deletion.',
    };
  }
}
