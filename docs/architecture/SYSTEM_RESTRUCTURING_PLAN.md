# System Restructuring Plan

Last updated: 2026-06-25

## Objective

Establish a clear operational order for the logistics platform while preserving current business functionality. The system should feel like one command workflow, not a collection of unrelated pages.

## Target Operational Flow

1. Command dashboard: executive status, alerts, approvals, and live operational risk.
2. Sales and customers: customer pipeline, bookings, contracts, and rate agreements.
3. Dispatch: trips, shipment execution, route planning, live map, and trip history.
4. Fleet: vehicles, tracking, fuel, maintenance, service requests, and compliance.
5. Inventory: stock, spare parts, parts requests, and warehouse activity.
6. Finance: income, expenses, accounting ledger, payments, and statutory reporting.
7. Reports: fleet performance, driver performance, fuel, route profitability, and vehicle revenue.
8. People: users, drivers, payroll, meetings, insurance, and HR compliance.
9. System: audit trail, notifications, profile, AI operations, and admin-only controls.

## Navigation Standard

The source of truth for application routing is `src/lib/route-config.ts`.

Rules:

- Every route must have a clear owner category when it is user-facing.
- Detail, creation, import, driver-subflow, and legacy routes should remain permission-checked but use `showInNavigation: false`.
- Sidebar and mobile navigation must use `getNavigationMenuByRole()` instead of filtering route arrays locally.
- Route guard debug logging is opt-in through `NEXT_PUBLIC_ROUTE_DEBUG=true` and should not spam production users.
- Default landing pages should match each role's main workflow.

## Folder Organization

Current target structure:

- `src/app`: route-level pages and API endpoints.
- `src/components/navigation`: sidebar, mobile tabs, and navigation chrome.
- `src/components/dashboard`: shared dashboard layout and role-specific dashboard surfaces.
- `src/components/ui`: reusable UI primitives.
- `src/services`: business data services.
- `src/lib`: shared infrastructure, route registry, Supabase helpers, AI/database context, and utilities.
- `src/types`: shared domain types.
- `database/migrations`: baseline and ordered migration scripts.
- `database/patches`: module-specific repair and feature SQL.
- `database/debug`: diagnostic SQL only.
- `database/seed`: destructive or environment-specific seed/cleanup scripts.
- `docs/architecture`: durable design and system structure.
- `docs/setup`: setup and deployment instructions.
- `docs/troubleshooting`: historical fixes, debt register, and known failure modes.
- `templates`: reusable import/export templates and historical UI templates.

## Cleanup Policy

Safe to remove:

- Generated build caches such as `tsconfig.tsbuildinfo`.
- Transient logs such as `deploy.log`, `deploy_output.log`, `npx_test.log`, `tscheck.txt`, `tsc_trace.txt`, and `typescript-errors.txt`.
- Throwaway scripts once their behavior has either been migrated into real app code or documented.

Review before removal:

- SQL scripts, because they may contain production recovery steps.
- Legacy templates, because they may be used for document generation or customer-facing exports.
- Environment files, because they may be active deployment configuration.

Do not remove without replacement:

- Business services, route handlers, migrations, RLS policies, role definitions, shared UI primitives, or auth/session code.

## Completed In This Pass

- Centralized visible navigation through `getNavigationMenuByRole()`.
- Added explicit navigation category order and labels.
- Hid detail/import/legacy/driver subflow routes from primary navigation while preserving access checks.
- Renamed confusing visible menu labels: fuel approvals and AI operations.
- Changed HR default landing page from finance to people management.
- Gated route guard debug logs behind `NEXT_PUBLIC_ROUTE_DEBUG=true`.
- Trimmed obvious unused navigation imports/state.

## Next Structural Passes

1. Normalize domain naming between database snake_case and TypeScript camelCase models.
2. Split large dashboard components into role dashboards and reusable widgets.
3. Consolidate duplicate SQL repair scripts into ordered migration bundles.
4. Add module READMEs for Sales, Dispatch, Fleet, Finance, People, Insurance, and AI.
5. Add smoke tests for route guards, logout behavior, insurance workflows, and role navigation.
