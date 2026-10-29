export type UserAccountStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type MembershipStatus = 'PENDING_ACCEPTANCE' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface User {
  id: string;
  email: string;
  name: string;
  isEmailVerified?: boolean;
  emailVerifiedAt?: string | null;
  accountStatus?: UserAccountStatus;
}

export interface AuthResponse {
  user: User;
  sessionToken: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role?: string | undefined;
  status?: MembershipStatus | undefined;
  timezone?: string | undefined;
  locale?: string | undefined;
  currency?: string | undefined;
  logoUrl?: string | null | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface WorkspaceMember {
  membershipId: string;
  role: WorkspaceRole;
  status?: MembershipStatus;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    isEmailVerified: boolean;
    emailVerifiedAt?: string | null;
    accountStatus?: UserAccountStatus;
  };
}

export interface WorkspaceInvitation {
  id: string;
  emailNormalized: string;
  role: WorkspaceRole;
  status?: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ProductItem {
  id: string;
  sku: string | null;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  inventoryCount: number;
  url?: string | null | undefined;
  images: string[];
  tags: string[];
  isStale: boolean;
  isActive?: boolean | undefined;
  freshnessCheckedAt?: string | null | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface ProductListResponse {
  items: ProductItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CatalogImportRecord {
  id: string;
  fileName: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors?:
    | Array<{
        rowNumber: number;
        sku?: string | undefined;
        title?: string | undefined;
        errors: string[];
      }>
    | null
    | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface GroundedMarketingDraft {
  caption: string;
  hashtags: string[];
  callToAction: string;
  characterCount: number;
  groundedFacts: {
    productId: string;
    title: string;
    priceFormatted: string;
    stockStatus: string;
    url?: string | null | undefined;
  };
  staleWarning?: string | undefined;
  draftPost?: {
    id: string;
    status: string;
    productId: string;
    content: string;
    mediaUrls: string[];
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    costEstimateMicrocents: number;
    model: string;
    provider: string;
  };
}

export interface QuotaStatus {
  usedTokens: number;
  limitTokens: number;
  remainingTokens: number;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
}

export interface BrandProfileItem {
  id: string;
  workspaceId: string;
  name: string;
  toneOfVoice?: string | null | undefined;
  targetAudience?: string | null | undefined;
  prohibitedWords: string[];
  preferredHashtags: string[];
}

export interface ContentTemplateItem {
  id: string;
  workspaceId: string;
  name: string;
  promptTemplate: string;
  channel?: string | null | undefined;
}

export interface MediaAssetItem {
  id: string;
  workspaceId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  width?: number | null | undefined;
  height?: number | null | undefined;
  url?: string | null | undefined;
  createdAt: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  expectedHeaders: Record<string, string>;
}

export type SocialProviderType =
  'META_INSTAGRAM' | 'META_FACEBOOK' | 'TIKTOK' | 'PINTEREST' | 'YOUTUBE' | 'TWITTER' | 'LINKEDIN';

export interface SocialAccountItem {
  id: string;
  workspaceId: string;
  provider: SocialProviderType;
  providerAccountId: string;
  displayName: string;
  username?: string | null | undefined;
  tokenExpiresAt?: string | null | undefined;
  scopes: string[];
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DISCONNECTED';
  createdAt: string;
}

export type PostStatusType =
  | 'DRAFT'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'UNKNOWN_OUTCOME'
  | 'FAILED'
  | 'CANCELLED';

export interface PostItem {
  id: string;
  workspaceId: string;
  campaignId?: string | null | undefined;
  productId?: string | null | undefined;
  socialAccountId?: string | null | undefined;
  status: PostStatusType;
  content: string;
  mediaUrls: string[];
  scheduledAt?: string | null | undefined;
  publishedAt?: string | null | undefined;
  providerPostId?: string | null | undefined;
  product?: { id: string; title: string; sku: string | null } | null | undefined;
  socialAccount?: { id: string; provider: string; displayName: string } | null | undefined;
  latestApproval?:
    | {
        id: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED';
        decisionNotes?: string | null | undefined;
        decidedAt: string;
      }
    | null
    | undefined;
  attemptsCount?: number | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface PostListResponse {
  items: PostItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PublishAttemptItem {
  id: string;
  postId: string;
  attemptNumber: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  providerRequestId?: string | null | undefined;
  errorCode?: string | null | undefined;
  errorMessage?: string | null | undefined;
  isTransient: boolean;
  attemptedAt: string;
}

export interface HealthCheckResponse {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    database: { status: 'up' | 'down'; latencyMs?: number | undefined };
    redis: { status: 'up' | 'down'; latencyMs?: number | undefined };
  };
}

export interface BillingPlanItem {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  billingInterval: 'month' | 'year';
  maxMonthlyPosts: number;
  maxMonthlyAiWords: number;
  maxSocialAccounts: number;
  maxTeamMembers: number;
  features: string[];
}

export interface SubscriptionItem {
  id: string;
  workspaceId: string;
  planId: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActionCard {
  id: string;
  level: 'info' | 'warning' | 'urgent';
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}

export interface WorkspaceAdminSummary {
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    locale: string;
    currency: string;
    createdAt: string;
  };
  plan: {
    planId: string;
    planName: string;
    status: string;
    currentPeriodEnd: string | null;
    limits: {
      maxPosts: number;
      currentPosts: number;
      maxSocialAccounts: number;
      currentSocialAccounts: number;
      maxTeamMembers: number;
      currentTeamMembers: number;
    };
  };
  counts: {
    teamMembers: number;
    pendingInvitations: number;
    activeProducts: number;
    connectedSocialAccounts: number;
    connectedStores: number;
    draftsAwaitingApproval: number;
    scheduledPosts: number;
    publishedPosts: number;
    failedPosts: number;
  };
  actionCards: ActionCard[];
  recentActivity: Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    createdAt: string;
    actor: { name: string; email: string } | null;
    metadata: unknown;
  }>;
}

export interface WorkspaceDataPrivacySummary {
  workspace: { id: string; name: string; slug: string; createdAt: string };
  data: { members: number; invitations: number; products: number; mediaAssets: number; posts: number; socialAccounts: number; stores: number };
  export: { personalExportEndpoint: string; workspaceExportStatus: 'NOT_CONFIGURED'; note: string };
  deletion: { status: 'REQUEST_ONLY'; note: string };
}

export interface ApprovalPolicy {
  id?: string;
  workspaceId: string;
  requiresApprovalBeforeSchedule: boolean;
  requiresApprovalBeforePublish: boolean;
  allowedApproverRoles: WorkspaceRole[];
  updatedByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface PaginatedAuditLogs {
  items: Array<{
    id: string;
    workspaceId: string;
    userId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress: string | null;
    metadata: unknown;
    createdAt: string;
    user?: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BillingUsageItem {
  plan: BillingPlanItem;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  metrics: {
    monthlyPosts: { used: number; limit: number; percentage: number };
    monthlyAiWords: { used: number; limit: number; percentage: number };
    socialAccounts: { used: number; limit: number; percentage: number };
    teamMembers: { used: number; limit: number; percentage: number };
  };
}

export interface BillingEventItem {
  id: string;
  workspaceId: string;
  providerPaymentId: string;
  amountCents: number;
  currency: string;
  eventType: string;
  metadata?: Record<string, unknown> | null | undefined;
  createdAt: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  orderId: string;
  keyId: string;
  planId: string;
  planName: string;
  amountCents: number;
  currency: string;
  checkoutUrl: string;
}

export interface StoreConnectionItem {
  id: string;
  workspaceId: string;
  platform: 'SHOPIFY' | 'WOOCOMMERCE' | 'CUSTOM';
  storeName: string;
  storeUrl: string;
  apiKeyMasked: string;
  apiVersion?: string | null | undefined;
  lastSyncAt?: string | null | undefined;
  syncStatus: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string | null | undefined;
  syncedProducts: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectStorePayload {
  platform: 'SHOPIFY' | 'WOOCOMMERCE' | 'CUSTOM';
  storeName: string;
  storeUrl: string;
  apiKey: string;
  apiSecret?: string | undefined;
  apiVersion?: string | undefined;
}

export interface SyncStoreResult {
  synced: number;
  status: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED';
  message?: string | undefined;
}

export interface CustomProductItem {
  sourceId: string;
  title: string;
  priceCents: number;
  currency?: string | undefined;
  sku?: string | undefined;
  inventoryCount?: number | undefined;
  description?: string | undefined;
  url?: string | undefined;
  images?: string[] | undefined;
  tags?: string[] | undefined;
  isActive?: boolean | undefined;
}

export interface CustomProductBatchPayload {
  products: CustomProductItem[];
  storeName?: string | undefined;
}

export interface CustomIngestResponse {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  failed: number;
  message: string;
}

export interface CustomValidationResponse {
  valid: boolean;
  normalizedCount: number;
  errors: string[];
  sample: Array<{
    sourceId: string;
    sku?: string | undefined;
    title: string;
    description?: string | undefined;
    priceCents: number;
    currency: string;
    inventoryCount: number;
    url?: string | undefined;
    images: string[];
    tags: string[];
  }>;
}

export interface CustomIngestHistoryItem {
  id: string;
  timestamp: string;
  storeName: string;
  total: number;
  created: number;
  updated: number;
  actor: { name: string; email: string } | null;
}

export interface OrderWebhookSimulationRequest {
  provider?: 'shopify' | 'custom' | 'woocommerce' | undefined;
  eventType?: string | undefined;
  payload: Record<string, unknown>;
  secret?: string | undefined;
  tamperSignature?: boolean | undefined;
}

export interface OrderWebhookSimulationResponse {
  success: boolean;
  httpStatus: number;
  provider: string;
  eventType: string;
  orderId: string;
  hmacSignature: string;
  hmacValid: boolean;
  idempotencyStatus: 'processed' | 'already_processed' | 'failed';
  orderTotalCents: number;
  currency: string;
  attribution: {
    campaignId?: string | undefined;
    campaignName?: string | undefined;
    source?: string | undefined;
  };
  error?: string | undefined;
  message: string;
}

export interface SocialRefreshExpiringResult {
  scanned: number;
  refreshed: number;
  failed: number;
  expired: number;
  results: Array<{
    id: string;
    displayName: string;
    provider: string;
    status: 'refreshed' | 'expired' | 'failed';
    error?: string | undefined;
  }>;
}

export interface CampaignItem {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  utmCampaign?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
  _count?:
    | {
        posts: number;
        trackedClicks: number;
        conversions?: number;
      }
    | undefined;
  metrics?: {
    clicks: number;
    conversions: number;
    revenueCents: number;
    conversionRate: number;
    averageOrderValueCents?: number;
  };
}

export interface TrackingLinkItem {
  id: string;
  workspaceId: string;
  campaignId?: string | null | undefined;
  shortCode: string;
  shortUrl: string;
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign?: string | null | undefined;
  utmContent?: string | null | undefined;
  utmTerm?: string | null | undefined;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
  campaign?: { id: string; name: string; utmCampaign?: string | null } | null | undefined;
}

export interface CreateTrackingLinkPayload {
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign?: string | undefined;
  utmContent?: string | undefined;
  utmTerm?: string | undefined;
  campaignId?: string | undefined;
}

export interface CreateCampaignPayload {
  name: string;
  description?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  utmCampaign?: string | undefined;
}

export interface SuperAdminProfile {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    isEmailVerified: boolean;
    createdAt: string;
  };
  role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminDashboardOverview {
  users: {
    total: number;
    active: number;
    suspended: number;
  };
  workspaces: {
    total: number;
    active: number;
    suspended: number;
  };
  content: {
    totalPosts: number;
    totalCampaigns: number;
    totalStoreConnections: number;
  };
  aiUsage: {
    totalRequests: number;
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    costEstimateMicrocents: number;
  };
  recentActivity: Array<{
    id: string;
    actorId: string;
    actorEmail: string;
    action: string;
    targetType: string;
    targetId?: string | null | undefined;
    reason?: string | null | undefined;
    outcome: string;
    createdAt: string;
    metadata?: Record<string, unknown> | null | undefined;
  }>;
}

export interface SuperAdminGrowthPoint {
  date: string;
  users: number;
  workspaces: number;
}

export interface SuperAdminHealth {
  database: {
    status: string;
    latencyMs: number;
  };
  integrations: {
    stores: {
      healthy: number;
      failing: number;
    };
    socialAccounts: {
      healthy: number;
      attentionRequired: number;
    };
  };
  timestamp: string;
}

export interface SuperAdminAuditLogsResponse {
  data: Array<{
    id: string;
    actorId: string;
    actorEmail: string;
    action: string;
    targetType: string;
    targetId?: string | null | undefined;
    reason?: string | null | undefined;
    outcome: string;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PlatformAdminItem {
  id: string;
  userId: string;
  role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  permissions: string[];
  createdBy?: string | null | undefined;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    isEmailVerified: boolean;
    createdAt: string;
  };
}

export interface SuperAdminUserItem {
  id: string;
  email: string;
  name: string;
  isEmailVerified: boolean;
  isSuspended: boolean;
  suspendedAt?: string | null | undefined;
  suspensionReason?: string | null | undefined;
  createdAt: string;
  updatedAt: string;
  platformAdmin?: {
    id: string;
    role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN';
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  } | null | undefined;
  workspaces: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    role: string;
  }>;
  totalSessions: number;
  activeSessionsCount: number;
  membershipsCount: number;
}

export interface SuperAdminUsersResponse {
  users: SuperAdminUserItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SuperAdminUserDetails {
  user: {
    id: string;
    email: string;
    name: string;
    isEmailVerified: boolean;
    isSuspended: boolean;
    suspendedAt?: string | null | undefined;
    suspensionReason?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
  };
  platformAdmin?: {
    id: string;
    role: string;
    status: string;
    permissions: string[];
  } | null | undefined;
  workspaces: Array<{
    membershipId: string;
    role: string;
    joinedAt: string;
    workspace: {
      id: string;
      name: string;
      slug: string;
      status: string;
      planTier: string;
      createdAt: string;
    };
  }>;
  sessions: Array<{
    id: string;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
    createdAt: string;
    expiresAt: string;
    revokedAt?: string | null | undefined;
    isValid: boolean;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorEmail: string;
    outcome: string;
    reason?: string | null | undefined;
    createdAt: string;
  }>;
}

export interface SuperAdminWorkspaceItem {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  locale: string;
  currency: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  suspendedAt?: string | null | undefined;
  suspensionReason?: string | null | undefined;
  planTier: string;
  customQuotas?: Record<string, unknown> | null | undefined;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null | undefined;
  stats: {
    totalMembers: number;
    totalStores: number;
    totalPosts: number;
    totalCampaigns: number;
  };
}

export interface SuperAdminWorkspacesResponse {
  workspaces: SuperAdminWorkspaceItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SuperAdminWorkspaceDetails {
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    locale: string;
    currency: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
    suspendedAt?: string | null | undefined;
    suspensionReason?: string | null | undefined;
    planTier: string;
    customQuotas?: Record<string, unknown> | null | undefined;
    createdAt: string;
    updatedAt: string;
  };
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      isSuspended: boolean;
      createdAt: string;
    };
  }>;
  stores: Array<{
    id: string;
    platform: string;
    storeName: string;
    storeUrl: string;
    syncStatus: string;
    syncedProducts: number;
    lastSyncAt?: string | null | undefined;
    createdAt: string;
  }>;
  stats: {
    totalMembers: number;
    totalStores: number;
    totalProducts: number;
    totalPosts: number;
    postsByStatus: {
      PUBLISHED: number;
      SCHEDULED: number;
      DRAFT: number;
    };
    totalCampaigns: number;
    ai: {
      totalRequests: number;
      totalTokens: number;
      estimatedCostMicrocents: number;
    };
  };
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorEmail: string;
    outcome: string;
    reason?: string | null | undefined;
    createdAt: string;
  }>;
}

export interface SuperAdminIntegrationsSummary {
  stores: {
    total: number;
    healthy: number;
    failing: number;
    syncing: number;
    platforms: {
      SHOPIFY: number;
      WOOCOMMERCE: number;
      CUSTOM: number;
    };
  };
  social: {
    total: number;
    active: number;
    expired: number;
    revoked: number;
    expiringSoon: number;
    providers: {
      META_INSTAGRAM: number;
      LINKEDIN: number;
    };
  };
  timestamp: string;
}

export interface SuperAdminStoreConnectionItem {
  id: string;
  workspaceId: string;
  platform: 'SHOPIFY' | 'WOOCOMMERCE' | 'CUSTOM';
  storeName: string;
  storeUrl: string;
  apiVersion?: string | null | undefined;
  lastSyncAt?: string | null | undefined;
  syncStatus: 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED';
  errorMessage?: string | null | undefined;
  syncedProducts: number;
  createdAt: string;
  updatedAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
    planTier: string;
  };
}

export interface SuperAdminIntegrationStoresResponse {
  stores: SuperAdminStoreConnectionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SuperAdminSocialAccountItem {
  id: string;
  workspaceId: string;
  provider: 'META_INSTAGRAM' | 'META_FACEBOOK' | 'TIKTOK' | 'PINTEREST' | 'YOUTUBE' | 'TWITTER' | 'LINKEDIN';
  providerAccountId: string;
  displayName: string;
  username?: string | null | undefined;
  tokenExpiresAt?: string | null | undefined;
  scopes: string[];
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DISCONNECTED';
  createdAt: string;
  updatedAt: string;
  daysUntilExpiration?: number | null | undefined;
  isExpiringSoon?: boolean | undefined;
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
    planTier: string;
  };
}

export interface SuperAdminIntegrationSocialResponse {
  accounts: SuperAdminSocialAccountItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SuperAdminBillingSummary {
  mrrCents: number;
  arrCents: number;
  totalRevenueCents: number;
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
  };
  planDistribution: Record<string, number>;
}

export interface SuperAdminSubscriptionItem {
  id: string;
  workspaceId: string;
  planId: string;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'UNPAID';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    planTier: string;
    status: string;
    _count: {
      memberships: number;
    };
  };
}

export interface SuperAdminSubscriptionsResponse {
  subscriptions: SuperAdminSubscriptionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SuperAdminAiSummary {
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostEstimateMicrocents: number;
  totalCostEstimateUsd: number;
  providerBreakdown: Record<
    string,
    {
      requests: number;
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      costMicrocents: number;
    }
  >;
  featureBreakdown: Record<
    string,
    {
      requests: number;
      totalTokens: number;
      costMicrocents: number;
    }
  >;
}

export interface SuperAdminAiUsageItem {
  id: string;
  workspaceId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costEstimateMicrocents: number;
  feature: string;
  createdAt: string;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  } | undefined;
}

export interface SuperAdminAiUsageResponse {
  usage: SuperAdminAiUsageItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SuperAdminTopAiTenant {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  planTier: string;
  totalTokens: number;
  costEstimateMicrocents: number;
  costEstimateUsd: number;
  requestCount: number;
}

export interface SuperAdminQueueItem {
  name: string;
  displayName: string;
  status: 'HEALTHY' | 'IDLE' | 'DEGRADED';
  waiting: number;
  active: number;
  failed: number;
  completed: number;
}

export interface SuperAdminJobFailureItem {
  id: string;
  type: 'POST_PUBLISH' | 'CATALOG_IMPORT';
  workspaceId: string;
  targetName: string;
  errorMessage: string;
  failedAt: string;
}

export interface SuperAdminJobsOverview {
  redisStatus: 'ONLINE' | 'OFFLINE';
  workerMode: 'BULLMQ_DISTRIBUTED' | 'DIRECT_MONGODB_POLLING';
  queues: SuperAdminQueueItem[];
  workload: {
    failedPosts: number;
    scheduledPosts: number;
    publishingPosts: number;
    pendingImports: number;
    failedImports: number;
  };
  recentFailures: SuperAdminJobFailureItem[];
}

export interface SuperAdminPlatformSetting {
  id: string;
  key: string;
  value: Record<string, unknown> | string | number | boolean;
  description?: string | null | undefined;
  isPublic: boolean;
  updatedBy?: string | null | undefined;
  version: number;
  updatedAt: string;
}

export interface SuperAdminAnnouncement {
  id: string;
  title: string;
  content: string;
  audience: string;
  isPublished: boolean;
  publishedAt?: string | null | undefined;
  expiresAt?: string | null | undefined;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SuperAdminEmailStatus {
  activeProvider: string;
  isConfigured: boolean;
  fromAddress: string;
  availableProviders: string[];
  outboxCount: number;
}

export interface SuperAdminEmailVerificationResult {
  ok: boolean;
  provider: string;
  message: string;
  latencyMs: number;
}

export interface SuperAdminEmailTestResult {
  id: string;
  provider: string;
  timestamp: string;
  latencyMs: number;
}

export interface GenerateUtmUrlPayload {
  baseUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign?: string | undefined;
  utmContent?: string | undefined;
  utmTerm?: string | undefined;
}

export interface GenerateUtmUrlResult {
  taggedUrl: string;
  utmParameters: Record<string, string>;
}

export interface TrackedClickItem {
  id: string;
  workspaceId: string;
  campaignId?: string | null | undefined;
  targetUrl: string;
  referrer?: string | null | undefined;
  country?: string | null | undefined;
  clickedAt: string;
  campaign?: { id: string; name: string; utmCampaign: string } | null | undefined;
}

export interface ConversionEventItem {
  id: string;
  workspaceId: string;
  orderId: string;
  orderTotalCents: number;
  currency: string;
  attributionSource?: string | null | undefined;
  occurredAt: string;
}

export interface AnalyticsOverview {
  periodDays: number;
  totalPosts: number;
  totalImpressions: number;
  totalClicks: number;
  totalEngagements: number;
  totalConversions: number;
  totalRevenueCents: number;
  clickThroughRate: number;
  conversionRate: number;
  averageOrderValueCents: number;
  growth: {
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  };
}

export interface DailyMetricPoint {
  date: string;
  impressions: number;
  clicks: number;
  engagements: number;
  conversions: number;
  revenueCents: number;
}

export interface BestTimeRecommendation {
  dayOfWeek: string;
  hourUtc: number;
  formattedTime: string;
  confidenceScore: number;
  reason: string;
}

export interface CampaignAnalyticsItem {
  id: string;
  name: string;
  utmCampaign: string | null;
  postsCount: number;
  clicks: number;
  conversions: number;
  revenueCents: number;
  conversionRate: number;
  averageOrderValueCents: number;
}

export interface ChannelAnalyticsItem {
  channel: string;
  clicks: number;
  conversions: number;
  revenueCents: number;
  conversionRate: number;
  sharePercentage: number;
}

export interface ProductAnalyticsItem {
  id: string;
  title: string;
  sku: string | null;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  clicks: number;
  conversions: number;
  revenueCents: number;
  conversionRate: number;
}

export interface RecentConversionItem {
  id: string;
  orderId: string;
  orderTotalCents: number;
  currency: string;
  campaignId: string | null;
  campaignName: string | null;
  attributionSource: string;
  targetUrl: string | null;
  occurredAt: string;
}

export function resolveApiBaseUrl(): string {
  if (process.env['NEXT_PUBLIC_API_URL']) {
    return process.env['NEXT_PUBLIC_API_URL'].replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:4000/api/v1`;
    }
    return `${window.location.origin}/api/v1`;
  }
  return 'http://localhost:4000/api/v1';
}

export const API_BASE_URL = resolveApiBaseUrl();

class ApiClient {
  private token: string | null = null;

  public getBaseUrl(): string {
    return resolveApiBaseUrl();
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('commercepilot_token', token);
      } else {
        localStorage.removeItem('commercepilot_token');
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('commercepilot_token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, {
        ...options,
        headers,
      });

      if (!res.ok) {
        if (res.status === 401) {
          this.setToken(null);
        }
        let errorMsg = `HTTP Error ${res.status}`;
        try {
          const errorJson = await res.json();
          errorMsg =
            errorJson?.error?.message || errorJson?.message || errorJson?.error || errorMsg;
        } catch {
          // Response was not JSON
        }
        throw new Error(errorMsg);
      }

      if (res.status === 204) {
        return {} as T;
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Network error or server unreachable', { cause: err });
    }
  }

  // --- Health Probes ---
  async getReadiness(): Promise<HealthCheckResponse> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    return this.request<HealthCheckResponse>(`${rootUrl}/ready`);
  }

  // --- Auth ---
  async getPublicAuthConfig(): Promise<{
    allowPublicRegistrations: boolean;
    maintenanceMode?: { enabled: boolean; message?: string };
  }> {
    try {
      return await this.request<{
        allowPublicRegistrations: boolean;
        maintenanceMode?: { enabled: boolean; message?: string };
      }>('/auth/config');
    } catch {
      return {
        allowPublicRegistrations: true,
        maintenanceMode: { enabled: false },
      };
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(res.sessionToken);
    return res;
  }

  async register(
    name: string,
    email: string,
    password: string,
    workspaceName?: string,
    invitationToken?: string,
  ): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        ...(workspaceName ? { workspaceName } : {}),
        ...(invitationToken ? { invitationToken } : {}),
      }),
    });
    this.setToken(res.sessionToken);
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // --- Workspaces ---
  async getWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>('/workspaces');
  }

  async createWorkspace(
    name: string,
    slug?: string | undefined,
  ): Promise<{ workspace: Workspace }> {
    return this.request<{ workspace: Workspace }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify({
        name,
        slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      }),
    });
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.request<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
  }

  async getWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    return this.request<WorkspaceInvitation[]>(`/workspaces/${workspaceId}/invitations`);
  }

  async inviteWorkspaceMember(
    workspaceId: string,
    email: string,
    role: Exclude<WorkspaceRole, 'OWNER'>,
  ): Promise<WorkspaceInvitation> {
    return this.request<WorkspaceInvitation>(`/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async createMemberDirectly(
    workspaceId: string,
    name: string,
    email: string,
    role: Exclude<WorkspaceRole, 'OWNER'>,
    department?: string,
  ): Promise<WorkspaceMember> {
    return this.request<WorkspaceMember>(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ name, email, role, department }),
    });
  }

  async updateWorkspaceMemberStatus(
    workspaceId: string,
    membershipId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    reason?: string,
  ): Promise<WorkspaceMember> {
    return this.request<WorkspaceMember>(`/workspaces/${workspaceId}/members/${membershipId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  async updateWorkspaceMemberRole(
    workspaceId: string,
    membershipId: string,
    role: Exclude<WorkspaceRole, 'OWNER'>,
  ): Promise<WorkspaceMember> {
    return this.request<WorkspaceMember>(`/workspaces/${workspaceId}/members/${membershipId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async removeWorkspaceMember(workspaceId: string, membershipId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/workspaces/${workspaceId}/members/${membershipId}`, {
      method: 'DELETE',
    });
  }

  async revokeWorkspaceInvitation(workspaceId: string, invitationId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/workspaces/${workspaceId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  }

  async resendWorkspaceInvitation(
    workspaceId: string,
    invitationId: string,
  ): Promise<{ success: boolean; id: string; expiresAt: string }> {
    return this.request<{ success: boolean; id: string; expiresAt: string }>(
      `/workspaces/${workspaceId}/invitations/${invitationId}/resend`,
      {
        method: 'POST',
      },
    );
  }

  async activateAccount(token: string, password: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/activate-account', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async resendVerification(email?: string): Promise<{
    message: string;
    isDevOutbox?: boolean;
    devVerificationUrl?: string;
  }> {
    return this.request<{
      message: string;
      isDevOutbox?: boolean;
      devVerificationUrl?: string;
    }>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resendActivation(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/resend-activation', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async getMe(): Promise<{ user: User; workspaces: Workspace[] }> {
    return this.request<{ user: User; workspaces: Workspace[] }>('/auth/me');
  }

  async updateWorkspaceSettings(
    workspaceId: string,
    data: { name?: string; timezone?: string; locale?: string; currency?: string; logoUrl?: string | null | undefined },
  ): Promise<{ id: string; name: string; slug: string; timezone: string; locale: string; currency: string; logoUrl?: string | null }> {
    return this.request<{ id: string; name: string; slug: string; timezone: string; locale: string; currency: string; logoUrl?: string | null }>(
      `/workspaces/${workspaceId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    );
  }

  async getWorkspaceAdminSummary(workspaceId: string): Promise<WorkspaceAdminSummary> {
    return this.request<WorkspaceAdminSummary>(`/workspaces/${workspaceId}/admin-summary`);
  }

  async getApprovalPolicy(workspaceId: string): Promise<ApprovalPolicy> {
    return this.request<ApprovalPolicy>(`/workspaces/${workspaceId}/approval-policy`);
  }

  async updateApprovalPolicy(
    workspaceId: string,
    data: {
      requiresApprovalBeforeSchedule?: boolean;
      requiresApprovalBeforePublish?: boolean;
      allowedApproverRoles?: WorkspaceRole[];
    },
  ): Promise<ApprovalPolicy> {
    return this.request<ApprovalPolicy>(`/workspaces/${workspaceId}/approval-policy`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getWorkspaceAuditLogs(
    workspaceId: string,
    params?: {
      page?: number | undefined;
      limit?: number | undefined;
      action?: string | undefined;
      resourceType?: string | undefined;
    },
  ): Promise<PaginatedAuditLogs> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.action) query.set('action', params.action);
    if (params?.resourceType) query.set('resourceType', params.resourceType);
    const qs = query.toString();
    return this.request<PaginatedAuditLogs>(
      `/workspaces/${workspaceId}/audit-logs${qs ? `?${qs}` : ''}`,
    );
  }

  async startOwnershipTransfer(workspaceId: string, membershipId: string): Promise<{ id: string; expiresAt: string }> {
    return this.request<{ id: string; expiresAt: string }>(`/workspaces/${workspaceId}/ownership-transfers`, {
      method: 'POST',
      body: JSON.stringify({ membershipId }),
    });
  }

  async acceptWorkspaceInvitation(token: string): Promise<{ workspaceId: string; role: WorkspaceRole }> {
    return this.request<{ workspaceId: string; role: WorkspaceRole }>(`/invitations/${encodeURIComponent(token)}/accept`, {
      method: 'POST',
    });
  }

  async acceptOwnershipTransfer(transferId: string): Promise<{ workspaceId: string; role: WorkspaceRole }> {
    return this.request<{ workspaceId: string; role: WorkspaceRole }>(
      `/ownership-transfers/${encodeURIComponent(transferId)}/accept`,
      { method: 'POST' },
    );
  }

  // --- Products & Catalog ---
  async getProducts(
    workspaceId: string,
    params?:
      | { search?: string | undefined; page?: number | undefined; limit?: number | undefined }
      | undefined,
  ): Promise<ProductListResponse> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return this.request<ProductListResponse>(
      `/workspaces/${workspaceId}/products${qs ? `?${qs}` : ''}`,
    );
  }

  async createProduct(
    workspaceId: string,
    data: {
      sku?: string | undefined;
      title: string;
      description?: string | undefined;
      priceCents: number;
      currency?: string | undefined;
      inventoryCount?: number | undefined;
      url?: string | undefined;
      images?: string[] | undefined;
      tags?: string[] | undefined;
    },
  ): Promise<ProductItem> {
    return this.request<ProductItem>(`/workspaces/${workspaceId}/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(
    workspaceId: string,
    productId: string,
    data: Partial<ProductItem>,
  ): Promise<ProductItem> {
    return this.request<ProductItem>(`/workspaces/${workspaceId}/products/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(
    workspaceId: string,
    productId: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>(
      `/workspaces/${workspaceId}/products/${productId}`,
      {
        method: 'DELETE',
      },
    );
  }

  async refreshProductFreshness(workspaceId: string, productId: string): Promise<ProductItem> {
    return this.request<ProductItem>(
      `/workspaces/${workspaceId}/products/${productId}/freshness`,
      {
        method: 'POST',
      },
    );
  }

  async importCsv(
    workspaceId: string,
    data: { fileName: string; csvContent: string; defaultCurrency?: string | undefined },
  ): Promise<CatalogImportRecord> {
    return this.request<CatalogImportRecord>(`/workspaces/${workspaceId}/products/import-csv`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getImportStatus(workspaceId: string, importId: string): Promise<CatalogImportRecord> {
    return this.request<CatalogImportRecord>(
      `/workspaces/${workspaceId}/products/imports/${importId}`,
    );
  }

  // --- AI Content & Brand Voice ---
  async generateContent(
    workspaceId: string,
    data: {
      productId: string;
      channel?: string | undefined;
      brandProfileId?: string | undefined;
      templateId?: string | undefined;
      customInstructions?: string | undefined;
      createDraftPost?: boolean | undefined;
    },
  ): Promise<GroundedMarketingDraft> {
    return this.request<GroundedMarketingDraft>(`/workspaces/${workspaceId}/content/generate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getQuotaUsage(workspaceId: string): Promise<QuotaStatus> {
    return this.request<QuotaStatus>(`/workspaces/${workspaceId}/content/usage`);
  }

  async getBrandProfiles(workspaceId: string): Promise<BrandProfileItem[]> {
    return this.request<BrandProfileItem[]>(`/workspaces/${workspaceId}/brand-profiles`);
  }

  async createBrandProfile(
    workspaceId: string,
    data: {
      name: string;
      toneOfVoice?: string | undefined;
      targetAudience?: string | undefined;
      prohibitedWords?: string[] | undefined;
      preferredHashtags?: string[] | undefined;
    },
  ): Promise<BrandProfileItem> {
    return this.request<BrandProfileItem>(`/workspaces/${workspaceId}/brand-profiles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTemplates(
    workspaceId: string,
    channel?: string | undefined,
  ): Promise<ContentTemplateItem[]> {
    const qs = channel ? `?channel=${encodeURIComponent(channel)}` : '';
    return this.request<ContentTemplateItem[]>(`/workspaces/${workspaceId}/templates${qs}`);
  }

  // --- Media Library ---
  async getMediaUploadUrl(
    workspaceId: string,
    data: { filename: string; mimeType: string; fileSizeBytes: number },
  ): Promise<PresignedUploadResponse> {
    return this.request<PresignedUploadResponse>(`/workspaces/${workspaceId}/media/upload-url`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async confirmMediaUpload(
    workspaceId: string,
    data: {
      storageKey: string;
      originalFilename: string;
      mimeType: string;
      fileSizeBytes: number;
      width?: number | undefined;
      height?: number | undefined;
    },
  ): Promise<MediaAssetItem> {
    return this.request<MediaAssetItem>(`/workspaces/${workspaceId}/media/confirm`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMediaAssets(workspaceId: string): Promise<MediaAssetItem[]> {
    return this.request<MediaAssetItem[]>(`/workspaces/${workspaceId}/media`);
  }

  async getWorkspaceDataPrivacySummary(workspaceId: string): Promise<WorkspaceDataPrivacySummary> {
    return this.request<WorkspaceDataPrivacySummary>(`/workspaces/${workspaceId}/data-privacy`);
  }

  async requestWorkspaceDeletionReview(workspaceId: string): Promise<{ accepted: boolean; status: string; message: string }> {
    return this.request(`/workspaces/${workspaceId}/data-privacy/deletion-request`, { method: 'POST' });
  }

  async exportMyData(): Promise<unknown> {
    return this.request('/auth/export-data');
  }

  async uploadLocalMediaAsset(workspaceId: string, file: File): Promise<MediaAssetItem> {
    const url = `${API_BASE_URL}/workspaces/${workspaceId}/media/upload`;
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      let errorMsg = `Upload failed with HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        errorMsg = errorJson?.error?.message || errorJson?.message || errorJson?.error || errorMsg;
      } catch {
        // Not JSON
      }
      throw new Error(errorMsg);
    }

    return (await res.json()) as MediaAssetItem;
  }

  resolveMediaUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    return `${rootUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  async deleteMediaAsset(
    workspaceId: string,
    assetId: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>(
      `/workspaces/${workspaceId}/media/${assetId}`,
      {
        method: 'DELETE',
      },
    );
  }

  // --- Social Accounts ---
  async getSocialAccounts(workspaceId: string): Promise<SocialAccountItem[]> {
    return this.request<SocialAccountItem[]>(`/workspaces/${workspaceId}/social-accounts`);
  }

  async connectSocialAccount(
    workspaceId: string,
    data: {
      provider: string;
      providerAccountId: string;
      displayName: string;
      username?: string | undefined;
      accessToken: string;
      scopes?: string[] | undefined;
    },
  ): Promise<SocialAccountItem> {
    return this.request<SocialAccountItem>(`/workspaces/${workspaceId}/social-accounts/connect`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async disconnectSocialAccount(
    workspaceId: string,
    accountId: string,
  ): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>(
      `/workspaces/${workspaceId}/social-accounts/${accountId}/disconnect`,
      {
        method: 'POST',
      },
    );
  }

  // --- LinkedIn OAuth Integration ---
  /**
   * Returns the backend OAuth connect URL for browser-side navigation.
   * Appends workspaceId and the session token so the server can
   * authenticate the user in the GET redirect without a JSON body.
   */
  getLinkedInConnectUrl(workspaceId: string, sessionToken: string): string {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const params = new URLSearchParams({
      workspaceId,
      token: sessionToken,
    });
    return `${rootUrl}/api/integrations/linkedin/connect?${params.toString()}`;
  }

  /**
   * Get safe status of connected LinkedIn integration (no tokens exposed).
   */
  async getLinkedInStatus(workspaceId: string): Promise<{
    connected: boolean;
    account: {
      id: string;
      displayName: string;
      username: string | null;
      providerAccountId: string;
      scopes: string[];
      status: string;
      tokenExpiresAt: string | null;
      createdAt: string;
      hasRefreshToken?: boolean;
    } | null;
    canPublish: boolean;
  }> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const token = this.getToken();
    const res = await fetch(
      `${rootUrl}/api/integrations/linkedin/status?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch LinkedIn status: HTTP ${res.status}`);
    }
    return (await res.json()) as {
      connected: boolean;
      account: {
        id: string;
        displayName: string;
        username: string | null;
        providerAccountId: string;
        scopes: string[];
        status: string;
        tokenExpiresAt: string | null;
        createdAt: string;
        hasRefreshToken?: boolean;
      } | null;
      canPublish: boolean;
    };
  }

  /**
   * Disconnect the LinkedIn integration for a workspace.
   */
  async disconnectLinkedIn(
    workspaceId: string,
    accountId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const token = this.getToken();
    const res = await fetch(`${rootUrl}/api/integrations/linkedin/disconnect`, {
      method: 'DELETE',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        ...(accountId ? { accountId } : {}),
      }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = (err as { message?: string }).message || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return (await res.json()) as { success: boolean; message: string };
  }

  /**
   * Publish a post to the connected LinkedIn personal profile.
   */
  async publishLinkedInPost(
    workspaceId: string,
    content: string,
    mediaUrls?: string[],
  ): Promise<{ success: boolean; postId: string; providerPostId: string }> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const token = this.getToken();
    const res = await fetch(`${rootUrl}/api/integrations/linkedin/posts`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        content,
        ...(mediaUrls ? { mediaUrls } : {}),
      }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = (err as { message?: string }).message || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return (await res.json()) as { success: boolean; postId: string; providerPostId: string };
  }

  /**
   * Refresh the LinkedIn access token for a workspace.
   */
  async refreshLinkedInToken(
    workspaceId: string,
    accountId?: string,
  ): Promise<{ success: boolean; accountId: string; tokenExpiresAt: string; message: string }> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const token = this.getToken();
    const res = await fetch(`${rootUrl}/api/integrations/linkedin/refresh`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        ...(accountId ? { accountId } : {}),
      }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = (err as { message?: string }).message || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return (await res.json()) as {
      success: boolean;
      accountId: string;
      tokenExpiresAt: string;
      message: string;
    };
  }

  // --- Instagram OAuth Integration ---

  /**
   * Returns the backend OAuth connect URL for browser-side navigation.
   * Appends workspaceId and session token so the server can authenticate
   * the user in the GET redirect without a JSON body.
   */
  getInstagramConnectUrl(workspaceId: string, sessionToken: string): string {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const params = new URLSearchParams({
      workspaceId,
      token: sessionToken,
    });
    return `${rootUrl}/api/integrations/instagram/connect?${params.toString()}`;
  }

  /**
   * Get safe status of connected Instagram integration (no tokens exposed).
   */
  async getInstagramStatus(workspaceId: string): Promise<{
    connected: boolean;
    account: {
      id: string;
      displayName: string;
      username: string | null;
      providerAccountId: string;
      scopes: string[];
      status: string;
      tokenExpiresAt: string | null;
      createdAt: string;
      hasRefreshToken?: boolean;
    } | null;
    canPublish: boolean;
  }> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const token = this.getToken();
    const res = await fetch(
      `${rootUrl}/api/integrations/instagram/status?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch Instagram status: HTTP ${res.status}`);
    }
    return (await res.json()) as {
      connected: boolean;
      account: {
        id: string;
        displayName: string;
        username: string | null;
        providerAccountId: string;
        scopes: string[];
        status: string;
        tokenExpiresAt: string | null;
        createdAt: string;
        hasRefreshToken?: boolean;
      } | null;
      canPublish: boolean;
    };
  }

  /**
   * Disconnect the Instagram integration for a workspace.
   */
  async disconnectInstagram(
    workspaceId: string,
    accountId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const token = this.getToken();
    const res = await fetch(`${rootUrl}/api/integrations/instagram/disconnect`, {
      method: 'DELETE',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        ...(accountId ? { accountId } : {}),
      }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = (err as { message?: string }).message || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return (await res.json()) as { success: boolean; message: string };
  }

  /**
   * Publish a post to the connected Instagram professional profile.
   */
  async publishInstagramPost(
    workspaceId: string,
    content: string,
    mediaUrls: string[],
  ): Promise<{ success: boolean; postId: string; providerPostId: string }> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const token = this.getToken();
    const res = await fetch(`${rootUrl}/api/integrations/instagram/posts`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        content,
        mediaUrls,
      }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = (err as { message?: string }).message || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return (await res.json()) as { success: boolean; postId: string; providerPostId: string };
  }

  /**
   * Refresh the Instagram access token for a workspace.
   */
  async refreshInstagramToken(
    workspaceId: string,
    accountId?: string,
  ): Promise<{ success: boolean; accountId: string; tokenExpiresAt: string; message: string }> {
    const rootUrl = API_BASE_URL.replace(/\/api\/v1$/, '');
    const token = this.getToken();
    const res = await fetch(`${rootUrl}/api/integrations/instagram/refresh`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspaceId,
        ...(accountId ? { accountId } : {}),
      }),
    });
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        msg = (err as { message?: string }).message || msg;
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    return (await res.json()) as {
      success: boolean;
      accountId: string;
      tokenExpiresAt: string;
      message: string;
    };
  }

  // --- Posts, Approvals, & Scheduling ---
  async getPosts(
    workspaceId: string,
    params?:
      | {
          status?: string | undefined;
          productId?: string | undefined;
          page?: number | undefined;
          limit?: number | undefined;
        }
      | undefined,
  ): Promise<PostListResponse> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.productId) query.set('productId', params.productId);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    const qs = query.toString();
    return this.request<PostListResponse>(`/workspaces/${workspaceId}/posts${qs ? `?${qs}` : ''}`);
  }

  async getPost(workspaceId: string, postId: string): Promise<PostItem> {
    return this.request<PostItem>(`/workspaces/${workspaceId}/posts/${postId}`);
  }

  async createPost(
    workspaceId: string,
    data: {
      content: string;
      mediaUrls?: string[] | undefined;
      productId?: string | undefined;
      campaignId?: string | undefined;
      socialAccountId?: string | undefined;
      scheduledAt?: string | undefined;
    },
  ): Promise<PostItem> {
    return this.request<PostItem>(`/workspaces/${workspaceId}/posts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePost(
    workspaceId: string,
    postId: string,
    data: {
      content?: string | undefined;
      mediaUrls?: string[] | undefined;
      productId?: string | undefined;
      campaignId?: string | undefined;
      socialAccountId?: string | undefined;
      scheduledAt?: string | undefined;
    },
  ): Promise<PostItem> {
    return this.request<PostItem>(`/workspaces/${workspaceId}/posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deletePost(workspaceId: string, postId: string): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>(
      `/workspaces/${workspaceId}/posts/${postId}`,
      {
        method: 'DELETE',
      },
    );
  }

  async requestPostApproval(workspaceId: string, postId: string): Promise<PostItem> {
    return this.request<PostItem>(`/workspaces/${workspaceId}/posts/${postId}/request-approval`, {
      method: 'POST',
    });
  }

  async approvePost(
    workspaceId: string,
    postId: string,
    decisionNotes?: string | undefined,
  ): Promise<PostItem> {
    return this.request<PostItem>(`/workspaces/${workspaceId}/posts/${postId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decisionNotes }),
    });
  }

  async rejectPost(
    workspaceId: string,
    postId: string,
    decisionNotes?: string | undefined,
  ): Promise<PostItem> {
    return this.request<PostItem>(`/workspaces/${workspaceId}/posts/${postId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ decisionNotes }),
    });
  }

  async schedulePost(workspaceId: string, postId: string, scheduledAt: string): Promise<PostItem> {
    return this.request<PostItem>(`/workspaces/${workspaceId}/posts/${postId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduledAt }),
    });
  }

  async publishPostNow(
    workspaceId: string,
    postId: string,
  ): Promise<{ post: PostItem; attempt: PublishAttemptItem }> {
    return this.request<{ post: PostItem; attempt: PublishAttemptItem }>(
      `/workspaces/${workspaceId}/posts/${postId}/publish-now`,
      {
        method: 'POST',
      },
    );
  }

  async cancelPost(workspaceId: string, postId: string): Promise<PostItem> {
    return this.request<PostItem>(`/workspaces/${workspaceId}/posts/${postId}/cancel`, {
      method: 'POST',
    });
  }

  async getPostAttempts(workspaceId: string, postId: string): Promise<PublishAttemptItem[]> {
    return this.request<PublishAttemptItem[]>(
      `/workspaces/${workspaceId}/posts/${postId}/attempts`,
    );
  }

  async getPublicBillingPlans(): Promise<BillingPlanItem[]> {
    return this.request<BillingPlanItem[]>('/billing/plans');
  }

  async getBillingPlans(workspaceId: string): Promise<BillingPlanItem[]> {
    return this.request<BillingPlanItem[]>(`/workspaces/${workspaceId}/billing/plans`);
  }

  async getBillingSubscription(workspaceId: string): Promise<SubscriptionItem> {
    return this.request<SubscriptionItem>(`/workspaces/${workspaceId}/billing/subscription`);
  }

  async getBillingUsage(workspaceId: string): Promise<BillingUsageItem> {
    return this.request<BillingUsageItem>(`/workspaces/${workspaceId}/billing/usage`);
  }

  async getBillingHistory(workspaceId: string): Promise<BillingEventItem[]> {
    return this.request<BillingEventItem[]>(`/workspaces/${workspaceId}/billing/history`);
  }

  async createBillingCheckout(workspaceId: string, planId: string): Promise<CheckoutSessionResult> {
    return this.request<CheckoutSessionResult>(`/workspaces/${workspaceId}/billing/checkout`, {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  }

  async activateBillingPlan(workspaceId: string, orderId: string): Promise<SubscriptionItem> {
    return this.request<SubscriptionItem>(`/workspaces/${workspaceId}/billing/activate`, {
      method: 'POST',
      body: JSON.stringify({ orderId }),
    });
  }

  async cancelBillingSubscription(
    workspaceId: string,
    reason?: string | undefined,
  ): Promise<SubscriptionItem> {
    return this.request<SubscriptionItem>(`/workspaces/${workspaceId}/billing/cancel`, {
      method: 'POST',
      body: JSON.stringify(reason !== undefined ? { reason } : {}),
    });
  }

  // Store Integrations
  async getCustomStoreCredentials(workspaceId: string): Promise<{
    success: boolean;
    storeId: string;
    storeName: string;
    apiKeyMasked: string;
    webhookSecretMasked: string;
    pushEndpoint: string;
    webhookEndpoint: string;
    syncedProducts: number;
    lastSyncAt: string | null;
  }> {
    return this.request(`/workspaces/${workspaceId}/integrations/custom/credentials`);
  }

  async rotateCustomStoreWebhookSecret(workspaceId: string): Promise<{
    success: boolean;
    webhookSecret: string;
    message: string;
  }> {
    return this.request(`/workspaces/${workspaceId}/integrations/custom/rotate-secret`, {
      method: 'POST',
    });
  }

  async getStoreConnections(workspaceId: string): Promise<StoreConnectionItem[]> {
    return this.request<StoreConnectionItem[]>(`/workspaces/${workspaceId}/integrations/stores`);
  }

  async authorizeShopify(
    workspaceId: string,
    shop: string,
  ): Promise<{ authUrl: string; shop: string }> {
    return this.request<{ authUrl: string; shop: string }>(
      `/workspaces/${workspaceId}/integrations/stores/shopify/authorize`,
      {
        method: 'POST',
        body: JSON.stringify({ shop }),
      },
    );
  }

  async connectStore(
    workspaceId: string,
    payload: ConnectStorePayload,
  ): Promise<StoreConnectionItem> {
    return this.request<StoreConnectionItem>(`/workspaces/${workspaceId}/integrations/stores`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async syncStore(workspaceId: string, connectionId: string): Promise<SyncStoreResult> {
    return this.request<SyncStoreResult>(
      `/workspaces/${workspaceId}/integrations/stores/${connectionId}/sync`,
      {
        method: 'POST',
      },
    );
  }

  async disconnectStore(workspaceId: string, connectionId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/workspaces/${workspaceId}/integrations/stores/${connectionId}`,
      {
        method: 'DELETE',
      },
    );
  }

  // --- Custom Store Ingestion & Developer Tools ---
  async ingestCustomProducts(
    workspaceId: string,
    data: CustomProductBatchPayload,
  ): Promise<CustomIngestResponse> {
    return this.request<CustomIngestResponse>(`/workspaces/${workspaceId}/integrations/custom/products`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async validateCustomPayload(
    workspaceId: string,
    payload: unknown,
  ): Promise<CustomValidationResponse> {
    return this.request<CustomValidationResponse>(`/workspaces/${workspaceId}/integrations/custom/validate`, {
      method: 'POST',
      body: JSON.stringify({ payload }),
    });
  }

  async getCustomIngestHistory(
    workspaceId: string,
  ): Promise<CustomIngestHistoryItem[]> {
    return this.request<CustomIngestHistoryItem[]>(`/workspaces/${workspaceId}/integrations/custom/history`);
  }

  async simulateOrderWebhook(
    workspaceId: string,
    data: OrderWebhookSimulationRequest,
  ): Promise<OrderWebhookSimulationResponse> {
    return this.request<OrderWebhookSimulationResponse>(
      `/workspaces/${workspaceId}/integrations/custom/simulate-order-webhook`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  }

  async refreshExpiringSocialTokens(
    workspaceId: string,
    days = 7,
  ): Promise<SocialRefreshExpiringResult> {
    return this.request<SocialRefreshExpiringResult>(
      `/workspaces/${workspaceId}/social-accounts/refresh-expiring?days=${days}`,
      { method: 'POST' },
    );
  }

  // Campaigns & UTM
  async getCampaigns(workspaceId: string): Promise<CampaignItem[]> {
    return this.request<CampaignItem[]>(`/workspaces/${workspaceId}/campaigns`);
  }

  async getCampaign(workspaceId: string, campaignId: string): Promise<CampaignItem> {
    return this.request<CampaignItem>(`/workspaces/${workspaceId}/campaigns/${campaignId}`);
  }

  async createCampaign(workspaceId: string, payload: CreateCampaignPayload): Promise<CampaignItem> {
    return this.request<CampaignItem>(`/workspaces/${workspaceId}/campaigns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateCampaign(
    workspaceId: string,
    campaignId: string,
    payload: Partial<CreateCampaignPayload>,
  ): Promise<CampaignItem> {
    return this.request<CampaignItem>(`/workspaces/${workspaceId}/campaigns/${campaignId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteCampaign(workspaceId: string, campaignId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/workspaces/${workspaceId}/campaigns/${campaignId}`,
      {
        method: 'DELETE',
      },
    );
  }

  async generateUtmUrl(
    workspaceId: string,
    payload: GenerateUtmUrlPayload,
  ): Promise<GenerateUtmUrlResult> {
    return this.request<GenerateUtmUrlResult>(`/workspaces/${workspaceId}/campaigns/generate-url`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Tracking & Links
  async createTrackingLink(
    workspaceId: string,
    payload: CreateTrackingLinkPayload,
  ): Promise<TrackingLinkItem> {
    return this.request<TrackingLinkItem>(`/workspaces/${workspaceId}/tracking/links`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getTrackingLinks(workspaceId: string, campaignId?: string): Promise<TrackingLinkItem[]> {
    const query = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
    return this.request<TrackingLinkItem[]>(`/workspaces/${workspaceId}/tracking/links${query}`);
  }

  // Tracking
  async recordClick(
    workspaceId: string,
    payload: {
      targetUrl: string;
      campaignId?: string | undefined;
      referrer?: string | undefined;
      country?: string | undefined;
    },
  ): Promise<TrackedClickItem> {
    return this.request<TrackedClickItem>(`/workspaces/${workspaceId}/tracking/clicks`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async recordConversion(
    workspaceId: string,
    payload: {
      orderId: string;
      orderTotalCents: number;
      currency?: string | undefined;
      attributionSource?: string | undefined;
    },
  ): Promise<ConversionEventItem> {
    return this.request<ConversionEventItem>(`/workspaces/${workspaceId}/tracking/conversions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getRecentClicks(workspaceId: string, limit?: number): Promise<TrackedClickItem[]> {
    const q = limit ? `?limit=${limit}` : '';
    return this.request<TrackedClickItem[]>(`/workspaces/${workspaceId}/tracking/clicks${q}`);
  }

  async getRecentConversions(workspaceId: string, limit?: number): Promise<ConversionEventItem[]> {
    const q = limit ? `?limit=${limit}` : '';
    return this.request<ConversionEventItem[]>(
      `/workspaces/${workspaceId}/tracking/conversions${q}`,
    );
  }

  // Analytics
  async getAnalyticsOverview(workspaceId: string, days?: number): Promise<AnalyticsOverview> {
    const q = days ? `?days=${days}` : '';
    return this.request<AnalyticsOverview>(`/workspaces/${workspaceId}/analytics/overview${q}`);
  }

  async getAnalyticsTimeseries(workspaceId: string, days?: number): Promise<DailyMetricPoint[]> {
    const q = days ? `?days=${days}` : '';
    return this.request<DailyMetricPoint[]>(`/workspaces/${workspaceId}/analytics/timeseries${q}`);
  }

  async getAnalyticsCampaigns(workspaceId: string, days?: number): Promise<CampaignAnalyticsItem[]> {
    const q = days ? `?days=${days}` : '';
    return this.request<CampaignAnalyticsItem[]>(`/workspaces/${workspaceId}/analytics/campaigns${q}`);
  }

  async getAnalyticsChannels(workspaceId: string, days?: number): Promise<ChannelAnalyticsItem[]> {
    const q = days ? `?days=${days}` : '';
    return this.request<ChannelAnalyticsItem[]>(`/workspaces/${workspaceId}/analytics/channels${q}`);
  }

  async getAnalyticsProducts(workspaceId: string, days?: number): Promise<ProductAnalyticsItem[]> {
    const q = days ? `?days=${days}` : '';
    return this.request<ProductAnalyticsItem[]>(`/workspaces/${workspaceId}/analytics/products${q}`);
  }

  async getAnalyticsRecentConversions(
    workspaceId: string,
    days?: number,
    limit?: number,
  ): Promise<RecentConversionItem[]> {
    const params = new URLSearchParams();
    if (days) params.set('days', String(days));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<RecentConversionItem[]>(
      `/workspaces/${workspaceId}/analytics/conversions${qs}`,
    );
  }

  async getAnalyticsBestTimes(workspaceId: string): Promise<BestTimeRecommendation[]> {
    return this.request<BestTimeRecommendation[]>(
      `/workspaces/${workspaceId}/analytics/best-times`,
    );
  }

  async exportAnalyticsReport(
    workspaceId: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<{
    data?: string | undefined;
    filename?: string | undefined;
    overview?: AnalyticsOverview | undefined;
  }> {
    return this.request<{
      data?: string | undefined;
      filename?: string | undefined;
      overview?: AnalyticsOverview | undefined;
    }>(`/workspaces/${workspaceId}/analytics/export`, {
      method: 'POST',
      body: JSON.stringify({ format }),
    });
  }

  // Super Admin
  async getSuperAdminProfile(): Promise<SuperAdminProfile> {
    return this.request<SuperAdminProfile>('/super-admin/me');
  }

  async getSuperAdminOverview(): Promise<SuperAdminDashboardOverview> {
    return this.request<SuperAdminDashboardOverview>('/super-admin/dashboard/overview');
  }

  async getSuperAdminGrowth(days: number = 30): Promise<SuperAdminGrowthPoint[]> {
    return this.request<SuperAdminGrowthPoint[]>(`/super-admin/dashboard/growth?days=${days}`);
  }

  async getSuperAdminHealth(): Promise<SuperAdminHealth> {
    return this.request<SuperAdminHealth>('/super-admin/dashboard/health');
  }

  async getSuperAdminAuditLogs(params?: {
    page?: number | undefined;
    limit?: number | undefined;
    action?: string | undefined;
    targetType?: string | undefined;
    actorEmail?: string | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
  }): Promise<SuperAdminAuditLogsResponse> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.action) q.set('action', params.action);
    if (params?.targetType) q.set('targetType', params.targetType);
    if (params?.actorEmail) q.set('actorEmail', params.actorEmail);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<SuperAdminAuditLogsResponse>(`/super-admin/audit-logs${qs}`);
  }

  async getSuperAdminList(): Promise<PlatformAdminItem[]> {
    return this.request<PlatformAdminItem[]>('/super-admin/admins');
  }

  async grantSuperAdmin(payload: {
    email: string;
    role: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN';
    permissions?: string[] | undefined;
    reason?: string | undefined;
  }): Promise<PlatformAdminItem> {
    return this.request<PlatformAdminItem>('/super-admin/admins', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateSuperAdmin(
    adminId: string,
    payload: {
      role?: 'SUPER_ADMIN' | 'SUPPORT_ADMIN' | 'BILLING_ADMIN' | undefined;
      status?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | undefined;
      permissions?: string[] | undefined;
      suspensionReason?: string | undefined;
    },
  ): Promise<PlatformAdminItem> {
    return this.request<PlatformAdminItem>(`/super-admin/admins/${adminId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getSuperAdminUsers(params?: {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    status?: string | undefined;
  }): Promise<SuperAdminUsersResponse> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<SuperAdminUsersResponse>(`/super-admin/users${qs}`);
  }

  async getSuperAdminUserDetails(userId: string): Promise<SuperAdminUserDetails> {
    return this.request<SuperAdminUserDetails>(`/super-admin/users/${userId}`);
  }

  async suspendSuperAdminUser(
    userId: string,
    reason: string,
  ): Promise<{ id: string; email: string; isSuspended: boolean }> {
    return this.request(`/super-admin/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async reactivateSuperAdminUser(
    userId: string,
  ): Promise<{ id: string; email: string; isSuspended: boolean }> {
    return this.request(`/super-admin/users/${userId}/reactivate`, {
      method: 'POST',
    });
  }

  async revokeSuperAdminUserSessions(userId: string): Promise<{ userId: string; revokedCount: number }> {
    return this.request(`/super-admin/users/${userId}/revoke-sessions`, {
      method: 'POST',
    });
  }

  async triggerSuperAdminUserPasswordReset(userId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/super-admin/users/${userId}/password-reset`, {
      method: 'POST',
    });
  }

  async getSuperAdminWorkspaces(params?: {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    status?: string | undefined;
    planTier?: string | undefined;
  }): Promise<SuperAdminWorkspacesResponse> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.planTier) q.set('planTier', params.planTier);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<SuperAdminWorkspacesResponse>(`/super-admin/workspaces${qs}`);
  }

  async getSuperAdminWorkspaceDetails(workspaceId: string): Promise<SuperAdminWorkspaceDetails> {
    return this.request<SuperAdminWorkspaceDetails>(`/super-admin/workspaces/${workspaceId}`);
  }

  async suspendSuperAdminWorkspace(
    workspaceId: string,
    reason: string,
  ): Promise<{ id: string; status: string }> {
    return this.request(`/super-admin/workspaces/${workspaceId}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async reactivateSuperAdminWorkspace(
    workspaceId: string,
  ): Promise<{ id: string; status: string }> {
    return this.request(`/super-admin/workspaces/${workspaceId}/reactivate`, {
      method: 'POST',
    });
  }

  async purgeSuperAdminWorkspace(
    workspaceId: string,
    confirmSlug: string,
    reason?: string,
  ): Promise<{ success: boolean; workspaceId: string; workspaceName: string; purgedAt: string }> {
    return this.request<{ success: boolean; workspaceId: string; workspaceName: string; purgedAt: string }>(
      `/super-admin/workspaces/${workspaceId}/purge`,
      {
        method: 'POST',
        body: JSON.stringify({ confirmSlug, reason }),
      },
    );
  }

  async updateSuperAdminWorkspaceLimits(
    workspaceId: string,
    payload: { planTier?: string | undefined; customQuotas?: Record<string, unknown> | undefined },
  ): Promise<{ id: string; planTier: string }> {
    return this.request(`/super-admin/workspaces/${workspaceId}/limits`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getSuperAdminIntegrationsSummary(): Promise<SuperAdminIntegrationsSummary> {
    return this.request<SuperAdminIntegrationsSummary>('/super-admin/integrations/summary');
  }

  async getSuperAdminIntegrationStores(params?: {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    platform?: string | undefined;
    syncStatus?: string | undefined;
  }): Promise<SuperAdminIntegrationStoresResponse> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.platform) q.set('platform', params.platform);
    if (params?.syncStatus) q.set('syncStatus', params.syncStatus);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<SuperAdminIntegrationStoresResponse>(`/super-admin/integrations/stores${qs}`);
  }

  async getSuperAdminIntegrationSocial(params?: {
    page?: number | undefined;
    limit?: number | undefined;
    search?: string | undefined;
    provider?: string | undefined;
    status?: string | undefined;
  }): Promise<SuperAdminIntegrationSocialResponse> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.search) q.set('search', params.search);
    if (params?.provider) q.set('provider', params.provider);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<SuperAdminIntegrationSocialResponse>(`/super-admin/integrations/social${qs}`);
  }

  async triggerSuperAdminStoreSync(storeId: string): Promise<{
    connectionId: string;
    storeName: string;
    platform: string;
    syncResult: Record<string, unknown>;
  }> {
    return this.request(`/super-admin/integrations/stores/${storeId}/sync`, {
      method: 'POST',
    });
  }

  async updateSuperAdminSocialStatus(
    accountId: string,
    status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DISCONNECTED',
    reason?: string | undefined,
  ): Promise<{ id: string; status: string }> {
    return this.request(`/super-admin/integrations/social/${accountId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  }

  // --- SUPER ADMIN BILLING & SUBSCRIPTIONS ---

  async getSuperAdminBillingSummary(): Promise<SuperAdminBillingSummary> {
    return this.request<SuperAdminBillingSummary>('/super-admin/billing/summary');
  }

  async getSuperAdminSubscriptions(params?: {
    page?: number | undefined;
    limit?: number | undefined;
    status?: string | undefined;
    planId?: string | undefined;
    search?: string | undefined;
  }): Promise<SuperAdminSubscriptionsResponse> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.status) q.set('status', params.status);
    if (params?.planId) q.set('planId', params.planId);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<SuperAdminSubscriptionsResponse>(`/super-admin/billing/subscriptions${qs}`);
  }

  async cancelSuperAdminSubscription(
    id: string,
    payload: { reason: string; immediate?: boolean | undefined },
  ): Promise<SuperAdminSubscriptionItem> {
    return this.request<SuperAdminSubscriptionItem>(`/super-admin/billing/subscriptions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSuperAdminPlans(): Promise<BillingPlanItem[]> {
    return this.request<BillingPlanItem[]>('/super-admin/billing/plans');
  }

  async createSuperAdminPlan(payload: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    currency?: string;
    billingInterval?: 'month' | 'year';
    maxMonthlyPosts: number;
    maxMonthlyAiWords: number;
    maxSocialAccounts: number;
    maxTeamMembers: number;
    features: string[];
    isActive?: boolean;
  }): Promise<BillingPlanItem> {
    return this.request<BillingPlanItem>('/super-admin/billing/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateSuperAdminPlan(
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      priceCents: number;
      currency: string;
      billingInterval: 'month' | 'year';
      maxMonthlyPosts: number;
      maxMonthlyAiWords: number;
      maxSocialAccounts: number;
      maxTeamMembers: number;
      features: string[];
      isActive: boolean;
    }>,
  ): Promise<BillingPlanItem> {
    return this.request<BillingPlanItem>(`/super-admin/billing/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteSuperAdminPlan(id: string): Promise<{ success: boolean; deletedPlanId: string }> {
    return this.request<{ success: boolean; deletedPlanId: string }>(`/super-admin/billing/plans/${id}`, {
      method: 'DELETE',
    });
  }

  // --- SUPER ADMIN AI & TOKENS ---

  async getSuperAdminAiSummary(): Promise<SuperAdminAiSummary> {
    return this.request<SuperAdminAiSummary>('/super-admin/ai/summary');
  }

  async getSuperAdminAiUsage(params?: {
    page?: number | undefined;
    limit?: number | undefined;
    provider?: string | undefined;
    model?: string | undefined;
    workspaceId?: string | undefined;
    feature?: string | undefined;
  }): Promise<SuperAdminAiUsageResponse> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.provider) q.set('provider', params.provider);
    if (params?.model) q.set('model', params.model);
    if (params?.workspaceId) q.set('workspaceId', params.workspaceId);
    if (params?.feature) q.set('feature', params.feature);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return this.request<SuperAdminAiUsageResponse>(`/super-admin/ai/usage${qs}`);
  }

  async getSuperAdminTopAiTenants(): Promise<SuperAdminTopAiTenant[]> {
    return this.request<SuperAdminTopAiTenant[]>('/super-admin/ai/top-tenants');
  }

  // --- SUPER ADMIN BACKGROUND JOBS ---

  async getSuperAdminJobsOverview(): Promise<SuperAdminJobsOverview> {
    return this.request<SuperAdminJobsOverview>('/super-admin/jobs/overview');
  }

  async retrySuperAdminFailedJobs(): Promise<{ retriedPosts: number; retriedImports: number }> {
    return this.request<{ retriedPosts: number; retriedImports: number }>('/super-admin/jobs/retry-failed', {
      method: 'POST',
    });
  }

  // --- SUPER ADMIN PLATFORM SETTINGS & ANNOUNCEMENTS ---

  async getSuperAdminPlatformSettings(): Promise<SuperAdminPlatformSetting[]> {
    return this.request<SuperAdminPlatformSetting[]>('/super-admin/settings');
  }

  async updateSuperAdminPlatformSetting(
    key: string,
    payload: { value: unknown; description?: string | undefined; isPublic?: boolean | undefined },
  ): Promise<SuperAdminPlatformSetting> {
    return this.request<SuperAdminPlatformSetting>(`/super-admin/settings/${key}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getSuperAdminAnnouncements(): Promise<SuperAdminAnnouncement[]> {
    return this.request<SuperAdminAnnouncement[]>('/super-admin/announcements');
  }

  async createSuperAdminAnnouncement(payload: {
    title: string;
    content: string;
    audience?: string | undefined;
    isPublished?: boolean | undefined;
    expiresAt?: string | undefined;
  }): Promise<SuperAdminAnnouncement> {
    return this.request<SuperAdminAnnouncement>('/super-admin/announcements', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateSuperAdminAnnouncement(
    id: string,
    payload: {
      title?: string | undefined;
      content?: string | undefined;
      audience?: string | undefined;
      isPublished?: boolean | undefined;
      expiresAt?: string | undefined;
    },
  ): Promise<SuperAdminAnnouncement> {
    return this.request<SuperAdminAnnouncement>(`/super-admin/announcements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async deleteSuperAdminAnnouncement(id: string): Promise<{ success: boolean; id: string }> {
    return this.request<{ success: boolean; id: string }>(`/super-admin/announcements/${id}`, {
      method: 'DELETE',
    });
  }

  // --- SUPER ADMIN EMAIL MANAGEMENT & DIAGNOSTICS ---

  async getSuperAdminEmailStatus(): Promise<SuperAdminEmailStatus> {
    return this.request<SuperAdminEmailStatus>('/super-admin/email/status');
  }

  async verifySuperAdminEmailConnection(
    provider?: string,
  ): Promise<SuperAdminEmailVerificationResult> {
    return this.request<SuperAdminEmailVerificationResult>('/super-admin/email/verify', {
      method: 'POST',
      body: JSON.stringify({ provider }),
    });
  }

  async sendSuperAdminTestEmail(
    to: string,
    provider?: string,
  ): Promise<SuperAdminEmailTestResult> {
    return this.request<SuperAdminEmailTestResult>('/super-admin/email/test', {
      method: 'POST',
      body: JSON.stringify({ to, provider }),
    });
  }
  async deleteWorkspace(
    workspaceId: string,
    confirmSlug: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/workspaces/${workspaceId}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmSlug }),
    });
  }
}

export const api = new ApiClient();
