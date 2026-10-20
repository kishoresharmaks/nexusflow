import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard, AuthenticatedRequest } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceGuard } from './guards/workspace.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { WorkspaceRole } from '@commercepilot/database';
import { WorkspacesService } from './workspaces.service';

@ApiTags('Workspace invitations')
@ApiBearerAuth()
@Controller()
export class WorkspaceInvitationsController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('workspaces/:workspaceId/invitations')
  @UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'List workspace invitations' })
  getInvitations(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getInvitations(workspaceId);
  }

  @Delete('workspaces/:workspaceId/invitations/:invitationId')
  @UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Revoke an active workspace invitation' })
  revokeInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.revokeInvitation(workspaceId, invitationId, user.id, ip);
  }

  @Post('invitations/:token/accept')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Accept an invitation using the signed-in invited email address' })
  acceptInvitation(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.acceptInvitation(token, user.id, user.email, user.isEmailVerified, ip);
  }

  @Post('ownership-transfers/:transferId/accept')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Accept a pending ownership transfer' })
  acceptOwnershipTransfer(
    @Param('transferId') transferId: string,
    @CurrentUser() user: AuthenticatedRequest['user'],
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.acceptOwnershipTransfer(transferId, user.id, ip);
  }
}
