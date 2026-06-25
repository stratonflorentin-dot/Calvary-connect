# Calvary Connect UI Component Inventory & Design System
## Core Principles
The platform is calm, data-dense, and trustworthy. No decorative gradients, glows, or heavy shadows. Flat surfaces, generous whitespace, minimal borders. Every color choice should serve information hierarchy — not decoration.

---

## Color System
### Core Rules
- **Use semantic CSS tokens only**: No raw hex values in components
- **Dual light/dark theme support**: All colors have both light and dark variants
- **Sidebar is always dark**: Independent of page theme

### Core Palette
| Token | Light (Hex/RGB) | Dark (Hex/RGB) | Usage Context |
|-------|-----------------|----------------|---------------|
| `--background` | `#EEF0F5` / `rgb(238, 240, 245)` | `#141E2D` / `rgb(20, 30, 45)` | Page/shell background (warm off-white / deep navy) |
| `--card` | `#F5F6FA` / `rgb(245, 246, 250)` | `#192335` / `rgb(25, 35, 53)` | Card surface (slightly lighter than background) |
| `--primary` | `#1565C0` / `rgb(21, 101, 192)` | `#3B8CE8` / `rgb(59, 140, 232)` | Primary buttons, active nav, progress fills, focus rings |
| `--accent` | `#1BA3CC` / `rgb(27, 163, 204)` | `#2AADE0` / `rgb(42, 173, 224)` | Secondary highlights, in-transit badges |
| `--destructive` | `#E53935` / `rgb(229, 57, 53)` | `#C0392B` / `rgb(192, 57, 43)` | Errors, overdue states, delete actions |
| `--muted-foreground` | `#6C7A96` / `rgb(108, 122, 150)` | `#7E90AB` / `rgb(126, 144, 171)` | Helper text, placeholders |
| `--border` | `#CDD1DE` / `rgb(205, 209, 222)` | `#253248` / `rgb(37, 50, 72)` | Dividers, borders, inputs |

### Sidebar (Always Dark)
| Token | Value (Hex/RGB) | Usage |
|-------|-----------------|-------|
| `--sidebar-background` | `#18213A` / `rgb(24, 33, 58)` | Sidebar background |
| `--sidebar-foreground` | `#CBD5E8` / `rgb(203, 213, 232)` | Sidebar text (inactive) |
| `--sidebar-primary` | `#3B8CE8` / `rgb(59, 140, 232)` | Active nav background |

### Chart Colors
| Order | Light (Hex/RGB) | Dark (Hex/RGB) |
|-------|-----------------|----------------|
| 1     | Primary blue (#1565C0) | Primary blue (#3B8CE8) |
| 2     | Accent teal (#1BA3CC) | Accent teal (#2AADE0) |
| 3     | Amber (#F5A623) | Amber (#F5A623) |
| 4     | Green (#2E7D32) | Green (#2E7D32) |
| 5     | Destructive red (#E53935) | Destructive red (#E53935) |

---

## Typography & Spacing
### Font Rules
- **Weights only**: 400 (body) and 500 (headings/labels) — never use 600 or 700
- **Sentence case everywhere**: No ALL CAPS, no Title Case
- **Body text**: 14px, line-height: 1.7
- **Headings**: 
  - h1: 22px, weight 500
  - h2: 18px, weight 500
  - h3: 16px, weight 500

### Border Radius
| Component | Radius |
|-----------|--------|
| Cards | 0.75rem (12px) |
| Inputs, buttons, badges | 8px |
| Sidebar nav items | 7px |
| Badges (pill-shaped) | 99px |

### Spacing
- **Base grid**: 8px
- **All spacing uses multiples**: 8px, 16px, 24px, 32px, etc.

---

## Component Specifications
### Buttons
Six variants only. All use 8px border radius:

| Variant | Styles | Usage |
|---------|--------|-------|
| `primary` | `bg-primary`, `text-white` | Primary actions |
| `secondary` | `bg-secondary` (D8DCE8 / 243047), `text-foreground` | Secondary actions |
| `accent` | `bg-accent`, `text-white` | Accent actions |
| `outline` | `bg-transparent`, `border border-border`, `text-primary` | Neutral actions |
| `destructive` | `bg-destructive`, `text-white` | Delete/danger actions |
| `ghost` | `bg-transparent`, `border-none`, hover: `bg-accent/10` | Subtle actions |

### Badges
Pill-shaped (border-radius 99px), 8px base:

| Variant | Usage |
|---------|-------|
| Primary | Active states |
| Accent | In-transit badges |
| Destructive | Overdue/destructive |
| Secondary | Roles/labels |
| Outline | Neutral |

### Cards
- Background: `--card` (white in light, #192335 in dark)
- Border: 0.5px `--border`
- Radius: 0.75rem (12px)
- Padding: 1rem x 1.25rem

#### Stat Cards
- Background: `--muted` surface
- No border
- Label: 12px
- Value: 22px

### Inputs & Selects
- Border: `--border`
- Background: `--background`
- Radius: 8px
- Font: 14px
- Focus: `ring-2 ring-primary`
- Placeholder: `--muted-foreground`

### Tables
- Header: `bg-muted`
- Header labels: 11px, uppercase, letter-spacing 0.06em
- Rows: 0.5px `--border` between rows, **last row no border**

### Alerts
- Left 3px border (no radius)
- Background: light tint of alert semantic color
- Text: matching dark color from same family

### Sidebar Navigation
- Text: 13px
- Inactive: `--sidebar-foreground`
- Active: white text on `--sidebar-primary`
- Radius: 7px
- Touch target: min 44px mobile

---

## Accessibility
### Compliance Rules
- **WCAG AA contrast minimum**: All text meets or exceeds
- **Focus visible**: All interactive elements have `focus-visible:ring-2`
- **Touch targets**:
  - Mobile (< 768px): min 44px
  - Coarse pointer devices: min 48px
- **User preferences**:
  - `prefers-reduced-motion`: Disable all transitions/animations
  - `prefers-contrast: high`: Increase border opacity
  - iOS inputs: 16px to prevent zoom
- **Semantics**: Semantic HTML + Radix UI primitives throughout
