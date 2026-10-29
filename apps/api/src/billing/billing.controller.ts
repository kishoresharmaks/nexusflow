import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Ip,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AuthGuard, AuthenticatedUser } from '../auth/guards/auth.guard';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RolesGuard } from '../workspaces/guards/roles.guard';
import { Roles } from '../workspaces/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRole, type Subscription, type BillingEvent } from '@commercepilot/database';
import {
  BillingService,
  type WorkspaceUsageSummary,
  type CheckoutSessionResult,
} from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { ActivatePlanDto } from './dto/activate-plan.dto';
import type { PlanEntitlements } from './billing-plans';

@ApiTags('Billing & Subscriptions')
@ApiBearerAuth()
@UseGuards(AuthGuard, WorkspaceGuard, RolesGuard)
@Controller('workspaces/:workspaceId/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List all available subscription plans and entitlements' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Available plans and feature tiers' })
  getPlans(): PlanEntitlements[] {
    return this.billingService.getAvailablePlans();
  }

  @Get('subscription')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get current workspace subscription details' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Current active subscription' })
  async getSubscription(@Param('workspaceId') workspaceId: string): Promise<Subscription> {
    return this.billingService.getSubscription(workspaceId);
  }

  @Get('usage')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get current billing cycle usage against plan entitlements' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Current period usage summary' })
  async getUsage(@Param('workspaceId') workspaceId: string): Promise<WorkspaceUsageSummary> {
    return this.billingService.getUsage(workspaceId);
  }

  @Get('history')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get billing events and payment history' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'List of billing events' })
  async getHistory(@Param('workspaceId') workspaceId: string): Promise<BillingEvent[]> {
    return this.billingService.getBillingHistory(workspaceId);
  }

  @Post('checkout')
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Initiate a subscription checkout session (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 201, description: 'Checkout session created' })
  @ApiResponse({ status: 403, description: 'Forbidden (insufficient role)' })
  async createCheckout(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<CheckoutSessionResult> {
    return this.billingService.createCheckoutSession(workspaceId, dto, user.id, ip);
  }

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Confirm webhook-verified payment and activate plan (OWNER/ADMIN only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Subscription activated after verified payment' })
  @ApiResponse({ status: 409, description: 'Payment not yet confirmed by Razorpay webhook' })
  async activate(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ActivatePlanDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<Subscription> {
    return this.billingService.confirmActivation(workspaceId, dto.orderId, user.id, ip);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER)
  @ApiOperation({ summary: 'Cancel subscription at period end (OWNER only)' })
  @ApiParam({ name: 'workspaceId', description: '24-character hex MongoDB ObjectId' })
  @ApiResponse({ status: 200, description: 'Subscription set to cancel at end of cycle' })
  @ApiResponse({ status: 403, description: 'Forbidden (only workspace OWNER can cancel)' })
  async cancel(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CancelSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip?: string,
  ): Promise<Subscription> {
    return this.billingService.cancelSubscription(workspaceId, dto, user.id, ip);
  }
}
