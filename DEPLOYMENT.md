# Deployment & Operations

## 1. Deployable processes

- `web`: Next.js application.
- `api`: NestJS HTTP API.
- `worker`: BullMQ consumers, scheduled recovery/reconciliation, analytics sync and reports.
- MongoDB: managed/secured deployment.
- Redis: managed/secured deployment.
- Object storage: private S3-compatible bucket.

The API and worker may share domain packages but should be independently deployable and observable.

## 2. Environments

Maintain isolated development, staging, and production environments:

- Separate database and Redis instances/credentials.
- Separate OAuth applications or redirect URLs where supported.
- Separate payment test/live credentials.
- Separate storage buckets.
- Separate encryption keys and webhook secrets.
- No production data in development/test.

## 3. Release procedure

1. Review code, dependency updates, schema/index changes, and feature flags.
2. Run CI gates.
3. Back up production data before risky schema/index operations.
4. Deploy backward-compatible changes first where possible.
5. Run readiness and smoke tests.
6. Monitor API latency, errors, queue depth, overdue posts, provider failures, and billing events.
7. Roll back code or disable the feature flag if error thresholds are exceeded.
8. Reconcile jobs and provider state after recovery.

## 4. Health checks

- `/health`: process liveness.
- `/ready`: required dependency readiness without leaking credentials.
- Worker health: heartbeat, queue processing status, last successful reconciliation.

## 5. Backups and recovery

- Configure automated MongoDB backups and documented retention.
- Test restores periodically in an isolated environment.
- Document Redis recovery expectations; do not rely on Redis alone for scheduled-post truth.
- Ensure MongoDB records allow due/abandoned work to be reconstructed and re-enqueued.
- Define recovery steps for token-encryption key loss, leaked provider credentials, and billing webhook backlog.

## 6. Monitoring and alerts

Alert on:

- Elevated API 5xx or p95 latency.
- Queue backlog, oldest job age, and repeated job failures.
- Scheduled posts overdue or stuck in `PUBLISHING`.
- Provider authentication/permission failure spikes.
- Duplicate-publish incidents.
- Payment webhook signature/processing failures.
- AI spend or credit consumption anomalies.
- Database connection saturation and storage thresholds.

## 7. Secrets and networking

- Use deployment secret managers.
- Restrict MongoDB/Redis network access to authorized workloads.
- Use TLS where supported.
- Never expose database or Redis ports publicly without a strong documented need and strict access controls.
- Rotate credentials and document access ownership.
