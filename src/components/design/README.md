# Calvary Connect Design System

This folder contains reusable layout and UI primitives that apply the Calvary Connect design language consistently across the app.

## Quick start

Replace ad-hoc page wrappers with the shell components:

```tsx
import { PageShell, PageHeader, PageSection } from '@/components/design/page-shell';
import { KpiCard, EmptyState } from '@/components/design/kpi-card';

export default function MyPage() {
  return (
    <PageShell>
      <PageHeader
        title="Page Title"
        subtitle="A short description of the page."
        eyebrow="Section"
      >
        <Button>New Item</Button>
      </PageHeader>

      <PageSection className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Active" value="12" icon={<Truck />} />
        ...
      </PageSection>

      <PageSection>
        <Card>...your content...</Card>
      </PageSection>
    </PageShell>
  );
}
```

## Components

### PageShell
Root wrapper for every page. Adds consistent padding, safe-area handling, and optional entrance animation.

### PageHeader
Standard page title block with optional eyebrow, subtitle, and action buttons. Use for every page heading.

### PageSection
Section wrapper that provides consistent spacing and animation. Pass `className` for grids or custom layouts.

### KpiCard
Metric card with icon, value, optional trend, and link. Use for dashboard stats and summary numbers.

### EmptyState
Consistent empty-state illustration with icon, title, description, and optional action.

## Design tokens

All colors, spacing, shadows, and typography come from `src/app/globals.css`. Do not hardcode colors; use the CSS variables and Tailwind utilities (e.g. `text-primary`, `bg-success/10`, `border-border`).

## Patterns

- Use `cv-surface`, `cv-panel`, `cv-kpi`, `cv-chip-*` utility classes for surfaces and status chips.
- Keep card headers concise (CardTitle + optional CardDescription).
- Right-align currency and numbers; left-align text.
- Use `text-muted-foreground` for secondary text and labels.
- Reserve red/destructive for errors and critical alerts.

## Reference pages

- `/design-system` — interactive showcase of all tokens and components.
- `/landing` — marketing landing page pattern.
- `/dashboard` — data-dense executive dashboard pattern.
