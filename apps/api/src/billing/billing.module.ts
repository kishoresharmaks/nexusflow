import { Module, Global } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [AuthModule, WorkspacesModule, AuditModule],
  controllers: [BillingController],
  providers: [BillingService, EntitlementsService],
  exports: [BillingService, EntitlementsService],
})
export class BillingModule {}
