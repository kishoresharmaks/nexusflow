# Security & Privacy Requirements

## 1. Security baseline

- Treat every client input, imported CSV, generated AI output, webhook, and provider response as untrusted.
- Enforce authorization server-side for every resource and operation.
- Default to least privilege for workspace roles, database users, cloud credentials, and social scopes.
- Keep secrets out of source control, logs, screenshots, frontend bundles, and issue reports.

## 2. Authentication and sessions

- Hash passwords with Argon2id using a maintained library.
- Use secure, HttpOnly, SameSite cookies for browser sessions where compatible with the chosen architecture.
- Protect state-changing cookie-authenticated requests against CSRF.
- Use email verification and single-use, expiring password reset tokens.
- Rotate/revoke sessions after sensitive account changes and on logout.
- Rate-limit login, password recovery, verification, invitations, and other abuse-prone endpoints.

## 3. Multi-tenant authorization

For every protected request:

1. Authenticate.
2. Resolve workspace from trusted server-side session/request context.
3. Verify membership and role.
4. Scope resource queries by tenant.
5. Verify all referenced objects belong to that tenant.
6. Check plan entitlements.
7. Audit sensitive actions.

Test cross-tenant attacks in integration tests. Hiding UI buttons is not authorization.

## 4. OAuth and provider credentials

- Validate OAuth `state` and exact redirect URIs; use PKCE where supported by the provider flow.
- Request only necessary scopes.
- Encrypt access/refresh tokens at rest with managed keys/envelope encryption.
- Never return provider tokens to the browser.
- Redact tokens, OAuth codes, cookies, authorization headers, and webhook secrets from logs.
- Support reconnect, revoke/disconnect, and key rotation.
- Record granted scopes and account eligibility.

## 5. Webhooks and payments

- Verify signatures using the provider's documented method and required raw-body handling.
- Persist event IDs and process events idempotently.
- Handle duplicates and out-of-order delivery.
- Reconcile billing state against the trusted provider when needed.
- Never grant credits or mark a subscription paid from an unverified browser redirect alone.

## 6. Input, files, and AI

- Validate DTOs and reject unexpected fields.
- Avoid passing request objects directly to Prisma writes.
- Validate uploaded file size, type, content, and ownership; store media privately.
- Use short-lived signed URLs for authorized access.
- Validate AI output and treat it as untrusted; do not permit model output to trigger publication or privileged actions without explicit policy and authorization.
- Prevent invented prices, inventory, discounts, shipping terms, and unsupported claims by grounding generation in catalog facts and requiring review.
- Apply AI rate limits, usage caps, and cost controls.

## 7. Infrastructure and observability

- Use HTTPS, secure headers, CORS allowlists, rate limits, and dependency updates.
- Keep production secrets in a secret manager.
- Restrict MongoDB network access and use least-privilege credentials.
- Separate dev/staging/production credentials and databases.
- Log request IDs and safe error codes, not secrets or unnecessary personal data.
- Alert on auth abuse, cross-tenant authorization failures, provider failures, queue backlogs, billing webhook errors, and unusual AI spend.

## 8. Privacy and lifecycle

- Publish a clear privacy notice and retention schedule.
- Collect only the data needed for features.
- Define deletion/export behavior for workspace, user, social account, messages, generated assets, analytics, and audit data.
- Respect provider data deletion requirements and applicable data protection laws.
- Review consent and disclosure before tracking clicks/conversions or processing messages.
- Do not scrape private profiles or bypass access controls for competitor insights.

## 9. Incident response

Maintain a playbook for leaked tokens, cross-tenant exposure, malicious uploads, compromised accounts, billing discrepancies, and duplicate publishing. Include containment, credential rotation, evidence preservation, user/provider notification decisions, and recovery verification.
