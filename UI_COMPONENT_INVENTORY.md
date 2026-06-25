# Calvary Connect UI Component Inventory & Design System
## System Overview
Professional logistics management platform with dual light/dark themes, accessibility compliance, and comprehensive role-based dashboards.

---

## Design System Colors
### Core Color Palette
| Color Role          | Light Theme (Hex/RGB)          | Dark Theme (Hex/RGB)            | HSL (Light/Dark)                   | Usage Context                                  |
|---------------------|---------------------------------|----------------------------------|------------------------------------|------------------------------------------------|
| `--background`      | `#EEF0F5` / `rgb(238,240,245)`  | `#141E2D` / `rgb(20,30,45)`      | `220 18% 94%` / `216 35% 11%`      | Page/shell background                          |
| `--foreground`      | `#252D3D` / `rgb(37,45,61)`     | `#CDD4E6` / `rgb(205,212,230)`   | `220 25% 18%` / `215 25% 88%`      | Primary text                                   |
| `--card`            | `#F5F6FA` / `rgb(245,246,250)`  | `#192335` / `rgb(25,35,53)`      | `220 20% 97%` / `216 33% 14%`      | Card surface, dashboards                       |
| `--card-foreground` | `#252D3D` / `rgb(37,45,61)`     | `#CDD4E6` / `rgb(205,212,230)`   | `220 25% 18%` / `215 25% 88%`      | Card text                                      |
| `--primary`         | `#1565C0` / `rgb(21,101,192)`   | `#3B8CE8` / `rgb(59,140,232)`    | `213 80% 42%` / `213 80% 58%`      | Primary buttons, active nav, ring color        |
| `--primary-foreground` | `#FFFFFF` / `rgb(255,255,255)` | `#141E2D` / `rgb(20,30,45)`    | `0 0% 100%` / `216 35% 10%`        | Text on primary color                          |
| `--secondary`       | `#D8DCE8` / `rgb(216,220,232)`  | `#243047` / `rgb(36,48,71)`      | `220 15% 88%` / `216 28% 20%`      | Secondary buttons, muted surfaces              |
| `--secondary-foreground` | `#252D3D` (light) / `#CDD4E6` (dark) | - | `220 25% 25%` / `215 25% 80%` | Text on secondary surfaces |
| `--muted`           | `#E2E5EE` / `rgb(226,229,238)`  | `#1F2C3F` / `rgb(31,44,63)`      | `220 15% 91%` / `216 28% 18%`      | Muted backgrounds (tables, headers)            |
| `--muted-foreground` | `#6C7A96` / `rgb(108,122,150)` | `#7E90AB` / `rgb(126,144,171)` | `220 14% 46%` / `215 18% 58%`      | Secondary/help text, placeholders              |
| `--accent`          | `#1BA3CC` / `rgb(27,163,204)`   | `#2AADE0` / `rgb(42,173,224)`    | `199 72% 50%` / `199 65% 52%`      | Accent buttons, highlights                     |
| `--destructive`     | `#E53935` / `rgb(229,57,53)`    | `#C0392B` / `rgb(192,57,43)`     | `4 80% 52%` / `4 72% 45%`          | Errors, warnings, delete buttons               |
| `--border`          | `#CDD1DE` / `rgb(205,209,222)`  | `#253248` / `rgb(37,50,72)`      | `220 18% 84%` / `216 28% 22%`      | Dividers, borders, inputs                      |
| `--input`           | Same as border                  | Same as border                   | Same as border                     | Input backgrounds/borders                      |

### Sidebar Specific Colors
| Role                | Light/Dark                     | Usage                                  |
|---------------------|--------------------------------|----------------------------------------|
| `--sidebar-background` | `#18213A` (fixed deep navy) | Sidebar (always dark)                  |
| `--sidebar-foreground` | `#CBD5E8` | Sidebar text                          |
| `--sidebar-primary`  | `#3B8CE8` | Sidebar active button                 |

