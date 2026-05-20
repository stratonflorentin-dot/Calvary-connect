"use client";

import { useEffect, useCallback, useState } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';
import { ADMIN_EMAIL } from '@/lib/supabase';
import { resolveUserRole } from '@/lib/user-role-utils';

export function useRole() {
  const { user, role: contextRole, changeRole: supabaseChangeRole, isLoading } = useSupabase();
  const [localRole, setLocalRole] = useState<UserRole | null>(null);

  // Enhanced console logging for role changes
  useEffect(() => {
    console.log("Role changed to:", contextRole || localRole);
  }, [contextRole, localRole]);

  // The actual user role from database (never changes with impersonation)
  const actualRole = user?.role || null;
  // Whether user is an actual ADMIN (check roles and emails)
  const isAdmin = actualRole === 'ADMIN' || actualRole === 'CEO' || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || user?.email?.toLowerCase() === 'calvaryadmin466@gmail.com';

  // For admin user, always use localStorage role as current role
  const currentRole = isAdmin
    ? typeof window !== 'undefined'
      ? resolveUserRole(
          localStorage.getItem('fleet_command_role') || String(actualRole || 'ADMIN'),
          'ADMIN',
        )
      : resolveUserRole(String(actualRole || 'ADMIN'), 'ADMIN')
    : contextRole != null
      ? resolveUserRole(contextRole)
      : null;

  console.log(`[useRole] User: ${user?.email}, isAdmin: ${isAdmin}, currentRole: ${currentRole}, contextRole: ${contextRole}`);

  // Sync role from localStorage (for admin role switching)
  useEffect(() => {
    if (isAdmin) {
      const savedRole = localStorage.getItem('fleet_command_role');
      if (savedRole) {
        const resolved = resolveUserRole(savedRole, 'ADMIN');
        if (resolved !== contextRole) {
          setLocalRole(resolved);
          supabaseChangeRole(resolved);
        }
      }
    }
  }, [user, contextRole, supabaseChangeRole, isAdmin]);

  const changeRole = (newRole: UserRole) => {
    // Role switching is now handled directly in role-selector with localStorage
    // This function is kept for compatibility but no longer used
    console.log('[useRole] changeRole called (deprecated):', newRole);
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
