Vercel: Securely storing API keys and environment variables

Overview
- For secrets (API keys, service role keys), always use server-only environment variables in Vercel (do NOT prefix with `NEXT_PUBLIC_`).
- Client-safe config (non-secret) may use `NEXT_PUBLIC_` prefixes.

Recommended variables (server-only)
- `OPENROUTER_API_KEY`  — OpenRouter secret key used by the server API.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-only).
- `GROQ_API_KEY` — Groq server key, if used server-side.

Client-visible vars
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (note: anon key is public by design)
- `NEXT_PUBLIC_OPENROUTER_BASE_URL`
- `NEXT_PUBLIC_OPENROUTER_MODEL`

Set variables via Vercel dashboard
1. Open your project in Vercel.
2. Go to Settings → Environment Variables.
3. Add `OPENROUTER_API_KEY` and any other server-only vars under the appropriate environment (Production, Preview, Development).
4. For client-visible values, set `NEXT_PUBLIC_*` keys.
5. Redeploy your project after adding/updating env vars.

Set variables via Vercel CLI
- Install Vercel CLI: `npm i -g vercel`
- Add a secret to a specific environment:

```bash
# add to production
vercel env add OPENROUTER_API_KEY production
# add to preview
vercel env add OPENROUTER_API_KEY preview
# add to development
vercel env add OPENROUTER_API_KEY development
```

- You can also pull remote env into a local file:

```bash
vercel env pull .env.local
```

Security considerations
- Never commit `.env` or secrets to git. Ensure `.gitignore` includes `.env` and `.env.local`.
- Use server-only variables for any sensitive keys; do not use `NEXT_PUBLIC_` for secrets.
- Rotate keys if they are exposed.

Testing after deploy
- After adding `OPENROUTER_API_KEY`, deploy the project and call the server endpoint `/api/ai/ask-company` from the app UI to verify responses.
- If you see errors referencing missing `OPENROUTER_API_KEY`, check that the variable is set in the correct environment (Production vs Preview).

Notes for this repo
- The server route `src/app/api/ai/ask-company/route.ts` now prefers `process.env.OPENROUTER_API_KEY` and falls back to the `genkit` client if not provided.
- If you prefer the server to always compute the DB context, remove client-sent `dbContext` and call `getFleetContext()` server-side in the API route.
