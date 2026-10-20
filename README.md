# CommercePilot

CommercePilot is an AI-powered commerce marketing platform for ecommerce sellers, brands, and agencies. It connects product catalog data to social content creation, approval, scheduling, publishing, engagement, and measurable campaign outcomes.

## Current documentation set

- `AGENTS.md` — instructions for AI coding agents.
- `SRS.md` — software requirements specification.
- `FEATURES.md` — feature catalog, monetization, integrations, roadmap, and acceptance criteria.
- `FRONTEND_TECH_STACK.md` — frontend stack and implementation conventions.
- `BACKEND_TECH_STACK.md` — backend architecture and API conventions.
- `DATABASE_MONGODB_PRISMA.md` — MongoDB + Prisma setup and database-specific constraints.
- `UI_DESIGN_SYSTEM.md` — visual design system and component guidelines.
- `PROJECT_STRUCTURE.md` — proposed monorepo layout and module ownership.
- `DATABASE_SCHEMA.md` — domain models, ownership, indexes, and schema workflow.
- `API_SPEC.md` — proposed REST API contract.
- `SECURITY.md` — security and privacy requirements.
- `IMPLEMENTATION_PLAN.md` — phased implementation checklist.
- `TESTING.md` — testing strategy and CI gates.
- `ENVIRONMENT.md` — local setup and environment variables.
- `INTEGRATIONS.md` — third-party integrations and provider constraints.
- `DEPLOYMENT.md` — deployment, monitoring, backups, and rollback.
- `PUBLISHING_STATE_MACHINE.md` — publishing state transitions and recovery.
- `OBSERVABILITY.md` — logs, metrics, alerts, and incident response.
- `CONTRIBUTING.md` — contribution and review workflow.
- `.env.example` — safe placeholder environment variables.
- `.gitignore` — common generated files and secrets exclusions.

## Required stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, Lucide React.
- Backend: NestJS + TypeScript, REST API.
- Database: MongoDB + Prisma ORM.
- Jobs: Redis + BullMQ.
- Media: private S3-compatible storage.
- Billing: Razorpay integration subject to merchant eligibility and current provider capabilities.
- Social publishing: official APIs, beginning with eligible Meta accounts.

## Recommended first implementation slice

1. Initialize the monorepo and strict TypeScript configuration.
2. Validate pinned Prisma/MongoDB compatibility and configure a disposable local/test database.
3. Implement backend-owned authentication and workspace isolation.
4. Implement product CRUD and CSV import.
5. Implement AI-assisted caption drafting with editable, persisted drafts.
6. Add social OAuth and publishing only after permissions and app configuration are verified.

## Quickstart & Local Development

### Prerequisites

- Node.js `>= 22.0.0`
- pnpm `>= 10.0.0`
- MongoDB deployment (Atlas or local replica set)
- Redis (optional for worker and queue readiness)

### Setup

```bash
# 1. Clone & install dependencies
pnpm install

# 2. Setup environment variables (never commit .env)
cp .env.example .env

# 3. Validate Prisma schema & generate client
pnpm db:validate
pnpm db:generate
```

### Quality & Verification Commands

```bash
# Format check
pnpm format:check

# Format code
pnpm format

# Lint all workspaces
pnpm lint

# Typecheck all workspaces
pnpm typecheck

# Run all unit tests
pnpm test

# Build all applications and packages
pnpm build
```

### Starting Applications

```bash
# Start all services concurrently (Web, API, Worker)
pnpm dev

# Or start services individually:
pnpm dev:web     # Next.js web application (http://localhost:3000)
pnpm dev:api     # NestJS HTTP API (http://localhost:4000)
pnpm dev:worker  # BullMQ background worker (standby mode in Phase 0)
```

### Service Health & Documentation

- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API Swagger Docs**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)
- **Liveness Probe**: [http://localhost:4000/health](http://localhost:4000/health) or `/api/v1/health`
- **Readiness Probe**: [http://localhost:4000/ready](http://localhost:4000/ready) or `/api/v1/ready`

## Important

This documentation describes a planned product, not a guarantee of third-party API access. Verify provider capabilities, permissions, pricing, and current documentation before implementation. Do not commit real secrets. Exact subscription prices and quotas remain undecided until validated.
