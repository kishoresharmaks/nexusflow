# CommercePilot Complete Implementation Plan

> **Status:** proposed delivery plan, created 20 October 2026.
>
> **Purpose:** turn the existing development prototype into a secure, supportable product. This replaces no product requirements; it sequences the work in `SRS.md`, `FEATURES.md`, `SECURITY.md`, `INTEGRATIONS.md`, and `TESTING.md` according to the implementation audit.

## 1. Goal and delivery rule

Launch a paid beta where an authorized workspace member can securely connect an eligible Meta account, import accurate catalog data, generate an editable grounded draft, approve it, schedule it, publish it exactly once through the official API, and view only verified metrics and attribution data.

**A feature is done only when it has:** server-side authorization and tenant isolation, input validation, success/error/recovery UI, auditable state changes, automated tests, observability, and documented operational behaviour.

### Explicit non-goals for paid beta

- Do not launch inbox/comments, agency workspaces, competitor insights, YouTube, Pinterest, LinkedIn, X/Twitter, WhatsApp, or image generation before the beta critical path is proven.
- Do not show estimated social impressions or engagement as actual provider data.
- Do not accept raw social access tokens from the browser as the production connection flow.
- Do not add a new provider until its official API, permissions, account eligibility, media rules, review process, and monitoring have been validated.

## 2. Planning assumptions

| Item            | Assumption                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Team            | 1 backend engineer, 1 frontend engineer, 1 QA/DevOps engineer, part-time product owner; security review is independent.          |
| Estimate        | 16–20 weeks for paid beta, assuming Meta and Razorpay approval are not delayed. Add 25% contingency for external-provider work.  |
| Environments    | Separate local, test, staging, and production MongoDB/Redis/object-storage accounts. Never share production data or credentials. |
| Release channel | Staging with synthetic data first, then an invite-only beta with feature flags and low limits.                                   |
| Source control  | First commit the currently untracked repository with secret-free history; protect the main branch and require CI.                |

## 3. Milestones

| #   | Milestone                           | Target       | Success criteria                                                                              |
| --- | ----------------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| 0   | Repository and secret safety        | Week 1       | No credentials in Git/docs; CI, environments, and incident response are usable.               |
| 1   | Secure core platform                | Weeks 2–4    | Auth, workspaces, catalog, media, and API security pass integration tests.                    |
| 2   | Real Meta publishing vertical slice | Weeks 5–8    | OAuth through provider-confirmed publish works once, recovers safely, and is observable.      |
| 3   | Billing and beta readiness          | Weeks 9–11   | Real checkout/webhooks, entitlements, backup restore, drills, and release documentation pass. |
| 4   | Paid beta                           | Weeks 12–13  | Invite-only customers complete the core workflow in production under monitored limits.        |
| 5   | Growth features                     | Weeks 14–20+ | Store sync, truthful attribution/reports, then one additional provider at a time.             |
| 6   | Advanced roadmap                    | Post-beta    | Inbox/comments, agency, competitor work only after legal and provider review.                 |

## 4. Critical path

```text
Secrets/CI/production configuration
  -> auth and authorization hardening
  -> Meta OAuth + secure media
  -> durable queue/state-machine/reconciliation
  -> provider-confirmed publishing
  -> real billing + enforced entitlements
  -> backup/drills/monitoring/security review
  -> paid beta
```

The catalog, AI drafting, and web UX can progress alongside OAuth/worker work, but must not delay the critical path.

---

## Phase 0 — Stop unsafe release work (Week 1)

### 0.1 Rotate and remove exposed secrets

