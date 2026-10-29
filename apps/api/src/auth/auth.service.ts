import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService, sanitizeEmail, sanitizeErrorMessage } from '../email/email.service';
import { WorkspaceRole, UserAccountStatus, MembershipStatus } from '@commercepilot/database';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { VerifyEmailDto } from './dto/verify-email.dto';
import type { ActivateAccountDto } from './dto/activate-account.dto';
import type { ResendVerificationDto } from './dto/resend-verification.dto';
import type { ResendActivationDto } from './dto/resend-activation.dto';

export interface UserDataExport {
  exportTimestamp: string;
  user: {
    id: string;
    email: string;
    name: string;
    isEmailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  workspaces: Array<{
    workspaceId: string;
    workspaceName: string;
    slug: string;
    role: WorkspaceRole;
    joinedAt: Date;
  }>;
  activeSessions: Array<{
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    expiresAt: Date;
    revokedAt: Date | null;
  }>;
  recentAuditActivity: unknown[];
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
  emailVerifiedAt?: Date | null;
  accountStatus?: UserAccountStatus;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  role?: WorkspaceRole;
  status?: MembershipStatus;
}

export interface AuthSessionResponse {
  user: UserSummary;
  workspace?: WorkspaceSummary;
  workspaces?: WorkspaceSummary[];
  sessionToken: string;
  expiresAt: string;
  verificationEmailSent?: boolean;
  verificationEmailError?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  public hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  public generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async getPublicAuthConfig(): Promise<{
    allowPublicRegistrations: boolean;
    maintenanceMode: { enabled: boolean; message?: string };
  }> {
    const [publicRegSetting, maintenanceSetting] = await Promise.all([
      this.prisma.platformSetting.findUnique({
        where: { key: 'allow_public_registrations' },
      }),
      this.prisma.platformSetting.findUnique({
        where: { key: 'maintenance_mode' },
      }),
    ]);

    const allowPublicRegistrations =
      publicRegSetting && typeof publicRegSetting.value === 'object' && publicRegSetting.value !== null
        ? (publicRegSetting.value as { enabled?: boolean }).enabled !== false
        : true;

    const maintenanceVal =
      maintenanceSetting && typeof maintenanceSetting.value === 'object' && maintenanceSetting.value !== null
        ? (maintenanceSetting.value as { enabled?: boolean; message?: string })
        : { enabled: false };

    return {
      allowPublicRegistrations,
      maintenanceMode: {
        enabled: Boolean(maintenanceVal.enabled),
        message: maintenanceVal.message || 'Platform undergoing scheduled maintenance.',
      },
    };
  }

  async register(dto: RegisterDto, ipAddress?: string): Promise<AuthSessionResponse> {
    const config = await this.getPublicAuthConfig();
    if (!config.allowPublicRegistrations) {
      let isAuthorizedByInvite = false;
      if (dto.invitationToken) {
        const tokenHash = this.hashToken(dto.invitationToken);
        const invite = await this.prisma.workspaceInvitation.findFirst({
          where: {
            tokenHash,
            emailNormalized: dto.email.toLowerCase().trim(),
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (invite) {
          isAuthorizedByInvite = true;
        }
      }

      if (!isAuthorizedByInvite) {
        throw new ForbiddenException(
          'Public registration is currently disabled by platform administrators. An invitation is required to create a new account.',
        );
      }
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists.');
    }

    const passwordHash = await hash(dto.password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const email = dto.email.toLowerCase().trim();
    const name = dto.name.trim();

    const rawVerificationToken = this.generateToken();
    const verificationTokenHash = this.hashToken(rawVerificationToken);
    const verificationExpiresAt = new Date(Date.now() + 86400000); // 24 hours

    // 1. Create User
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        isEmailVerified: false,
        emailVerificationToken: verificationTokenHash,
        emailVerificationTokenExpiresAt: verificationExpiresAt,
      },
    });

    // 2. Generate slug and create initial Personal Workspace
    const workspaceName = dto.workspaceName?.trim() || `${name}'s Workspace`;
    const baseSlug =
      workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'workspace';
    const slugSuffix = randomBytes(3).toString('hex');
    const slug = `${baseSlug}-${slugSuffix}`;

    const workspace = await this.prisma.workspace.create({
      data: {
        name: workspaceName,
        slug,
      },
    });

    // 3. Create OWNER Membership
    await this.prisma.membership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: WorkspaceRole.OWNER,
      },
    });

