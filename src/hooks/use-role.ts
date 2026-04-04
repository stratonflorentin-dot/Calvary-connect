"use client";

import { useEffect, useCallback, useState } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';
import { ADMIN_EMAIL } from '@/lib/supabase';

export function useRole() {
  const { user, role: contextRole, changeRole: supabaseChangeRole } = useSupabase();
  const [localRole, setLocalRole] = useState<UserRole | null>(null);

  // Enhanced console logging for role changes
  useEffect(() => {
    console.log("Role changed to:", contextRole || localRole);
  }, [contextRole, localRole]);

  // The actual user role from database (never changes with impersonation)
  const actualRole = user?.role || null;
  // Whether user is an actual ADMIN (check both role and email)
  const isAdmin = actualRole === 'ADMIN' || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // For admin user, always use localStorage role as current role
  const currentRole = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    ? (localStorage.getItem('fleet_command_role') as UserRole || contextRole || localRole || 'ADMIN')
    : contextRole;

  // Sync role from localStorage (for admin role switching)
  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) {
      const savedRole = localStorage.getItem('fleet_command_role') as UserRole;
      if (savedRole && savedRole !== contextRole) {
        setLocalRole(savedRole);
        supabaseChangeRole(savedRole);
      }
    }
  }, [user, contextRole, supabaseChangeRole]);

  // Sync role from localStorage on mount (for admin role impersonation)
  useEffect(() => {
    if (!user) {
      localStorage.setItem('fleet_command_role', 'CEO');
      return;
    }

    // For ADMIN users (by role OR email), check if there's a saved role preference
    if (isAdmin) {
      const savedRole = localStorage.getItem('fleet_command_role') as UserRole | null;
      if (savedRole && ['CEO', 'ADMIN', 'OPERATOR', 'DRIVER', 'MECHANIC', 'ACCOUNTANT', 'HR'].includes(savedRole)) {
        // If saved role differs from current, update it
        if (savedRole !== contextRole) {
          supabaseChangeRole(savedRole);
        }
      } else if (contextRole !== 'ADMIN') {
        // Default to ADMIN if no saved role
        localStorage.setItem('fleet_command_role', 'ADMIN');
        supabaseChangeRole('ADMIN');
      }
    } else {
      // For non-ADMIN users, always use their actual role
      localStorage.removeItem('fleet_command_role');
      if (user.role !== contextRole) {
        supabaseChangeRole(user.role);
      }
    }
  }, [user, isAdmin, contextRole, supabaseChangeRole]);

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
    isInitialized: true,
    hasPermission,
    canAccess
  };
}
