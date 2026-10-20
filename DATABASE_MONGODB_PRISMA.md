# MongoDB + Prisma ORM

## Requirement

MongoDB is the primary database and Prisma ORM is the typed data-access layer. Do not substitute a relational database or another ORM without explicit approval.

## MongoDB connector caveats

Verify the current Prisma MongoDB connector documentation and pinned versions for relation syntax, ObjectId fields, indexes, transaction/replica-set requirements, and schema-change workflow. Do not assume SQL-style Prisma Migrate behavior.

## Environment

Use server-only `DATABASE_URL`. Separate dev/test/staging/production databases and least-privilege credentials. Never commit credentials or expose them through frontend variables.

## Schema conventions

MongoDB IDs commonly use a Prisma pattern such as:

```prisma
model Example {
  id          String   @id @default(auto()) @map("_id") @db.ObjectId
  workspaceId String   @db.ObjectId
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

Validate the actual schema with the pinned Prisma version. Keep related ObjectId fields consistently typed. Validate IDs received from clients.

## Core models

User, Session, Workspace, Membership, Product, CatalogImport, MediaAsset, SocialAccount, BrandProfile, ContentTemplate, Campaign, Post, Approval, PublishAttempt, WebhookEvent, Subscription, BillingEvent, UsageLedger, AiUsage, AnalyticsSnapshot, TrackedClick, ConversionEvent, Notification, AuditEvent.

## Rules

- Every workspace-owned record must include `workspaceId` or be accessible only through an authorized parent.
- Query by both resource ID and workspace ID wherever possible.
- Avoid unbounded arrays; use separate collections for attempts, audit events, and analytics.
- Store timestamps in UTC and money as integer minor units/exact representation.
- Design indexes from real query patterns and validate them against the deployed connector.
- Back up before risky schema/index changes and test restore procedures.
- Use conditional updates/leases for state transitions where supported.
