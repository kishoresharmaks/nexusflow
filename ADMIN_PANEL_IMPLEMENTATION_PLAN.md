# CommercePilot Workspace Admin Panel — Implementation Plan

## 1. Purpose and scope

Build a **workspace administration console** for CommercePilot. It lets an authorized workspace owner or administrator manage the workspace, people, roles, connected services, content governance, usage, billing visibility, and audit history.

This is deliberately **not a global platform super-admin console**. A user may belong to several workspaces, and every screen and API operation remains scoped to the selected workspace. A separate internal-operator console would require its own threat model, data-access policy, support workflow, and explicit product approval.

### Goals

- Give workspace owners and administrators a clear, safe place to run the business side of a CommercePilot workspace.
- Reuse the existing backend authorization, API, database models, and Next.js application rather than duplicating business logic.
- Make security-sensitive actions explicit, auditable, and recoverable.
- Never present provider connections, analytics, billing, or publishing as successful unless the backend has confirmed it.

### Non-goals for this release

- No new global `SUPER_ADMIN` role.
- No direct database access from the web app.
- No client-side enforcement as a substitute for backend authorization.
- No fake provider status, mock invoice, synthetic metric, or simulated checkout in a production UI path.
- No agency/client-approval role yet; that is a later, separately designed permission model.

## 2. Current baseline

The repository already has the foundations this panel should reuse:

