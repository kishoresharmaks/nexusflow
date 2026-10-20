export interface User {
  id: string;
  email: string;
  name: string;
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
}

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface WorkspaceMember {
  membershipId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user: { id: string; name: string; email: string; isEmailVerified: boolean };
}

export interface WorkspaceInvitation {
  id: string;
  emailNormalized: string;
  role: WorkspaceRole;
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
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
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
      }
    | undefined;
}

export interface CreateCampaignPayload {
  name: string;
  description?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  utmCampaign?: string | undefined;
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

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

class ApiClient {
  private token: string | null = null;

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
  ): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        ...(workspaceName ? { workspaceName } : {}),
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
    return this.request<WorkspaceInvitation>(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async updateWorkspaceMemberRole(
    workspaceId: string,
    membershipId: string,
    role: Exclude<WorkspaceRole, 'OWNER'>,
  ): Promise<WorkspaceMember> {
    return this.request<WorkspaceMember>(`/workspaces/${workspaceId}/members/${membershipId}`, {
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
      `/workspaces/${workspaceId}/products/${productId}/refresh-freshness`,
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

  async activateBillingPlan(workspaceId: string, planId: string): Promise<SubscriptionItem> {
    return this.request<SubscriptionItem>(`/workspaces/${workspaceId}/billing/activate`, {
      method: 'POST',
      body: JSON.stringify({ planId }),
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
  async getStoreConnections(workspaceId: string): Promise<StoreConnectionItem[]> {
    return this.request<StoreConnectionItem[]>(`/workspaces/${workspaceId}/integrations/stores`);
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

  // Campaigns & UTM
  async getCampaigns(workspaceId: string): Promise<CampaignItem[]> {
    return this.request<CampaignItem[]>(`/workspaces/${workspaceId}/campaigns`);
  }

  async createCampaign(workspaceId: string, payload: CreateCampaignPayload): Promise<CampaignItem> {
    return this.request<CampaignItem>(`/workspaces/${workspaceId}/campaigns`, {
      method: 'POST',
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
}

export const api = new ApiClient();
