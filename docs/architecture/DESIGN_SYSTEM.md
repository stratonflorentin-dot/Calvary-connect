# Design System Guide

## Overview
This document defines the unified design system for Calvary Connect Fleet Management. All components and pages must use these design tokens and utility classes to ensure consistency across the application.

## Typography

### Font Family
- **Primary Font**: Inter (Google Fonts)
- **Weights**: 400, 500, 600, 700, 800
- **Usage**: All text elements use Inter via `font-body` or `font-sans` classes

### Font Classes
```tsx
// Body text
className="font-body text-foreground"

// Headings
className="font-headline font-semibold text-foreground"
```

## Color System

### Design Tokens (CSS Variables)
All colors use HSL values defined in `globals.css`:

#### Primary Colors
- `--primary`: Main brand color (blue)
- `--primary-foreground`: Text on primary background
- `--secondary`: Secondary action color
- `--secondary-foreground`: Text on secondary background

#### Semantic Colors
- `--success`: Success states (green)
- `--warning`: Warning states (yellow/orange)
- `--destructive`: Error/danger states (red)
- `--info`: Informational states (blue)

#### Neutral Colors
- `--background`: Page background
- `--foreground`: Primary text
- `--muted`: Subtle backgrounds
- `--muted-foreground`: Secondary text
- `--border`: Borders and dividers
- `--card`: Card backgrounds
- `--card-foreground`: Card text

### Usage in Tailwind
```tsx
// Background colors
className="bg-background"
className="bg-card"
className="bg-muted/50"

// Text colors
className="text-foreground"
className="text-muted-foreground"
className="text-primary"

// Border colors
className="border-border"
```

## Component Classes

### Surface Components
Use these utility classes for consistent surfaces:

```tsx
// Card surface
className="app-surface" // rounded-lg border border-border bg-card shadow-sm

// Section container
className="app-section" // rounded-lg border border-border bg-card/95 p-4 shadow-sm

// Toolbar
className="app-toolbar" // flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/95 p-3

// KPI card
className="app-kpi" // rounded-lg border border-border bg-card p-4 hover:border-primary/30

// Muted panel
className="app-muted-panel" // rounded-lg border border-border bg-muted/45 p-4

// Table container
className="app-table-shell" // overflow-hidden rounded-lg border border-border bg-card shadow-sm
```

## Spacing

### Standard Spacing Scale
Use Tailwind's spacing scale consistently:
- `p-4` (1rem) - Default padding
- `p-5` (1.25rem) - Medium padding (desktop)
- `gap-2` (0.5rem) - Default gap
- `gap-4` (1rem) - Medium gap

### Responsive Padding
```tsx
// Mobile: p-4, Desktop: p-5
className="p-4 md:p-5"
```

## Border Radius

### Standard Radius
- `rounded-lg` - Default (0.5rem)
- `rounded-md` - Medium (calc(0.5rem - 2px))
- `rounded-sm` - Small (calc(0.5rem - 4px))

## Interactive States

### Focus States
All interactive elements must have visible focus states:
```tsx
className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
```

### Hover States
```tsx
// Subtle hover
className="hover:bg-accent hover:text-accent-foreground"

// Border hover
className="hover:border-primary/30"
```

## Dark Mode

The design system supports dark mode via the `.dark` class. All color tokens automatically adapt to dark mode. No additional classes needed.

## Accessibility

### Touch Targets
- Minimum touch target: 44px (mobile), 48px (coarse pointer)
- Applied automatically via media queries in globals.css

### Reduced Motion
Respects `prefers-reduced-motion` preference automatically.

### High Contrast
Respects `prefers-contrast: high` preference automatically.

## Best Practices

### DO
- Use design system classes (`app-surface`, `app-section`, etc.)
- Use semantic color tokens (`bg-primary`, `text-destructive`)
- Use responsive spacing (`p-4 md:p-5`)
- Use Inter font family via `font-body` or `font-sans`

### DON'T
- Hardcode hex colors (e.g., `#ffffff`, `#2952A3`)
- Use arbitrary values (e.g., `bg-[#123456]`)
- Mix font families
- Override component classes with inline styles
- Use pixel values for spacing

## Migration Guide

When updating existing components:

1. Replace hardcoded colors with design tokens
2. Replace custom surfaces with `app-surface` or `app-section`
3. Ensure consistent padding using the spacing scale
4. Add focus states to interactive elements
5. Use `font-body` or `font-sans` for all text

## Example: Before and After

### Before
```tsx
<div className="bg-white border-gray-200 rounded p-4 shadow">
  <h2 className="text-xl font-bold text-gray-900">Title</h2>
  <p className="text-gray-600">Description</p>
</div>
```

### After
```tsx
<div className="app-surface">
  <h2 className="font-headline font-semibold text-foreground">Title</h2>
  <p className="text-muted-foreground">Description</p>
</div>
```

## Component Library

### Buttons
Use the button component from `@/components/ui/button` which already follows the design system.

### Inputs
Use input components from `@/components/ui/input` which already follow the design system.

### Tables
Use `app-table-shell` for table containers and standard Tailwind classes for table cells.

## Resources

- **Global Styles**: `src/app/globals.css`
- **Tailwind Config**: `tailwind.config.ts`
- **Theme Provider**: `src/components/theme-provider.tsx`