- Four workspace roles: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`.
- Auth, workspace membership guards, role guard, audit logs, workspace settings, membership endpoints, billing/usage endpoints, social accounts, catalog, post approvals, campaign tracking, and analytics endpoints.
- Existing web routes for catalog, composer, posts, media, integrations, campaigns, analytics, billing, login, and registration.

Important implementation gaps already present in the product must stay visible in the admin panel:

- Real S3 media verification remains incomplete where fallback/mock signing paths exist.
- Social publishing and provider metrics require real approved provider credentials and verified account eligibility.
- Razorpay checkout is not production-complete until real order creation and webhook reconciliation are verified.
- Queue recovery and ambiguous publish reconciliation are release blockers.

## 3. Roles and permission matrix

The panel must use the current role enum. Do not create a second, conflicting permission system.

| Capability | Owner | Admin | Member | Viewer |
| --- | :---: | :---: | :---: | :---: |
| View workspace overview, usage, team, integrations, audit history | Yes | Yes | No | No |
| Edit workspace name, locale, timezone, currency | Yes | Yes | No | No |
| Invite/remove members; change `MEMBER`/`VIEWER` roles | Yes | Yes | No | No |
| Promote a member to Admin | Yes | Yes, only if policy permits | No | No |
| Assign or transfer Owner | Owner only, explicit transfer flow | No | No | No |
| Connect/disconnect social or store accounts | Yes | Yes | No | No |
| Configure approval policy / content governance | Yes | Yes | No | No |
| View billing and usage | Yes | Yes | No | No |
| Start checkout / change plan | Yes | Admin only if product policy allows | No | No |
| Cancel subscription | Owner only | No | No | No |
| View audit log | Yes | Yes | No | No |

### Mandatory role-safety rules

- At least one owner must always exist. The final owner cannot be demoted, removed, or deleted.
- An administrator must not elevate themselves or another user to owner; ownership transfer needs a dedicated owner-only flow and explicit acceptance by the recipient.
- A user must not remove or demote the last owner.
- Role checks must be executed server-side on every request; hiding a button only improves usability.
- The UI must show a clear “no permission” state instead of showing a failed screen or leaking data.

## 4. Admin-panel feature inventory

### A. Admin overview (`/settings`)

**Audience:** Owner, Admin

**Purpose:** One operational view of workspace health and actions that need attention.

Include:

- Workspace name, plan, billing period, current user role, timezone, and selected workspace switcher.
- Action cards: unverified email members, pending invitations, expired/revoked integrations, quota nearing limit, stale catalog data, failed/overdue scheduled posts, pending approvals.
- Compact counts: team members, active products, connected accounts, drafts awaiting approval, scheduled posts, usage percentage.
- “Recent activity” list sourced from audit events, with actor, action, target, time, and safe metadata.
- Clear empty, loading, error, permission-denied, and unavailable-provider states.

Do not calculate fake health scores or estimate provider metrics. A card must either use a persisted/confirmed value or say that the data is unavailable.

### B. Workspace settings (`/settings/workspace`)

**Audience:** Owner, Admin

Fields:

- Workspace name.
- Slug (read-only in initial release unless a URL migration policy is designed).
- Timezone (IANA timezone select/search).
- Locale.
- Default currency.

Behavior:

- React Hook Form + Zod validation mirrors the Nest DTO validation.
- Warn before changing timezone: it changes how future schedules are interpreted; it must not silently rewrite historical UTC timestamps.
- Show success/error state after save and write a `WORKSPACE_UPDATED` audit event.

### C. Team and invitations (`/settings/team`)

**Audience:** Owner, Admin

Include:

- Paginated/searchable members table: name, email, verified state, role, joined date, actions.
- Invite dialog: email + allowed role (`ADMIN`, `MEMBER`, `VIEWER`); explain the role before sending.
- Role-change confirmation dialog including effects of reduced access.
- Remove-member confirmation dialog that preserves the owner safeguard.
- Pending-invitation section: email, invited role, expiry, inviter, resend, revoke.
- Owner transfer panel, visible to the current owner only, with recipient confirmation and re-authentication.

**Required correction before this page ships:** the current member API creates an unverified placeholder user for an email address. Replace that behavior with a real invitation lifecycle; no account should be created with an unusable random password as the invitation mechanism.

### D. Access and content governance (`/settings/governance`)

**Audience:** Owner, Admin

Include:

- Explain the current approval process and the post state machine.
- Configure whether a post requires approval before it can be scheduled/published.
- Set eligible approver roles (initially Owner/Admin only unless a new Approver role is formally introduced).
- Show policy version, editor, and last-updated time.
- Show the recent approval decision history, linking to the applicable post.

This section needs a new persisted workspace-owned approval-policy model; it must not be merely a frontend switch.

### E. Integrations and security (`/settings/integrations`)

**Audience:** Owner, Admin

Include:

- Social and commerce connections, grouped by provider.
- Per connection: display name, status, granted scopes, masked credential indicator, expiry/reconnect need, last successful sync/publish where genuinely available.
- Actions: connect, reconnect, disconnect, sync (only where the provider adapter supports it), and view safe diagnostic code.
- Capability label based on persisted granted scopes/account eligibility: for example, “catalog sync available” or “publishing unavailable — missing scope.”
- Security copy explaining that credentials stay server-side and are encrypted at rest.

Provider-specific pages must show **“not configured”** or **“not yet supported”** when credentials, provider approval, or capability verification are absent. They must not offer manual raw-token entry as the production connection path.

### F. Billing and usage (`/settings/billing`)

**Audience:** all roles can view summary if product policy retains this; payment actions limited by backend role policy.

Include:

- Active plan, status, billing dates, cancellation state, and server-calculated entitlement meters.
- Usage meters: scheduled posts, AI text/images where applicable, social accounts, seats, storage when a verified measurement exists.
- Event/payment history with provider event status, never full payment details or payment secrets.
- Upgrade/change-plan and cancel flows only when a real payment integration is configured and returns a verified checkout session.
- If payment integration is not configured, show an honest unavailable state; do not generate an apparent checkout link.

### G. Audit log (`/settings/audit-log`)

**Audience:** Owner, Admin

Include:

- Date range, action, actor, resource type, and text filters.
- Paginated immutable event table: UTC timestamp plus workspace-local display time, actor, action, resource, request/IP indicator if safe, and a metadata detail drawer.
- Metadata allowlist/redaction. Never render tokens, password-reset values, OAuth codes, payment signature values, cookies, or complete IP addresses to ordinary workspace admins.
- CSV export is out of scope until retention, data-export authorization, and PII policy are defined.

### H. Data and account lifecycle (`/settings/data`)

**Audience:** Owner only

Initial release:

- Explain data ownership, deletion process, integration disconnect consequences, and support route.
- Provide a read-only summary of stored workspace data categories.

Future gated release:

- Workspace data export and deletion request workflow, with multi-step confirmation, a grace period, job tracking, and provider-data deletion handling.

Do not expose destructive workspace deletion until retention, backup/restore, and legal/privacy requirements are approved and tested.

## 5. Information architecture and UI specification

### Navigation

Add one `Settings` item to the authenticated application navigation. It contains:

```text
Settings
├── Overview
├── Workspace
├── Team & access
├── Governance
├── Integrations
├── Billing & usage
├── Audit log
└── Data & privacy
```

Show Settings only to Owner/Admin. Direct route access by a Member/Viewer should render a friendly access-denied page after the API returns `403`; it must not preload privileged data.

### Layout and visual system

- Reuse the current Next.js App Router, Tailwind, shadcn/ui, Radix primitives, Lucide icons, React Hook Form, Zod, TanStack Table, and existing API client.
- Desktop: existing app shell with a settings sub-navigation; content max-width suitable for forms/tables.
- Mobile: use a `Sheet` or select-style section navigator; tables become accessible cards or horizontally scrollable only when necessary.
- Use existing design tokens: app background `#F7F8FA`, surface `#FFFFFF`, primary `#E85D2A`, and semantic success/warning/danger colours.
- Use a status badge with both icon/text and colour; never depend on colour alone.
- All controls need visible focus, keyboard operation, labels, field-level validation, and 44px practical touch targets.