| Task                                                                                                                                     | Effort | Owner   | Depends on          | Done criteria                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -----: | ------- | ------------------- | ------------------------------------------------- |
| Revoke the MongoDB credential exposed in `.env.example`; create a new least-privilege credential.                                        |     2h | DevOps  | —                   | Old connection string cannot authenticate.        |
| Replace `.env.example` with literal placeholders only; remove all secret-like values from docs and test fixtures.                        |     2h | Backend | Credential rotation | Secret scan has no findings.                      |
| Inspect Git history before the first remote push; if a credential has ever been committed, rotate it and document the exposure response. |     2h | DevOps  | Credential rotation | Audit record and remediation date exist.          |
| Add a pre-commit/CI secret scan and block pushes containing `.env`, key files, or connection strings.                                    |     4h | DevOps  | —                   | Deliberate test secret is rejected by CI.         |
| Define secret ownership, rotation interval, and a password-manager/secret-manager location for each production secret.                   |     3h | DevOps  | —                   | Runbook lists owner, use, and rotation procedure. |

### 0.2 Establish trustworthy engineering gates

| Task                                                                                                                                                                  | Effort | Owner      | Depends on        | Done criteria                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------- | ----------------- | ---------------------------------------------- |
| Commit the baseline repository after confirming generated files and real `.env` are ignored.                                                                          |     2h | Tech lead  | 0.1               | Clean clone reproduces the workspace.          |
| Add GitHub Actions (or the chosen CI) for install, format check, lint, typecheck, unit tests, Prisma validation/generation, build, dependency audit, and secret scan. |     6h | DevOps     | Clean baseline    | PR status checks run on every change.          |
| Make tests deterministic: use isolated database names, test Redis, seeded fixtures, per-suite cleanup, and hard test timeouts.                                        |     6h | QA/backend | CI                | `pnpm test` exits cleanly and repeatedly.      |
| Create staging configuration and deployment manifests; use separate accounts/buckets/databases from production.                                                       |     6h | DevOps     | Secret management | Staging deploy passes health/readiness checks. |
| Record baseline dependency versions and produce a dependency-update policy.                                                                                           |     2h | Tech lead  | CI                | Supported-version matrix is documented.        |

**Exit gate:** all quality commands complete in CI, no secret appears in tracked files, and staging is independently deployable.

---

## Phase 1 — Secure the foundation (Weeks 2–4)

### 1.1 Authentication and account lifecycle

| Task                                                                                                                        | Effort | Owner              | Depends on             | Done criteria                                                                              |
| --------------------------------------------------------------------------------------------------------------------------- | -----: | ------------------ | ---------------------- | ------------------------------------------------------------------------------------------ |
| Decide cookie-based session authentication or a bearer-token model; document CSRF and storage protections.                  |     3h | Tech lead/security | Phase 0                | Architecture decision record is approved.                                                  |
| Implement secure HTTP-only, `Secure`, `SameSite` session cookies if cookies are selected; remove browser token persistence. |     6h | Backend/frontend   | Decision               | Login, logout, expiry, and revocation work without exposing a token to JavaScript.         |
| Implement transactional email delivery for email verification, password reset, invitations, and security notices.           |     6h | Backend            | Email provider account | Messages are sent only through a staging-safe provider; templates and failures are tested. |
| Add resend, expiry, rate limits, generic anti-enumeration responses, and audit events to verification/reset flows.          |     6h | Backend            | Email delivery         | Abuse and expired-token tests pass.                                                        |
| Add login, registration, reset, and invite rate limits backed by Redis.                                                     |     4h | Backend            | Redis                  | Limits return safe recovery messages and are covered by tests.                             |
| Define and test account deletion/export, session/device revocation, and data-retention behaviour.                           |     8h | Backend/product    | Privacy decisions      | User-facing request flow and audited execution exist.                                      |

### 1.2 Workspace authorization and data integrity

