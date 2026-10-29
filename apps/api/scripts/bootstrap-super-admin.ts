import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment
const candidateEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const envPath of candidateEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    if (process.env['DATABASE_URL']) break;
  }
}

import { PrismaClient, PlatformRole, PlatformAdminStatus } from '@commercepilot/database';

async function main() {
  const emailArg = process.argv[2] || process.env['BOOTSTRAP_EMAIL'];

  if (!emailArg) {
    console.error('Usage: tsx scripts/bootstrap-super-admin.ts <user-email>');
    process.exit(1);
  }

  const normalizedEmail = emailArg.trim().toLowerCase();
  const prisma = new PrismaClient();

  try {
    console.log(`Checking user: ${normalizedEmail}...`);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      console.error(`Error: User with email "${normalizedEmail}" not found. The user must register first.`);
      process.exit(1);
    }

    const existingAdmin = await prisma.platformAdmin.findUnique({
      where: { userId: user.id },
    });

    if (existingAdmin) {
      if (existingAdmin.status === PlatformAdminStatus.ACTIVE && existingAdmin.role === PlatformRole.SUPER_ADMIN) {
        console.log(`User ${normalizedEmail} is already an active SUPER_ADMIN.`);
        process.exit(0);
      }

      await prisma.platformAdmin.update({
        where: { id: existingAdmin.id },
        data: {
          role: PlatformRole.SUPER_ADMIN,
          status: PlatformAdminStatus.ACTIVE,
          updatedAt: new Date(),
        },
      });

      await prisma.adminAuditLog.create({
        data: {
          actorId: user.id,
          actorEmail: normalizedEmail,
          action: 'admin.promoted',
          targetType: 'PLATFORM_ADMIN',
          targetId: existingAdmin.id,
          reason: 'Promoted to SUPER_ADMIN via CLI script',
          outcome: 'SUCCESS',
        },
      });

      console.log(`Successfully restored/promoted ${normalizedEmail} as SUPER_ADMIN.`);
      process.exit(0);
    }

    const newAdmin = await prisma.platformAdmin.create({
      data: {
        userId: user.id,
        role: PlatformRole.SUPER_ADMIN,
        status: PlatformAdminStatus.ACTIVE,
        createdBy: 'CLI_SCRIPT',
        permissions: [],
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        actorId: user.id,
        actorEmail: normalizedEmail,
        action: 'admin.bootstrap',
        targetType: 'PLATFORM_ADMIN',
        targetId: newAdmin.id,
        reason: 'Initial bootstrap via CLI script',
        outcome: 'SUCCESS',
      },
    });

    console.log(`SUCCESS: User ${normalizedEmail} provisioned as SUPER_ADMIN (adminId: ${newAdmin.id}).`);
  } catch (err) {
    console.error('Fatal error during bootstrap:', (err as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
