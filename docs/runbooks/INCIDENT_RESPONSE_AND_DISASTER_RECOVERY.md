# CommercePilot Incident Response & Disaster Recovery Runbook

**Document Owner:** DevOps & Tech Lead  
**Last Updated:** October 2026  
**Classification:** Internal Operational Runbook  

---

## 1. Overview & Severity Classification

| Severity | Definition | Target Response (SLA) | Example Scenarios |
|----------|------------|-----------------------|-------------------|
| **SEV-1 (Critical)** | Core publishing or customer data integrity outage. Multiple workspaces blocked. | < 15 minutes | MongoDB replica set down; duplicate posts publishing uncontrolled; secret compromise. |
| **SEV-2 (Major)** | Major platform capability degraded. Workarounds exist. | < 1 hour | Meta Graph API returning 5xx; BullMQ worker process crashing; Razorpay checkout errors. |
| **SEV-3 (Minor)** | Non-blocking feature impaired or isolated single tenant impact. | < 4 hours | Stale CSV catalog sync error; AI quota calculation latency; non-critical webhook delay. |

---

## 2. Accidental Duplicate Publish Prevention (Emergency Circuit Breaker)

If a publishing queue storm or duplicate publishing condition is detected:

### Immediate Action (Kill Switch)
1. **Pause publishing workers immediately:**
   ```bash
   # Scale worker deployment to 0 replicas
   docker compose -f deploy/staging/docker-compose.yml stop worker
   # In Kubernetes:
   kubectl scale deployment commercepilot-worker --replicas=0
   ```
2. **Purge the pending `post-publishing` BullMQ queue in Redis:**
   ```bash
   redis-cli -u $REDIS_URL
   > DEL "bull:post-publishing:wait"
   > DEL "bull:post-publishing:delayed"
   ```
3. **Inspect MongoDB for posts in `PUBLISHING` status:**
   ```javascript
   db.Post.find({ status: "PUBLISHING" });
   ```
4. **Halt lease acquisition:** Update stale `PUBLISHING` posts to `FAILED` with error `EMERGENCY_CIRCUIT_BREAKER_TRIGGERED`.
5. **Reconcile with Meta:** Before re-enabling any post, query `https://graph.facebook.com/v19.0/{providerAccountId}/media` or `feed` to confirm whether the post was already created on the remote provider. Never blindly re-publish without confirming.

---

## 3. Provider Outage Protocols

### 3.1 Meta Graph API Outage
- **Symptoms:** High rate of `META_ERR_2`, `META_ERR_4`, `NETWORK_TIMEOUT` in worker attempt logs.
- **Action:**
  1. Verify [Meta Business Status Dashboard](https://metastatus.com).
  2. The publishing adapter marks network timeouts and 5xx as `isTransient: true`.
  3. Worker applies exponential backoff with jitter up to 3 bounded attempts.
  4. If outage exceeds 2 hours, `FallbackScheduler` pauses due posts and flags `AWAITING_RECONNECT`.

### 3.2 Razorpay Payment Gateway Outage
- **Symptoms:** Checkout session initiation failures or unverified webhook events.
- **Action:**
  1. Check Razorpay Status Page.
  2. Webhook events received are transactionally deduplicated in `WebhookEvent` table.
  3. If webhooks are missed during downtime, execute the reconciliation sync:
     `POST /api/v1/workspaces/:workspaceId/billing/reconcile` (or run nightly subscription reconciliation).

### 3.3 Gemini / AI Provider Outage
- **Symptoms:** `ContentGenerationService` timeout errors or `GEMINI_UNAVAILABLE`.
- **Action:**
  1. Fail fast: AI drafting is an optional accelerator; core manual post drafting and publishing remain operational.
  2. UI displays banner: *"AI Content Studio is temporarily unavailable. Manual post creation is unaffected."*

---

## 4. Disaster Recovery & Backup Restore Procedures

### 4.1 MongoDB Backup & Point-in-Time Recovery (PITR)
- **RPO Target:** < 1 hour
- **RTO Target:** < 4 hours
- **Automated Backup Cadence:** Daily full mongodump with oplog streaming enabled, stored encrypted (AES-256) in private S3 backup bucket.

#### Restore Procedure
```bash
# 1. Download encrypted backup archive from secure S3 vault
aws s3 cp s3://commercepilot-backups/mongo/daily-2026-10-20.archive.enc ./backup.enc

# 2. Decrypt with KMS key
openssl enc -d -aes-256-cbc -pbkdf2 -in ./backup.enc -out ./backup.archive -pass env:BACKUP_ENCRYPTION_KEY

# 3. Restore to target isolated database instance
mongorestore --uri="$TARGET_DATABASE_URL" --archive=./backup.archive --oplogReplay --drop

# 4. Run database health validation
pnpm --filter @commercepilot/database test
```

### 4.2 S3 / MinIO Object Storage Disaster Recovery
- **Bucket Policy:** Versioning enabled, Object Lock with 30-day retention on original assets.
- **Cross-Region Replication:** Asynchronous replication from primary region to secondary disaster recovery bucket.
- **Restore:** Switch `S3_ENDPOINT` and `S3_BUCKET` configuration to replica bucket.

---

## 5. Security Compromise & Credential Revocation

In the event of an unauthorized secret disclosure (e.g. database password, encryption key, Meta App Secret):

1. **Immediate Revocation:** Refer to `docs/runbooks/SECRET_MANAGEMENT_AND_ROTATION.md`.
2. **Token Re-encryption:**
   - Deploy new `TOKEN_ENCRYPTION_KEY`.
   - Run migration script `pnpm --filter @commercepilot/api run reencrypt-tokens` to re-wrap all stored social tokens with the new key.
3. **Session Revocation:**
   - Execute `DELETE /api/v1/auth/sessions/revoke-all` across affected user accounts.
4. **Audit Trail Inspection:**
   - Query `AuditLog` for IP address and user actions taken during exposure window.