| Task                                                                                                                                  | Effort | Owner            | Depends on          | Done criteria                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------------- | ------------------- | ------------------------------------------------------------------------- |
| Audit every protected route for authentication, membership, role, workspace ownership, and linked-resource ownership.                 |     8h | Backend/security | Existing API        | Route-by-route matrix has automated tenant-boundary tests.                |
| Validate `campaignId`, `productId`, and `socialAccountId` on post create/update against the same workspace.                           |     4h | Backend          | Authorization audit | Cross-workspace identifiers are rejected.                                 |
| Define an approval-policy model rather than allowing any draft to schedule by default.                                                |     6h | Product/backend  | Role decisions      | Required approval is enforced server-side per workspace.                  |
| Add database uniqueness/index decisions for imported products, billing provider event IDs, analytics snapshots, and idempotency keys. |     6h | Backend/DB       | Query review        | Schema validates and integration tests verify expected conflicts.         |
| Add structured audit events for all security-sensitive mutations and a restricted audit-log view.                                     |     4h | Backend/frontend | Authorization audit | Audit events preserve actor, workspace, resource, action, and request ID. |

### 1.3 Catalog, AI, and truthful UI

| Task                                                                                                                                  | Effort | Owner            | Depends on                   | Done criteria                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| Replace browser CSV fallback with a server-owned upload → mapping → validation → commit workflow.                                     |     8h | Backend/frontend | Secure media/upload decision | Invalid rows are downloadable; valid rows are not duplicated on retry.           |
| Add source freshness policy: source, last checked, price/stock staleness thresholds, warnings, and refresh actions.                   |     6h | Backend/frontend | Catalog workflow             | A stale product is visibly warned and cannot silently be represented as current. |
| Define an AI-provider contract with timeouts, payload caps, JSON validation, redaction, retry policy, and model/version audit fields. |     8h | Backend          | AI provider decision         | Malformed/unsafe AI output is rejected and does not create a draft.              |
| Make live AI explicit: use Gemini only when configured; label mock output as development-only and forbid it in staging/production.    |     4h | Backend/frontend | AI contract                  | Production startup fails safely without approved provider configuration.         |
| Enforce AI quotas transactionally and show genuine remaining usage from the backend.                                                  |     6h | Backend          | Billing model                | Parallel requests cannot exceed a quota.                                         |
| Remove or label all client-side simulated catalog, AI, media, and analytics fallbacks.                                                |     6h | Frontend         | API contracts                | Production UI never presents simulated data as live.                             |

**Exit gate:** an unauthorized/foreign tenant cannot read or mutate protected data; core user journeys handle errors and recovery; production configuration rejects mock providers.

---

## Phase 2 — Private media and official Meta OAuth (Weeks 4–6)

### 2.1 Private object storage

| Task                                                                                                                                     | Effort | Owner          | Depends on          | Done criteria                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -----: | -------------- | ------------------- | ----------------------------------------------------------------------------- |
| Select the production S3-compatible service and configure private bucket, encryption, lifecycle, CORS, and least-privilege service role. |     4h | DevOps         | Phase 0             | Bucket cannot be listed/read publicly.                                        |
| Implement SDK-generated presigned PUT and GET URLs with content type, max size, expiry, and tenant-key conditions.                       |     8h | Backend        | Bucket              | Tampered key/type/size requests are rejected.                                 |
| Confirm uploads by server-side `HeadObject` validation; record only verified object metadata.                                            |     6h | Backend        | Presigning          | A nonexistent or foreign key cannot be registered as an asset.                |
| Generate short-lived download URLs instead of storing public URLs; delete the storage object when deleting an asset.                     |     6h | Backend        | Upload verification | Asset deletion removes metadata and object, with a recoverable failure state. |
| Add malware/content scanning policy and supported image/video validation before provider publishing.                                     |     8h | Backend/DevOps | Object storage      | Unsafe or unsupported media cannot reach a provider adapter.                  |

### 2.2 Meta account connection

