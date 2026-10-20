# Environment & Local Development

## 1. Prerequisites

Install supported versions of:

- Node.js LTS (pin exact major/minor policy in `.nvmrc` or toolchain config).
- pnpm (pin via `packageManager` in root `package.json`).
- Git.
- MongoDB deployment compatible with the selected Prisma connector.
- Redis for BullMQ.
- Optional Docker for reproducible local dependencies.

Verify the current Prisma MongoDB requirements before selecting the local MongoDB topology; transaction-dependent functionality may require replica-set support.

## 2. Local services

Run isolated development instances of MongoDB and Redis. Do not use production credentials or production data for local development. Keep local service configuration in a developer-specific environment file ignored by Git.

## 3. Environment variable categories

Use `.env.example` for names and safe placeholders. Validate required values at process startup.

### App

- `NODE_ENV`
- `PORT`
- `WEB_URL`
- `API_BASE_URL`
- `CORS_ORIGINS`

### Database and jobs

- `DATABASE_URL`
- `REDIS_URL`

### Auth and security

- `SESSION_SECRET` or key-management configuration
- `TOKEN_ENCRYPTION_KEY` or managed-key configuration
- `CSRF_SECRET` if applicable

### Media

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

### AI

- `AI_TEXT_PROVIDER`
- `AI_TEXT_API_KEY`
- `AI_IMAGE_PROVIDER`
- `AI_IMAGE_API_KEY`

### Social OAuth

- Provider-specific client IDs/secrets and exact callback URLs. Keep server-only; never expose secrets as `NEXT_PUBLIC_*`.

### Payments and email

- Payment API credentials and webhook secret.
- Email provider key and verified sender configuration.

Actual variable names should be finalized during implementation and kept consistent across apps. Do not copy real values into documentation.

## 4. Local workflow

1. Copy `.env.example` to the appropriate ignored local env file.
2. Fill in local MongoDB and Redis URLs.
3. Install dependencies with the pinned package manager.
4. Generate Prisma Client using the project's documented command.
5. Apply the documented MongoDB schema/index workflow to a disposable local database.
6. Start web, API, and worker with root scripts.
7. Run lint, typecheck, unit tests, integration tests, and build.

## 5. Secrets policy

- Never commit `.env`, credentials, access tokens, OAuth secrets, payment secrets, or production dumps.
- Rotate any secret accidentally committed or logged.
- Use deployment secret managers in staging/production.
- Keep example values obviously fake.
