# Document Manifest

This bundle contains planning and starter configuration files for CommercePilot.

## Included

- Product requirements and features: `README.md`, `SRS.md`, `FEATURES.md`
- Agent and engineering guidance: `AGENTS.md`, `CONTRIBUTING.md`
- Architecture and contracts: `PROJECT_STRUCTURE.md`, `API_SPEC.md`, `DATABASE_SCHEMA.md`
- Stack and UI: `FRONTEND_TECH_STACK.md`, `BACKEND_TECH_STACK.md`, `UI_DESIGN_SYSTEM.md`, `DATABASE_MONGODB_PRISMA.md`
- Security, integrations, testing, environment, deployment, publishing reliability, observability
- Safe starter config: `.env.example`, `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`

## Important limitations

- The archive contains documentation and starter root configuration, not a fully initialized or runnable application. `apps/` and `packages/` source code, package manifests, actual Prisma schema, lockfile, CI workflows, and provider credentials still need to be created/validated.
- The root `package.json` scripts are intended for the proposed workspace and will not work until the app/package directories and scripts exist.
- Replace/merge `AGENTS.md` and `SRS.md` with any fuller versions already present in your project if those contain additional decisions. The archive versions are concise baselines.
- Do not overwrite a more detailed existing file without comparing it first.
- Verify current Prisma/MongoDB behavior and all third-party API permissions before production.
