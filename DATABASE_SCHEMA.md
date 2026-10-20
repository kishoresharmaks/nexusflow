# Database Schema Plan — MongoDB + Prisma

## 1. Principles

MongoDB is the primary database; Prisma ORM is required for typed data access. This document is a domain schema plan, not a substitute for validating the actual `schema.prisma` against the pinned Prisma version and MongoDB topology.

Prisma's MongoDB connector differs from relational connectors. Verify supported relation patterns, indexes, transactions/replica-set requirements, and the current schema-change workflow before production. Do not assume SQL-style Prisma Migrate behavior.

## 2. Core models/collections

| Model             | Key purpose                                     | Tenant ownership   |
| ----------------- | ----------------------------------------------- | ------------------ |
| User              | Identity and account status                     | User-level         |
| Session           | Hashed session token, expiry, revocation        | User-level         |
| Workspace         | Tenant, timezone, locale, preferences           | Root tenant        |
| Membership        | User role in a workspace                        | Workspace          |
| Product           | Catalog item and freshness metadata             | Workspace          |
| CatalogImport     | CSV upload, mapping, row outcomes               | Workspace          |
| MediaAsset        | Private media metadata and ownership            | Workspace          |
| SocialAccount     | Provider identity, scopes, encrypted tokens     | Workspace          |
| BrandProfile      | Voice, audience, language, prohibited claims    | Workspace          |
| ContentTemplate   | Reusable generation template                    | Workspace          |
| Campaign          | Goal, dates, product set, UTM settings          | Workspace          |
| Post              | Draft, approval, schedule and publish state     | Workspace          |
| Approval          | Reviewer decisions and comments                 | Workspace          |
| PublishAttempt    | Provider attempt and failure history            | Workspace          |
| WebhookEvent      | Idempotent provider event receipt               | Workspace/provider |
| Subscription      | Plan, status, billing cycle                     | Workspace          |
| BillingEvent      | Verified payment event history                  | Workspace          |
| UsageLedger       | Credit grants, usage, refunds, expiry           | Workspace          |
| AiUsage           | Model, usage, cost and request metadata         | Workspace          |
| AnalyticsSnapshot | Aggregated metrics and sync cursor              | Workspace          |
| TrackedClick      | Campaign link clicks with privacy controls      | Workspace          |
| ConversionEvent   | Store conversion event and attribution metadata | Workspace          |
| Notification      | User-facing alert state                         | Workspace/user     |
| AuditEvent        | Sensitive action history                        | Workspace          |

## 3. Common field conventions

For MongoDB ObjectIds, use the Prisma MongoDB pattern appropriate to the pinned connector, commonly `String @id @default(auto()) @map("_id") @db.ObjectId`. References must use consistent ObjectId typing.

Common fields for workspace-owned documents:

- `id`
- `workspaceId`
- `createdAt`
- `updatedAt`
- Optional `deletedAt` only where soft deletion has defined semantics.

Persist timestamps in UTC. Display and interpret scheduled times in the workspace timezone. Store money in integer minor units or another exact representation; never use floating-point for money.

## 4. Index candidates

Validate actual query plans and connector support before finalizing:

- `User.email` unique.
- `Workspace.slug` unique.
- `Membership(userId, workspaceId)` unique.
- `Product(workspaceId, isActive, updatedAt)`.
- `SocialAccount(workspaceId, provider, providerAccountId)` unique.
- `Post(workspaceId, status, scheduledAt)`.
- `PublishAttempt(postId, attemptNumber)` unique.
- `WebhookEvent(provider, providerEventId)` unique.
- `Subscription(workspaceId, status)`.
- `UsageLedger(workspaceId, createdAt)`.
- `AuditEvent(workspaceId, createdAt)`.

Decide how absent/null fields interact with unique indexes. Manage TTL indexes deliberately and verify whether the chosen Prisma workflow creates/manages them as required.

## 5. Tenant isolation

Every workspace-owned record must include `workspaceId` or be reachable only through an authorized parent. Every protected operation must authenticate the user, resolve the active workspace from trusted session context, verify membership/role, query by resource and tenant, validate linked records belong to the same tenant, and enforce plan entitlements.

Never trust a browser-provided workspace ID as proof of access. Never return a globally fetched resource by ID before checking tenant ownership.

## 6. Schema rollout

1. Pin MongoDB and Prisma versions.
2. Validate and generate Prisma Client in CI.
3. Apply schema/index changes in a disposable database.
4. Run integration tests against the same MongoDB topology class used in production.
5. Back up before production schema/index changes.
6. Document rollback/recovery; not every data transformation is reversible.
7. Test restore procedures periodically.

Use the currently documented MongoDB workflow for the selected Prisma version; do not blindly run SQL migration commands.
