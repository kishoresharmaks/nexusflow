# AGENTS.md — CommercePilot Coding Agent Instructions

## Mission

Build CommercePilot, a secure AI-powered commerce marketing SaaS for ecommerce sellers, brands, and agencies. The product workflow is: product catalog → grounded AI content → human review/approval → schedule/publish → engagement/analytics → click/conversion attribution where supported.

## Read before coding

Read `README.md`, `SRS.md`, `FEATURES.md`, `FRONTEND_TECH_STACK.md`, `BACKEND_TECH_STACK.md`, `UI_DESIGN_SYSTEM.md`, `DATABASE_MONGODB_PRISMA.md`, `DATABASE_SCHEMA.md`, `API_SPEC.md`, `SECURITY.md`, `INTEGRATIONS.md`, `TESTING.md`, and `IMPLEMENTATION_PLAN.md` as relevant. If documents conflict, do not guess: identify the conflict and propose a resolution. Security, user consent, official provider rules, and data integrity take precedence.

## Required stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, Lucide React.
- Backend: NestJS + TypeScript, REST under `/api/v1`.
- Database: MongoDB + Prisma ORM. Do not substitute SQL or another ORM without explicit approval.
- Jobs: Redis + BullMQ; run a separately deployable worker.
- Media: private S3-compatible object storage.
- Forms: React Hook Form + Zod; server-side DTO validation.
- Tables/charts: TanStack Table and Recharts where appropriate.
- Tests: frontend unit/component/E2E and backend unit/integration/contract tests.

## Architecture

- Use a pnpm monorepo with `apps/web`, `apps/api`, `apps/worker`, and `packages/database`.
- Start with a modular monolith API; do not create microservices prematurely.
- Frontend never accesses MongoDB/Prisma directly.
- Keep controllers thin; business rules belong in services/use cases.
- Keep provider-specific behavior behind adapters.
- MongoDB is the source of truth for scheduled posts and business state; Redis/BullMQ is the execution mechanism.
- Validate Prisma/MongoDB connector behavior for the pinned version and actual topology; do not assume SQL-style migration semantics.

## Product rules

- Product facts, prices, offers, and stock must be grounded in catalog/store data.
- Generated AI output is editable draft content and is not auto-published by default.
- Show freshness warnings when product data may be stale.
- A post is published only after provider success is confirmed and persisted.
- Never blindly retry an ambiguous publish outcome if it may create duplicates.
- Never promise a social capability without confirming current official API support, account eligibility, permissions, and review.
- Exact pricing and quotas remain configurable until validated.

## Security requirements

- Enforce authentication, workspace membership, role permissions, and resource ownership on every protected API request.
- Never trust client-supplied workspace IDs as authorization.
- Encrypt social tokens at rest; never expose them to the browser or logs.
- Verify OAuth state/redirects and webhook signatures.
- Process webhooks idempotently.
- Validate every external input and model output.
- Keep secrets out of Git and frontend `NEXT_PUBLIC_*` variables.
- Use secure sessions, rate limits, audit logs, and safe error responses.

## Code quality

- TypeScript strict mode; avoid `any`.
- Validate at trust boundaries; do not pass raw request objects into Prisma writes.
- Add tests for behavior and failure cases.
- Implement loading, empty, error, success, and recovery states in UI.
- Use accessible shadcn/ui components and consistent design tokens.
- Do not use fake production metrics or hard-coded provider results.
- Run formatting, lint, typecheck, tests, Prisma schema validation/client generation, and build before declaring completion.

## Agent workflow

1. Inspect the repository and current state before edits.
2. Choose a small vertical slice with explicit acceptance criteria.
3. Identify assumptions and provider dependencies.
4. Implement backend authorization/data flow before wiring the UI to it.
5. Add tests and run checks.
6. Summarize files changed, commands run, test results, known gaps, and next steps.
7. Do not claim tests or provider integration succeeded unless actually verified.

## Definition of done

A feature is done only when its behavior, authorization, tenant isolation, validation, errors/recovery, tests, documentation, observability, and usage limits (where relevant) are implemented. External integrations must use official APIs and verified permissions.

## Strict Truth-in-Engineering & Anti-Simulation Contract (MANDATORY ON EVERY PROMPT)

1. **Anti-Simulation Rule**: NEVER write fake business logic or simulate success in production code paths (e.g. generating `mockPostId`, appending `?signed=true` without S3 SDK, calculating synthetic impressions like `clicks * 25`). If a provider integration is not yet wired to real SDKs/credentials, the service MUST return `501 Not Implemented` or an explicit unconfigured status.
2. **Real Definition of Done**: Never mark a checklist item `[x]` in `IMPLEMENTATION_PLAN.md` or claim a feature is "completed" or "production-ready" based merely on a passing mock unit test. It is only done when official provider SDKs, real cryptographic signing, real background queue jobs, and real error classification are fully implemented. If it is only a prototype, explicitly label it: `[ ] Incomplete (Prototype only; real provider integration pending)`.
3. **Zero Secret Leakage**: Never write or retain real database URIs, API keys, or tokens in `.env.example`, markdown documentation, or code. `.env.example` must contain ONLY non-functional dummy placeholders.
4. **Mandatory Reality Audit on Every Prompt**: Every response must clearly state:
   - What was genuinely built and verified.
   - What relies on external provider credentials.
   - What remains unbuilt or incomplete.
     NEVER gloss over missing or simulated work.
