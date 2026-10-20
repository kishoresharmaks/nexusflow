import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspaceGuard } from './guards/workspace.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { AuditController } from '../audit/audit.controller';
import { WorkspaceInvitationsController } from './workspace-invitations.controller';

@Module({
  imports: [AuthModule],
  controllers: [WorkspacesController, AuditController, WorkspaceInvitationsController],
  providers: [WorkspacesService, WorkspaceGuard, RolesGuard],
  exports: [WorkspacesService, WorkspaceGuard, RolesGuard],
})
export class WorkspacesModule {}
