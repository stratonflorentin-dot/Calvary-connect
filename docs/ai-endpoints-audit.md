# AI Endpoints — Security & Correctness Audit

_Reviewed all ~16 `/api/ai/*` and `/api/ai-agents/*` routes for how they authenticate and what data
client they use. Headline: **no data leak** — RLS holds on every path. One correctness gap remains._

## Security: sound (no leak)

- **No AI route uses the service-role admin client to answer requests** (grep confirms none import
  `supabaseAdmin` for query answering), so none bypass RLS.
- The data tables the AI reads (`vehicles`, `trips`, `expenses`, `invoices`, `bank_accounts`,
  `user_profiles`, `customers`, …) all have RLS policies gated on `auth.uid() IS NOT NULL` (or a role
  check). An unauthenticated/anon server call therefore returns **nothing** — verified against
  `pg_policies`.
- `ask-company` (the main analyst) and the `ai-agents/*` routes authenticate the caller correctly:
  `authenticateAiRequest` ([ai-request-auth.ts](src/lib/ai-request-auth.ts)) validates the Bearer
  token, rejects deleted users, and returns a **caller-scoped** data client so queries run under the
  caller's own RLS — and `ai-agents` uses `requireAgentAccess` ([ai-agents/auth.ts](src/lib/ai-agents/auth.ts)).

## Correctness gap (not a leak): two routes queried as anon → empty data — FIXED

`getFleetContext(queryClient = supabase)` ([ai-database-context.ts:220](src/lib/ai-database-context.ts))
defaults to the anon browser singleton. `api/ai/analyze` and `api/ai/forecast` called it **without
authenticating and without passing a caller client**, so on the server `auth.uid()` was null and every
query came back empty — the AI "analyzed" nothing. (`notebook` was a false positive: the grep matched a
*comment* mentioning `getFleetContext`; it actually authenticates via `requireFleetReportAccess` and
queries with an access-checked client — no change needed.)

**Fixed** by mirroring `ask-company` in both routes:

```ts
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';
const { dataClient } = await authenticateAiRequest(request);
const context = await getFleetContext(dataClient);
// outer catch: status = error instanceof AiRequestAuthError ? error.status : 500
```

No client changes were needed: a codebase search found **neither endpoint is called anywhere** (the
AI dashboard's "forecast" is a client-side model, not `/api/ai/forecast`). So these are unwired
endpoints, now authenticated and RLS-correct for whenever they're used — zero breakage risk. A caller
that wires them later must send `Authorization: Bearer <access token>`, as the ask-company client does.

## Anti-abuse: authenticate the body-data LLM routes

These routes don't query the DB (they take client-supplied data and call a **paid** LLM), so they were
not a data-leak risk, but being callable unauthenticated is a cost/abuse vector. Added a token check
(`authenticateAiRequest`) to the three whose caller (`callAiRoute`) already sends the Bearer token —
**zero client change, zero breakage**:

- `ceo-insights`, `fuel-prediction`, `predictive-maintenance` — ✅ now require a valid session.
- `diagnose` — already blocked in production (dev-only GET); left as-is.

✅ **DONE** — the remaining four are now authenticated too, with their callers updated to send the
Bearer token (`supabase.auth.getSession()` / `getAiAccessToken()`):

- `dispatch-suggestion` (trip form) — also queries the DB via `getDispatchContext`, which now takes a
  `queryClient` param so it runs under the caller's RLS (was anon/empty, like analyze/forecast).
- `driver-performance-summary`, `customer-relationship-summary` — authenticate-only (body data).
- `tts` — authenticate-only (paid ElevenLabs API).

Every `/api/ai/*` route is now authenticated (or prod-blocked, for `diagnose`). **Verify with a login**
that these four features still work end to end.

## Lower-priority follow-ups

- Review the ~69 `anon`-executable SECURITY DEFINER functions (advisor WARN) and revoke `anon` from
  any not needed by the public routes (`/track`, `/q/[token]`, `/api/health`). Do with care — revoking
  one a public route relies on breaks that page.
