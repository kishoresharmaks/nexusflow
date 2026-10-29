import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import type { Request } from 'express';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberStatusDto } from './dto/update-member-status.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { StartOwnershipTransferDto } from './dto/ownership-transfer.dto';
import { UpdateApprovalPolicyDto } from './dto/approval-policy.dto';
import { AuthGuard, AuthenticatedRequest, AuthenticatedUser } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from './guards/workspace.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRole } from '@commercepilot/database';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created with creator as OWNER' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.createWorkspace(user.id, dto, ip);
  }

  @Get()
  @ApiOperation({ summary: 'List all workspaces for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of accessible workspaces' })
  async listUserWorkspaces(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.getUserWorkspaces(user.id);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Get details for a specific workspace (member only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Workspace details' })
  @ApiResponse({ status: 403, description: 'Access denied (cross-tenant isolation)' })
  async getOne(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getWorkspace(workspaceId);
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update workspace settings (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Workspace updated' })
  @ApiResponse({ status: 403, description: 'Forbidden (insufficient permissions)' })
  async update(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWorkspaceDto,
    @Req() req: Request,
  ): Promise<any> {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.updateWorkspace(workspaceId, user.id, dto, ip);
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'List all members of a workspace (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'List of workspace members' })
  async getMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getMembers(workspaceId);
  }

  @Post(':workspaceId/invitations')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create a secure workspace invitation (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'Expiring invitation created' })
  async createInvitation(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.createInvitation(workspaceId, user.id, req.membership!.role, dto, ip);
  }

  @Post(':workspaceId/members')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create a secure workspace invitation (legacy member endpoint)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'Invitation dispatched; no user account is created until acceptance' })
  @ApiResponse({ status: 403, description: 'Forbidden (insufficient permissions)' })
  async addMember(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.createInvitation(workspaceId, user.id, req.membership!.role, dto, ip);
  }

  @Patch(':workspaceId/members/:membershipId/status')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Suspend or reactivate a workspace membership (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'membershipId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Membership status updated' })
  async updateMemberStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.updateMemberStatus(
      workspaceId,
      user.id,
      req.membership!.role,
      membershipId,
      dto,
      ip,
    );
  }

  @Patch(':workspaceId/members/:membershipId/role')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update role for a workspace member (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'membershipId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Member role updated' })
  @ApiResponse({ status: 400, description: 'Cannot demote sole owner' })
  async updateRoleDedicated(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.updateMemberRole(
      workspaceId,
      user.id,
      req.membership!.role,
      membershipId,
      dto,
      ip,
    );
  }

  @Patch(':workspaceId/members/:membershipId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update role for a workspace member (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'membershipId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Member role updated' })
  @ApiResponse({ status: 400, description: 'Cannot demote sole owner' })
  async updateRole(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.updateMemberRole(
      workspaceId,
      user.id,
      req.membership!.role,
      membershipId,
      dto,
      ip,
    );
  }

  @Delete(':workspaceId/members/:membershipId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Remove a member from the workspace (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiParam({ name: 'membershipId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Member removed from workspace' })
  @ApiResponse({ status: 400, description: 'Cannot remove sole owner' })
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.removeMember(workspaceId, user.id, req.membership!.role, membershipId, ip);
  }

  @Post(':workspaceId/ownership-transfers')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @ApiOperation({ summary: 'Start a two-party ownership transfer (OWNER only)' })
  async startOwnershipTransfer(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartOwnershipTransferDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.startOwnershipTransfer(workspaceId, user.id, dto, ip);
  }

  @Get(':workspaceId/admin-summary')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Get workspace administration overview, actionable counts, and safe metrics' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Workspace operational summary' })
  async getAdminSummary(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getAdminSummary(workspaceId);
  }

  @Get(':workspaceId/approval-policy')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Get content governance approval policy' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Current approval policy' })
  async getApprovalPolicy(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getApprovalPolicy(workspaceId);
  }

  @Patch(':workspaceId/approval-policy')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update content governance approval policy' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Updated approval policy' })
  async updateApprovalPolicy(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApprovalPolicyDto,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.updateApprovalPolicy(workspaceId, user.id, dto, ip);
  }

  @Get(':workspaceId/data-privacy')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @ApiOperation({ summary: 'Get owner-only scoped data and privacy summary' })
  async getDataPrivacySummary(@Param('workspaceId') workspaceId: string) {
    return this.workspacesService.getDataPrivacySummary(workspaceId);
  }

  @Post(':workspaceId/data-privacy/deletion-request')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @ApiOperation({ summary: 'Record a non-destructive workspace deletion review request' })
  async requestDeletionReview(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.requestWorkspaceDeletionReview(workspaceId, user.id, ip);
  }

  @Delete(':workspaceId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @ApiOperation({ summary: 'Archive/delete workspace (Owner only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Workspace archived and scheduled for deletion' })
  async archiveWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: { confirmSlug?: string },
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!dto || !dto.confirmSlug) {
      throw new BadRequestException('Request body must include confirmSlug matching workspace slug.');
    }
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.workspacesService.archiveWorkspace(
      workspaceId,
      user.id,
      req.membership!.role,
      dto.confirmSlug,
      ip,
    );
  }
}
