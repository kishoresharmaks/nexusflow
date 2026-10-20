import { Module } from '@nestjs/common';
import { LinkedInIntegrationController } from './linkedin.controller';
import { LinkedInIntegrationService } from './linkedin.service';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../../audit/audit.module';
import { AuthModule } from '../../auth/auth.module';
import { WorkspacesModule } from '../../workspaces/workspaces.module';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, WorkspacesModule],
  controllers: [LinkedInIntegrationController],
  providers: [LinkedInIntegrationService],
  exports: [LinkedInIntegrationService],
})
export class LinkedInIntegrationModule {}
