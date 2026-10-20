# Observability & Incident Response

## 1. Logging

Use structured JSON logs with request/job IDs, module, operation, duration, result, and safe error code. Redact credentials, authorization headers, cookies, OAuth codes, payment signatures, message bodies, and unnecessary personal/product data.

## 2. Metrics

Track:

- API request count, error rate, latency percentiles.
- MongoDB query latency, connection pool saturation, and slow queries.
- Queue depth, oldest job age, processing duration, retry count, and failed jobs.
- Scheduled posts due/overdue, publish success/failure by provider, ambiguous outcomes, and duplicate incidents.
- AI requests, token/image usage, cost estimates, failures, and quota rejections.
- Billing webhook processing lag, duplicates, failures, and reconciliation differences.
- Email delivery failures and bounce rates.

## 3. Alerts

Set thresholds based on beta baselines. Prioritize:

- Stuck scheduled posts.
- Provider auth failure spikes.
- Queue backlog or worker outage.
- Database/Redis unavailability.
- Unexpected AI spend.
- Payment webhook failures.
- Elevated 5xx or p95 latency.
- Suspected cross-tenant access or secret exposure.

## 4. Incident workflow

1. Detect and assign an incident owner.
2. Contain impact: disable risky integration/feature flag, pause a queue, or revoke credentials if required.
3. Preserve safe diagnostics and timeline.
4. Restore service and reconcile external provider/database state.
5. Rotate compromised secrets and notify affected parties/providers when required.
6. Write a post-incident review with root cause, impact, corrective action, and owner.
