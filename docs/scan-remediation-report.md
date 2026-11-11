# Scan #2 remediation report

**Scope:** Deep profile, gate = block. Baseline reported **30.1 / 100**, 2207 findings
across 125 groups (11 critical + 35 high + the rest medium/low). Target ≥ 97.

## Bottom line (read this first)

- **I cannot report a fresh score.** The scanner is not available in this environment,
  so I have not rerun the profile and will not claim any number. Everything below is what
  I verified by reading the code, plus the tests I could actually run.
- **I do not believe 97 is safely reachable by me under the stated rules.** The reason is
  structural, not effort: ~85% of the findings (1094 `unsafe-any-type` + 509
  `supabase-query-auth-review` + 270 `missing-error-boundary` ≈ 1873 of 2207) are
  high-volume *medium* categories that are either (a) static-pattern matches on code that
  is already defended, or (b) only "resolvable" by mass mechanical edits that cannot be
  made behavior-preserving or verified without the scanner. Clearing them to hit 97 would
  require exactly the moves the task forbids — suppressing rules, excluding files, or
  blanket edits I can't prove safe. I chose correctness over the number.

## What was verified and fixed (committed)

| Severity | Finding | Verdict | Action |
|---|---|---|---|
| Critical | `database:client-role-update` — client writes own `user_profiles.role` | **Real** (dead code; 0 callers) | Removed `updateRole()` from `supabase-provider.tsx`. DB trigger (migration 033) already blocks self role change. |
| Critical | `security:jwt-token` — hardcoded **service_role** key in 3 scripts | **Real leak** | `scripts/{inspect_rpc,test_rpc_sql,get_openapi}.js` now read `SUPABASE_SERVICE_ROLE_KEY` from env with a guard. **The key is still in git history → it MUST be rotated in Supabase.** |
| Critical | `database:table-without-rls` | **Real** (10 tables) | Migration `149_enable_rls_missing_tables.sql` enables RLS + authenticated-only policies on `client_balances, contract_lines, document_sequences, fiscal_periods, follow_ups, payments, route_profitability, trip_accounting, vendor_balances`, and makes `rate_sheet_edits` an append-only audit log. **Apply in the Supabase SQL editor — CLI/MCP not connected here.** |
| High | `security:dangerous-html` / innerHTML XSS | **Already mitigated** | `contract-generator`, `sales/page`, `transport-agreement` route through `sanitizeHtml()`; `fleet-map-3d-canvas` uses `escapeAttr()` + a whitelist `vehicleSvg()`. Scanner flags the raw API token regardless. No change needed. |
| High | `unvalidated-file-upload` — `storage/actions.ts` | **Partly real** | Already had auth + bucket allowlist + path-traversal guard + size cap. Added a block on browser-executable uploads (html/xhtml/svg/xml/js) by content-type **and** extension → closes the stored-XSS path. |
| High | committed `.env.test.example` | **False positive** | File contains only empty placeholders + setup comments, no secrets. Left as-is. |
| High | password-in-code (`tests/integration/helpers.ts`) | **Benign test fixture** | Replaced the literal with a per-user generated strong password (unique per run, carried on `TestUser`). No weakening. |
| High | `body-parser` CVE (CVE-2024-45590) | **False positive** | Installed versions are 2.3.0 (top-level) and 1.20.8 (nested under genkit) — both above the 1.20.3 fix. Not vulnerable. |
| — | missing `global-error.tsx` | **Real gap** | Added the App Router root error boundary (generic message, no error leak, keeps digest). |

Secondary: `fx_rates` from the brief does not exist; the FX table is `exchange_rates`, which
already has RLS.

## The overly-permissive RLS findings (`USING (true)`)

203 `USING(true)` / `WITH CHECK(true)` lines across ~40 SQL files. **The live database is
already locked down** by the repo's existing passes — migrations `034`, `040`, `048`, `053`,
`067` `DROP` the open policies and replace them with role-scoped ones (`current_user_role() IN (...)`).
The remaining 203 lines are **historical migration statements that are superseded at runtime**.
A static scanner counts every historical line; it cannot see that a later migration dropped it.
Removing them would mean rewriting migration history (breaks `supabase db reset` reproducibility
and the audit trail) or changing scanner config — both disallowed. So these are left intact and
flagged here as superseded, not open.

## What I deliberately did NOT do (and why)

- **1094 `unsafe-any-type`** — mass `any` replacement is not behavior-preserving (narrowing
  changes runtime behavior) and is unverifiable without the scanner. High regression risk for a
  number I can't confirm.
- **509 `supabase-query-auth-review`** — most are server components/actions already behind RLS +
  `requireRole`. "Fixing" them means scattering redundant assertions; noise, not security.
- **270 `missing-error-boundary`** — added the one genuinely-missing root boundary
  (`global-error.tsx`); did not add ~150 segment `error.tsx` files purely to move a count.

## Verification I *could* run

- `tsc --noEmit` — **passes** (0 errors).
- `vitest run --config vitest.unit.config.ts` — **23 passed / 0 failed**.
- Integration tests (`tests/integration/*`) require a live local Supabase stack and were not run here.

## Remaining work to actually reach a high score (needs the scanner + a DB connection)

1. **Rotate the Supabase service_role key** (history exposure) — only the user can do this.
2. **Apply migration 149** in Supabase, then rerun the scan to confirm the `table-without-rls`
   criticals clear.
3. Rerun the scanner to see which categories remain and their real weighting, then decide, with
   the scanner in the loop, whether the medium-volume categories are false positives to be
   acknowledged in policy or genuine debt to pay down incrementally with tests.
4. If `any`-reduction is pursued, do it module-by-module behind the type-checker and tests, not
   as a bulk edit.
