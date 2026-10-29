import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicBillingController } from '../src/billing/public-billing.controller';
import { BillingService } from '../src/billing/billing.service';

describe('PublicBillingController', () => {
  let controller: PublicBillingController;
  let service: BillingService;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockPrisma: any = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockAudit: any = {};
    service = new BillingService(mockPrisma, mockAudit);
    controller = new PublicBillingController(service);
  });

  it('returns all public subscription plans without requiring authentication', () => {
    const plans = controller.getPublicPlans();
    expect(plans).toBeDefined();
    expect(plans.length).toBeGreaterThanOrEqual(4);

    const planIds = plans.map((p) => p.id);
    expect(planIds).toContain('FREE');
    expect(planIds).toContain('STARTER');
    expect(planIds).toContain('GROWTH');
    expect(planIds).toContain('PRO');

    const starter = plans.find((p) => p.id === 'STARTER');
    expect(starter?.priceCents).toBe(2900);
    expect(starter?.currency).toBe('USD');
    expect(starter?.maxSocialAccounts).toBe(3);

    const growth = plans.find((p) => p.id === 'GROWTH');
    expect(growth?.priceCents).toBe(7900);
    expect(growth?.maxMonthlyPosts).toBe(200);

    const pro = plans.find((p) => p.id === 'PRO');
    expect(pro?.priceCents).toBe(19900);
    expect(pro?.maxMonthlyAiWords).toBe(1000000);
  });
});
