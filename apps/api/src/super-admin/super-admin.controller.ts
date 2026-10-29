import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { SuperAdminGuard, AuthenticatedAdminRequest } from './guards/super-admin.guard';
import { RequireAdminPermissions } from './decorators/require-admin-permissions.decorator';
import { AdminPermission } from './super-admin.constants';
import { SuperAdminService, DashboardOverviewResult } from './super-admin.service';
import { AdminAuditService } from './audit/admin-audit.service';
import { GrantAdminDto, UpdateAdminDto } from './dto/admin-management.dto';
import { ListUsersQueryDto, SuspendUserDto } from './dto/user-management.dto';
import {
  ListWorkspacesQueryDto,
  SuspendWorkspaceDto,
  UpdateWorkspaceLimitsDto,
} from './dto/workspace-management.dto';
import {
  ListIntegrationStoresQueryDto,
  ListIntegrationSocialQueryDto,
  UpdateSocialStatusDto,
} from './dto/integration-management.dto';
import {
  ListSubscriptionsQueryDto,
  SuperAdminCancelSubscriptionDto,
  CreatePlanDto,
  UpdatePlanDto,
} from './dto/billing-management.dto';
import { ListAiUsageQueryDto } from './dto/ai-management.dto';
import {
  UpdatePlatformSettingDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
  VerifyEmailConnectionDto,
  SendTestEmailDto,
} from './dto/system-management.dto';

