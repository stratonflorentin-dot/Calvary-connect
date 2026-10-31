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

## Correctness gap (not a leak): three routes query as anon → empty data

`getFleetContext(queryClient = supabase)` ([ai-database-context.ts:220](src/lib/ai-database-context.ts))
defaults to the anon browser singleton. These routes call it **without authenticating and without
passing a caller client**, so on the server `auth.uid()` is null and every query comes back empty —
the AI then "analyzes" nothing:

- `api/ai/analyze/route.ts`
- `api/ai/forecast/route.ts`
- `api/ai/notebook/route.ts`

(`ask-company` already does it right: `const { dataClient } = await authenticateAiRequest(req); await getFleetContext(dataClient)`.)

### Fix (scoped follow-up — spans route + its client caller, needs runtime test)

For each of the three routes, mirror `ask-company`:

```ts
import { AiRequestAuthError, authenticateAiRequest } from '@/lib/ai-request-auth';
// inside the handler:
const { dataClient } = await authenticateAiRequest(request);
const context = await getFleetContext(dataClient);
// ...and catch AiRequestAuthError → NextResponse.json({ error }, { status }).
```

**Important:** the browser caller for each route must send `Authorization: Bearer <access token>` (as
the ask-company client already does), or the newly-auth-required route will 401. That's why this is a
coordinated route + client change and should be verified with a real login, not shipped blind.

## Lower-priority follow-ups

- Review the ~69 `anon`-executable SECURITY DEFINER functions (advisor WARN) and revoke `anon` from
  any not needed by the public routes (`/track`, `/q/[token]`, `/api/health`). Do with care — revoking
  one a public route relies on breaks that page.
