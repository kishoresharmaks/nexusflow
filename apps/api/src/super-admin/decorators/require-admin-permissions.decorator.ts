import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { AdminPermission, ADMIN_PERMISSIONS_METADATA_KEY } from '../super-admin.constants';

export const RequireAdminPermissions = (
  ...permissions: AdminPermission[]
): CustomDecorator<string> => SetMetadata(ADMIN_PERMISSIONS_METADATA_KEY, permissions);