### Reusable UI pieces

Create only small domain components that are reused by multiple settings pages:

- `SettingsLayout` — title, description, sub-navigation, permission state.
- `SettingsSection` — consistent card and heading layout.
- `RoleBadge` and `RoleSelect` — role explanation and constraints.
- `ConfirmSensitiveActionDialog` — typed confirmation/re-auth handoff where required.
- `UsageMeter` — server-provided current/limit representation.
- `IntegrationStatusCard` — safe connection/capability display.
- `AuditLogTable` — pagination, filters, redacted metadata detail.

Avoid building a generic “admin framework” or a second component library.

### Critical interaction flows

1. **Invite member:** Admin opens dialog → enters email/selects role → server validates authority and entitlement → invitation is persisted → transactional email is queued → audit event is stored → UI shows pending invite.
2. **Change role:** Admin chooses role → UI displays access impact → backend validates hierarchy/last-owner rules → membership updates → audit event → cache invalidation and success feedback.
3. **Disconnect integration:** Admin confirms provider/account → backend revokes/deactivates credentials where provider allows → encrypted tokens are removed or marked revoked → audit event → UI reflects confirmed state.
4. **Change workspace timezone:** Admin selects timezone → UI warns about scheduling semantics → backend validates IANA value → persists setting/audit event → all dates retain UTC storage and render in new local timezone.
5. **Cancel subscription:** Owner confirms cancellation terms → backend calls real payment gateway only when configured → payment result/webhook reconciliation determines status → audit event and UI update. Never trust a browser redirect alone.

## 6. Backend design

### Modules and service ownership

| Area | Existing module to extend | New responsibility |
| --- | --- | --- |
| Workspace settings | `workspaces` | Read/update workspace configuration; validate timezone/locale/currency. |
| Team | `workspaces` + new `invitations` module | Invitation lifecycle, role changes, removal, ownership transfer. |
| Governance | `posts` or focused `approval-policies` module | Persist and evaluate workspace approval policy. |
| Integrations | `social`, `integrations`, `webhooks` | Safe status/capability view and secure disconnect/reconnect actions. |
| Billing | `billing`, `webhooks` | Return authoritative usage/subscription only; real checkout when verified. |
| Audit | `audit` | Filtered, redacted, paginated read model. |
| Data lifecycle | dedicated future module | Export/deletion workflow only after policy/operations approval. |

Controllers stay thin. Services own validation, ownership checks, state transitions, provider calls, and audit-event creation. The web app calls REST endpoints only.

