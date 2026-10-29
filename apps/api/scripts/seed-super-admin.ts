import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
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

import { hash } from '@node-rs/argon2';
import { PrismaClient, PlatformRole, PlatformAdminStatus } from '@commercepilot/database';

async function seedSuperAdmin() {
  const email = (process.env['SUPER_ADMIN_EMAIL'] || 'admin@commercepilot.com').toLowerCase().trim();
  const password = process.env['SUPER_ADMIN_PASSWORD'] || 'SuperAdmin2026!';
  const name = process.env['SUPER_ADMIN_NAME'] || 'NexusFlow Operator';

  const prisma = new PrismaClient();

  try {
    console.log(`Checking existing user for ${email}...`);

    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationTokenExpiresAt: null,
        },
      });
      console.log(`Created new User: ${email} (ID: ${user.id})`);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          name,
          isEmailVerified: true,
          isSuspended: false,
          suspendedAt: null,
          suspensionReason: null,
        },
      });
      console.log(`Updated existing User: ${email} (ID: ${user.id}) with fresh credentials.`);
    }

    const existingAdmin = await prisma.platformAdmin.findUnique({
      where: { userId: user.id },
    });

    if (existingAdmin) {
      const updated = await prisma.platformAdmin.update({
        where: { id: existingAdmin.id },
        data: {
          role: PlatformRole.SUPER_ADMIN,
          status: PlatformAdminStatus.ACTIVE,
          updatedAt: new Date(),
        },
      });
      console.log(`Updated PlatformAdmin record: ID ${updated.id} to ACTIVE SUPER_ADMIN.`);
    } else {
      const created = await prisma.platformAdmin.create({
        data: {
          userId: user.id,
          role: PlatformRole.SUPER_ADMIN,
          status: PlatformAdminStatus.ACTIVE,
          createdBy: 'SEED_SCRIPT',
          permissions: [],
        },
      });
      console.log(`Created PlatformAdmin record: ID ${created.id} with SUPER_ADMIN role.`);
    }

    await prisma.adminAuditLog.create({
      data: {
        actorId: user.id,
        actorEmail: email,
        action: 'admin.seed_provisioned',
        targetType: 'PLATFORM_ADMIN',
        targetId: user.id,
        reason: 'Super admin credentials seeded via script',
        outcome: 'SUCCESS',
      },
    });

    console.log('\n======================================================');
    console.log(' SUPER ADMIN CREDENTIALS PROVISIONED SUCCESSFULLY');
    console.log('======================================================');
    console.log(` Email:    ${email}`);
    console.log(` Password: ${password}`);
    console.log(` Role:     SUPER_ADMIN`);
    console.log(` Gateway:  http://localhost:3000/super-admin/login`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Failed to seed Super Admin:', (err as Error).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedSuperAdmin();
