import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../../audit/audit.module';
import { AuthModule } from '../../auth/auth.module';
import { BillingModule } from '../../billing/billing.module';
import { InstagramIntegrationService } from './instagram.service';
import { InstagramIntegrationController } from './instagram.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, BillingModule],
  controllers: [InstagramIntegrationController],
  providers: [InstagramIntegrationService],
  exports: [InstagramIntegrationService],
})
export class InstagramIntegrationModule {}