| Task                                                                                                                                                       | Effort | Owner            | Depends on             | Done criteria                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------------- | ---------------------- | -------------------------------------------------------------- |
| Validate the exact Meta Graph API version, approved permissions, eligible account types, callback URL, and app-review requirements.                        |     4h | Product/backend  | Meta developer account | Capability matrix and approval status are documented.          |
| Build OAuth start route with signed, one-time, expiring state bound to user/workspace and PKCE where supported.                                            |     6h | Backend          | Provider validation    | State replay, mismatch, and expiry tests pass.                 |
| Build callback route: exchange code server-side, discover eligible Pages/Instagram professional accounts, show a safe account chooser, and encrypt tokens. |     8h | Backend/frontend | OAuth start            | Browser never receives provider access/refresh tokens.         |
| Persist granted scopes, token expiry, provider account identifiers, and capability metadata; implement reconnect/disconnect.                               |     6h | Backend          | Callback               | Expired/revoked/scopes-changed accounts show reconnect action. |
| Add encrypted-token key management using a managed KMS or documented envelope encryption/key rotation; remove development fallback keys in production.     |     8h | Security/backend | Secret management      | Token key rotation is tested without token loss.               |
| Add a provider-account status check and scheduled token/capability health check.                                                                           |     6h | Backend/worker   | OAuth callback         | Ineligible accounts are never offered as publishing targets.   |

**Exit gate:** an authorized owner can complete Meta OAuth in staging, select an eligible account, reconnect after expiry, and no token is exposed in logs, API responses, or the browser.

---

## Phase 3 — Durable publishing system (Weeks 5–8)

### 3.1 State machine and schedule intent

| Task                                                                                                                                  | Effort | Owner            | Depends on           | Done criteria                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| Formalize allowed transitions, approval rules, cancellation/reschedule semantics, and terminal/recovery states in one domain service. |     8h | Backend          | Phase 1 roles        | Invalid transitions cannot be produced by any route or worker.                            |
| Decide whether direct publish requires approval; enforce the same rule for HTTP and worker paths.                                     |     3h | Product/backend  | State-machine design | Policy tests cover both entry points.                                                     |
| Make scheduling atomic: write schedule intent/idempotency version, enqueue after commit, and record enqueue failure for recovery.     |     8h | Backend          | State machine        | A scheduled post is either queued or discovered by recovery without duplicate publishing. |
| On cancel/reschedule, invalidate the prior queue job/version and prove old jobs cannot publish it.                                    |     6h | Backend          | Atomic schedule      | Race-condition tests pass.                                                                |
| Replace default-social-account fallback with an explicit selected eligible social account.                                            |     3h | Backend/frontend | OAuth                | Posts without a target cannot schedule/publish.                                           |

### 3.2 Queue, workers, retries, and reconciliation

| Task                                                                                                                                           | Effort | Owner          | Depends on                 | Done criteria                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | -----: | -------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| Add a shared queue producer used by the API; configure BullMQ job IDs, delays, attempts, exponential backoff/jitter, and retention.            |     8h | Backend        | Redis/staging              | API schedules work into `post-publishing`; jobs are visible in staging.                    |
| Rewrite the worker publisher to use the same provider-adapter service as direct publishing; remove fabricated success IDs.                     |     8h | Backend        | Queue producer, Meta OAuth | A scheduled staging post invokes the real adapter exactly once.                            |
| Add conditional lease/state updates so two workers cannot publish the same post concurrently.                                                  |     8h | Backend        | Worker rewrite             | Concurrency test proves one provider submission maximum.                                   |
| Persist full attempt lifecycle: started, provider request ID, response category, safe error, retry time, outcome-unknown flag, and completion. |     6h | Backend        | Worker rewrite             | Attempt timeline supports debugging without leaking secrets.                               |
| Classify transient/permanent/ambiguous provider errors; apply bounded provider-aware retries only to transient errors.                         |     8h | Backend        | Adapter contract           | Retry tests cover timeout, 429, 5xx, invalid media, expired token, and permission failure. |
| Implement reconciliation worker for stale publishing leases, missing jobs, and ambiguous results; query the provider before any resubmission.  |     8h | Backend        | Attempt lifecycle          | Timeout simulation never blindly produces a duplicate post.                                |
| Build queue health, dead-letter visibility, recovery runbook, and operator actions.                                                            |     6h | DevOps/backend | Reconciliation             | A failed job is diagnosable and recoverable from the UI/runbook.                           |

