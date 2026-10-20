# Project Structure & Module Ownership

## 1. Architecture

Use a **pnpm monorepo with a modular monolith API and a separately deployable worker**. Do not start with microservices.

```text
commercepilot/
├── apps/
│   ├── web/                 # Next.js frontend
│   ├── api/                 # NestJS HTTP API
│   └── worker/              # BullMQ workers and recovery jobs
├── packages/
│   ├── database/            # Prisma schema/client/repositories
│   ├── contracts/           # Stable shared API contracts, where useful
│   ├── config/              # Shared lint/TypeScript configuration
│   └── providers/           # Provider interfaces/adapters, if shared safely
├── docs/                    # Optional future generated/reference docs
├── AGENTS.md
├── README.md
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
└── .gitignore
```

## 2. Frontend module ownership

`apps/web/src/`:

```text
app/
  (marketing)/
  (auth)/
  (dashboard)/
    overview/
    products/
    content-studio/
    calendar/
    publishing/
    analytics/
    social-accounts/
    inbox/
    billing/
    settings/
components/
  ui/                         # shadcn/ui source components
  layout/
  feedback/
  data-display/
features/
  auth/
  workspaces/
  catalog/
  content/
  campaigns/
  calendar/
  publishing/
  analytics/
  billing/
lib/
  api/
  auth/
  config/
  format/
  schemas/
hooks/
styles/
```

Use Server Components by default. Add client components only when interactivity, browser APIs, or client-side state requires them. Keep business logic out of presentational components.

## 3. Backend module ownership

`apps/api/src/`:

```text
auth/
users/
workspaces/
memberships/
catalog/
media/
social-accounts/
content-generation/
campaigns/
posts/
approvals/
publishing/
analytics/
billing/
notifications/
webhooks/
audit/
health/
common/
```

Each module owns its controller, use cases/services, DTOs, authorization checks, and tests. Controllers should be thin. Keep provider-specific code in adapters rather than scattering it through business modules.

## 4. Worker ownership

`apps/worker/src/`:

```text
queues/
  catalog-import/
  content-generation/
  post-publishing/
  post-reconciliation/
  analytics-sync/
  reports/
  notifications/
health/
```

Workers must be idempotent where possible, validate job payloads, record attempts, use bounded retries, and report metrics. MongoDB remains the source of truth for scheduled intent; Redis/BullMQ is the execution mechanism.

## 5. Naming conventions

- Files: kebab-case, e.g. `create-post.dto.ts`.
- Classes/types: PascalCase.
- Variables/functions: camelCase.
- Environment variables: uppercase snake case.
- API route prefix: `/api/v1`.
- Domain states: explicit string enums/unions and documented transitions.
- Avoid `any`; validate external input at boundaries.
- Keep secrets and provider tokens out of shared contracts and frontend bundles.

## 6. Dependency rules

- `web` calls the API; it must not access Prisma or MongoDB directly.
- `api` owns authorization and durable business state.
- `worker` uses shared business logic/repositories but is a separate process.
- `database` package owns Prisma schema and client generation.
- Provider adapters implement internal interfaces and cannot bypass domain validation.
- Shared contracts must not import server-only code into the browser bundle.
