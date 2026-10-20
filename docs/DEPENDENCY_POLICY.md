# Baseline Dependency & Update Policy

## 1. Supported Runtime Matrix

| Component        | Minimum Version          | Target / Pinned Version | Rationale                                                                            |
| ---------------- | ------------------------ | ----------------------- | ------------------------------------------------------------------------------------ |
| **Node.js**      | `>= 22.0.0` (Active LTS) | `22.14.0`               | Built-in native fetch, WebSocket, web crypto, high performance V8 engine.            |
| **pnpm**         | `>= 10.0.0`              | `10.0.0`                | Strict workspace dependency isolation and deterministic content-addressable storage. |
| **Next.js**      | `15.2.0`                 | `15.2.0`                | React 19 App Router support, server actions, route handlers.                         |
| **React**        | `19.0.0`                 | `19.0.0`                | Modern hooks, compiler optimizations, strict concurrent rendering.                   |
| **NestJS**       | `11.0.1`                 | `11.0.1`                | TypeScript strict mode, Express platform, modular architecture.                      |
| **Prisma ORM**   | `6.4.1`                  | `6.4.1`                 | Validated MongoDB connector with replica set support and atomic operations.          |
| **BullMQ**       | `5.41.3`                 | `5.41.3`                | Redis-backed delayed jobs, exponential backoff, worker concurrency control.          |
| **ioredis**      | `5.5.0`                  | `5.5.0`                 | Production Redis clustering and sentinel support with resilient auto-reconnect.      |
| **Tailwind CSS** | `3.4.1`                  | `3.4.1`                 | Utility-first styling with shadcn/ui components.                                     |
| **Vitest**       | `3.2.7`                  | `3.2.7`                 | High-speed ESM-native testing across monorepo packages.                              |

## 2. Dependency Audit & Update Policy

1. **Automated Vulnerability Scanning:**
   - Run `pnpm audit` in CI on every pull request.
   - Any dependency with a Moderate, High, or Critical CVE blocks merging until patched.
2. **Scheduled Dependency Updates:**
   - Dependabot / Renovate PRs are reviewed bi-weekly for minor and patch updates.
   - Major framework updates (e.g. Next.js, NestJS, Prisma) require a dedicated migration issue and regression test run.
3. **Lockfile Integrity:**
   - `pnpm-lock.yaml` is the single source of truth.
   - CI runs `pnpm install --frozen-lockfile` to prevent drift.