### Proposed REST contract additions/changes

Existing workspace, membership, billing, audit, social, and integration endpoints should be reused where they match the behavior below. Add the following only where the existing contract has a gap:

| Method and route | Roles | Purpose |
| --- | --- | --- |
| `GET /api/v1/workspaces/:workspaceId/admin-summary` | Owner, Admin | Server-calculated counts, actionable status, and safe overview fields. |
| `GET /api/v1/workspaces/:workspaceId/invitations` | Owner, Admin | Paginated pending/expired/revoked invitations. |
| `POST /api/v1/workspaces/:workspaceId/invitations` | Owner, Admin | Create one invitation; returns safe invitation metadata only. |
| `POST /api/v1/workspaces/:workspaceId/invitations/:invitationId/resend` | Owner, Admin | Rotate/send invitation subject to rate limit. |
| `DELETE /api/v1/workspaces/:workspaceId/invitations/:invitationId` | Owner, Admin | Revoke invitation. |
| `POST /api/v1/invitations/:token/accept` | authenticated invited user | Atomically consume a single-use invitation and create membership. |
| `POST /api/v1/workspaces/:workspaceId/ownership-transfer` | Owner | Start a confirmed transfer; never immediate based on email alone. |
| `POST /api/v1/workspaces/:workspaceId/ownership-transfer/:transferId/accept` | intended recipient | Accept active transfer after re-authentication. |
| `GET /api/v1/workspaces/:workspaceId/approval-policy` | Owner, Admin | Read effective content-approval policy. |
| `PATCH /api/v1/workspaces/:workspaceId/approval-policy` | Owner, Admin | Update validated policy and audit it. |
| `GET /api/v1/workspaces/:workspaceId/audit-logs` | Owner, Admin | Extend existing route with validated filters/cursor if needed. |

All state-changing routes require DTO allowlists, authenticated session, workspace guard, role guard, ownership validation, rate limiting as appropriate, and audit records. Use an idempotency key for invitation creation, ownership transfer initiation, and provider-affecting actions.

### DTO validation

- Validate every ObjectId, pagination value, filter enum, timezone, currency, locale, and email.
- Use an allowlisted DTO validation pipe (`whitelist`, reject unexpected fields).
- Enforce maximum string lengths and trim normalized text server-side.
- Validate IANA timezones from a controlled source; reject arbitrary strings.
- Invitation role must exclude `OWNER`; owner transfer has its own DTO and flow.
- Do not pass raw requests or raw UI objects into Prisma.

## 7. Data model and schema plan

### Reuse without schema changes

- `Workspace`: name, timezone, locale, currency.
- `Membership`: user/workspace relationship and `WorkspaceRole`.
- `SocialAccount`, `StoreConnection`, `Subscription`, `UsageLedger`, `AuditEvent`, `Post`, `Approval`, `Notification`.

### New models required

#### `WorkspaceInvitation`

Purpose: secure, revocable, expiring membership invitation; replaces the placeholder-user approach.

Suggested fields:

```ts
id, workspaceId, emailNormalized, role, tokenHash,
invitedByUserId, expiresAt, acceptedAt, revokedAt,
createdAt, updatedAt
```

Rules and indexes:

- Store only a cryptographic hash of the invitation token, never the raw token.
- Token is random, single-use, short-lived, and sent only through the email provider.
- Unique active invitation policy must be enforced in service logic; validate MongoDB partial-index support before depending on it.
- Index `workspaceId + createdAt`, `emailNormalized + expiresAt`, and token hash as appropriate.

#### `OwnershipTransfer`

Purpose: explicit two-party owner change.

Suggested fields:

```ts
id, workspaceId, fromUserId, toUserId,
status: PENDING | ACCEPTED | CANCELLED | EXPIRED,
expiresAt, acceptedAt, createdAt, updatedAt
```

Rules:

- The recipient must already be a verified member.
- Acceptance re-checks both memberships and current owner state inside a transaction where MongoDB topology supports it.
- Audit initiation, acceptance, cancellation, and expiry.

