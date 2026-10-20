# CommercePilot — Product Features & Monetization

## Product vision

CommercePilot is an AI-powered commerce marketing platform: import products → generate grounded content → review/approve → schedule/publish → engage → measure performance and conversions where data is available.

## Target customers

- Solo sellers and small ecommerce businesses.
- Growing brands managing multiple accounts.
- Agencies and social media managers with multiple clients.

## Feature priorities

### P0 — Launch-critical

- Authentication, workspaces, memberships, roles, audit events.
- Product catalog CRUD and CSV import with row-level validation.
- Product freshness timestamps and stale price/stock warnings.
- AI captions, hashtags, CTAs, selected regional-language drafts, brand voice, templates.
- AI image generation behind cost/quality controls.
- Composer, channel preview, approval, visual calendar, durable scheduling and publishing queue.
- Meta account integration for eligible Facebook Pages and Instagram professional accounts, subject to API access.
- Basic analytics where provider metrics are available.
- Billing, usage limits, email notifications, observability, security, backups.

### P1 — Growth

- Shopify/WooCommerce catalog and inventory sync.
- UTM links, click tracking, and conversion events where supported.
- Automated reports and exports.
- Best-time-to-post recommendations based on data availability.
- Unified inbox/comments for permitted provider endpoints.
- YouTube, Pinterest, LinkedIn integrations after capability review.
- WhatsApp Business Platform workflows compliant with opt-in and messaging policies.

### P2 — Advanced

- Competitor monitoring using permitted public data.
- Advanced attribution and campaign experiments.
- Agency workspaces, client approvals, granular roles, and white-label reporting if validated.
- Additional workflow automation and channel expansion.

## Monetization

Chosen model: **freemium + subscription tiers + optional AI credits**. Exact pricing is intentionally undecided and should be validated through customer interviews, cost modeling, competitor review, and paid beta experiments.

Potential revenue drivers:

- Connected account and scheduled-post quotas.
- Higher AI text and image usage.
- Team seats and approvals.
- Store synchronization.
- Advanced analytics, exports, attribution, and agency workspaces.
- Optional extra AI image credits.

Do not offer unlimited variable-cost AI usage before unit economics are understood. Meter usage server-side and maintain an auditable credit ledger.

## Draft entitlement matrix

| Capability            | Free                  | Starter               | Growth            | Agency               |
| --------------------- | --------------------- | --------------------- | ----------------- | -------------------- |
| Social accounts       | Low limit             | Higher                | Higher            | Highest              |
| Scheduled posts       | Small quota           | Standard              | High              | High                 |
| Catalog               | Basic/CSV             | Larger                | Sync options      | Multi-client         |
| AI text               | Small allowance       | Monthly quota         | Higher quota      | Shared/team quota    |
| AI images             | Trial/small allowance | Optional allowance    | Higher allowance  | Pooled allowance     |
| Brand voice/templates | Basic                 | Multiple              | Team-shared       | Client-specific      |
| Approval              | Basic                 | Limited collaborators | Team approvals    | Client approvals     |
| Analytics             | Basic                 | Standard              | Advanced          | Client reports       |
| Inbox/comments        | Not guaranteed        | Supported subset      | Team workflows    | Multi-client         |
| Attribution           | UTM basics            | Click reports         | Store conversions | Multi-client reports |
| Competitor insights   | Excluded              | Excluded              | Limited beta      | Advanced beta        |

All limits must be configurable and reflect real provider capabilities/costs. These are packaging categories, not approved limits or prices.

## Third-party services

- Meta Graph API: P0 publishing and eligible insights/comments; permissions and app review may constrain access.
- AI text provider: P0 caption generation and regional-language drafts.
- AI image provider: P0 gated by cost and quality checks.
- S3-compatible storage: P0 private media.
- Redis + BullMQ: P0 jobs and scheduling.
- Razorpay: P0 payment integration subject to merchant/account eligibility.
- Transactional email: P0 verification and notifications.
- Shopify/WooCommerce: P1 catalog and permitted conversion sync.
- YouTube/Pinterest/LinkedIn: P1, subject to API access and eligibility.
- WhatsApp Business Platform: P1, with opt-in, template, and pricing rules.
- Analytics connector: P1, subject to consent and data availability.
- Observability service: P0 logs, metrics, errors, and alerts.

Use official APIs only. Do not bypass restrictions or promise unsupported media, inbox, analytics, or competitor data.

## Acceptance criteria

- Users can create workspaces, import catalog data, and generate/edit/save drafts.
- Workspace isolation and role permissions are tested.
- Social account connection uses official OAuth and granted scopes.
- Post states, approvals, scheduling, retries, and reconciliation are reliable.
- Published status is only recorded after confirmed provider success.
- Billing webhooks are signature-verified and idempotent.
- Plan entitlements are enforced server-side.
- Metrics show source and freshness; missing data is not fabricated.
- Security, backup restore, monitoring, and release gates pass.

## Success metrics

Track activation (workspace/catalog/account/first draft/first publish), retention, posts per active workspace, publish success, queue age, AI cost per workspace, free-to-paid conversion, paid churn, gross margin, clicks/conversions where supported, and support load. Set numeric targets after beta baselines instead of presenting unvalidated targets as facts.
