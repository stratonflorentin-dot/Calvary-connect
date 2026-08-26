import path from 'path';
import { defineConfig } from 'vitest/config';

// Separate from vitest.config.ts on purpose: that one's setupFiles requires
// a live local Supabase instance (tests/integration/setup.ts throws without
// .env.test.local). These are pure-function unit tests over deterministic
// calculations — no DB, no Docker, safe to run anywhere including CI without
// a database service.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