#### `ApprovalPolicy`

Purpose: durable workspace content-governance settings.

Suggested fields:

```ts
id, workspaceId, requiresApprovalBeforeSchedule,
requiresApprovalBeforePublish, allowedApproverRoles,
updatedByUserId, createdAt, updatedAt
```

Rules:

- One policy per workspace via a unique `workspaceId` index.
- Default must preserve current safe behavior: drafts do not auto-publish.
- Existing post state machine enforces the policy server-side; the UI is only a configuration surface.

### Schema rollout

1. Add Prisma models/enums and validate against the pinned MongoDB connector.
2. Generate Prisma client and test in a disposable replica-set-compatible database.
3. Apply indexes explicitly and observe index build behavior.
4. Back up before production rollout and document rollback; invitations/ownership transfers may require compatibility handling.
5. Release backend support before exposing UI controls.

## 8. Security and privacy requirements

### Authentication and authorization

- Use existing secure session/auth guard; do not accept a role or workspace identifier from the browser as proof of authorization.
- `WorkspaceGuard` resolves actual membership and `RolesGuard` protects every administration endpoint.
- Re-check current user, role, target member, workspace ownership, and plan entitlement in the service method.
- Require recent authentication or password confirmation for ownership transfer, account deletion request, and other high-impact actions.
- Rotate/revoke sessions after password changes and ownership transfer as policy requires.

### Tenant isolation

- All database queries include the authorized `workspaceId` or traverse from an already-authorized parent.
- A target membership, invitation, social account, billing record, or audit event must be verified to belong to the same workspace before mutation.
- API tests must attempt workspace-ID substitution for every new endpoint.

### Tokens, payments, and logs

- Never return social/store tokens, payment secrets, raw webhook payload secrets, OAuth authorization codes, session tokens, password hashes, or invite tokens from list/status APIs.
- Encrypt provider tokens at rest; only show masked account metadata and scopes where safe.
- Log structured event IDs, request IDs, safe error codes, and actor IDs. Redact credentials, email body contents, token values, and payment details.
- Verify provider webhook signatures from raw bodies, deduplicate by provider event ID, and reconcile against trusted provider state.

### Abuse protection

- Rate-limit invitation creation/resend, member mutation, ownership transfers, login/recovery, and costly report/export operations.
- Use idempotency keys for duplicate-prone state changes.
- Record sensitive actions in immutable audit events.
- Apply CSRF protection to cookie-authenticated state-changing requests and use secure headers/CORS allowlists.

### Privacy and retention

- Define invitation, audit, analytics, and deleted-workspace retention periods before enabling data exports/deletion.
- Do not show raw IP addresses by default; expose only a policy-approved, minimally necessary representation.
- Record user consent/legal basis before adding analytics or message-data controls.

## 9. Delivery plan

Assumption: one frontend engineer and one backend engineer, with product/security review availability. Estimates exclude external provider approval waits. Each implementation task should be sized to roughly 2–8 hours during sprint planning.

| Milestone | Likely effort | Deliverable and exit criteria |
| --- | ---: | --- |
| M0 — Scope and safety decisions | 2–3 days | Approval of role matrix, ownership transfer rules, invitation email provider, retention rules, and no-global-admin boundary. |
| M1 — Secure team foundations | 4–6 days | `WorkspaceInvitation` and ownership-transfer backend, migrations/indexes, tests, audit events. No placeholder account creation. |
| M2 — Settings UI and workspace configuration | 3–4 days | Authenticated settings shell, workspace form, team table/invitation flow, responsive/accessibility states. |
| M3 — Governance, integrations, billing surfaces | 4–6 days | Approval-policy persistence/UI, safe integration status, real server-derived billing/usage pages. |
| M4 — Audit and admin overview | 3–4 days | Filtered redacted audit log, server-calculated admin summary, action-needed cards. |
| M5 — Verification and release gate | 3–5 days | Unit/integration/component/E2E tests, security review, quality gates, staging sign-off. |

