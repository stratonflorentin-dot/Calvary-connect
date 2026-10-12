# Calvary Connect AI Data Flow

## End-to-end flow

```mermaid
flowchart LR
  UI[AI dashboard] -->|message + Supabase access token| API[/api/ai/ask-company]
  API --> AUTH[Validate token and active profile]
  AUTH --> RLS[Caller-scoped Supabase client]
  RLS --> DB[(Supabase operational tables)]
  DB --> Q[Fetch tables and record per-table connection status]
  Q --> METRICS[Compute server-side fleet and finance metrics]
  METRICS --> PROMPT[Build grounded prompt with data health]
  PROMPT --> OR[OpenRouter]
  OR -->|error or unavailable| GROQ[Groq fallback]
  OR -->|success| FORMAT[Markdown report response]
  GROQ --> FORMAT
  FORMAT --> UI
  UI --> RENDER[Render headings, tables and lists]
  RENDER --> META[Show provider, source, connectivity and timestamp]
```

## Runtime behavior

1. The browser sends the user's current Supabase access token with the question. It sends chat history, but does not submit trusted financial or fleet metrics.
2. The API validates the token through Supabase Auth and confirms the profile is active. The API rejects missing, expired, or deleted-profile sessions.
3. A Supabase client carrying that user's token queries the operational tables. Row-level security remains in effect; the service-role key is used only to verify the session and profile.
4. The AI context loader records a connection result and row count for each table. Query failures remain visible as unavailable sources instead of being silently treated as zero records.
5. The server computes current metrics from the fetched records, preserving TZS and USD as separate currencies, then passes the data and connectivity status to the model.
6. `AI_PROVIDER=openrouter` prefers OpenRouter; `AI_PROVIDER=groq` prefers Groq. If the preferred provider fails and the other key is configured, the other provider is attempted.
7. The API returns the answer with provider, generation time, data source, and per-table connectivity status. The dashboard renders the report structure and shows a source-health summary.

## Required configuration

Set the following server-side environment variables. Never use `NEXT_PUBLIC_` for secret keys.

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Caller-scoped, RLS-protected data reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side token/profile verification only |
| `OPENROUTER_API_KEY` | One AI key required | OpenRouter generation |
| `GROQ_API_KEY` | One AI key required | Groq generation and fallback |
| `AI_PROVIDER` | No | Preferred provider: `openrouter` or `groq` |

Configure the same values in local development and the production hosting environment. After changing local `.env.local`, restart the Next.js server.

## Troubleshooting

- **401:** Sign in again; the access token is missing or expired.
- **403:** The signed-in account does not have an active user profile.
- **Data connectivity shows unavailable tables:** Check Supabase availability, the user's RLS policies, and table/column names. The response should state that the affected data is incomplete.
- **AI provider unavailable:** Check the server's OpenRouter/Groq keys, provider preference, model selection, and provider status. Keep at least one key configured.
- **Answer has no table:** The formatter is adaptive; tables appear for comparisons, projections, or multiple records where the available data supports them.

## Scope

This flow describes the interactive company AI analyst. Other AI routes may use narrower input schemas or feature-specific data. External API feeds such as fuel, FX, holidays, and port schedules remain separate integration routes and are not implicitly added to this analyst's prompt.
