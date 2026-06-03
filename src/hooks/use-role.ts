"use client";

import { useEffect, useCallback } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';
import { isPrimaryOwnerEmail } from '@/lib/supabase';
import { resolveUserRole } from '@/lib/user-role-utils';

export function useRole() {
  const { user, role: contextRole, changeRole: supabaseChangeRole, isLoading } = useSupabase();

  // Enhanced console logging for role changes
  useEffect(() => {
    if (!user && !contextRole) return;
    console.log('[useRole] contextRole:', contextRole, 'user.role:', user?.role, 'email:', user?.email);
  }, [contextRole, user?.role, user?.email]);

  // The actual user role from database (never changes with impersonation)
  const actualRole = user?.role ? resolveUserRole(user.role) : null;
  const isAdmin =
    actualRole === 'ADMIN' ||
    actualRole === 'CEO' ||
    isPrimaryOwnerEmail(user?.email);

  const currentRole = contextRole
    ? resolveUserRole(contextRole)
    : actualRole;

  const changeRole = (newRole: UserRole) => {
    if (!isAdmin) return;
    supabaseChangeRole(newRole);
  };

  // Permission check: ADMIN has full access regardless of impersonated role
  const hasPermission = useCallback((requiredRoles: UserRole[]) => {
    // ADMIN always has full access
    if (isAdmin) return true;
    // Otherwise check if current role is in required roles
    if (!currentRole) return false;
    return requiredRoles.includes(currentRole);
  }, [isAdmin, currentRole]);

  // Check if user can access a page/feature
  const canAccess = useCallback((allowedRoles: UserRole[]) => {
    if (isAdmin) return true;
    if (!currentRole) return false;
    return allowedRoles.includes(currentRole);
  }, [isAdmin, currentRole]);

  return {
    role: currentRole,
    actualRole,
    isAdmin,
    changeRole,
    isInitialized: !isLoading,
    isLoading,
    hasPermission,
    canAccess
  };
}