**Likely engineering time:** approximately 19–28 working days for two engineers, plus product/design/security review and any email/provider configuration work. Add 25% schedule buffer for MongoDB index rollout, invitation email delivery, and security review.

### Dependency map

```text
Role matrix + retention decisions
          ├──> Invitation/ownership schema + backend ──> Team UI
          ├──> Approval-policy schema + backend ───────> Governance UI
          └──> Admin summary contract ─────────────────> Overview UI

Workspace guards + audit service ──────────────────────> Every admin mutation
Real provider/payment capability ──────────────────────> Integration/billing action availability
All above ─────────────────────────────────────────────> Security/E2E/release gate
```

## 10. Testing and acceptance criteria

### Backend tests

- Unit: role hierarchy, final-owner guard, invitation token hashing/expiry/revocation, ownership-transfer state machine, approval-policy enforcement, audit-metadata redaction.
- Integration: every endpoint with valid input, malformed DTO, unauthenticated request, insufficient role, foreign workspace ID, duplicate request, rate limit, and audit event assertion.
- Security: invite-token reuse, expired/revoked token, attempts to promote to Owner through generic role API, self-demotion of final owner, cross-tenant member/invitation access, OAuth/payment secret leakage.
- Contract: frontend types match safe response DTOs; tokens and secrets are absent.

### Frontend tests

- Component tests for permission states, role-select restrictions, confirmation dialogs, forms, errors, loading, empty tables, and retries.
- Accessibility tests for keyboard navigation, focus trapping, dialog labels, table/card alternatives, status text, and error announcements.
- E2E: Owner invites user → user accepts → membership appears; Admin cannot make an owner; owner transfers ownership; admin changes workspace timezone; expired connection shows reconnect action; usage renders server data; unauthorized user cannot access admin routes.

### Definition of done

The admin panel is complete only when:

1. All listed routes are server-authorized and tenant-isolated.
2. Membership invitation and ownership transfer are secure, auditable, and tested.
3. Sensitive UI actions have confirmation/recovery states and no unsafe placeholder behavior.
4. Billing/integration screens show only verified backend/provider data and explicit unavailable states.
5. The full quality gate passes: format, lint, typecheck, unit/integration/component/E2E tests, Prisma validation/client generation, build.
6. Security review, backup/restore rehearsal, queue-recovery drill, and provider/payment verification are completed before declaring a production release.

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Admin role can accidentally take over a workspace | High | Dedicated owner-only, two-party ownership transfer; final-owner protection; audit trail. |
| Invite flow creates inaccessible or orphaned accounts | High | Hashed, expiring invitation tokens and accept flow; do not create placeholder users. |
| Cross-tenant data disclosure | High | Guards and tenant-scoped service queries; negative integration tests for every route. |
| UI claims provider feature works when it does not | High | Explicit `unconfigured`, `unsupported`, and `reconnect required` statuses sourced from backend capabilities. |
| Provider/payment webhooks are spoofed or replayed | High | Raw-body signature verification, event ID idempotency, reconciliation, secret redaction. |
| MongoDB schema/index rollout causes downtime | Medium | Disposable topology test, index rollout plan, backup, restore rehearsal, rollback documentation. |
| Audit history leaks personal/security data | Medium | Strict metadata allowlist/redaction; no raw payloads/tokens/secrets in event display. |
| Scope grows into an internal super-admin product | Medium | Keep platform operations out of this release; require separate approved SRS and threat model. |

## 12. External dependencies and reality check

- Transactional email credentials/domain configuration are required to send real invitations.
- Real social/store connections require each provider’s approved app, scopes, eligible account, credentials, and current official API support.
- Real billing actions require verified Razorpay merchant configuration, server-side order/checkout handling, webhook secret, signature verification, and reconciliation.
- S3-compatible storage credentials and bucket policy are required for real private-media behavior.
- Redis/BullMQ and MongoDB replica-set-compatible infrastructure are required to verify scheduling, retries, and ownership-transfer transactional behavior.

This document is an implementation plan only. It does not claim that the external integrations or production release gates are complete.
