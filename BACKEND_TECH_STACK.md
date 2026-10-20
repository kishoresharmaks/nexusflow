# Backend Technology Stack

## Approved stack

- Supported Node.js LTS and NestJS + TypeScript.
- REST API under `/api/v1`.
- MongoDB + Prisma ORM.
- Redis + BullMQ for asynchronous jobs and scheduling.
- Backend-owned authentication/session service with Argon2id password hashing.
- DTO validation using a consistent NestJS validation approach.
- OpenAPI/Swagger for API documentation.
- Structured redacted logging, request IDs, health/readiness checks.
- S3-compatible private media storage.
- Provider adapters for social, AI, email, analytics, and payments.
- Unit/integration/contract tests with a single consistent test runner per backend workspace.

## Architecture

Use a modular monolith API and separate worker process. Controllers are thin; services/use cases own business rules. Provider-specific behavior stays in adapters. Persist durable intent before queueing work.

## Required modules

Auth, Users, Workspaces, Memberships, Catalog, Media, Social Accounts, Content Generation, Campaigns, Posts, Approvals, Publishing, Analytics, Billing, Notifications, Webhooks, Audit, Health.

## Reliability

- MongoDB is source of truth; BullMQ executes jobs.
- Validate every job payload.
- Use bounded retries with exponential backoff/jitter.
- Classify transient vs permanent errors.
- Reconcile ambiguous publishing outcomes before retrying where possible.
- Persist attempt records and provider request IDs.
- Use per-provider rate limits and timeouts.
- Reconcile overdue scheduled posts after worker restarts.

## Security

- Enforce tenant ownership and roles on every protected request.
- Encrypt OAuth tokens at rest and never return them to the frontend.
- Verify webhook signatures and deduplicate events.
- Use DTO allowlists; never pass raw request objects directly to Prisma.
- Apply rate limits to auth, AI, imports, and costly endpoints.
- Keep secrets in a secret manager; redact logs.