### 3.3 Meta publishing and verification

| Task                                                                                                                                 | Effort | Owner            | Depends on    | Done criteria                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | -----: | ---------------- | ------------- | ------------------------------------------------------------------ |
| Implement provider-specific Meta publication flow for each supported format, including media container/upload/poll/publish sequence. |     8h | Backend          | Media, OAuth  | Only documented formats and capability combinations are accepted.  |
| Validate copy/media limits against provider rules before scheduling and again before publishing.                                     |     6h | Backend/frontend | Provider flow | Unsupported posts fail before submission with actionable errors.   |
| Persist `PUBLISHED` only after provider-confirmed publication ID is stored.                                                          |     4h | Backend          | Provider flow | Forced provider failure never creates a published state.           |
| Add staging/sandbox integration tests using official test accounts, plus contract tests with recorded safe fixtures.                 |     8h | QA/backend       | Provider flow | Core success, revoked token, rate limit, and ambiguity cases pass. |

**Exit gate:** a staging Meta post survives worker restart, publishes once at its scheduled time, and has a provider-confirmed ID or a safe recoverable failure state.

---

## Phase 4 — Billing, entitlements, and provider webhooks (Weeks 8–10)

### 4.1 Real billing

| Task                                                                                                                                   | Effort | Owner            | Depends on          | Done criteria                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------------- | ------------------- | -------------------------------------------------------------- |
| Finalize plans, currency/tax policy, quota definitions, grace periods, refunds, and cancellation semantics with product/legal.         |     6h | Product/legal    | —                   | Signed-off entitlement matrix replaces placeholders.           |
| Validate Razorpay merchant eligibility, product/subscription API capability, tax requirements, and webhook event contract.             |     4h | Product/backend  | Razorpay account    | Provider capability checklist is approved.                     |
| Implement Razorpay order/subscription creation server-side and return only the safe checkout configuration required by the web client. |     8h | Backend/frontend | Provider validation | A staging payment creates a real provider order.               |
| Require a configured webhook secret and a valid signature for every webhook; remove default secrets and unsigned acceptance.           |     4h | Backend/security | Secret management   | Missing/invalid signatures return 401 and mutate nothing.      |
| Make webhook event persistence/idempotency transactional; verify provider event/payment identity before changing a subscription.       |     8h | Backend          | Webhook signature   | Duplicated/reordered events cannot corrupt subscription state. |
| Reconcile subscriptions periodically from Razorpay’s trusted API; record discrepancies and operator actions.                           |     6h | Backend/worker   | Webhooks            | Simulated missed webhook is repaired by reconciliation.        |

### 4.2 Enforce every entitlement at the server boundary

| Task                                                                                                                                      | Effort | Owner    | Depends on          | Done criteria                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -----: | -------- | ------------------- | ------------------------------------------------------------------ |
| Create one entitlement service for social accounts, seats, products, scheduled/published posts, AI text, AI images, storage, and exports. |     8h | Backend  | Final plans         | No route independently calculates plan access.                     |
| Enforce entitlement checks atomically before resource creation or billable provider calls.                                                |     8h | Backend  | Entitlement service | Parallel requests cannot exceed an allowance.                      |
| Add immutable usage/credit ledger entries, period reset policy, admin correction audit trail, and reconciliation.                         |     8h | Backend  | Entitlement checks  | Usage dashboard matches ledger totals.                             |
| Connect the web billing page to real checkout states, invoices/receipts, payment failures, cancellation, and recovery.                    |     8h | Frontend | Real billing API    | UI does not claim activation before trusted provider confirmation. |

**Exit gate:** a real sandbox payment updates the subscription only via a verified webhook/reconciliation; every quota is consistently enforced server-side.

---

## Phase 5 — Observability, security, and launch operations (Weeks 10–11)

### 5.1 Operational readiness

