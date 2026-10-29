import { PlatformRole } from '@commercepilot/database';

export enum AdminPermission {
  DASHBOARD_READ = 'admin.dashboard.read',
  USERS_READ = 'admin.users.read',
  USERS_MANAGE = 'admin.users.manage',
  USERS_SUSPEND = 'admin.users.suspend',
  WORKSPACES_READ = 'admin.workspaces.read',
  WORKSPACES_MANAGE = 'admin.workspaces.manage',
  WORKSPACES_SUSPEND = 'admin.workspaces.suspend',
  BILLING_READ = 'admin.billing.read',
  BILLING_MANAGE = 'admin.billing.manage',
  INTEGRATIONS_READ = 'admin.integrations.read',
  INTEGRATIONS_MANAGE = 'admin.integrations.manage',
  AI_READ = 'admin.ai.read',
  AI_MANAGE = 'admin.ai.manage',
  JOBS_READ = 'admin.jobs.read',
  JOBS_RETRY = 'admin.jobs.retry',
  AUDIT_READ = 'admin.audit.read',
  SETTINGS_MANAGE = 'admin.settings.manage',
  ADMINS_MANAGE = 'admin.admins.manage',
}

export const ROLE_PERMISSIONS: Record<PlatformRole, AdminPermission[]> = {
  [PlatformRole.SUPER_ADMIN]: Object.values(AdminPermission),
  [PlatformRole.SUPPORT_ADMIN]: [
    AdminPermission.DASHBOARD_READ,
    AdminPermission.USERS_READ,
    AdminPermission.WORKSPACES_READ,
    AdminPermission.INTEGRATIONS_READ,
    AdminPermission.AI_READ,
    AdminPermission.JOBS_READ,
    AdminPermission.AUDIT_READ,
  ],
  [PlatformRole.BILLING_ADMIN]: [
    AdminPermission.DASHBOARD_READ,
    AdminPermission.BILLING_READ,
    AdminPermission.BILLING_MANAGE,
    AdminPermission.WORKSPACES_READ,
    AdminPermission.AUDIT_READ,
  ],
};

export const ADMIN_PERMISSIONS_METADATA_KEY = 'super_admin_permissions';