@Controller('super-admin')
@UseGuards(SuperAdminGuard)
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  @Get('me')
  async getProfile(@Req() req: AuthenticatedAdminRequest): Promise<any> {
    return this.superAdminService.getAdminProfile(req.user.id);
  }

  @Get('dashboard/overview')
  @RequireAdminPermissions(AdminPermission.DASHBOARD_READ)
  async getOverview(): Promise<DashboardOverviewResult> {
    return this.superAdminService.getDashboardOverview();
  }

  @Get('dashboard/growth')
  @RequireAdminPermissions(AdminPermission.DASHBOARD_READ)
  async getGrowth(@Query('days') days?: string): Promise<any> {
    const numDays = days ? parseInt(days, 10) : 30;
    return this.superAdminService.getDashboardGrowth(isNaN(numDays) ? 30 : numDays);
  }

  @Get('dashboard/health')
  @RequireAdminPermissions(AdminPermission.DASHBOARD_READ)
  async getHealth(): Promise<any> {
    return this.superAdminService.getDashboardHealth();
  }

  @Get('audit-logs')
  @RequireAdminPermissions(AdminPermission.AUDIT_READ)
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('actorEmail') actorEmail?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<any> {
    return this.adminAuditService.listLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      action,
      targetType,
      actorEmail,
      startDate,
      endDate,
    });
  }

  @Get('admins')
  @RequireAdminPermissions(AdminPermission.ADMINS_MANAGE)
  async listAdmins() {
    return this.superAdminService.listAdmins();
  }

  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  @RequireAdminPermissions(AdminPermission.ADMINS_MANAGE)
  async grantAdmin(
    @Body() dto: GrantAdminDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.grantAdmin(dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Patch('admins/:id')
  @RequireAdminPermissions(AdminPermission.ADMINS_MANAGE)
  async updateAdmin(
    @Param('id') adminId: string,
    @Body() dto: UpdateAdminDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.updateAdmin(adminId, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  // --- USERS MANAGEMENT ---

  @Get('users')
  @RequireAdminPermissions(AdminPermission.USERS_READ)
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.superAdminService.listUsers(query);
  }

  @Get('users/:userId')
  @RequireAdminPermissions(AdminPermission.USERS_READ)
  async getUserDetails(@Param('userId') userId: string) {
    return this.superAdminService.getUserDetails(userId);
  }

  @Post('users/:userId/suspend')
  @RequireAdminPermissions(AdminPermission.USERS_SUSPEND)
  async suspendUser(
    @Param('userId') userId: string,
    @Body() dto: SuspendUserDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.suspendUser(userId, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Post('users/:userId/reactivate')
  @RequireAdminPermissions(AdminPermission.USERS_SUSPEND)
  async reactivateUser(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.reactivateUser(userId, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Post('users/:userId/revoke-sessions')
  @RequireAdminPermissions(AdminPermission.USERS_MANAGE)
  async revokeUserSessions(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.revokeUserSessions(userId, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Post('users/:userId/password-reset')
  @RequireAdminPermissions(AdminPermission.USERS_MANAGE)
  async triggerPasswordReset(
    @Param('userId') userId: string,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.triggerUserPasswordReset(userId, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  // --- WORKSPACES MANAGEMENT ---

  @Get('workspaces')
  @RequireAdminPermissions(AdminPermission.WORKSPACES_READ)
  async listWorkspaces(@Query() query: ListWorkspacesQueryDto) {
    return this.superAdminService.listWorkspaces(query);
  }

  @Get('workspaces/:workspaceId')
  @RequireAdminPermissions(AdminPermission.WORKSPACES_READ)
  async getWorkspaceDetails(@Param('workspaceId') workspaceId: string) {
    return this.superAdminService.getWorkspaceDetails(workspaceId);
  }

  @Post('workspaces/:workspaceId/suspend')
  @RequireAdminPermissions(AdminPermission.WORKSPACES_SUSPEND)
  async suspendWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SuspendWorkspaceDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.suspendWorkspace(workspaceId, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Post('workspaces/:workspaceId/reactivate')
  @RequireAdminPermissions(AdminPermission.WORKSPACES_SUSPEND)
  async reactivateWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.reactivateWorkspace(workspaceId, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Patch('workspaces/:workspaceId/limits')
  @RequireAdminPermissions(AdminPermission.WORKSPACES_MANAGE)
  async updateWorkspaceLimits(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceLimitsDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.updateWorkspaceLimits(workspaceId, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Post('workspaces/:workspaceId/purge')
  @RequireAdminPermissions(AdminPermission.WORKSPACES_MANAGE)
  async purgeWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: { confirmSlug: string; reason?: string },
    @Req() req: AuthenticatedAdminRequest,
  ) {
    if (!dto || !dto.confirmSlug) {
      throw new BadRequestException('Confirmation slug is required for GDPR permanent purge.');
    }
    return this.superAdminService.purgeWorkspace(workspaceId, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  // --- INTEGRATIONS MANAGEMENT ---

  @Get('integrations/summary')
  @RequireAdminPermissions(AdminPermission.INTEGRATIONS_READ)
  async getIntegrationsSummary() {
    return this.superAdminService.getIntegrationsSummary();
  }

  @Get('integrations/stores')
  @RequireAdminPermissions(AdminPermission.INTEGRATIONS_READ)
  async listStoreConnections(@Query() query: ListIntegrationStoresQueryDto) {
    return this.superAdminService.listStoreConnections(query);
  }

  @Get('integrations/social')
  @RequireAdminPermissions(AdminPermission.INTEGRATIONS_READ)
  async listSocialAccounts(@Query() query: ListIntegrationSocialQueryDto) {
    return this.superAdminService.listSocialAccounts(query);
  }

  @Post('integrations/stores/:id/sync')
  @RequireAdminPermissions(AdminPermission.INTEGRATIONS_MANAGE)
  async triggerStoreResync(
    @Param('id') connectionId: string,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.triggerStoreResync(connectionId, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Patch('integrations/social/:id/status')
  @RequireAdminPermissions(AdminPermission.INTEGRATIONS_MANAGE)
  async updateSocialAccountStatus(
    @Param('id') accountId: string,
    @Body() dto: UpdateSocialStatusDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.updateSocialAccountStatus(accountId, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  // --- BILLING & SUBSCRIPTIONS ---

  @Get('billing/summary')
  @RequireAdminPermissions(AdminPermission.BILLING_READ)
  async getBillingSummary() {
    return this.superAdminService.getBillingSummary();
  }

  @Get('billing/subscriptions')
  @RequireAdminPermissions(AdminPermission.BILLING_READ)
  async listSubscriptions(@Query() query: ListSubscriptionsQueryDto) {
    return this.superAdminService.listSubscriptions(query);
  }

  @Post('billing/subscriptions/:id/cancel')
  @RequireAdminPermissions(AdminPermission.BILLING_MANAGE)
  async cancelSubscription(
    @Param('id') subscriptionId: string,
    @Body() dto: SuperAdminCancelSubscriptionDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.cancelSubscription(subscriptionId, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  // --- PLANS & ENTITLEMENTS ---

  @Get('billing/plans')
  @RequireAdminPermissions(AdminPermission.BILLING_READ)
  async listPlans() {
    return this.superAdminService.listPlans();
  }

  @Post('billing/plans')
  @RequireAdminPermissions(AdminPermission.BILLING_MANAGE)
  async createPlan(
    @Body() dto: CreatePlanDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.createPlan(dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Patch('billing/plans/:id')
  @RequireAdminPermissions(AdminPermission.BILLING_MANAGE)
  async updatePlan(
    @Param('id') planId: string,
    @Body() dto: UpdatePlanDto,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.updatePlan(planId, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Delete('billing/plans/:id')
  @RequireAdminPermissions(AdminPermission.BILLING_MANAGE)
  async deletePlan(
    @Param('id') planId: string,
    @Req() req: AuthenticatedAdminRequest,
  ) {
    return this.superAdminService.deletePlan(planId, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  // --- AI PROVIDERS & TOKENS ---

  @Get('ai/summary')
  @RequireAdminPermissions(AdminPermission.AI_READ)
  async getAiSummary() {
    return this.superAdminService.getAiSummary();
  }

  @Get('ai/usage')
  @RequireAdminPermissions(AdminPermission.AI_READ)
  async listAiUsage(@Query() query: ListAiUsageQueryDto) {
    return this.superAdminService.listAiUsage(query);
  }

  @Get('ai/top-tenants')
  @RequireAdminPermissions(AdminPermission.AI_READ)
  async getTopAiTenants() {
    return this.superAdminService.getTopAiTenants();
  }

  // --- BACKGROUND JOBS ---

  @Get('jobs/overview')
  @RequireAdminPermissions(AdminPermission.JOBS_READ)
  async getJobsOverview() {
    return this.superAdminService.getJobsOverview();
  }

  @Post('jobs/retry-failed')
  @RequireAdminPermissions(AdminPermission.JOBS_RETRY)
  async retryFailedJobs(@Req() req: AuthenticatedAdminRequest) {
    return this.superAdminService.retryFailedJobs({
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Post('jobs/token-refresh')
  @RequireAdminPermissions(AdminPermission.JOBS_RETRY)
  async triggerTokenRefresh(@Req() req: AuthenticatedAdminRequest) {
    return this.superAdminService.triggerTokenRefreshJob({
      id: req.user.id,
      email: req.user.email,
    });
  }

  // --- PLATFORM SETTINGS & ANNOUNCEMENTS ---

  @Get('settings')
  @RequireAdminPermissions(AdminPermission.SETTINGS_MANAGE)
  async listPlatformSettings(): Promise<any> {
    return this.superAdminService.listPlatformSettings();
  }

  @Patch('settings/:key')
  @RequireAdminPermissions(AdminPermission.SETTINGS_MANAGE)
  async updatePlatformSetting(
    @Param('key') key: string,
    @Body() dto: UpdatePlatformSettingDto,
    @Req() req: AuthenticatedAdminRequest,
  ): Promise<any> {
    return this.superAdminService.updatePlatformSetting(key, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Get('announcements')
  @RequireAdminPermissions(AdminPermission.SETTINGS_MANAGE)
  async listAnnouncements(): Promise<any> {
    return this.superAdminService.listAnnouncements();
  }

  @Post('announcements')
  @RequireAdminPermissions(AdminPermission.SETTINGS_MANAGE)
  async createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @Req() req: AuthenticatedAdminRequest,
  ): Promise<any> {
    return this.superAdminService.createAnnouncement(dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Patch('announcements/:id')
  @RequireAdminPermissions(AdminPermission.SETTINGS_MANAGE)
  async updateAnnouncement(
    @Param('id') announcementId: string,
    @Body() dto: UpdateAnnouncementDto,
    @Req() req: AuthenticatedAdminRequest,
  ): Promise<any> {
    return this.superAdminService.updateAnnouncement(announcementId, dto, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Delete('announcements/:id')
  @RequireAdminPermissions(AdminPermission.SETTINGS_MANAGE)
  async deleteAnnouncement(
    @Param('id') announcementId: string,
    @Req() req: AuthenticatedAdminRequest,
  ): Promise<any> {
    return this.superAdminService.deleteAnnouncement(announcementId, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  // --- EMAIL MANAGEMENT & DIAGNOSTICS ---

  @Get('email/status')
  @RequireAdminPermissions(AdminPermission.SETTINGS_MANAGE)
  async getEmailStatus(): Promise<any> {
    return this.superAdminService.getEmailStatus();
  }

  @Post('email/verify')
  @RequireAdminPermissions(AdminPermission.SETTINGS_MANAGE)
  async verifyEmailConnection(@Body() dto: VerifyEmailConnectionDto): Promise<any> {
    return this.superAdminService.verifyEmailConnection(dto.provider);
  }

  @Post('email/test')
  @RequireAdminPermissions(AdminPermission.SETTINGS_MANAGE)
  async sendTestEmail(
    @Body() dto: SendTestEmailDto,
    @Req() req: AuthenticatedAdminRequest,
  ): Promise<any> {
    return this.superAdminService.sendTestEmail(dto.to, dto.provider, {
      id: req.user.id,
      email: req.user.email,
    });
  }
}
