# CommercePilot Compliance, Privacy Policy & Terms of Service

**Effective Date:** 20 October 2026  
**Version:** 1.0.0  

---

## 1. Privacy Policy & Data Processing Inventory

CommercePilot operates as a data processor for ecommerce merchants and brand owners, and a data controller for merchant user accounts.

### 1.1 Data Collected and Purpose

| Category | Specific Elements | Purpose | Retention Period |
|----------|-------------------|---------|------------------|
| **Account Data** | Email, Name, Argon2id hashed password | Authentication & workspace membership | Account lifetime + 30 days grace period upon deletion |
| **Workspace Data** | Workspace name, members, audit logs | Tenant management & audit compliance | 365 days for immutable audit logs |
| **Catalog Data** | Product title, SKU, price, stock, description | Grounding AI marketing copy | Retained until catalog deletion or store disconnect |
| **Media Assets** | Images (JPEG/PNG/WebP), Videos (MP4/MOV) | Marketing publishing attachments | Deleted immediately from S3 upon asset deletion |
| **Social Tokens** | Access tokens, Refresh tokens | Social channel publishing | Encrypted at rest (AES-256-GCM); deleted on disconnect |
| **Billing Records** | Subscription ID, customer ID, order IDs | Subscription entitlement enforcement | 7 years for tax and statutory accounting |

### 1.2 User Privacy Rights (GDPR / CCPA)
1. **Right to Access / Export Data:**
   - Available via `GET /api/v1/auth/export-data` returning complete user account profile, owned workspaces, products, posts, and audit activity.
2. **Right to Erasure (Account Deletion):**
   - Available via `DELETE /api/v1/auth/account`. Requires password verification.
   - Deletes user records, cascades cleanup of owned single-member workspaces, invalidates sessions, and removes stored tokens.

---

## 2. Terms of Service & AI Content Disclosure

### 2.1 Grounded AI Content Terms & Disclaimer
1. **Human-in-the-Loop Requirement:**
   - All marketing copy generated via the AI Content Studio is provided strictly as **editable draft content**.
   - CommercePilot does NOT automatically publish AI-generated copy to external social channels without human review, authorization, and approval.
2. **Catalog Grounding:**
   - AI prompts are strictly grounded in merchant catalog facts (product title, SKU, verified pricing, current stock).
   - Stale catalog warning notices are emitted whenever product data is older than 48 hours.
3. **Accuracy Disclaimer:**
   - The merchant remains solely responsible for the factual accuracy, legal compliance, and regulatory adherence of all copy published to connected social networks.

### 2.2 Truth-in-Engineering & Anti-Simulation Contract
- CommercePilot never fabricates metrics, engagement, or social impressions.
- Analytics counters display only genuine events recorded via verified provider webhooks or first-party redirect attribution links.

---

## 3. Provider Capability & Eligibility Matrix

| Provider | Supported Account Types | Required Scopes | Media Specifications |
|----------|-------------------------|-----------------|----------------------|
| **Meta Instagram** | Professional Accounts (Business or Creator linked to Facebook Page) | `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights` | Photos: JPEG, PNG (< 8MB, aspect ratio 4:5 to 1.91:1)<br>Videos: MP4, MOV (< 100MB, max 60s for feed) |
| **Meta Facebook** | Facebook Business Pages | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` | Photos: JPEG, PNG, WebP (< 50MB)<br>Videos: MP4 (< 50MB)<br>Link posts |
