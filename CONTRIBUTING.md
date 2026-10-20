# Contributing & AI-Agent Workflow

## 1. Before changing code

- Read `AGENTS.md`, `SRS.md`, `FEATURES.md`, and relevant stack/schema/security docs.
- Identify the smallest user-visible slice and its dependencies.
- Confirm provider API requirements from official docs before implementing an integration.
- Do not assume undocumented API behavior.

## 2. Implementation workflow

1. State the goal and acceptance criteria.
2. Inspect the existing structure before creating files.
3. Implement a vertical slice rather than generating the entire product at once.
4. Add tests alongside behavior.
5. Run formatting, lint, typecheck, tests, Prisma validation/generation, and build.
6. Review authorization, tenant isolation, secrets, retries, and failure states.
7. Update docs when behavior or contracts change.

## 3. Code review checklist

- Does the backend enforce authentication, authorization, and tenant isolation?
- Are inputs validated and outputs intentionally serialized?
- Are provider errors classified and safely surfaced?
- Are external calls time-bounded and observable?
- Are retries bounded and idempotency/reconciliation considered?
- Are loading, empty, error, and recovery UI states implemented?
- Are quotas and entitlements enforced server-side?
- Are logs free of secrets and unnecessary personal data?
- Are tests included and passing?

## 4. Git and repository hygiene

- Use focused commits and descriptive branch/commit names.
- Never commit real `.env` files, tokens, keys, database dumps, or generated customer data.
- Keep lockfiles committed.
- Avoid broad formatting or dependency changes mixed with feature changes unless necessary.
- Document breaking API/schema changes and rollout requirements.
