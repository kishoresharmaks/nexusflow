import { Module, Global } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { PublicBillingController } from './public-billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsService } from './entitlements.service';
import { RazorpayClient } from './razorpay.client';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [AuthModule, WorkspacesModule, AuditModule],
  controllers: [BillingController, PublicBillingController],
  providers: [BillingService, EntitlementsService, RazorpayClient],
  exports: [BillingService, EntitlementsService],
})
export class BillingModule {}
