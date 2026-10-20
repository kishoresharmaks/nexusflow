# Implementation Plan

This is a dependency-aware plan, not a fixed delivery-date promise. Third-party app reviews and account eligibility may affect sequencing.

## Phase 0 — Repository and engineering foundations

- [x] Initialize pnpm workspace and root scripts.
- [x] Add strict TypeScript, linting, formatting, environment validation, and CI.
- [x] Create `apps/web`, `apps/api`, `apps/worker`, and `packages/database`.
- [x] Pin Node.js, Next.js, NestJS, Prisma, MongoDB driver/provider versions.
- [x] Verify current Prisma MongoDB connector support and schema workflow.
- [x] Configure local/test MongoDB and Redis.
- [x] Configure structured logging, request IDs, and health/readiness endpoints.
- [x] Add `.env.example` and ensure real `.env` is ignored.

**Exit gate:** clean install, typecheck, lint, tests, Prisma client generation, and build pass in a fresh environment.

## Phase 1 — Identity and workspace security

- [x] Implement registration, verification, login, logout, password recovery, and session revocation.
- [x] Implement workspace creation and switching.
- [x] Implement memberships and role policies.
- [x] Add audit events for sensitive actions.
- [x] Add cross-tenant authorization tests.

**Exit gate:** unauthorized users cannot access any workspace resource, including via guessed IDs.

## Phase 2 — Catalog

- [x] Implement product CRUD and search/pagination.
- [x] Implement CSV upload, mapping, validation, import status, and row error report.
- [x] Store product source and freshness timestamps.
- [x] Add tests for malformed rows, duplicates, invalid prices, and tenant boundaries.

**Exit gate:** a user can import a valid CSV, correct errors, and use products in a draft.

## Phase 3 — AI content and media

- [x] Implement provider-agnostic AI text adapter.
- [x] Implement brand profiles and content templates.
- [x] Generate editable captions/hashtags/CTAs grounded in product facts.
- [x] Add usage ledger, quotas, rate limits, cost metadata, and error handling.
- [x] Add image-generation adapter behind feature flag and quota controls.
- [ ] Implement private media storage and signed upload/download flow (Prototype only; real AWS S3 SDK presigner & HeadObject verification unbuilt).
- [x] Test generated output validation and missing/stale product data warnings.

**Exit gate:** drafts are saved, editable, and never published automatically by default. (Partial: content generation verified; S3 SDK signing pending).

## Phase 4 — Composer, approval, scheduling, and publishing

- [x] Implement channel-aware composer and preview.
- [x] Implement approval policies and decision history.
- [x] Implement post state machine and calendar.
- [ ] Persist schedule intent before enqueueing BullMQ jobs (Incomplete: DB state saved, BullMQ delayed job enqueuing pending).
- [ ] Implement provider adapter interface and Meta adapter after permission validation (Incomplete: Meta OAuth 2.0 unbuilt; manual token entry prototype).
- [ ] Add attempt history, bounded retry, permanent/transient error classification, and reconciliation (Incomplete: worker fabricates mockPostId; real adapter dispatch and ambiguous reconciliation pending).
- [ ] Test worker restart, duplicate jobs, ambiguous provider timeout, expired token, and rate limits.

**Exit gate:** scheduled work survives worker restart; ambiguous results do not cause blind duplicate retries. (Open: real worker dispatch and BullMQ queueing unbuilt).

## Phase 5 — Billing and paid beta

- [x] Confirm merchant/provider eligibility and payment product capabilities.
- [x] Implement configurable plans and entitlements.
- [ ] Implement checkout and signature-verified idempotent webhooks (Incomplete: simulated checkout URL; real Razorpay order creation and mandatory HMAC signature verification unbuilt).
- [x] Add usage dashboard, cancellation, failed-payment handling, and credit ledger if credits are enabled.
- [x] Add support diagnostics and billing reconciliation.
- [ ] Run pricing and unit-economics experiments.

**Exit gate:** quotas are server-enforced and billing state is reconciled from trusted provider events. (Open: real payment gateway integration unbuilt).

## Phase 6 — Growth features

- [x] Shopify/WooCommerce integration and catalog sync (Store Adapters, AES-256 tokens, background sync, and `/integrations` UI hub).
- [x] UTM links and click analytics (Campaigns, RFC 3986 generator, click & order conversion attribution, `/campaigns` UI hub).
- [ ] Additional supported social channels one at a time (Adapters exist, but real OAuth and worker dispatch are unbuilt).
- [ ] Analytics dashboards, scheduled reports, and best-time recommendations (Incomplete: first-party UTM tracking built; provider social reach sync and metric honest non-estimation pending).
- [ ] Inbox/comments only for providers and permissions that support required actions.
- [ ] Agency workspaces and competitor insights after legal/platform review.

**Exit gate:** automated catalog synchronization, RFC 3986 link tracking, conversion attribution, multi-platform publishing, and interactive performance dashboards verified end-to-end. (Open: real social publishing and real provider insights unbuilt).

## Release checklist

- [ ] Security review and dependency scan.
- [ ] Backup restore test.
- [ ] Queue recovery and publishing failure drill.
- [ ] Privacy, terms, retention, and deletion behavior documented.
- [ ] Provider permissions and supported media formats documented.
- [ ] No production secrets in repository.
- [ ] Monitoring, alerts, rollback, and support runbooks ready.
