# Technical Debt Register

Last updated: 2026-06-25

## Current Priority

The platform is usable, but the codebase still has broad TypeScript debt outside the insurance/navigation work. Full restructuring should continue in controlled passes so core operations are not broken.

## Known Typecheck Categories

- Contract module payload mismatch between UI models and service/database models.
- Finance components with implicit `any` values and inconsistent transaction shapes.
- Fleet service imports and user/session helper naming drift.
- Legacy package prototypes under `package/` that still compile with the main project.
- Some generated or historical scripts were previously mixed into the root directory.

## Cleanup Already Identified

Safe cleanup candidates:

- `tsconfig.tsbuildinfo`
- `deploy.log`
- `deploy_output.log`
- `npx_test.log`
- `tscheck.txt`
- `tsc_trace.txt`
- `typescript-errors.txt`
- one-off test scripts that are not referenced by package scripts or runtime imports

Review candidates:

- `depcheck-report.json`, because it should be regenerated after package cleanup.
- SQL repair scripts under `database/patches`, because they may still be useful for production recovery.
- Template files under `templates`, because they may support document generation or customer forms.

## Route And Navigation Standard

- New user-facing pages must be added to `ROUTE_CONFIG`.
- Use `showInNavigation: false` for detail pages, import flows, and legacy/external links.
- Role landing pages must be reviewed whenever a role dashboard changes.
- Avoid direct route arrays inside navigation components.

## Verification Standard

Minimum checks for each cleanup pass:

```powershell
npm.cmd run typecheck
```

When the full typecheck is still noisy, run focused checks against changed modules:

```powershell
npm.cmd run typecheck 2>&1 | Select-String -Pattern "route-config|navigation|insurance|dashboard-layout"
```

## Next Fix Queue

1. Contracts: align request/response types and database field names.
2. Finance: remove implicit `any`, normalize transaction and account types.
3. Fleet: repair stale imports and centralize current-user/session helpers.
4. Package prototypes: decide whether to move to `templates`, exclude from TypeScript, or convert into real app modules.
5. Database: produce one production migration index that explains execution order.
