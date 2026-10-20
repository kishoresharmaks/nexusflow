import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, WorkspacesModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
