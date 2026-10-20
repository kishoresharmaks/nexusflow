# Secret Management and Credential Rotation Runbook

## 1. Production Secrets Inventory & Ownership

| Secret Name                                       | Purpose                                                           | Target Secret Store           | Owner                     | Rotation Cadence      | Rotation Procedure                                                                                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------- | ------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                    | MongoDB cluster connection string with TLS                        | AWS Secrets Manager / Doppler | DevOps Lead               | 90 days / on exposure | Create new DB user with least privilege in MongoDB Atlas; update secret in Secret Manager; rolling restart API/worker; drop old user after verifying zero connections. |
| `REDIS_URL`                                       | Redis cluster connection string with TLS & AUTH                   | AWS Secrets Manager / Doppler | DevOps Lead               | 90 days               | Configure secondary AUTH password on Redis; deploy new secret; update services; disable primary password.                                                              |
| `SESSION_SECRET`                                  | Cryptographic secret for signing session cookies                  | AWS Secrets Manager           | Security / Backend Lead   | 180 days              | Support key rotation array `[newSecret, oldSecret]` for graceful transition; deploy new secret; deprecate old after 24h.                                               |
| `TOKEN_ENCRYPTION_KEY`                            | 256-bit AES-GCM key for encrypting provider access tokens at rest | AWS KMS / HashiCorp Vault     | Security Lead             | 180 days              | Re-encrypt existing tokens in DB using envelope encryption; rotate active key ID.                                                                                      |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`       | S3-compatible object storage IAM credentials                      | AWS Secrets Manager           | DevOps Lead               | 90 days               | Provision new IAM access key; deploy secret to API; deactivate and delete old access key.                                                                              |
| `META_CLIENT_SECRET`                              | Meta App OAuth client secret                                      | AWS Secrets Manager           | Backend Lead              | 180 days              | Generate new App Secret in Meta Developer Console; configure dual acceptance if possible, or deploy secret with brief planned maintenance window.                      |
| `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Razorpay API authentication & webhook HMAC signing                | AWS Secrets Manager           | Tech Lead / Billing Owner | 180 days              | Generate new secret in Razorpay Dashboard; update secret manager; update webhook endpoint configuration; verify test webhook.                                          |
| `EMAIL_API_KEY`                                   | Transactional email provider API key (Resend/SendGrid)            | AWS Secrets Manager           | Backend Lead              | 180 days              | Issue new API key with mail.send permissions only; update secret; revoke obsolete key.                                                                                 |

## 2. Emergency Rotation Procedure (Exposure Response)

If any credential is suspected or confirmed leaked (e.g. committed to git, exposed in logs, or compromised workstation):

1. **Immediate Containment (Within 15 minutes):**
   - Revoke the compromised credential immediately at the provider console or identity provider.
   - Provision a fresh credential with restricted privileges.
2. **Deploy Configuration (Within 30 minutes):**
   - Update the secret in AWS Secrets Manager / Doppler.
   - Trigger rolling deployment of `apps/api` and `apps/worker`.
3. **Audit & Evidence Preservation (Within 2 hours):**
   - Inspect provider audit logs (MongoDB Atlas query history, AWS CloudTrail, Meta API calls, Razorpay logs) for unauthorized actions.
   - Record exact exposure window, actor, and affected tenant resources in incident response log.
4. **Post-Mortem & Preventative Safeguards:**
   - Execute git history sanitization with Git Filter-Repo / BFG if committed locally.
   - Re-verify Gitleaks / CI pre-push hooks.
