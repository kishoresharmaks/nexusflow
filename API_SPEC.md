# API Specification — CommercePilot

**Base prefix:** `/api/v1`  
**Style:** REST/JSON  
**Status:** Proposed contract; update as implementation decisions are validated.

## 1. General conventions

- Use HTTPS outside local development.
- Validate all request bodies, query parameters, IDs, and provider callbacks.
- Keep request/response DTOs separate from Prisma models.
- Use a consistent error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "requestId": "req_example",
    "details": []
  }
}
```

- Never expose stack traces, credentials, raw tokens, internal database errors, or unsafe provider payloads.
- Use pagination for collection endpoints (`limit`, `cursor` or a documented page model).
- Use UTC ISO-8601 timestamps in API payloads; include workspace timezone where scheduling needs local-time interpretation.
- Add idempotency keys for operations where duplicate requests could create duplicate jobs, charges, or publish actions.
- Authentication and authorization must be enforced by the backend.

## 2. Proposed endpoint groups

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/refresh` (only if refresh-token/session design requires it)
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /auth/verify-email`

### Workspaces and members

- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:workspaceId`
- `PATCH /workspaces/:workspaceId`
- `GET /workspaces/:workspaceId/members`
- `POST /workspaces/:workspaceId/invitations`
- `PATCH /workspaces/:workspaceId/members/:membershipId`

### Catalog and media

- `GET /products`
- `POST /products`
- `GET /products/:productId`
- `PATCH /products/:productId`
- `DELETE /products/:productId`
- `POST /products/imports`
- `GET /products/imports/:importId`
- `GET /media/upload-url` or a documented multipart upload flow

### Social accounts

- `GET /social-accounts`
- `POST /social-accounts/:provider/connect`
- `GET /social-accounts/:provider/callback`
- `POST /social-accounts/:accountId/reconnect`
- `DELETE /social-accounts/:accountId`

#### LinkedIn OAuth 2.0 Direct Endpoints (OpenID Connect + REST Posts)
- `GET /api/integrations/linkedin/connect` (Initiates signed state redirect to LinkedIn authorization portal)
- `GET /api/integrations/linkedin/callback` (Validates HMAC state, exchanges code for access & refresh tokens, upserts account)
- `GET /api/integrations/linkedin/status` (Safe display status with expiration checks and publishing capability)
- `POST /api/integrations/linkedin/refresh` (Refreshes access token using stored encrypted refresh token)
- `DELETE /api/integrations/linkedin/disconnect` (Deactivates credentials and disconnects integration)
- `POST /api/integrations/linkedin/posts` (Publishes post content directly to member profile feed)

#### Instagram OAuth 2.0 Direct Endpoints (Meta Graph API + Container Model)
- `GET /api/integrations/instagram/connect` (Initiates signed state redirect to Meta OAuth authorization portal)
- `GET /api/integrations/instagram/callback` (Validates HMAC state, exchanges code, upgrades to 60-day token, discovers IG Business Account, upserts account)
- `GET /api/integrations/instagram/status` (Safe display status with expiration checks and publishing capability)
- `POST /api/integrations/instagram/refresh` (Refreshes 60-day token using fb_exchange_token)
- `DELETE /api/integrations/instagram/disconnect` (Deactivates credentials and disconnects integration)
- `POST /api/integrations/instagram/posts` (Publishes photo/video feed post via 2-step Meta container creation & publishing handshake)

OAuth callbacks and state handling must follow the provider's current official flow. Do not place access tokens in URLs or frontend-visible responses.

### AI and content

- `POST /content/generate`
- `POST /content/images`
- `GET /content/generations/:generationId`
- `GET /templates`
- `POST /templates`
- `PATCH /templates/:templateId`

### Posts, approval, scheduling

- `GET /posts`
- `POST /posts`
- `GET /posts/:postId`
- `PATCH /posts/:postId`
- `POST /posts/:postId/request-approval`
- `POST /posts/:postId/approve`
- `POST /posts/:postId/reject`
- `POST /posts/:postId/schedule`
- `POST /posts/:postId/cancel`
- `GET /posts/:postId/attempts`

### Analytics, reports, and attribution

- `GET /analytics/overview`
- `GET /analytics/posts`
- `POST /reports`
- `GET /reports/:reportId`
- `POST /tracked-links`
- `GET /tracked-links/:linkId/summary`

### Billing and usage

- `GET /billing/subscription`
- `POST /billing/checkout`
- `POST /billing/cancel`
- `GET /billing/usage`
- `POST /billing/credits/checkout` (if credit top-ups are enabled)

### Webhooks and health

- `POST /webhooks/razorpay`
- `POST /webhooks/social/:provider`
- `POST /webhooks/stores/:provider`
- `GET /health`
- `GET /ready`

## 3. Post state machine

Allowed states:
`DRAFT`, `AWAITING_APPROVAL`, `APPROVED`, `SCHEDULED`, `PUBLISHING`, `PUBLISHED`, `FAILED`, `CANCELLED`.

State transitions must be explicit and validated server-side. For example, an approval-required post cannot transition from `AWAITING_APPROVAL` to `PUBLISHING` without approval. Failed posts may be retried only when error classification and provider state permit it.

## 4. Authorization rules

- Workspace resources require workspace membership.
- Only permitted roles may invite members, change billing, approve, publish, or disconnect accounts.
- Linked products, accounts, campaigns, media, and posts must belong to the same workspace.
- Webhooks use provider signature verification rather than browser sessions.
- Plan entitlements are checked server-side.

## 5. API contract tests

Every endpoint group needs tests for valid requests, invalid input, missing authentication, insufficient role, cross-tenant resource IDs, rate limiting, duplicate submissions, and safe error responses.