| Task                                                                                                                                                                           | Effort | Owner            | Depends on    | Done criteria                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -----: | ---------------- | ------------- | ----------------------------------------------------------------------- |
| Adopt structured logs with request/job IDs, redaction rules, error tracking, metrics, and traces across API/worker.                                                            |     8h | DevOps/backend   | Core flows    | Sensitive fields are redacted and one publish can be traced end-to-end. |
| Define alerts for API/worker availability, queue age/failure rate, publish failures, webhook signature failures, token expiry, AI spend, and database/Redis health.            |     6h | DevOps           | Observability | Alert tests send to the on-call channel.                                |
| Implement automated encrypted backups, retention, restore environment, and quarterly restore schedule.                                                                         |     6h | DevOps           | Production DB | Restore test meets documented RPO/RTO.                                  |
| Write incident/runbook procedures for provider outage, accidental duplicate risk, queue backlog, credential compromise, data restore, billing mismatch, and customer deletion. |     6h | Tech lead/DevOps | Alerts        | On-call can execute every procedure in staging.                         |
| Test deploy, rollback, schema/index rollout, and feature-flag rollback on staging.                                                                                             |     6h | DevOps           | CI/CD         | A bad deployment is rolled back without data loss.                      |

### 5.2 Security and compliance gate

| Task                                                                                                                                              | Effort | Owner            | Depends on        | Done criteria                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------------- | ----------------- | ------------------------------------------------------------------------ |
| Run dependency, SAST, secret, and license scans; triage all high/critical findings.                                                               |     6h | Security/DevOps  | CI                | No unaccepted high/critical finding remains.                             |
| Perform authenticated API authorization testing, rate-limit testing, webhook/OAuth state tests, storage isolation tests, and tenant-escape tests. |     8h | Security/QA      | Core flows        | Findings are fixed or explicitly risk-accepted.                          |
| Add security headers, CORS allowlist verification, CSRF protections where cookies are used, and file-upload abuse controls.                       |     6h | Backend/frontend | Auth decision     | Automated security tests pass in staging.                                |
| Publish privacy policy, terms, retention/deletion policy, data-processing inventory, consent language, and supported-capabilities list.           |     8h | Legal/product    | Product decisions | Documents match actual behaviour.                                        |
| Complete accessibility and responsive review for every beta screen at required breakpoints.                                                       |     8h | Frontend/QA      | Stable UI         | Keyboard, focus, errors, and screen-reader semantics pass agreed checks. |

**Exit gate:** independent security review, backup restore, queue failure drill, and publishing ambiguity drill are passed and recorded.

---

## Phase 6 — Invite-only paid beta (Weeks 12–13)

| Task                                                                                                                                                                |  Effort | Owner             | Depends on      | Done criteria                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------: | ----------------- | --------------- | --------------------------------------------------------- |
| Define beta entry criteria, invite limits, support hours, provider/account eligibility, permitted formats, and clear customer disclosures.                          |      4h | Product/support   | Phase 5         | Beta policy is published internally and in-app.           |
| Seed a demo workspace and perform an end-to-end customer journey rehearsal.                                                                                         |      6h | QA/product        | Staging release | Journey passes without admin database edits.              |
| Enable production for a small allowlisted cohort using feature flags and conservative quotas.                                                                       |      4h | DevOps/product    | Rehearsal       | Only approved workspaces gain access.                     |
| Monitor activation funnel: workspace → catalog → connected account → first draft → approved post → confirmed publish.                                               |      6h | Product/analytics | Production beta | Dashboard uses real event data.                           |
| Conduct weekly customer interviews, support triage, publish-failure review, and cost/usage analysis.                                                                | 4h/week | Product/team      | Beta users      | Prioritized issue list and decisions are recorded weekly. |
| Establish go/no-go thresholds for wider release: duplicate-publish incidents, publish success rate, queue age, support burden, security issues, and unit economics. |      4h | Product/tech lead | Beta data       | Thresholds are defined before scale-up.                   |

**Exit gate:** beta users complete the primary workflow safely, support can diagnose every failed publish, and product metrics are sourced from real events.

---

## Phase 7 — Growth roadmap, in safe order (Weeks 14–20+)

