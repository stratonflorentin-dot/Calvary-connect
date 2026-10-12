# Security maintenance

## Dependency audit snapshot

Reviewed 12 October 2026 with `npm audit`: **0 critical, 19 high, 58 moderate** package findings across development and production dependencies; `npm audit --omit=dev` reports **0 critical, 12 high, 58 moderate**. `npm audit fix` applied the non-breaking fixes; safe overrides updated PostCSS, fast-glob, micromatch, and related parser dependencies. Nodemailer was updated to 10.1.0 after checking its use of the stable `createTransport` / `sendMail` API, and unused patch-package was removed. The full and production-only JSON reports are retained in `audit-report.json` and `audit-production-report.json` for this review.

The repository is **not at the requested high-vulnerability target yet**. Remaining findings include:

- `xlsx` (direct runtime dependency): current npm package has no audit fix. It parses user supplied workbooks and also generates reports. Workbook uploads are capped in size, sheets, rows, columns, and cell length, but these limits do not remove the parser risk. Replace with a maintained parser/distribution and retest all workbook exports before production.
- `eslint-config-next`, Tailwind CSS, Genkit CLI, and OpenTelemetry dependency chains: npm's proposed automatic fixes require major framework/toolchain changes or have no compatible fix. Do not run `npm audit fix --force` without a reviewed migration and full test run.
- The Genkit CLI and lint/build-only dependencies should be audited separately in CI with `npm audit --omit=dev` to distinguish shipped runtime exposure from developer tooling. A dev-only finding still matters on developer machines and CI.

Run the following in CI for every dependency update and retain the JSON output:

```powershell
npm audit --json > audit-report.json
npm audit --omit=dev
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

Prioritize fixes that stay within supported major versions. For a proposed major upgrade, review migration notes, update lockfile, run tests/build, and check generated bundle and production routes before merging. Recheck the audit after each change; don't treat a zero exit from `npm audit fix` as proof that findings are resolved.

## External health controls

- External API and map-location routes require authenticated roles; the map-location endpoint verifies the session and manager role on the server.
- The admin health dashboard is restricted to CEO/ADMIN. Realtime table reads are protected by RLS; writes use the Supabase service role on the server.
- The scheduled health endpoint accepts only a dedicated high-entropy secret and probes a fixed operation allowlist. Keep that secret in the app environment, Supabase Function secrets, and Supabase Vault; never put it in client code or committed SQL.
- PDF export includes provider health and limited external API admin audit summaries. It does not export user emails, IPs, or unrelated audit rows.
- Keep `.env.local`, `.env.test.local`, service-role keys, API Anything credentials, and downloaded audit artifacts containing environment data out of version control.
