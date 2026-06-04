"use client";

import { createClient } from '@supabase/supabase-js';

/**
 * Returns a Supabase client suitable for client components.
 * Tries to use auth-helpers helper when available; falls back
 * to a plain `createClient` using public env vars.
 */
export function getSupabaseClient() {
    try {
        // Try to dynamically require the auth-helpers factory if present
        // (some build environments may not expose it during prerender)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const authHelpers = require('@supabase/auth-helpers-nextjs');
        if (authHelpers && typeof authHelpers.createClientComponentClient === 'function') {
            return authHelpers.createClientComponentClient();
        }
    } catch (e) {
        // ignore - fall back to createClient
    }

    // Fallback: use public env vars to create a generic client
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
    if (!url || !anon) {
        // Provide a minimal no-op client shape to avoid runtime crashes during prerender
        // Callers should guard against missing network access in SSR/build environments.
        return {
            from: () => ({ select: async () => ({ data: null, error: null }) }),
            rpc: async () => ({ data: null, error: null }),
        } as any;
    }

    return createClient(url, anon);
}
