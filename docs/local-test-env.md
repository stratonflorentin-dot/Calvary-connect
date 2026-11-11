# Local integration-test environment

The integration tests (`tests/integration/*`) run against a **local** Supabase stack,
never production. Create a gitignored `.env.test.local` and fill it from what
`npx supabase start` prints once Docker is running:

```bash
npx supabase start
```

That command prints an API URL, anon key, and service_role key. These are
LOCAL-ONLY values (the default local JWT secret) — never the same as the
production project's keys, and safe to keep in a local, gitignored file.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<printed by `supabase start`>
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<printed by `supabase start`>
SUPABASE_SERVICE_ROLE_KEY=<printed by `supabase start`>
```

> Note: `.env*` files are intentionally not tracked by Git (see `.gitignore`).
> This document replaces the old committed `.env.test.example`.
