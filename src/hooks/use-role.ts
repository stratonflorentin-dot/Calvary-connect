"use client";

import { useEffect, useCallback } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';
import { ADMIN_EMAIL } from '@/lib/supabase';

export function useRole() {
  const { user, role, changeRole: supabaseChangeRole } = useSupabase();

  // The actual user role from database (never changes with impersonation)
  const actualRole = user?.role || null;
  // Whether the user is an actual ADMIN (check both role and email)
  const isAdmin = actualRole === 'ADMIN' || user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

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
        if (savedRole !== role) {
          supabaseChangeRole(savedRole);
        }
      } else if (role !== 'ADMIN') {
        // Default to ADMIN if no saved role
        localStorage.setItem('fleet_command_role', 'ADMIN');
        supabaseChangeRole('ADMIN');
      }
    } else {
      // For non-ADMIN users, always use their actual role
      localStorage.removeItem('fleet_command_role');
      if (user.role !== role) {
        supabaseChangeRole(user.role);
      }
    }
  }, [user, isAdmin, role, supabaseChangeRole]);

  const changeRole = (newRole: UserRole) => {
    // Only allow role switching if user is ADMIN (by role or email)
    if (isAdmin) {
      supabaseChangeRole(newRole);
    }
  };

  // Permission check: ADMIN has full access regardless of impersonated role
  const hasPermission = useCallback((requiredRoles: UserRole[]) => {
    // ADMIN always has full access
    if (isAdmin) return true;
    // Otherwise check if current role is in required roles
    if (!role) return false;
    return requiredRoles.includes(role);
  }, [isAdmin, role]);

  // Check if user can access a page/feature
  const canAccess = useCallback((allowedRoles: UserRole[]) => {
    if (isAdmin) return true;
    if (!role) return false;
    return allowedRoles.includes(role);
  }, [isAdmin, role]);

  return { 
    role, 
    actualRole,
    isAdmin,
    changeRole, 
    isInitialized: true,
    hasPermission,
    canAccess
  };
}
