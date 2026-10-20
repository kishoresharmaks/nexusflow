# Frontend Technology Stack

## Approved stack

- Next.js App Router + React + TypeScript strict mode.
- Tailwind CSS for layout and design tokens.
- shadcn/ui + Radix UI primitives for accessible, customizable components.
- Lucide React for icons.
- React Hook Form + Zod for forms.
- TanStack Query for server state and cache invalidation.
- Zustand only for small client UI state when needed.
- TanStack Table for catalog/post tables.
- Recharts for analytics charts.
- Sonner for concise toast notifications.
- date-fns for date handling.
- Playwright, Vitest, and React Testing Library for testing.

Avoid mixing shadcn/ui with competing full component kits. Pin dependencies and commit the lockfile.

## Structure

`apps/web/src/` should separate `app/`, `components/ui/`, `components/layout/`, `features/`, `lib/api/`, `lib/auth/`, `lib/schemas/`, `hooks/`, and `styles/`.

## Rules

- Server Components by default; use client components only for interaction/browser APIs.
- Frontend calls the NestJS API; never access Prisma/MongoDB directly.
- Keep secrets out of `NEXT_PUBLIC_*`.
- Validate inputs and show loading, empty, success, error, and recovery states.
- Backend owns authorization and entitlements.
- Use accessible semantic HTML, keyboard navigation, visible focus, and responsive alternatives for dense tables.
- Paginate large datasets on the server; optimize media with `next/image`.
- Test 360, 390, 768, 1024, 1280, and 1440px viewports.

## Required screens

Overview, Products, Content Studio, Calendar, Publishing Queue, Social Accounts, Analytics, Inbox (only supported capabilities), Billing/Usage, Team/Permissions, and Workspace Settings.
