import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OwnershipTransferStatus, WorkspaceRole } from '@commercepilot/database';
import { EmailService } from '../email/email.service';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto';
import type { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import type { StartOwnershipTransferDto } from './dto/ownership-transfer.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
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
  ) {
    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.timezone ? { timezone: dto.timezone.trim() } : {}),
        ...(dto.locale ? { locale: dto.locale.trim() } : {}),
        ...(dto.currency ? { currency: dto.currency.trim() } : {}),
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

    return updated;
  }

  async getMembers(workspaceId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isEmailVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user,
    }));
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
      },
    });

    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    await this.emailService.sendWorkspaceInvitationEmail(email, workspace.name, dto.role, rawToken);

    await this.auditService.record({
      workspaceId,
      userId: currentUserId,
      action: 'INVITATION_CREATED',
      resourceType: 'WorkspaceInvitation',
      resourceId: invitation.id,
      ipAddress,
      metadata: { targetEmail: email, role: dto.role },
    });

    return {
      id: invitation.id,
      email: invitation.emailNormalized,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  async getInvitations(workspaceId: string) {
    return this.prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, emailNormalized: true, role: true, expiresAt: true, acceptedAt: true, revokedAt: true, createdAt: true },
    });
  }

  async revokeInvitation(workspaceId: string, invitationId: string, currentUserId: string, ipAddress?: string) {
    const invitation = await this.prisma.workspaceInvitation.findFirst({ where: { id: invitationId, workspaceId } });
    if (!invitation) throw new NotFoundException('Invitation not found in this workspace.');
    if (invitation.acceptedAt || invitation.revokedAt) throw new BadRequestException('Only active invitations can be revoked.');
    await this.prisma.workspaceInvitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } });
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
    const invitation = await this.prisma.workspaceInvitation.findUnique({ where: { tokenHash: this.hashInvitationToken(token) } });
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
      throw new BadRequestException('This invitation is invalid, expired, or no longer active.');
    }
    if (invitation.emailNormalized !== userEmail.toLowerCase().trim()) {
      throw new ForbiddenException('Sign in with the email address that received this invitation.');
    }
    if (!isEmailVerified) throw new ForbiddenException('Verify your email address before accepting an invitation.');
    const existing = await this.prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } } });
    if (existing) throw new ConflictException('You are already a member of this workspace.');
    const [membership] = await this.prisma.$transaction([
      this.prisma.membership.create({ data: { workspaceId: invitation.workspaceId, userId, role: invitation.role } }),
      this.prisma.workspaceInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } }),
    ]);
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
    return { workspaceId: transfer.workspaceId, role: WorkspaceRole.OWNER };
  }

  private assertAssignableRole(currentRole: WorkspaceRole, targetRole: WorkspaceRole): void {
    if (targetRole === WorkspaceRole.OWNER) throw new BadRequestException('Use the ownership transfer flow to assign OWNER.');
    if (currentRole === WorkspaceRole.ADMIN && targetRole === WorkspaceRole.ADMIN) throw new ForbiddenException('Only the workspace owner can assign ADMIN.');
  }

  private hashInvitationToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
