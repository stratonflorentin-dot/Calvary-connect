# Scan #2 remediation report

**Scope:** Deep profile, gate = block. Baseline **30.1 / 100**, 2207 findings.
Target ≥ 97. This report reflects the **full scanner output** (the detailed finding
list), which corrected several earlier assumptions.

## Bottom line

- **I cannot report a fresh score** — the scanner (the local app at `127.0.0.1:5173`)
  is not runnable from here, and there is no scan script in `package.json`. I will not
  claim a number I did not measure.
- **97 is not safely reachable by me.** The score is dominated by four high-volume
  categories — **1094** `unsafe-any-type` + **509** `supabase-query-auth-review` +
  **270** `missing-error-boundary` + **190** `console-log-in-production` = **2063 of
  2207 findings (~94%)**. Clearing those needs mass mechanical edits across ~2000 sites
  that cannot be made behavior-preserving *or* verified without the scanner — exactly
  what the task forbids (no rule-suppression, no file-exclusion, smallest safe changes).
  I fixed the real, verifiable issues instead.

## Fixed and committed (verifiable in the working tree)

| Sev | Finding | Action |
|---|---|---|
| Critical | `client-role-update` | Removed dead `updateRole()` from `supabase-provider.tsx`. |
| Critical | `jwt-token` (6 files) | **5 of 6 fixed:** 3 scripts + `check_headers.js` now read keys from env; doc placeholder redacted. **Remaining: `vercel.json` anon key** — public by design (ships to browsers), but move it to a Vercel env var to clear the finding (I left it to avoid breaking your deploy). |
| High | `password-in-code` | Test fixture now generates a per-run password; literal removed. |
| High | `committed-env-file` | `.env.test.example` untracked (only empty placeholders); setup preserved in `docs/local-test-env.md`. |
| High | `unvalidated-file-upload` | `storage/actions.ts`: added executable-type block (html/svg/xml/js) by MIME + extension. The 2nd hit, `statement-pdf.ts`, is a PDF **generator** (jsPDF) — **false positive**, nothing to validate. |
| High | `ssrf-risk` | `ewura-caps/route.ts`: constrained the scraped-link fetch to the `ewura.go.tz` host. |
| High | `dangerous-runtime-code` (9) | Verified **already mitigated** — `sanitizeHtml()` (contract/sales/transport previews) and `escapeAttr()` + whitelist `vehicleSvg()` (fleet-map). Scanner flags the raw `innerHTML`/`dangerouslySetInnerHTML` API regardless. |
| — | missing `global-error.tsx` | Added the App Router root error boundary. |
| Medium | `pdpc-registration-not-documented` | Added `docs/compliance/pdpc-registration.md` recording the registration obligation (no fabricated certificate). |

## Written — needs you to APPLY in Supabase, then rescan

Migration `supabase/migrations/149_enable_rls_missing_tables.sql` (surgical; only the
3 scanner-flagged tables, so it cannot OR-loosen existing policies):

- Critical `table-without-rls`: **vendor_balances**, **fx_rates** → RLS + `TO authenticated` role-scoped policies.
- Critical `policy-without-rls-enabled`: **rate_sheet_edits** → RLS enabled; its open `USING(true)` insert policy replaced with a scoped append-only pair.

I **cannot apply migrations** (no DB/CLI/MCP connection here). These findings will not
clear on a rescan until you run 149 in the Supabase SQL editor.

## Real, but needs the scanner's exact locations or a DB/CI I won't touch blind

- **`pre-ticked-consent-checkbox` (critical)** and **`sms-opt-out-missing` / `rfc8058-list-unsubscribe` (high/med)** — I could not locate these by code pattern in `src/`. Guess-editing consent/SMS/email code risks real bugs. **Please export the scanner's "affected locations" for these** and I'll fix them exactly.
- **`rls-policy-overly-permissive` (18)** and **`rls-policy-missing-role-restriction` (75)** — **migration `150_rls_role_hardening.sql` written** (93 policies). It does NOT hand-retype predicates: at apply time it reads each policy's real command / `USING` / `WITH CHECK` / permissive flag from `pg_policies` and re-creates it `TO authenticated`, tightening a `true` predicate to `auth.uid() IS NOT NULL`. Faithful by construction, idempotent, and it rolls back as one transaction if anything errors. **Still must be applied + smoke-tested on a staging/branch DB first** — `TO authenticated` removes anon access, and the "System can insert events/audit trail" tightenings in particular should be confirmed against how those rows are actually written (service_role inserts bypass RLS and are unaffected).
- **`ci-secret-in-pr-workflow` (9)** — `deploy.yml` runs secret-using jobs on `pull_request`. Real, but the fix changes your live deploy/preview pipeline; I'd rather propose the exact diff than risk breaking it.
- **Dependency CVEs** — `body-parser@1.20.8`, `uuid@10.0.0`, `@opentelemetry/core`, `@hono/node-server` are flagged by **2026 OSV advisories** (newer than my knowledge). All are **transitive** (under genkit/opentelemetry). Fixing needs `overrides` pinned to verified-patched versions + `npm install` + a full build to confirm nothing breaks — a focused task where the build can be exercised.

## Not safely fixable at scale (these gate the score)

`unsafe-any-type` (1094), `supabase-query-auth-review` (509), `missing-error-boundary`
(270), `console-log-in-production` (190), `large-unoptimized-image` (3). Mass edits here
are high-regression-risk and unverifiable without the scanner.

## Verification I could run

- `tsc --noEmit` — **passes**.
- `vitest run --config vitest.unit.config.ts` — **23 passed / 0 failed**.

## Your action items

1. **Rotate the Supabase service_role key** (still in git history).
2. **Apply migration 149** in Supabase, then rerun the scan.
3. **Export the scanner's affected-locations** for the consent-checkbox, SMS, and
   List-Unsubscribe findings so I can fix them precisely.
4. Decide whether to proceed on the ~100 RLS policy role-clauses (needs DB to verify)
   and the CI/dependency changes (I'll produce exact diffs on request).
