import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { StoreConnectionsModule } from '../integrations/stores/store-connections.module';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { AdminAuditService } from './audit/admin-audit.service';
import { SuperAdminBootstrapService } from './bootstrap/super-admin-bootstrap.service';

@Module({
  imports: [DatabaseModule, AuthModule, StoreConnectionsModule],
  controllers: [SuperAdminController],
  providers: [
    SuperAdminService,
    SuperAdminGuard,
    AdminAuditService,
    SuperAdminBootstrapService,
  ],
  exports: [SuperAdminService, SuperAdminGuard, AdminAuditService],
})
export class SuperAdminModule {}
