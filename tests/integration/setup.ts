import { config } from 'dotenv';
import { existsSync } from 'fs';
import path from 'path';

// Loaded before any test file, per vitest.config.ts's setupFiles.
const envPath = path.resolve(__dirname, '../../.env.test.local');
if (!existsSync(envPath)) {
  throw new Error(
    `Missing ${envPath}.\n\n` +
      'These are integration tests — they run against a real local Postgres, not a mock.\n' +
      '1. Install Docker (required by `supabase start`).\n' +
      '2. Run `npx supabase start` from the repo root.\n' +
      '3. Copy .env.test.example to .env.test.local and fill in the URL/keys it prints.\n' +
      '4. Run `npx supabase db reset` to apply every migration in supabase/migrations/ fresh.\n',
  );
}
config({ path: envPath });

for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[key]) {
    throw new Error(`${key} is empty in .env.test.local — copy the value \`supabase start\` printed.`);
  }
}