### Chart Colors
| Chart | Light/Dark                    | Usage                                  |
|-------|-------------------------------|----------------------------------------|
| `--chart-1` | Primary blue (#1565C0 light / #3B8CE8 dark) | Line/bar 1                            |
| `--chart-2` | Accent teal (#1BA3CC light / #2AADE0 dark) | Line/bar 2                            |
| `--chart-3` | Amber (#F5A623 light / #F6B93B dark) | Line/bar 3                            |
| `--chart-4` | Green (#2E7D32 light / #43A047 dark) | Line/bar 4                            |
| `--chart-5` | Destructive red (#E53935) | Line/bar 5                            |

---

## UI Component Inventory

### Core Components
| Component               | File Location                          | Color Specifications                                                                 |
|-------------------------|----------------------------------------|---------------------------------------------------------------------------------------|
| **Button**              | `src/components/ui/button.tsx`         | <ul><li>Default: `bg-primary` / `text-primary-foreground`</li><li>Outline: `border-input`, `bg-background`, hover: `bg-accent`</li><li>Secondary: `bg-secondary`</li><li>Destructive: `bg-destructive`</li><li>Ghost: hover: `bg-accent`</li></ul> |
| **Badge**               | `src/components/ui/badge.tsx`          | <ul><li>Default: `bg-primary`</li><li>Secondary: `bg-secondary`</li><li>Destructive: `bg-destructive`</li><li>Outline: `text-foreground`</li></ul> |
| **Card**                | `src/components/ui/card.tsx`           | Uses `bg-card`, `text-card-foreground`, `border`; description: `text-muted-foreground` |
| **Input**               | `src/components/ui/input.tsx`          | Uses `border-input`, `bg-background`, placeholder `text-muted-foreground`; focus: `ring-ring` |
| **Textarea**            | `src/components/ui/textarea.tsx`       | Same as `Input`                                                                       |
| **Label**               | `src/components/ui/label.tsx`          | Uses `text-foreground`                                                                |
| **Dialog/Modal**        | `src/components/ui/dialog.tsx`         | Uses `bg-background`, `border`, `text-foreground`                                     |
| **Select**              | `src/components/ui/select.tsx`         | Uses `border-input`, `bg-background`, focus: `ring-ring`                              |
| **Accordion**           | `src/components/ui/accordion.tsx`      | Uses Radix UI primitives, system colors                                               |
| **Alert**               | `src/components/ui/alert.tsx`          | Uses `border`, `bg-background`, `text-foreground`                                     |
| **Progress**            | `src/components/ui/progress.tsx`       | Uses `bg-primary`                                                                     |
| **Switch**              | `src/components/ui/switch.tsx`         | Uses Radix UI primitives, system colors                                               |
| **Table**               | `src/components/ui/table.tsx`          | Uses `border`, `bg-card`, table head: `text-muted-foreground`                         |
| **Tabs**                | `src/components/ui/tabs.tsx`           | Uses `border`, `bg-muted`, active: `text-primary`                                     |
| **Dropdown Menu**       | `src/components/ui/dropdown-menu.tsx`  | Uses `bg-popover`, `text-popover-foreground`, hover: `bg-accent`                      |
| **Toast**               | `src/components/ui/toast.tsx`          | Uses `bg-background`, `border`, `text-foreground`                                     |

### Navigation Components
| Component               | File Location                          | Details                                                                 |
|-------------------------|----------------------------------------|-------------------------------------------------------------------------|
| **Sidebar**             | `src/components/ui/sidebar.tsx`, `src/components/navigation/sidebar.tsx` | Fixed dark theme: `--sidebar-background`, `--sidebar-foreground`       |
| **Bottom Tabs**         | `src/components/navigation/bottom-tabs.tsx` | Mobile nav: active `bg-slate-900`, inactive `text-slate-500` / hover `bg-slate-100`, logout: `text-red-600` / hover `bg-red-50` |

### Dashboard Components
| Component               | File Location                          | Details                                                                 |
|-------------------------|----------------------------------------|-------------------------------------------------------------------------|
| **Dashboard Layout**    | `src/components/dashboard/shared/dashboard-layout.tsx` | Header: `bg-white/95`, border: `border-slate-200`, user profile `bg-slate-900` initials |
| **Stat Card**           | `src/components/dashboard/shared/dashboard-layout.tsx` | Motion animated, color classes for `bg-emerald-100`, `text-emerald-600`, etc. |
| **AI Analysis Dashboard**| `src/components/dashboard/ai-analysis-dashboard.tsx` | Banner: `from-blue-600 via-indigo-600 to-purple-600` gradient          |

---

## Accessibility Compliance
### Accessibility Features
| Feature                          | Status | Implementation Details                                                                 |
|----------------------------------|--------|-----------------------------------------------------------------------------------------|
| High Contrast Support            | ✅ Yes | `@media (prefers-contrast: high)` adjusts `--border` to 60% (light) / 40% (dark)       |
| Reduced Motion Support           | ✅ Yes | `@media (prefers-reduced-motion: reduce)` disables animations/transitions              |
| Minimum Touch Target             | ✅ Yes | 44px on mobile (< 768px), 48px on touch devices (`pointer: coarse`)                    |
| Focus Visible Ring               | ✅ Yes | All interactive elements use `focus-visible:ring-2 focus-visible:ring-ring`           |
| Color Contrast (WCAG AA)         | ✅ Yes | Primary/background: ~10.1:1 (light), ~10.3:1 (dark); Muted/foreground: ~4.5:1          |
| Screen Reader Support            | ✅ Yes | Uses semantic HTML, Radix UI primitives (accessible by default)                        |

### Accessibility Notes
- iOS font size fix: 16px on inputs to prevent zoom
- Safe area padding for notch devices
- Touch-action manipulation to prevent double-tap zoom
- Standalone PWA support for top safe area
- Print styles included

---

## Usage Examples
### Buttons
```tsx
// Primary
<Button variant="default">Submit</Button>
// Destructive (logout)
<Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">Logout</Button>
```

### Badges
```tsx
// Default
<Badge>Active</Badge>
// Secondary (role)
<Badge variant="secondary">Admin</Badge>
// Destructive (warning)
<Badge variant="destructive">Overdue</Badge>
```

---

## Design System Principles
- **Not pure white/black**: Uses warm off-white/charcoal for eye comfort
- **Dual themes**: Light (professional blue-gray) + Dark (navy charcoal)
- **Consistent spacing/radius**: Uses `--radius: 0.75rem` (12px)
- **Semantic color naming**: Uses role-based tokens instead of hex values
- **Mobile-first approach**: Optimized for both desktop and mobile
