# Testing Strategy

## 1. Test layers

### Unit tests

Test pure functions and services: validation, authorization policies, entitlement calculations, state transitions, provider error classification, retry policy, attribution calculations, and usage ledger behavior.

### Component tests

Use React Testing Library for forms, dialogs, data tables, loading/empty/error states, accessible interactions, and permission-aware UI.

### API integration tests

Run against disposable MongoDB and Redis test instances. Test controllers, services, persistence, tenant isolation, webhook handling, and queue handoff.

### Contract tests

Verify frontend API assumptions and provider adapters against documented contracts. Mock provider APIs in normal CI; do not publish to real accounts.

### End-to-end tests

Cover:

1. Register/login and create workspace.
2. Import product CSV and inspect row errors.
3. Generate and edit caption draft.
4. Request and complete approval.
5. Schedule, cancel, and inspect post state.
6. Reconnect an expired/revoked social account.
7. Complete test-mode checkout and process duplicate webhooks.
8. Enforce usage limits.

## 2. Critical reliability scenarios

- Worker restarts while a post is due.
- Duplicate BullMQ job delivery.
- Provider timeout after a request may have succeeded.
- Invalid/expired token and missing permissions.
- Provider rate limit and transient 5xx.
- Permanent media validation failure.
- Duplicate/out-of-order payment webhook.
- Duplicate CSV rows and partial import failure.
- Concurrent edits to a post.
- Workspace ID substitution/cross-tenant resource access.
- AI provider timeout, malformed output, and budget exhaustion.

## 3. Security tests

- Missing/invalid/expired sessions.
- Role escalation attempts.
- Cross-tenant reads and writes.
- Malformed ObjectIds and unexpected DTO fields.
- OAuth state mismatch and redirect URI abuse.
- Invalid webhook signatures.
- Secret leakage in errors/logs.
- Upload type/size violations and unauthorized signed URL access.
- Rate-limit behavior on auth and expensive endpoints.

## 4. Quality gates

Before merge:

- Format check
- Lint
- Typecheck
- Unit tests
- Integration tests
- Prisma schema validation and client generation
- Production build
- Relevant E2E tests

Before production:

- Backup/restore verification
- Migration/schema rollout rehearsal
- Queue recovery drill
- Provider error/reconnect drill
- Billing webhook replay test
- Security review and dependency scan

## 5. Test data

Use synthetic products, fake tokens, mock provider responses, and test payment credentials. Never put real social credentials, customer data, or production payment secrets in fixtures or CI logs.
