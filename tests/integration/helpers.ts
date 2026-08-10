import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@/types/roles';

const URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Test-only marker prefix so a leftover-cleanup sweep can find every row these tests ever created, independent of individual test bookkeeping. */
export const TEST_PREFIX = 'itest_';

let serviceClient: SupabaseClient | null = null;
export function getServiceClient(): SupabaseClient {
  if (!serviceClient) {
    serviceClient = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return serviceClient;
}

export function getAnonClient(): SupabaseClient {
  return createClient(URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: UserRole;
}

/**
 * Creates a real auth.users row (via the admin API) plus a matching
 * user_profiles row with the given role, so tests exercise RLS the same
 * way a real signed-in session does — current_user_role() reads
 * user_profiles by auth.uid(), which only works for a genuine session,
 * not a service-role bypass.
 */
export async function createTestUser(role: UserRole, overrides: Record<string, any> = {}): Promise<TestUser> {
  const svc = getServiceClient();
  const email = `${TEST_PREFIX}${role.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = 'Test-password-1234!';

  const { data: authUser, error: authError } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authUser.user) throw new Error(`createTestUser: auth.admin.createUser failed: ${authError?.message}`);

  const { error: profileError } = await svc.from('user_profiles').insert({
    id: authUser.user.id,
    email,
    name: `${TEST_PREFIX}${role}`,
    role,
    status: 'active',
    ...overrides,
  });
  if (profileError) throw new Error(`createTestUser: user_profiles insert failed: ${profileError.message}`);

  return { id: authUser.user.id, email, password, role };
}

/** A real authenticated client for the given test user — RLS evaluates exactly as it would for that user in production. */
export async function getClientAs(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw new Error(`getClientAs(${user.email}): sign-in failed: ${error.message}`);
  return client;
}

export async function deleteTestUser(userId: string): Promise<void> {
  const svc = getServiceClient();
  await svc.from('user_profiles').delete().eq('id', userId);
  await svc.auth.admin.deleteUser(userId);
}

/** Safety-net sweep: deletes every user_profiles/auth row this test suite has ever created, in case an individual test's own cleanup didn't run (a thrown assertion, a crashed run). Call from a global afterAll if you want a fully clean slate. */
export async function sweepAllTestUsers(): Promise<void> {
  const svc = getServiceClient();
  const { data } = await svc.from('user_profiles').select('id').like('email', `${TEST_PREFIX}%`);
  for (const row of data ?? []) {
    await deleteTestUser(row.id);
  }
}
