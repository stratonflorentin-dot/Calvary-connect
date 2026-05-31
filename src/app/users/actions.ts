"use server";

import { createClient } from "@supabase/supabase-js";
import { isInvitedLikeStatus } from "@/lib/user-status-utils";

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase admin credentials");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

/** After login/signup: mark invited profiles active (bypasses RLS). */
export async function activateUserOnLoginAction(
  authUserId: string,
  email: string,
) {
  const supabaseAdmin = getAdminClient();
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date().toISOString();

  const { data: byId } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("id", authUserId)
    .maybeSingle();

  const { data: byEmail } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  const profile = byId || byEmail;
  if (!profile) return null;

  const updates: Record<string, string> = {
    id: authUserId,
    updated_at: now,
    last_login_at: now,
  };

  if (isInvitedLikeStatus(profile.status)) {
    updates.status = "active";
    updates.status_reason = "Account activated after sign-in";
  }

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .update(updates)
    .eq("email", profile.email)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/** Align invited profiles with Supabase Auth (users who already signed in). */
async function syncInvitedProfilesWithAuth(
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const { data: profiles, error } = await supabaseAdmin
    .from("user_profiles")
    .select("id, email, status, last_login_at")
    .in("status", ["invited", "pending", "invite_pending", "invitation_sent", "invite"]);

  if (error || !profiles?.length) return;

  const { data: authList, error: authError } =
    await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

  if (authError || !authList?.users?.length) return;

  const authByEmail = new Map(
    authList.users
      .filter((u) => u.email)
      .map((u) => [u.email!.toLowerCase().trim(), u]),
  );

  const now = new Date().toISOString();

  for (const profile of profiles) {
    const email = String(profile.email || "").toLowerCase().trim();
    const authUser = authByEmail.get(email);
    if (!authUser) continue;

    const hasSignedIn =
      !!authUser.last_sign_in_at ||
      !!authUser.email_confirmed_at ||
      !!authUser.confirmed_at;

    if (!hasSignedIn) continue;

    await supabaseAdmin
      .from("user_profiles")
      .update({
        id: authUser.id,
        status: "active",
        status_reason: "Activated — user has signed in",
        last_login_at: authUser.last_sign_in_at || now,
        updated_at: now,
      })
      .eq("email", profile.email);
  }
}

export async function inviteUserAction(userData: any) {
  const supabaseAdmin = getAdminClient();

  // Generate Employee ID based on department if not provided
  if (!userData.employee_id) {
    userData.employee_id = await generateEmployeeId(userData.department);
  }

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .insert([userData])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getUsersAction() {
  const supabaseAdmin = getAdminClient();

  await syncInvitedProfilesWithAuth(supabaseAdmin);

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteUserAction(userId: string) {
  const supabaseAdmin = getAdminClient();

  const { error } = await supabaseAdmin
    .from("user_profiles")
    .delete()
    .eq("id", userId);

  if (error) throw new Error(error.message);
  return true;
}

export async function updateUserAction(userId: string, updateData: any) {
  const supabaseAdmin = getAdminClient();

  // employee_id is immutable — never update it on edit
  if (updateData) {
    delete updateData.employee_id;
    delete updateData.employeeId;
  }

  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update(updateData)
    .eq("id", userId);

  if (error) throw new Error(error.message);
  return true;
}

export async function checkInviteAction(email: string) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getAdminClient();
  } catch {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .ilike("email", email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(error.message);
  }
  return data;
}

export async function linkUserProfileAction(email: string, authId: string, name: string) {
  const supabaseAdmin = getAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .update({
      id: authId,
      name: name,
      status: "active",
      status_reason: "Account activated after signup",
      last_login_at: now,
      updated_at: now,
    })
    .ilike("email", email)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

async function generateEmployeeId(departmentName?: string): Promise<string> {
  const prefixes: Record<string, string> = {
    'Administration': 'ADM',
    'Finance': 'FIN',
    'HR': 'HR',
    'IT': 'IT',
    'Operations': 'OPS',
    'Sales': 'SAL',
    'Workshop': 'WRK'
  };

  const prefix = departmentName ? (prefixes[departmentName] || 'EMP') : 'EMP';
  const supabaseAdmin = getAdminClient();

  // Find the highest existing employee_id for this prefix
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("employee_id")
    .like("employee_id", `${prefix}-%`);

  let nextNumber = 1;
  if (data && data.length > 0) {
    const numbers = data
      .map(d => {
        const parts = d.employee_id?.split('-');
        const num = parseInt(parts?.[parts.length - 1] || '');
        return isNaN(num) ? 0 : num;
      })
      .filter(num => num > 0);

    if (numbers.length > 0) {
      nextNumber = Math.max(...numbers) + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}

export async function backfillEmployeeIdsAction(dryRun: boolean = true) {
  const supabaseAdmin = getAdminClient();

  // Fetch all profiles without employee_id, ordered by created_at (or id) ASC
  const { data: profiles, error } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .or("employee_id.is.null,employee_id.eq.")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const results: Array<{ id: string; name: string; email: string; department: string; oldId: string | null; newId: string }> = [];
  const prefixCounters: Record<string, number> = {};

  for (const profile of profiles || []) {
    const prefixes: Record<string, string> = {
      'Administration': 'ADM',
      'Finance': 'FIN',
      'HR': 'HR',
      'IT': 'IT',
      'Operations': 'OPS',
      'Sales': 'SAL',
      'Workshop': 'WRK'
    };

    const prefix = profile.department ? (prefixes[profile.department] || 'EMP') : 'EMP';
    
    if (prefixCounters[prefix] === undefined) {
      const { data: existing } = await supabaseAdmin
        .from("user_profiles")
        .select("employee_id")
        .like("employee_id", `${prefix}-%`);

      let max = 0;
      if (existing && existing.length > 0) {
        const numbers = existing
          .map(d => {
            const parts = d.employee_id?.split('-');
            const num = parseInt(parts?.[parts.length - 1] || '');
            return isNaN(num) ? 0 : num;
          })
          .filter(num => num > 0);

        if (numbers.length > 0) {
          max = Math.max(...numbers);
        }
      }
      prefixCounters[prefix] = max;
    }

    prefixCounters[prefix] += 1;
    const newId = `${prefix}-${String(prefixCounters[prefix]).padStart(3, '0')}`;

    results.push({
      id: profile.id,
      name: profile.name || 'Unknown',
      email: profile.email || 'N/A',
      department: profile.department || 'N/A',
      oldId: profile.employee_id,
      newId
    });

    if (!dryRun) {
      await supabaseAdmin
        .from("user_profiles")
        .update({ employee_id: newId, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
    }
  }

  return results;
}