### 7.1 Store sync and verified attribution

1. Validate Shopify and WooCommerce OAuth/API permissions, webhooks, rate limits, deletion requirements, and test-store support.
2. Replace manually entered store credentials with official OAuth/API-key flows appropriate to each platform.
3. Add cursor-based, idempotent catalog/inventory sync jobs with per-store rate limiting, retry/reconciliation, sync health, and freshness warnings.
4. Add signed/canonical UTM redirect links with privacy-safe click collection, bot filtering policy, consent policy, and retention policy.
5. Ingest conversion events only from verified store webhooks/API sources; deduplicate by trusted order/event identity.
6. Clearly label attribution method, window, source, and freshness; never claim exact attribution when the method is probabilistic.
7. Add export jobs with access control, audit logs, and expiring downloads.

### 7.2 Analytics and reports

1. Remove estimated provider metrics from production responses and UI.
2. Add provider-insight sync adapters only after each provider grants the needed permission.
3. Store metric source, retrieval timestamp, provider version, and missing-data reason with every snapshot.
4. Build best-time recommendations only when minimum sample size and confidence thresholds are met; otherwise display “not enough data.”
5. Add scheduled reports through a notification/email service, with tenant isolation and unsubscribe/preference controls.

### 7.3 Additional channels — one provider per release

For LinkedIn, Pinterest, X/Twitter, YouTube, or WhatsApp, repeat this checklist independently:

1. Written capability/legal/eligibility review.
2. OAuth and encrypted tokens; no manual production token entry.
3. Provider-specific media/copy validation and account selection.
4. Adapter contract, idempotency/ambiguous-outcome design, reconciliation, and integration tests.
5. Provider-specific insights only if officially permitted.
6. Feature-flagged beta, monitoring, support runbook, and go/no-go review.

Do not share a generic “published” claim across channels whose API confirmation semantics differ.

### 7.4 Inbox/comments

Only start after paid beta and a provider-specific permission review. Implement as a separate module with: OAuth scopes, webhook signature verification, idempotent event storage, thread ownership, role-based replies, retention/deletion policy, moderation/escalation, rate limits, audit events, and clear unsupported-capability states.

### 7.5 Agency workspaces and competitor insights

Treat both as separate product discoveries, not extensions of the beta:

- **Agency:** client boundary model, cross-workspace permissions, client approvals, billing ownership, export/report isolation, impersonation restrictions, and full authorization review.
- **Competitor insights:** written legal basis, permitted data sources, rate limits, retention, opt-outs, source attribution, and an explicit ban on scraping where prohibited.

---

## 5. Test strategy and required evidence

| Layer       | Required checks                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | State transitions, ownership checks, crypto/key handling, provider error classification, quota calculations, URL/media validation.                        |
| Integration | MongoDB/Prisma indexes, Redis/BullMQ delayed jobs, upload confirmation, webhook signature/idempotency, OAuth state, token expiry, billing reconciliation. |
| Contract    | Official-provider payloads and safe recorded fixtures for Meta, Razorpay, Shopify, and WooCommerce.                                                       |
| End-to-end  | Register → workspace → catalog → AI draft → approve → schedule → provider-confirmed publish → verified analytics/attribution where available.             |
| Security    | Cross-tenant tests for every workspace route, authorization matrix, CSRF/rate-limit tests, secret scan, SAST, dependency scan, storage-key tampering.     |
| Reliability | Worker restart, duplicate job, stale lease, provider timeout, 429, 5xx, expired/revoked token, missed webhook, restore, and rollback drills.              |
| Frontend    | Loading, empty, no-results, error, recovery, permission and responsive states for each screen; keyboard and screen-reader acceptance.                     |

No milestone can close solely because unit tests pass; each needs its stated staging evidence and operational runbook.

## 6. Release checklist

