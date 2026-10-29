import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import type { PlanEntitlements } from './billing-plans';

@ApiTags('Billing & Subscriptions')
@Controller('billing')
export class PublicBillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List all public subscription plans and entitlements' })
  @ApiResponse({
    status: 200,
    description: 'Available plans, pricing in cents, and feature tiers for public marketing',
  })
  getPublicPlans(): PlanEntitlements[] {
    return this.billingService.getAvailablePlans();
  }
}
