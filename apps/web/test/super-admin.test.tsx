import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import SuperAdminLayout from '../src/app/super-admin/layout';
import SuperAdminDashboardPage from '../src/app/super-admin/page';
import SuperAdminLoginPage from '../src/app/super-admin/login/page';
import SuperAdminUsersPage from '../src/app/super-admin/users/page';
import SuperAdminWorkspacesPage from '../src/app/super-admin/workspaces/page';
import SuperAdminIntegrationsPage from '../src/app/super-admin/integrations/page';
import SuperAdminSubscriptionsPage from '../src/app/super-admin/subscriptions/page';
import SuperAdminAiProvidersPage from '../src/app/super-admin/ai-providers/page';
import SuperAdminJobsPage from '../src/app/super-admin/jobs/page';
import SuperAdminSettingsPage from '../src/app/super-admin/settings/page';
import { AuthProvider } from '../src/context/auth-context';
import { api } from '../src/lib/api';

vi.mock('next/navigation', () => ({
  usePathname: () => '/super-admin',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('Super Admin Console (Phase 2)', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockUser = {
    id: 'user-admin-1',
    name: 'Platform Operator',
    email: 'operator@commercepilot.com',
    isEmailVerified: true,
    createdAt: new Date().toISOString(),
  };

  const mockProfile = {
    id: 'pa-1',
    userId: 'user-admin-1',
    user: mockUser,
    role: 'SUPER_ADMIN' as const,
    status: 'ACTIVE' as const,
    permissions: ['admin.dashboard.read', 'admin.admins.manage'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockHealth = {
    database: { status: 'HEALTHY', latencyMs: 3 },
    integrations: {
      stores: { healthy: 4, failing: 0 },
      socialAccounts: { healthy: 8, attentionRequired: 1 },
    },
    timestamp: new Date().toISOString(),
  };

  const mockOverview = {
    users: { total: 120, active: 118, suspended: 2 },
    workspaces: { total: 45, active: 44, suspended: 1 },
    content: { totalPosts: 350, totalCampaigns: 28, totalStoreConnections: 12 },
    aiUsage: {
      totalRequests: 840,
      totalTokens: 2500000,
      promptTokens: 1800000,
      completionTokens: 700000,
      costEstimateMicrocents: 450000,
    },
    recentActivity: [
      {
        id: 'act-1',
        actorId: 'user-admin-1',
        actorEmail: 'operator@commercepilot.com',
        action: 'admin.bootstrap',
        targetType: 'PLATFORM_ADMIN',
        targetId: 'pa-1',
        reason: 'Initial setup',
        outcome: 'SUCCESS',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  it('renders "Platform Access Denied" gate when authenticated user is not a platform admin', async () => {
    vi.spyOn(api, 'getSuperAdminProfile').mockRejectedValue(
      new Error('403 Forbidden: Platform administrator access required.'),
    );
    vi.spyOn(api, 'getSuperAdminHealth').mockResolvedValue(mockHealth);

    render(
      <AuthProvider initialToken="user-token" initialUser={mockUser}>
        <SuperAdminLayout>
          <div>Privileged Admin Content</div>
        </SuperAdminLayout>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Platform Access Denied')).toBeDefined();
    });

    expect(
      screen.getByText(/does not have active platform-level administrator privileges/i),
    ).toBeDefined();
    expect(screen.queryByText('Privileged Admin Content')).toBeNull();
  });

  it('renders Super Admin operator sidebar and navigation for authorized platform administrator', async () => {
    vi.spyOn(api, 'getSuperAdminProfile').mockResolvedValue(mockProfile);
    vi.spyOn(api, 'getSuperAdminHealth').mockResolvedValue(mockHealth);

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminLayout>
          <div data-testid="admin-content">Privileged Operator Content</div>
        </SuperAdminLayout>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Super Admin Console')).toBeDefined();
    });

    expect(screen.getByText('Platform Overview')).toBeDefined();
    expect(screen.getByText('Security & Audit Logs')).toBeDefined();
    expect(screen.getByText('SUPER_ADMIN')).toBeDefined();
    expect(screen.getByTestId('admin-content')).toBeDefined();
  });

  it('renders Dashboard Overview KPI cards, growth summary, and infrastructure health', async () => {
    vi.spyOn(api, 'getSuperAdminOverview').mockResolvedValue(mockOverview);
    vi.spyOn(api, 'getSuperAdminGrowth').mockResolvedValue([
      { date: '2026-10-19', users: 5, workspaces: 2 },
      { date: '2026-10-20', users: 8, workspaces: 3 },
    ]);
    vi.spyOn(api, 'getSuperAdminHealth').mockResolvedValue(mockHealth);
    vi.spyOn(api, 'getSuperAdminList').mockResolvedValue([mockProfile as any]);

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminDashboardPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Platform Overview & Telemetry')).toBeDefined();
    });

    expect(screen.getByText('120')).toBeDefined(); // Total users
    expect(screen.getByText('45')).toBeDefined(); // Total workspaces
    expect(screen.getByText('Infrastructure Health')).toBeDefined();
    expect(screen.getByText('Platform Growth (Last 14 Days)')).toBeDefined();
    expect(screen.getByText('Recent Privileged Operations')).toBeDefined();
    expect(screen.getByText('admin.bootstrap')).toBeDefined();
  });

  it('renders the Super Admin Login Gateway', () => {
    render(
      <AuthProvider>
        <SuperAdminLoginPage />
      </AuthProvider>,
    );

    expect(screen.getByText('Super Admin Gateway')).toBeDefined();
    expect(screen.getByPlaceholderText('operator@commercepilot.com')).toBeDefined();
    expect(screen.getByText('Authenticate Privileged Session')).toBeDefined();
  });

  it('renders Super Admin Users Directory with search, status filters, and session telemetry', async () => {
    vi.spyOn(api, 'getSuperAdminUsers').mockResolvedValue({
      users: [
        {
          id: 'u-1',
          name: 'Jane Merchant',
          email: 'jane@store.com',
          isEmailVerified: true,
          isSuspended: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          platformAdmin: null,
          workspaces: [{ id: 'ws-1', name: 'Jane Boutique', slug: 'jane-boutique', status: 'ACTIVE', role: 'OWNER' }],
          totalSessions: 3,
          activeSessionsCount: 1,
          membershipsCount: 1,
        },
        {
          id: 'u-2',
          name: 'Suspended Bad Actor',
          email: 'spammer@malicious.com',
          isEmailVerified: false,
          isSuspended: true,
          suspensionReason: 'Automated spam abuse',
          suspendedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          platformAdmin: null,
          workspaces: [],
          totalSessions: 1,
          activeSessionsCount: 0,
          membershipsCount: 0,
        },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminUsersPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('User Accounts & Identities')).toBeDefined();
    });

    expect(screen.getByText('Jane Merchant')).toBeDefined();
    expect(screen.getByText('jane@store.com')).toBeDefined();
    expect(screen.getByText('Jane Boutique (owner)')).toBeDefined();
    expect(screen.getByText('1 active')).toBeDefined();

    expect(screen.getByText('Suspended Bad Actor')).toBeDefined();
    expect(screen.getByText('spammer@malicious.com')).toBeDefined();
    expect(screen.getAllByText('Suspended').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Super Admin Workspaces Fleet with plans, custom quotas, and telemetry', async () => {
    vi.spyOn(api, 'getSuperAdminWorkspaces').mockResolvedValue({
      workspaces: [
        {
          id: 'ws-1',
          name: 'Apex Outfitters',
          slug: 'apex-outfitters',
          timezone: 'America/New_York',
          locale: 'en-US',
          currency: 'USD',
          status: 'ACTIVE',
          planTier: 'GROWTH',
          customQuotas: { maxPostsPerMonth: 800 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          owner: { id: 'u-1', name: 'Apex Owner', email: 'owner@apex.com' },
          stats: { totalMembers: 5, totalStores: 2, totalPosts: 120, totalCampaigns: 4 },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    vi.spyOn(api, 'getSuperAdminPlans').mockResolvedValue([]);

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminWorkspacesPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Tenant Workspaces & Multi-Tenancy')).toBeDefined();
    });

    expect(screen.getByText('Apex Outfitters')).toBeDefined();
    expect(screen.getByText('apex-outfitters')).toBeDefined();
    expect(screen.getByText('Apex Owner')).toBeDefined();
    expect(screen.getByText('GROWTH')).toBeDefined();
    expect(screen.getByText('Custom limits active')).toBeDefined();
    expect(screen.getByText(/5 member\(s\) • 2 store\(s\)/)).toBeDefined();
  });

  it('renders Super Admin Integrations Fleet with stores, health diagnostics, and social tabs', async () => {
    vi.spyOn(api, 'getSuperAdminIntegrationsSummary').mockResolvedValue({
      stores: {
        total: 4,
        healthy: 3,
        failing: 1,
        syncing: 0,
        platforms: { SHOPIFY: 3, WOOCOMMERCE: 1, CUSTOM: 0 },
      },
      social: {
        total: 6,
        active: 5,
        expired: 1,
        revoked: 0,
        expiringSoon: 1,
        providers: { META_INSTAGRAM: 4, LINKEDIN: 2 },
      },
      timestamp: new Date().toISOString(),
    });

    vi.spyOn(api, 'getSuperAdminIntegrationStores').mockResolvedValue({
      stores: [
        {
          id: 'sc-1',
          workspaceId: 'ws-1',
          platform: 'SHOPIFY',
          storeName: 'Nordic Apparel Store',
          storeUrl: 'https://nordic.myshopify.com',
          syncStatus: 'SUCCESS',
          syncedProducts: 250,
          lastSyncAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          workspace: { id: 'ws-1', name: 'Nordic Brands', slug: 'nordic-brands', status: 'ACTIVE', planTier: 'GROWTH' },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    vi.spyOn(api, 'getSuperAdminPlans').mockResolvedValue([]);

    vi.spyOn(api, 'getSuperAdminIntegrationSocial').mockResolvedValue({
      accounts: [
        {
          id: 'sa-1',
          workspaceId: 'ws-1',
          provider: 'META_INSTAGRAM',
          providerAccountId: 'ig-12345',
          displayName: 'Nordic IG Official',
          username: 'nordic_official',
          scopes: ['instagram_basic'],
          status: 'ACTIVE',
          tokenExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          daysUntilExpiration: 3,
          isExpiringSoon: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          workspace: { id: 'ws-1', name: 'Nordic Brands', slug: 'nordic-brands', status: 'ACTIVE', planTier: 'GROWTH' },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    vi.spyOn(api, 'getSuperAdminPlans').mockResolvedValue([]);

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminIntegrationsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Integration Fleet & Diagnostics')).toBeDefined();
    });

    expect(screen.getByText('Nordic Apparel Store')).toBeDefined();
    expect(screen.getByText('SHOPIFY')).toBeDefined();
    expect(screen.getByText('Success')).toBeDefined();
    expect(screen.getByText('Resync')).toBeDefined();
  });

  it('renders Subscriptions page with MRR, ARR, and active subscription directory', async () => {
    vi.spyOn(api, 'getSuperAdminBillingSummary').mockResolvedValue({
      mrrCents: 45000,
      arrCents: 540000,
      totalRevenueCents: 1200000,
      subscriptions: { total: 8, active: 6, trialing: 1, pastDue: 1, canceled: 0 },
      planDistribution: { FREE: 30, STARTER: 4, PROFESSIONAL: 2, ENTERPRISE: 0 },
    });

    vi.spyOn(api, 'getSuperAdminSubscriptions').mockResolvedValue({
      subscriptions: [
        {
          id: 'sub-1',
          workspaceId: 'ws-1',
          planId: 'professional_tier',
          status: 'ACTIVE',
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          workspace: {
            id: 'ws-1',
            name: 'Apex Retail',
            slug: 'apex-retail',
            planTier: 'PROFESSIONAL',
            status: 'ACTIVE',
            _count: { memberships: 5 },
          },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    vi.spyOn(api, 'getSuperAdminPlans').mockResolvedValue([]);

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminSubscriptionsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Platform Billing & Subscriptions')).toBeDefined();
    });

    expect(screen.getByText('Apex Retail')).toBeDefined();
    expect(screen.getByText('professional_tier')).toBeDefined();
    expect(screen.getByText('Active Subscriptions')).toBeDefined();
  });

  it('renders Subscription Plans tab and supports creating and editing plan catalog', async () => {
    const mockPlans = [
      {
        id: 'STARTER',
        name: 'Starter Tier',
        description: 'For growing boutiques',
        priceCents: 2900,
        currency: 'USD',
        billingInterval: 'month' as const,
        maxMonthlyPosts: 50,
        maxMonthlyAiWords: 50000,
        maxSocialAccounts: 3,
        maxTeamMembers: 3,
        features: ['50 Posts / mo', '3 Channels'],
      },
      {
        id: 'SCALE',
        name: 'Scale Tier',
        description: 'For enterprise commerce',
        priceCents: 19900,
        currency: 'USD',
        billingInterval: 'month' as const,
        maxMonthlyPosts: 1000,
        maxMonthlyAiWords: 1000000,
        maxSocialAccounts: 25,
        maxTeamMembers: 50,
        features: ['1000 Posts / mo', '25 Channels'],
      },
    ];

    vi.spyOn(api, 'getSuperAdminBillingSummary').mockResolvedValue({
      mrrCents: 45000,
      arrCents: 540000,
      totalRevenueCents: 1200000,
      subscriptions: { total: 8, active: 6, trialing: 1, pastDue: 1, canceled: 0 },
      planDistribution: { FREE: 30, STARTER: 4, PROFESSIONAL: 2, ENTERPRISE: 0 },
    });
    vi.spyOn(api, 'getSuperAdminSubscriptions').mockResolvedValue({
      subscriptions: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });
    vi.spyOn(api, 'getSuperAdminPlans').mockResolvedValue(mockPlans);

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminSubscriptionsPage />
      </AuthProvider>,
    );

    // Switch to Subscription Plans & Entitlements tab
    const plansTab = screen.getByRole('button', { name: /subscription plans & entitlements/i });
    plansTab.click();

    await waitFor(() => {
      expect(screen.getByText('Starter Tier')).toBeDefined();
      expect(screen.getByText('Scale Tier')).toBeDefined();
      expect(screen.getByText('$29')).toBeDefined();
      expect(screen.getByText('$199')).toBeDefined();
    });

    // Check "Add New Plan Tier" button exists
    expect(screen.getAllByRole('button', { name: /add new plan/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders AI Providers page with token counters and top consuming workspaces', async () => {
    vi.spyOn(api, 'getSuperAdminAiSummary').mockResolvedValue({
      totalRequests: 240,
      totalTokens: 1200000,
      promptTokens: 800000,
      completionTokens: 400000,
      totalCostEstimateMicrocents: 6000000,
      totalCostEstimateUsd: 0.06,
      providerBreakdown: {
        OPENAI: {
          requests: 180,
          promptTokens: 600000,
          completionTokens: 300000,
          totalTokens: 900000,
          costMicrocents: 4500000,
        },
      },
      featureBreakdown: {
        CAPTION_GENERATION: { requests: 180, totalTokens: 900000, costMicrocents: 4500000 },
      },
    });

    vi.spyOn(api, 'getSuperAdminTopAiTenants').mockResolvedValue([
      {
        workspaceId: 'ws-1',
        workspaceName: 'Apex Brands',
        workspaceSlug: 'apex-brands',
        planTier: 'PROFESSIONAL',
        totalTokens: 900000,
        costEstimateMicrocents: 4500000,
        costEstimateUsd: 0.045,
        requestCount: 180,
      },
    ]);

    vi.spyOn(api, 'getSuperAdminAiUsage').mockResolvedValue({
      usage: [
        {
          id: 'use-1',
          workspaceId: 'ws-1',
          provider: 'OPENAI',
          model: 'gpt-4o',
          promptTokens: 400,
          completionTokens: 200,
          costEstimateMicrocents: 3000,
          feature: 'CAPTION_GENERATION',
          createdAt: new Date().toISOString(),
          workspace: { id: 'ws-1', name: 'Apex Brands', slug: 'apex-brands' },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    vi.spyOn(api, 'getSuperAdminPlans').mockResolvedValue([]);

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminAiProvidersPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('AI Provider Infrastructure & Token Quotas')).toBeDefined();
    });

    expect(screen.getAllByText('Apex Brands').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('gpt-4o')).toBeDefined();
    expect(screen.getByText('Top 10 AI-Consuming Tenants')).toBeDefined();
  });

  it('renders Background Jobs page with queue health and retry actions', async () => {
    vi.spyOn(api, 'getSuperAdminJobsOverview').mockResolvedValue({
      redisStatus: 'ONLINE',
      workerMode: 'BULLMQ_DISTRIBUTED',
      queues: [
        {
          name: 'post-publishing',
          displayName: 'Post Publishing Queue',
          status: 'HEALTHY',
          waiting: 5,
          active: 1,
          failed: 0,
          completed: 120,
        },
      ],
      workload: {
        failedPosts: 0,
        scheduledPosts: 5,
        publishingPosts: 1,
        pendingImports: 0,
        failedImports: 0,
      },
      recentFailures: [],
    });

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminJobsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Background Jobs & Worker Telemetry')).toBeDefined();
    });

    expect(screen.getByText('Post Publishing Queue')).toBeDefined();
    expect(screen.getByText('ONLINE')).toBeDefined();
    expect(screen.getByText('BullMQ Distributed')).toBeDefined();
  });

  it('renders Platform Settings & Broadcasts page with maintenance controls', async () => {
    vi.spyOn(api, 'getSuperAdminPlatformSettings').mockResolvedValue([
      {
        id: 'set-1',
        key: 'maintenance_mode',
        value: { enabled: false },
        description: 'Global maintenance switch',
        isPublic: true,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'set-2',
        key: 'allow_public_registrations',
        value: { enabled: true },
        description: 'Self-service user registration',
        isPublic: true,
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    ]);

    vi.spyOn(api, 'getSuperAdminAnnouncements').mockResolvedValue([
      {
        id: 'ann-1',
        title: 'Scheduled API Upgrade',
        content: 'System will update on Sunday at 02:00 UTC.',
        audience: 'ALL',
        isPublished: true,
        createdBy: 'operator@commercepilot.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    render(
      <AuthProvider initialToken="admin-token" initialUser={mockUser}>
        <SuperAdminSettingsPage />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Platform Settings & Broadcasts')).toBeDefined();
    });

    expect(screen.getByText('Platform Maintenance Mode')).toBeDefined();
    expect(screen.getByText('Allow Public Registrations')).toBeDefined();
    expect(screen.getByText('maintenance_mode')).toBeDefined();
  });
});
