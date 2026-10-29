import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuperAdminService } from '../src/super-admin/super-admin.service';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('SuperAdminService - Plans & Entitlements Management', () => {
  let service: SuperAdminService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAudit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockBillingService: any;

  const adminActor = {
    id: 'admin-123',
    email: 'admin@commercepilot.io',
  };

  beforeEach(() => {
    mockPrisma = {
      platformSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    mockAudit = {
      logAction: vi.fn().mockResolvedValue({ id: 'log-123' }),
    };

    mockBillingService = {
      setCustomPlans: vi.fn(),
      getAvailablePlans: vi.fn(),
    };

    service = new SuperAdminService(
      mockPrisma,
      mockAudit,
      undefined,
      undefined,
      mockBillingService,
    );
  });

  it('lists default canonical plans when no database override exists', async () => {
    const plans = await service.listPlans();
    expect(plans.length).toBeGreaterThanOrEqual(4);
    const planIds = plans.map((p) => p.id);
    expect(planIds).toContain('FREE');
    expect(planIds).toContain('STARTER');
    expect(planIds).toContain('GROWTH');
    expect(planIds).toContain('PRO');
  });

  it('creates a new custom subscription plan and updates platform settings', async () => {
    const newPlanDto = {
      id: 'SCALE_ENTERPRISE',
      name: 'Scale Enterprise VIP',
      description: 'Dedicated fleet infrastructure for hyper-scale commerce',
      priceCents: 49900,
      currency: 'USD',
      billingInterval: 'month' as const,
      maxMonthlyPosts: 5000,
      maxMonthlyAiWords: 5000000,
      maxSocialAccounts: 50,
      maxTeamMembers: 100,
      features: ['Dedicated database cluster', 'Custom LLM fine-tuning', '24/7 SLA'],
      isActive: true,
    };

    const created = await service.createPlan(newPlanDto, adminActor);
    expect(created.id).toBe('SCALE_ENTERPRISE');
    expect(created.priceCents).toBe(49900);
    expect(created.maxTeamMembers).toBe(100);

    // Verify PlatformSetting upsert
    expect(mockPrisma.platformSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'billing.plans' },
      }),
    );

    // Verify BillingService synchronization
    expect(mockBillingService.setCustomPlans).toHaveBeenCalled();

    // Verify Audit Log
    expect(mockAudit.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'billing.plan_created',
        targetId: 'SCALE_ENTERPRISE',
        actorEmail: adminActor.email,
      }),
    );
  });

  it('rejects creating a plan with duplicate ID', async () => {
    const duplicateDto = {
      id: 'STARTER',
      name: 'Duplicate Starter',
      description: 'This should fail',
      priceCents: 1000,
      maxMonthlyPosts: 10,
      maxMonthlyAiWords: 1000,
      maxSocialAccounts: 1,
      maxTeamMembers: 1,
      features: [],
    };

    await expect(service.createPlan(duplicateDto, adminActor)).rejects.toThrow(ConflictException);
  });

  it('updates an existing plan entitlements and pricing', async () => {
    const updateDto = {
      name: 'Starter Merchant Plus',
      priceCents: 3500, // Raised price from 2900 to 3500 ($35)
      maxMonthlyPosts: 75,
      features: ['Up to 3 channels', '75 scheduled posts', 'Priority support'],
    };

    const updated = await service.updatePlan('STARTER', updateDto, adminActor);
    expect(updated.id).toBe('STARTER');
    expect(updated.name).toBe('Starter Merchant Plus');
    expect(updated.priceCents).toBe(3500);
    expect(updated.maxMonthlyPosts).toBe(75);

    expect(mockPrisma.platformSetting.upsert).toHaveBeenCalled();
    expect(mockBillingService.setCustomPlans).toHaveBeenCalled();
    expect(mockAudit.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'billing.plan_updated',
        targetId: 'STARTER',
      }),
    );
  });

  it('throws NotFoundException when updating non-existent plan', async () => {
    await expect(
      service.updatePlan('NON_EXISTENT_PLAN', { name: 'New Name' }, adminActor),
    ).rejects.toThrow(NotFoundException);
  });

  it('prevents deleting the FREE trial plan', async () => {
    await expect(service.deletePlan('FREE', adminActor)).rejects.toThrow(BadRequestException);
  });

  it('successfully deletes a non-free plan and records audit trail', async () => {
    const result = await service.deletePlan('PRO', adminActor);
    expect(result.success).toBe(true);
    expect(result.deletedPlanId).toBe('PRO');

    expect(mockPrisma.platformSetting.upsert).toHaveBeenCalled();
    expect(mockBillingService.setCustomPlans).toHaveBeenCalled();
    expect(mockAudit.logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'billing.plan_deleted',
        targetId: 'PRO',
      }),
    );
  });
});
