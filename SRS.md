# CommercePilot Software Requirements Specification

## Purpose and scope

CommercePilot helps ecommerce sellers and marketing teams create catalog-aware social content, review and approve posts, schedule/publish through official APIs, manage supported comments, and measure performance and attribution where data is available.

## Users

- Solo seller
- Brand/team member
- Workspace owner/admin
- Approver
- Analyst
- Agency operator

## Functional requirements

1. Authentication, workspace management, membership and roles.
2. Product CRUD, CSV import, validation and freshness metadata.
3. AI-assisted captions, hashtags, CTAs, regional-language drafts, brand voice and templates.
4. AI image creatives with review and usage metering.
5. Composer, channel previews, approval, calendar, scheduling and publishing queue.
6. Social account OAuth, scope tracking, reconnect/disconnect.
7. Analytics and best-time recommendations when data is sufficient.
8. Inbox/comments only where official API permissions support it.
9. UTM/click/conversion attribution where data and consent permit.
10. Reports/exports, billing, quotas, notifications, audit, and observability.
11. Competitor insights from permitted data sources only.

## Non-functional requirements

- Stack: Next.js/TypeScript, Tailwind/shadcn/ui, NestJS, MongoDB + Prisma, Redis/BullMQ.
- Secure sessions, tenant isolation, encrypted social tokens, verified webhooks, rate limits and redacted logs.
- Durable scheduling, bounded retries, reconciliation, backup/restore.
- Accessible responsive UI targeting WCAG 2.2 AA.
- Provider adapters, strict TypeScript, automated tests, documented API contracts.
- Privacy-aware data retention, deletion, consent, and provider compliance.

## Constraints

Provider app review, scopes, eligible account types, quotas, supported media, and current terms govern available features. Exact pricing/quotas remain undecided. Validate Prisma's MongoDB connector and deployment requirements before production.

## Acceptance

A launch candidate must demonstrate workspace isolation, CSV import, editable AI drafts, supported social account connection, reliable post state transitions and recovery, server-enforced quotas, idempotent verified billing webhooks, monitoring, tested backups, and passing CI gates.
