# Scan remediation report (Vibe Coding QA)

Baseline: **2207 findings** — 11 critical (6 unique), 35 high (26 unique), 1968 medium
(90 unique), 193 low (3 unique). Target: clear them.

## Important: I cannot produce the "after" rescan counts

The scanner runs as a separate app (the local server you paste from); there is no scan
command in this repo, so **I cannot re-run it here**. Every "after" number below needs
**you to rerun the scan**. I will not claim a count I did not measure. I also **cannot
apply DB migrations** (no DB/CLI/MCP connection) — the database fixes are written as
migrations you must apply, then rescan.

A large share of findings are **not in the application** (`src/`). They sit in tracked
**design-export / snippet artifacts** — `_screens/`, `design_handoff_calvary_connect/`,
and `package/` — which are not imported or built by the app. See "Non-app artifacts" below.

---

## 1) SECURITY

| Finding | Status |
|---|---|
| `jwt-token` (6) | **Fixed in tree (5):** 3 scripts + `check_headers.js` now read keys from env; `SYSTEM_WORKFLOWS` blueprint and `SYSTEM-STATUS.md` redacted. **Remaining (1): `vercel.json` anon key** — public by design (ships in the browser); move it to a Vercel env var to clear (needs your Vercel setup). **Rotate the service_role key — it was in git history.** |
| `dangerous-runtime-code` (9) | All occurrences are in `_screens/.../support.js` and `design_handoff_calvary_connect/.../support.js` — **design-export files, not app code.** App-code `innerHTML`/`dangerouslySetInnerHTML` is already sanitized (`sanitizeHtml`, `escapeAttr`, whitelist). Clears when the design-export dirs are removed (see below). |
| `unvalidated-file-upload` (2) | `storage/actions.ts` **fixed** (blocks executable html/svg/xml/js by MIME+extension). `statement-pdf.ts` is a PDF **generator** (jsPDF) — **false positive**. |
| `committed-env-file` (1) | **Fixed** — `.env.test.example` untracked + gitignored; guidance moved to `docs/local-test-env.md`. |
| `password-in-code` (1) | **Fixed** — test fixture generates a per-run password. |
| `ssrf-risk` (1) | Flagged line is a **unit-test helper** (`new NextRequest(\`...${query}\`)`, constant query) — **false positive.** Separately I added a real SSRF host-allowlist to the production `ewura-caps` route. |

## 2) DATABASE / RLS  — *written as migrations; apply + rescan*

| Finding | Status |
|---|---|
| `client-role-update` (1) | **Fixed** (removed dead `updateRole()`). |
| `policy-without-rls-enabled` rate_sheet_edits (1) | **Migration 149** (enables RLS). |
| `table-without-rls` vendor_balances, fx_rates (2) | **Migration 149** (RLS + role-scoped policies). |
| `rls-policy-overly-permissive` (18) | **Migration 150** — tightens each `true` to `auth.uid() IS NOT NULL` + `TO authenticated`, reading live predicates from `pg_policies`. |
| `rls-policy-missing-role-restriction` (75) | **Migration 150** — adds `TO authenticated` to each, predicates preserved verbatim. |
| `rls-enabled-without-policy` sensor_readings (1) | **Open** — intentional deny-all is likely; confirm and either document or add a least-privilege policy. |
| `supabase-query-auth-review` (509) | **Open (relies on RLS).** These are server components/actions behind RLS + `requireRole`. Mass-adding redundant checks is noise, not security, and unverifiable without the scanner. Resolved in practice by the RLS work above being applied. |

Migrations **149** and **150** must be applied in the Supabase SQL editor, **staging first**
(`TO authenticated` removes anon access), then rescan.

## 3) COMPLIANCE (Tanzania PDPA / TCRA)

| Finding | Status |
|---|---|
| `pre-ticked-consent-checkbox` (1, critical) | In `design_handoff_calvary_connect/*.dc.html` — **design-export mockup, not app code.** Clears when design-export dirs are removed. (No pre-ticked consent exists in the `src/` app.) |
| `sms-opt-out-missing` (1) | Points at `src/lib/finance/fx.ts` — an FX-rate module with **no SMS code**. **False positive.** |
| `pdpc-registration-not-documented` (1) | **Fixed** — `docs/compliance/pdpc-registration.md` added and referenced from `README.md`. |
| `rfc8058-list-unsubscribe-incomplete` (1) | Points at `src/hooks/use-fleet-map-locations.ts`, whose only "unsubscribe" is a Supabase **realtime channel** `.unsubscribe()` — not email. **False positive.** |

