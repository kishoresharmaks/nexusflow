import { Injectable, Logger, OnApplicationBootstrap, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PlatformRole, PlatformAdminStatus } from '@commercepilot/database';
import { AdminAuditService } from '../audit/admin-audit.service';

@Injectable()
export class SuperAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AdminAuditService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const bootstrapEnabled = this.configService.get<string>('SUPER_ADMIN_BOOTSTRAP_ENABLED') === 'true';
    const bootstrapEmail = this.configService.get<string>('SUPER_ADMIN_BOOTSTRAP_EMAIL');

    if (bootstrapEnabled && bootstrapEmail) {
      this.logger.log(`Bootstrap mode enabled. Checking promotion for ${bootstrapEmail}...`);
      try {
        await this.bootstrapAdminByEmail(bootstrapEmail, 'ENVIRONMENT_CONFIG');
      } catch (err) {
        this.logger.warn(`Bootstrap check: ${(err as Error).message}`);
      }
    }
  }

  async bootstrapAdminByEmail(email: string, initiatedBy: string = 'CLI_BOOTSTRAP') {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new NotFoundException(`User with email "${normalizedEmail}" not found. Account must register first.`);
    }

    const existingAdmin = await this.prisma.platformAdmin.findUnique({
      where: { userId: user.id },
    });

    if (existingAdmin) {
      if (existingAdmin.status === PlatformAdminStatus.ACTIVE && existingAdmin.role === PlatformRole.SUPER_ADMIN) {
        this.logger.log(`User ${normalizedEmail} is already an active Super Admin.`);
        return existingAdmin;
      }

      // Reactivate or promote
      const updated = await this.prisma.platformAdmin.update({
        where: { id: existingAdmin.id },
        data: {
          role: PlatformRole.SUPER_ADMIN,
          status: PlatformAdminStatus.ACTIVE,
          updatedAt: new Date(),
        },
      });

      await this.auditService.logAction({
        actorId: user.id,
        actorEmail: normalizedEmail,
        action: 'admin.promoted',
        targetType: 'PLATFORM_ADMIN',
        targetId: updated.id,
        reason: `Reactivated/promoted to SUPER_ADMIN by ${initiatedBy}`,
        outcome: 'SUCCESS',
      });

      this.logger.log(`Successfully updated ${normalizedEmail} to active SUPER_ADMIN.`);
      return updated;
    }

    const newAdmin = await this.prisma.platformAdmin.create({
      data: {
        userId: user.id,
        role: PlatformRole.SUPER_ADMIN,
        status: PlatformAdminStatus.ACTIVE,
        createdBy: initiatedBy,
        permissions: [],
      },
    });

    await this.auditService.logAction({
      actorId: user.id,
      actorEmail: normalizedEmail,
      action: 'admin.bootstrap',
      targetType: 'PLATFORM_ADMIN',
      targetId: newAdmin.id,
      reason: `Provisioned as initial SUPER_ADMIN via ${initiatedBy}`,
      outcome: 'SUCCESS',
    });

    this.logger.log(`Successfully bootstrapped ${normalizedEmail} as SUPER_ADMIN.`);
    return newAdmin;
  }
}