- [ ] All credentials rotated and stored only in the chosen secret manager.
- [ ] No real secret in Git history, tracked files, logs, screenshots, or documentation.
- [ ] CI quality gates are mandatory and green.
- [ ] Production and staging are isolated.
- [ ] Official provider access and permitted capabilities are documented and verified.
- [ ] OAuth, webhooks, encrypted token storage, and disconnect/reconnect are tested.
- [ ] Scheduled posts publish only via durable jobs and provider-confirmed results.
- [ ] Ambiguous publishes reconcile before any retry.
- [ ] Analytics show source/freshness and contain no fabricated provider metrics.
- [ ] Billing uses real provider orders, verified webhooks, reconciliation, and server-enforced limits.
- [ ] Backup restore, queue failure, provider outage, and rollback drills pass.
- [ ] Privacy, retention, deletion, terms, support, on-call, and incident runbooks are approved.
- [ ] Security review resolves or explicitly accepts every finding.
- [ ] Invite-only beta go/no-go review is signed off by product, engineering, security, and support.

## 7. Risks and mitigation

| Risk                                          | Impact   | Likelihood | Mitigation                                                                                                  |
| --------------------------------------------- | -------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| Provider app review or permissions delayed    | High     | High       | Keep scope to one Meta flow; use staging/test accounts; do not promise dates until approval.                |
| Duplicate social publishing                   | High     | Medium     | Idempotency key, conditional lease, attempt history, reconciliation before retry, and a failure drill.      |
| Exposed secrets or token leakage              | Critical | Medium     | Immediate rotation, secret scanning, managed secrets/KMS, redacted logs, and access review.                 |
| False analytics claims                        | High     | Medium     | Remove estimates from production; attach source/freshness/method to every metric.                           |
| Billing mismatch                              | High     | Medium     | Verified webhooks, idempotent event store, trusted-provider reconciliation, support tooling.                |
| Third-party outage/rate limit                 | Medium   | High       | Provider-aware backoff, safe retry classification, status messaging, and queue visibility.                  |
| Scope creep from additional channels/features | High     | High       | Feature flags; one channel per release; beta critical path is a protected scope.                            |
| Test suite is unreliable                      | High     | Medium     | Isolated test infrastructure, deterministic cleanup, hard timeouts, and CI enforcement before feature work. |

## 8. Suggested ownership and cadence

| Role               | Weekly focus                                                                        |
| ------------------ | ----------------------------------------------------------------------------------- |
| Backend engineer   | Security boundaries, OAuth, worker/state machine, billing and provider adapters.    |
| Frontend engineer  | Real API-only UI, error/recovery states, accessibility, workflow UX.                |
| QA/DevOps engineer | CI, environments, deterministic integration tests, observability, restores, drills. |
| Product owner      | Provider eligibility, plan decisions, disclosures, beta users, release gates.       |
| Security reviewer  | Threat model, credential/token handling, authorization, webhook/OAuth review.       |

- Monday: dependency and risk review; confirm the next small vertical slice.
- Daily: merge only green CI; treat provider/security blockers as highest priority.
- Friday: demo staging evidence, review failed jobs/tests, update risks and delivery forecast.
- At each milestone: formal go/no-go decision based on the exit gate, not checklist optimism.

## 9. First two-week execution order

1. Rotate the exposed MongoDB credential and sanitize `.env.example`.
2. Commit a secret-free baseline and install mandatory CI checks.
3. Make the test suite exit reliably; record the real baseline results.
4. Choose session/CSRF model and production secret-management/KMS approach.
5. Audit every API route for authorization and repair cross-workspace linked-resource checks.
6. Replace fake S3 URLs with real private-object-storage presigning and confirmation.
7. Obtain/validate Meta staging app settings and document capabilities.
8. Implement OAuth state/callback/account discovery and remove production manual-token connection.
9. Define the publishing state machine and queue-producer contract before changing the worker.
10. Demo a staging-only workflow from catalog product to provider-confirmed Meta publication.

Only after step 10 succeeds should the team spend significant effort on extra social channels, inbox, agency tools, competitor insights, or cosmetic expansion.