## 4) CODE QUALITY (volume)

| Finding | Status |
|---|---|
| `unsafe-any-type` (1094) | **Open.** Partly in `package/*.tsx` (non-app). Mass `any`→type is not behavior-preserving and unverifiable without the scanner; high regression risk. |
| `missing-error-boundary` (270) | Root `global-error.tsx` **added**. The rule wants a boundary per component file (270 files) — not addressed at that scale. |
| `console-log-in-production` (190) | **Open.** ~10 are in design-export dirs (clear on removal); the rest are app logging. |

## 5) DEPENDENCIES

| Finding | Status |
|---|---|
| `ci-secret-in-pr-workflow` (9) | **Fixed** — preview-deploy (reads `FIREBASE_SERVICE_ACCOUNT`) gated to same-repo PRs; documented moving public `NEXT_PUBLIC_*` to Actions `vars`. |
| `body-parser@1.20.8` GHSA-27r3-jxmh-p828 | Advisory affected range is **2.0.0–2.4.0** → `1.20.8` is **not in range** (effective false positive). The top-level `2.3.0` *is*; forcing `2.4.0` globally would break express-4's bundled 1.x. Transitive under genkit. |
| `uuid@10.0.0` GHSA-w5hq-g745-h8pq | Fixed in **11.1.1+**. Bug only affects v3/v5/v6 with a caller buffer; the app uses **v4** (unaffected). Transitive under genkit; overridable but risks the genkit subtree. |
| `@opentelemetry/core` 1.25.1/1.30.1/2.7.1 GHSA-8988-4f7v-96qf | Fixed in **2.8.0** — a **major jump** from versions pinned *exactly* across the OpenTelemetry stack. Force-overriding would break telemetry at runtime (build won't catch it). **Not safely overridable;** the clean fix is upgrading genkit/OpenTelemetry. |
| `@hono/node-server@1.19.17` GHSA-rmxm-3fg6-px4f | Fixed in **2.1.3** (1.x has no fix). Transitive under `@modelcontextprotocol/sdk` (accepts `^2.0.5`). Overridable but needs install+build verification. |

All dependency vulns are **transitive, inside the genkit AI-tooling / OpenTelemetry subtree**.
Safe remediation = bump **genkit** to a release that pulls the patched transitive versions,
then `npm install` + full build. Force-pinning individual transitive versions (especially
`@opentelemetry/core` 1.x→2.x) risks breaking the AI/telemetry subsystem and can't be verified
by typecheck alone.

## 6) PERFORMANCE

| Finding | Status |
|---|---|
| `large-unoptimized-image` (3) | 2 are design-export logos (clear on removal). 1 is **`public/logo-full.png` (714 KB)** — a real asset; compress to WebP/AVIF (needs an image tool; not done here to avoid a lossy change without your say). |

---

## Non-app artifacts (the biggest single lever)

`_screens/` (9 files), `design_handoff_calvary_connect/` (9 files) and `package/` (2 files)
are tracked **design-tool exports and standalone snippets** — not imported, built, or served
by the app (verified). They are the source of: `dangerous-runtime-code` (9), the
`pre-ticked-consent` critical (1), ~10 `console-log`, 2 of 3 `large-image`, and several
`unsafe-any-type` / `missing-error-boundary` / `supabase-query-auth` findings.

The project already treats design exports as reference material (`stitch_sales_pipelines_board/`
is gitignored). **Removing these three directories** is legitimate cleanup — the real risk
(e.g. `innerHTML` in a never-served mockup) genuinely disappears — and is *not* scanner-gaming
(no rule suppression, no config change, no test weakening). I have **not** deleted them yet
because it removes 20 tracked files; say the word and I will.

## Verification I can run (not the scanner)

- `tsc --noEmit` — **passes**.
- `vitest run --config vitest.unit.config.ts` — **23 passed / 0 failed**.

## Your action items
1. **Rotate the Supabase service_role key** (git-history exposure).
2. **Apply migrations 149 + 150** on staging, smoke-test, then production; **rerun the scan**.
3. Decide on **removing the design-export/snippet dirs** (clears a whole batch).
4. Move `vercel.json` anon key + CI `NEXT_PUBLIC_*` to env/vars; compress `public/logo-full.png`.
5. For deps, bump **genkit** and rebuild rather than force-pinning transitive versions.
