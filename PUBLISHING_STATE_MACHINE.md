# Publishing State Machine & Recovery

## 1. States

- `DRAFT`
- `AWAITING_APPROVAL`
- `APPROVED`
- `SCHEDULED`
- `PUBLISHING`
- `PUBLISHED`
- `FAILED`
- `CANCELLED`

## 2. Rules

- State transitions are validated by backend domain logic.
- If approval is required, `AWAITING_APPROVAL` cannot publish until an authorized reviewer approves.
- Persist the post and schedule intent in MongoDB before enqueueing a BullMQ job.
- Use UTC for persisted timestamps and workspace timezone for schedule interpretation/display.
- Every publishing attempt is recorded separately with start/end time, attempt number, provider request ID, safe error code, and next retry time.
- A post is `PUBLISHED` only after confirmed provider success is persisted.
- `FAILED` should include a safe reason and next action.
- Cancellation/rescheduling must invalidate or supersede pending jobs so stale jobs cannot publish cancelled content.

## 3. Retry classification

Transient examples: network failures, temporary provider 5xx, rate limits with documented retry guidance. Use bounded exponential backoff with jitter and provider-aware limits.

Permanent examples: missing permission, invalid media, unsupported format, disconnected account, expired authorization requiring user action. Do not retry indefinitely.

## 4. Ambiguous outcome

If a provider request times out after it may have been accepted:

1. Mark the attempt as outcome-unknown or otherwise record ambiguity.
2. Query provider state or use documented reconciliation when possible.
3. Do not blindly submit the same post again if duplicate publication is possible.
4. If outcome cannot be established, surface a safe operator/user action and retain audit history.

## 5. Recovery worker

Periodically find:

- Due `SCHEDULED` posts without active jobs.
- Stale `PUBLISHING` posts whose lease/heartbeat expired.
- Failed jobs eligible for retry.
- Provider outcomes requiring reconciliation.

Recovery must use conditional updates/leases and tolerate duplicate execution. Test process crashes at every transition boundary.
