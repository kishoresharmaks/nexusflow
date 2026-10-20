# UI Design System

## Recommended UI library

**Tailwind CSS + shadcn/ui + Radix UI + Lucide React.** Use one component system; do not mix multiple competing UI kits.

## Design direction

Premium, calm, modern B2B SaaS. Prioritize operational clarity, catalog-aware content, status visibility, and accessible workflows over decoration.

## Palette

- Primary: `#E85D2A`
- Primary foreground: `#FFFFFF`
- App background: `#F7F8FA`
- Surface: `#FFFFFF`
- Text primary: `#17202A`
- Text secondary: `#667085`
- Border: `#E4E7EC`
- Success: `#16803C`
- Warning: `#B54708`
- Danger: `#B42318`
- Info: `#175CD3`
- Focus ring: `#F79009`

Verify WCAG 2.2 AA contrast; never communicate status through color alone.

## Typography and spacing

- Inter or system sans-serif; use `next/font` if Inter is selected.
- Page titles 24–30px, section headings 16–20px, body 14–16px.
- 4px spacing rhythm; page padding around 24px desktop and 16px mobile.
- Inputs/buttons 40px or taller; touch targets around 44×44px where practical.
- Controls radius 8–10px; cards 12–16px; subtle borders/shadows.

## Layout

Desktop: 240–256px sidebar, top bar, task-appropriate main content width. Mobile: compact header and drawer/bottom navigation, simpler content hierarchy, card alternatives for dense tables. Test 360, 390, 768, 1024, 1280, and 1440px.

## Core UI components

shadcn/ui Button, Input, Textarea, Label, Select, Checkbox, Switch, Card, Badge, Skeleton, Dialog, AlertDialog, Sheet, Popover, Tooltip, DropdownMenu, Tabs, Table. Use React Hook Form + Zod. Add domain components such as `PageHeader`, `StatusBadge`, `EmptyState`, `ErrorState`, `ChannelPreview`, `PublishAttemptTimeline`, and `UsageMeter`.

## Product interaction standards

- Catalog import: Upload → Map Columns → Validate → Results.
- Content Studio: product/context, editable draft, channel preview.
- Calendar/queue: explicit status labels, timezone, retry/reconnect actions.
- Billing: show plan, renewal, usage, quotas, and cancellation clearly.
- All data-driven pages include loading, empty, populated, no-results, error, and permission states.
- Respect reduced motion; use keyboard-accessible controls and visible focus.
