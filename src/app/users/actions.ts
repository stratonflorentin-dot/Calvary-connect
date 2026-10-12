"use server";

import { createClient } from "@supabase/supabase-js";
import { isInvitedLikeStatus } from "@/lib/user-status-utils";

function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase admin credentials. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function requireUserManager(accessToken: string, allowedRoles: string[]) {
  if (!accessToken) throw new Error("Sign in again to continue.");
  const admin = getAdminClient();
  const { data: { user }, error: authError } = await admin.auth.getUser(accessToken);
  if (authError || !user) throw new Error("Your session is invalid or expired. Sign in again.");
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) throw new Error("Your user profile could not be verified.");
  const role = String(profile.role || "").toUpperCase();
  if (!allowedRoles.includes(role)) throw new Error("You are not authorized to manage users.");
  return { admin, user, role };
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

  const profile = (byId || byEmail) as Record<string, any> | null;
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
    .eq("email", profile?.email || normalizedEmail)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/** Align invited profiles with Supabase Auth (users who already signed in). */
async function syncInvitedProfilesWithAuth(supabaseAdmin: any) {
  const { data: profiles, error } = await supabaseAdmin
    .from("user_profiles")
    .select("id, email, status, last_login_at")
    .in("status", ["invited", "pending", "invite_pending", "invitation_sent", "invite"]);

  if (error || !profiles?.length) return;

  const { data: authList, error: authError } =
    await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

  if (authError || !authList?.users?.length) return;

  const authUsers = Array.isArray((authList as any)?.users) ? (authList as any).users : [];
  const authByEmail = new Map<string, Record<string, any>>(
    authUsers
      .filter((u: Record<string, any>) => u.email)
      .map((u: Record<string, any>) => [String(u.email).toLowerCase().trim(), u]),
  );

  const now = new Date().toISOString();

  for (const profile of profiles || []) {
    const email = String((profile as Record<string, any>).email || "").toLowerCase().trim();
    const authUser = authByEmail.get(email) as Record<string, any> | undefined;
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

export async function inviteUserAction(userData: any, accessToken: string) {
  const { admin: supabaseAdmin, role } = await requireUserManager(accessToken, ["CEO", "ADMIN", "HR"]);
  if (role === "HR" && ["CEO", "ADMIN"].includes(String(userData.role).toUpperCase())) {
    throw new Error("HR cannot invite users with CEO or ADMIN access.");
  }
  userData = { ...userData };

  // Generate Employee ID based on department (or role fallback) if not provided
  if (!userData.employee_id) {
    userData.employee_id = await generateEmployeeId(userData.department, userData.role);
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

export async function getUsersAction(accessToken: string) {
  const { admin: supabaseAdmin } = await requireUserManager(accessToken, ["CEO", "ADMIN", "HR", "OPERATOR", "MECHANIC"]);

  await syncInvitedProfilesWithAuth(supabaseAdmin);

  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .neq("status", "deleted")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteUserAction(userId: string, accessToken: string) {
  const { admin: supabaseAdmin, user: actor } = await requireUserManager(accessToken, ["CEO", "ADMIN"]);
  if (actor.id === userId) throw new Error("You cannot delete the account you are currently using.");

  const { data: target, error: targetError } = await supabaseAdmin
    .from("user_profiles")
    .select("id, name, email, role, status")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) throw new Error("User was not found.");

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  let hardDeleted = !authDeleteError;
  if (authDeleteError?.status === 404) {
    const { error } = await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
    hardDeleted = !error;
  } else if (authDeleteError) {
    // Preserve historical foreign-key relationships when a hard delete is
    // blocked, while immediately preventing another login.
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    if (banError && banError.status !== 404) {
      throw new Error(`Could not revoke this user's access: ${banError.message}`);
    }
    hardDeleted = false;
  }

  if (!hardDeleted) {
    const { error } = await supabaseAdmin
      .from("user_profiles")
      .update({ status: "deleted", status_reason: "Access removed by an administrator; history retained.", updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(`Access was revoked, but the user profile could not be archived: ${error.message}`);
  } else if (hardDeleted) {
    // Pre-invited profiles may not have an auth.users record; remove that row
    // directly. Auth-backed profiles are normally removed by the FK cascade.
    const { error } = await supabaseAdmin.from("user_profiles").delete().eq("id", userId);
    if (error) {
      const { error: archiveError } = await supabaseAdmin
        .from("user_profiles")
        .update({ status: "deleted", status_reason: "Access removed by an administrator; history retained.", updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (archiveError) throw new Error(`User access was removed, but the profile could not be archived: ${archiveError.message}`);
      hardDeleted = false;
    }
  }

  try {
    await supabaseAdmin.from("audit_trail").insert({
      user_id: actor.id,
      module: "management",
      action: "delete",
      entity_type: "user",
      entity_id: userId,
      old_value: target,
      new_value: hardDeleted ? null : { status: "deleted", history_retained: true },
      description: `${hardDeleted ? "Deleted" : "Removed access for"} user ${target.name || target.email || userId}`,
    });
  } catch (auditError) {
    console.warn("Could not write user deletion audit record:", auditError);
  }

  return { hardDeleted, archived: !hardDeleted };
}

export async function updateUserAction(userId: string, updateData: any, accessToken: string) {
  const { admin: supabaseAdmin, user: actor, role } = await requireUserManager(accessToken, ["CEO", "ADMIN", "HR"]);

  // Whitelist of columns that are safe to update on user_profiles
  const ALLOWED_COLUMNS = [
    'name', 'email', 'role', 'phone', 'avatar_url', 'status',
    'license_number', 'license_expiry', 'license_class', 'compliance_status',
    'updated_at', 'last_login_at', 'last_activity_at', 'login_count',
    'status_reason', 'salary', 'department',
    'invited_at', 'invited_by',
  ];

  // employee_id is immutable — never update it on edit
  if (updateData) {
    delete updateData.employee_id;
    delete updateData.employeeId;
  }

  if (role === "HR" && updateData?.role !== undefined && ["CEO", "ADMIN"].includes(String(updateData.role).toUpperCase())) {
    throw new Error("HR cannot assign CEO or ADMIN access.");
  }

  // Only keep whitelisted fields
  const sanitized: Record<string, any> = {};
  for (const key of ALLOWED_COLUMNS) {
    if (key in updateData && updateData[key] !== undefined) {
      sanitized[key] = updateData[key];
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return true; // nothing to update
  }

  // Fetch the prior row so role/status/etc. changes are traceable — this
  // action previously wrote no audit trail at all for user edits (only
  // vehicles, journal entries, compliance documents and company settings
  // were ever logged), which is exactly why a role change couldn't be
  // traced when investigating one live.
  const { data: before } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from("user_profiles")
    .update(sanitized)
    .eq("id", userId);

  if (error) throw new Error(error.message);

  const changedFields = Object.keys(sanitized).filter(
    (k) => k !== "updated_at" && before && (before as Record<string, any>)[k] !== sanitized[k],
  );
  if (changedFields.length > 0) {
    await supabaseAdmin.from("audit_trail").insert({
      user_id: actor.id,
      module: "management",
      action: "update",
      entity_type: "user",
      entity_id: userId,
      old_value: before,
      new_value: sanitized,
      description: `Updated user ${before?.name ?? userId} (${changedFields.join(", ")})`,
    });
  }

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

// Map from department name → prefix
const DEPARTMENT_PREFIXES: Record<string, string> = {
  'Administration': 'ADM',
  'Finance': 'FIN',
  'HR': 'HR',
  'IT': 'IT',
  'Operations': 'OPS',
  'Sales': 'SAL',
  'Workshop': 'WRK',
};

// Map from system role → prefix (fallback when department is not set)
const ROLE_PREFIXES: Record<string, string> = {
  'CEO': 'ADM',
  'ADMIN': 'ADM',
  'HR': 'HR',
  'OPERATOR': 'OPS',
  'DRIVER': 'OPS',
  'MECHANIC': 'WRK',
  'ACCOUNTANT': 'FIN',
  'SALESMAN': 'SAL',
};

// Map from system role → department name (for backfilling the department field)
const ROLE_TO_DEPARTMENT: Record<string, string> = {
  'CEO': 'Administration',
  'ADMIN': 'Administration',
  'HR': 'HR',
  'OPERATOR': 'Operations',
  'DRIVER': 'Operations',
  'MECHANIC': 'Workshop',
  'ACCOUNTANT': 'Finance',
  'SALESMAN': 'Sales',
};

function resolvePrefix(department?: string | null, role?: string | null): string {
  if (department && DEPARTMENT_PREFIXES[department]) {
    return DEPARTMENT_PREFIXES[department];
  }
  if (role && ROLE_PREFIXES[role]) {
    return ROLE_PREFIXES[role];
  }
  return 'EMP';
}

async function generateEmployeeId(departmentName?: string, roleName?: string): Promise<string> {
  const prefix = resolvePrefix(departmentName, roleName);
  const supabaseAdmin = getAdminClient();

  // Find the highest existing employee_id for this prefix
  const { data } = await supabaseAdmin
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

export async function backfillEmployeeIdsAction(dryRun: boolean, accessToken: string) {
  const { admin: supabaseAdmin } = await requireUserManager(accessToken, ["CEO", "ADMIN"]);

  // Fetch all profiles without employee_id, ordered by created_at ASC
  const { data: profiles, error } = await supabaseAdmin
    .from("user_profiles")
    .select("*")
    .or("employee_id.is.null,employee_id.eq.")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const results: Array<{ id: string; name: string; email: string; department: string; oldId: string | null; newId: string }> = [];
  const prefixCounters: Record<string, number> = {};

  for (const profile of profiles || []) {
    // Derive prefix from department first, then fall back to role
    const prefix = resolvePrefix(profile.department, profile.role);
    // Derive the department name to backfill if missing
    const resolvedDepartment = profile.department
      || (profile.role ? ROLE_TO_DEPARTMENT[profile.role] : null)
      || null;

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
      department: resolvedDepartment || profile.role || 'N/A',
      oldId: profile.employee_id,
      newId
    });

    if (!dryRun) {
      const updatePayload: Record<string, any> = {
        employee_id: newId,
        updated_at: new Date().toISOString(),
      };
      // Also backfill the department field if it was missing
      if (!profile.department && resolvedDepartment) {
        updatePayload.department = resolvedDepartment;
      }
      await supabaseAdmin
        .from("user_profiles")
        .update(updatePayload)
        .eq("id", profile.id);
    }
  }

  return results;
}