    // 4. Create Session
    const rawSessionToken = this.generateToken();
    const sessionTokenHash = this.hashToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.prisma.session.create({
      data: {
        userId: user.id,
        sessionTokenHash,
        expiresAt,
        ...(ipAddress ? { ipAddress } : {}),
      },
    });

    // 5. Record Audit Event
    await this.auditService.record({
      workspaceId: workspace.id,
      userId: user.id,
      action: 'AUTH_REGISTER',
      resourceType: 'User',
      resourceId: user.id,
      ipAddress,
      metadata: { email: user.email },
    });

    let verificationEmailSent = false;
    let verificationEmailError: string | null = null;
    try {
      await this.emailService.sendVerificationEmail(user.email, user.name, rawVerificationToken);
      verificationEmailSent = true;
    } catch (err: unknown) {
      verificationEmailError = sanitizeErrorMessage(err);
      this.logger.error(
        `Failed to deliver verification email during registration to ${sanitizeEmail(user.email)}: ${verificationEmailError}`,
      );
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        accountStatus: user.accountStatus,
      },
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: WorkspaceRole.OWNER,
      },
      sessionToken: rawSessionToken,
      expiresAt: expiresAt.toISOString(),
      verificationEmailSent,
      ...(verificationEmailError ? { verificationEmailError } : {}),
    };
  }

  async login(dto: LoginDto, ipAddress?: string): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.accountStatus === UserAccountStatus.PENDING_ACTIVATION) {
      throw new UnauthorizedException(
        'Your account is pending activation. Please check your email to activate your account before logging in.',
      );
    }

    if (user.accountStatus === UserAccountStatus.DEACTIVATED) {
      throw new UnauthorizedException('This account has been deactivated. Please contact support.');
    }

    if (user.isSuspended || user.accountStatus === UserAccountStatus.SUSPENDED) {
      throw new UnauthorizedException(
        `Account has been suspended${user.suspensionReason ? `: ${user.suspensionReason}` : ''}. Please contact support.`,
      );
    }

    const isMatch = await verify(user.passwordHash, dto.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Create session
    const rawSessionToken = this.generateToken();
    const sessionTokenHash = this.hashToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        sessionTokenHash,
        expiresAt,
        ...(ipAddress ? { ipAddress } : {}),
      },
    });

    const workspaces: WorkspaceSummary[] = user.memberships
      .filter((m) => m.status !== MembershipStatus.REMOVED)
      .map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        status: m.status,
      }));

    const primaryWorkspace = workspaces[0];
    if (primaryWorkspace) {
      await this.auditService.record({
        workspaceId: primaryWorkspace.id,
        userId: user.id,
        action: 'AUTH_LOGIN',
        resourceType: 'Session',
        ipAddress,
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        accountStatus: user.accountStatus,
      },
      workspaces,
      sessionToken: rawSessionToken,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async logout(sessionToken: string): Promise<{ success: boolean }> {
    const sessionTokenHash = this.hashToken(sessionToken);
    const session = await this.prisma.session.findUnique({
      where: { sessionTokenHash },
      include: {
        user: {
          include: {
            memberships: true,
          },
        },
      },
    });

    if (session && !session.revokedAt) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      const firstWorkspace = session.user.memberships[0];
      if (firstWorkspace) {
        await this.auditService.record({
          workspaceId: firstWorkspace.workspaceId,
          userId: session.userId,
          action: 'AUTH_LOGOUT',
          resourceType: 'Session',
          resourceId: session.id,
        });
      }
    }

    return { success: true };
  }

  async validateSession(rawToken: string): Promise<any> {
    const sessionTokenHash = this.hashToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { sessionTokenHash },
      include: {
        user: {
          include: {
            memberships: {
              include: { workspace: true },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt < new Date() ||
      session.user.isSuspended ||
      session.user.accountStatus === UserAccountStatus.SUSPENDED ||
      session.user.accountStatus === UserAccountStatus.DEACTIVATED ||
      session.user.accountStatus === UserAccountStatus.PENDING_ACTIVATION
    ) {
      return null;
    }

    return session;
  }

  async forgotPassword(dto: ForgotPasswordDto, ipAddress?: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { memberships: true },
    });

    if (user) {
      const rawResetToken = this.generateToken();
      const hashedToken = this.hashToken(rawResetToken);
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashedToken,
          passwordResetTokenExpiresAt: expiresAt,
        },
      });

      const firstWorkspace = user.memberships[0];
      if (firstWorkspace) {
        await this.auditService.record({
          workspaceId: firstWorkspace.workspaceId,
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          resourceType: 'User',
          resourceId: user.id,
          ipAddress,
        });
      }

      try {
        await this.emailService.sendPasswordResetEmail(user.email, user.name, rawResetToken);
      } catch (err: unknown) {
        this.logger.error(
          `Failed to deliver password reset email to ${sanitizeEmail(user.email)}: ${sanitizeErrorMessage(err)}`,
        );
      }
    }

    // Always return generic success to protect against account enumeration
    return {
      message:
        'If an account exists for that email, password reset instructions have been dispatched.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, ipAddress?: string): Promise<{ message: string }> {
    const hashedToken = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetTokenExpiresAt: {
          gt: new Date(),
        },
      },
      include: {
        memberships: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const newPasswordHash = await hash(dto.newPassword, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
      },
    });

    // Revoke all existing sessions for this user on password reset (Security requirement)
    await this.prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const firstWorkspace = user.memberships[0];
    if (firstWorkspace) {
      await this.auditService.record({
        workspaceId: firstWorkspace.workspaceId,
        userId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
      });
    }

    try {
      await this.emailService.sendSecurityAlertEmail(
        user.email,
        'Your NexusFlow Password Was Changed',
        'Your password has been changed successfully. All other active sessions have been revoked for your security.',
      );
    } catch {
      // Non-blocking
    }

    return {
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const hashedToken = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpiresAt: {
          gt: new Date(),
        },
      },
      include: {
        memberships: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token.');
    }

    const verifiedAt = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: verifiedAt,
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      },
    });

    const firstWorkspace = user.memberships[0];
    if (firstWorkspace) {
      await this.auditService.record({
        workspaceId: firstWorkspace.workspaceId,
        userId: user.id,
        action: 'EMAIL_VERIFIED',
        resourceType: 'User',
        resourceId: user.id,
      });
    }

    return { message: 'Email verified successfully.' };
  }

  async activateAccount(dto: ActivateAccountDto, ipAddress?: string): Promise<{ message: string }> {
    if (!dto.password || dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long.');
    }

    const hashedToken = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        activationTokenHash: hashedToken,
        activationTokenExpiresAt: { gt: new Date() },
      },
      include: {
        memberships: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired activation link. Please request a new activation email.');
    }

    const passwordHash = await hash(dto.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          accountStatus: UserAccountStatus.ACTIVE,
          activatedAt: new Date(),
          activationTokenHash: null,
          activationTokenExpiresAt: null,
        },
      });

      // Activate any pending membership associated with this direct member creation
      await tx.membership.updateMany({
        where: {
          userId: user.id,
          status: MembershipStatus.PENDING_ACCEPTANCE,
        },
        data: {
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
    });

    const firstWorkspace = user.memberships[0];
    if (firstWorkspace) {
      await this.auditService.record({
        workspaceId: firstWorkspace.workspaceId,
        userId: user.id,
        action: 'ACCOUNT_ACTIVATED',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
      });
    }

    try {
      await this.emailService.sendAccountActivatedEmail(user.email, user.name);
    } catch {
      // Non-blocking notification dispatch
    }

    return { message: 'Account activated successfully. You can now log in.' };
  }

  async resendVerification(
    userIdOrEmail: string,
    ipAddress?: string,
  ): Promise<{ message: string; isDevOutbox?: boolean; devVerificationUrl?: string }> {
    const isEmail = userIdOrEmail.includes('@');
    const user = await this.prisma.user.findFirst({
      where: isEmail
        ? { email: userIdOrEmail.toLowerCase().trim() }
        : { id: userIdOrEmail },
      include: { memberships: true },
    });

    if (!user) {
      return { message: 'If an account exists with this email, a verification link has been sent.' };
    }

    if (user.isEmailVerified) {
      return { message: 'Your email address is already verified.' };
    }

    const rawToken = this.generateToken();
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpiresAt: expiresAt,
      },
    });

    await this.emailService.sendVerificationEmail(user.email, user.name, rawToken);

    const firstWs = user.memberships[0];
    if (firstWs) {
      await this.auditService.record({
        workspaceId: firstWs.workspaceId,
        userId: user.id,
        action: 'EMAIL_VERIFICATION_RESENT',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
      });
    }

    const emailStatus = typeof this.emailService.getStatus === 'function'
      ? this.emailService.getStatus()
      : { activeProvider: 'smtp' };

    if (emailStatus.activeProvider === 'local') {
      const baseUrl = process.env.WEB_URL || 'http://localhost:3000';
      const devVerificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
      return {
        message: 'A verification link has been sent to your email address.',
        isDevOutbox: true,
        devVerificationUrl,
      };
    }

    return { message: 'A verification link has been sent to your email address.' };
  }

  async resendActivation(email: string, ipAddress?: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { memberships: { include: { workspace: true } } },
    });

    if (!user || user.accountStatus !== UserAccountStatus.PENDING_ACTIVATION) {
      return { message: 'If an account is pending activation with this email, an activation link has been sent.' };
    }

    const rawToken = this.generateToken();
    const hashedToken = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        activationTokenHash: hashedToken,
        activationTokenExpiresAt: expiresAt,
      },
    });

    const targetMembership = user.memberships[0];
    const wsName = targetMembership?.workspace?.name ?? 'NexusFlow';
    const role = targetMembership?.role ?? 'MEMBER';

    await this.emailService.sendAccountActivationEmail(user.email, user.name, wsName, role, rawToken);

    if (targetMembership) {
      await this.auditService.record({
        workspaceId: targetMembership.workspaceId,
        userId: user.id,
        action: 'ACTIVATION_RESENT',
        resourceType: 'User',
        resourceId: user.id,
        ipAddress,
      });
    }

    return { message: 'An activation link has been sent to your email address.' };
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return sessions;
  }

  async revokeAllSessions(
    userId: string,
    _currentSessionToken?: string,
  ): Promise<{ revokedCount: number }> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true },
    });

    const firstWorkspace = user?.memberships[0];
    if (firstWorkspace) {
      await this.auditService.record({
        workspaceId: firstWorkspace.workspaceId,
        userId,
        action: 'AUTH_ALL_SESSIONS_REVOKED',
        resourceType: 'User',
        resourceId: userId,
        metadata: { revokedCount: result.count },
      });
    }

    return { revokedCount: result.count };
  }

  async exportUserData(userId: string): Promise<UserDataExport> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { workspace: true },
        },
        sessions: {
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            expiresAt: true,
            revokedAt: true,
          },
        },
        auditEvents: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    return {
      exportTimestamp: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      workspaces: user.memberships.map((m) => ({
        workspaceId: m.workspaceId,
        workspaceName: m.workspace.name,
        slug: m.workspace.slug,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      activeSessions: user.sessions,
      recentAuditActivity: user.auditEvents,
    };
  }

  async deleteAccount(
    userId: string,
    passwordConfirm: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    const isMatch = await verify(user.passwordHash, passwordConfirm);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid password confirmation.');
    }

    // Revoke all sessions first
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const firstWorkspace = user.memberships[0];
    if (firstWorkspace) {
      await this.auditService.record({
        workspaceId: firstWorkspace.workspaceId,
        userId,
        action: 'ACCOUNT_DELETED',
        resourceType: 'User',
        resourceId: userId,
        ipAddress,
      });
    }

    // Delete user (cascade deletes memberships and sessions)
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return {
      success: true,
      message: 'Account and associated personal sessions successfully deleted.',
    };
  }
}
