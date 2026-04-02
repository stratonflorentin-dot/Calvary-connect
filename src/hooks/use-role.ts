"use client";

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';
import { ADMIN_EMAIL } from '@/lib/supabase';

export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useSupabase();

  // The actual user role from database (never changes with impersonation)
  const actualRole = user?.role || null;
  // Whether the user is the specific admin (stratonflorentin@gmail.com)
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!user) {
      // Default to CEO for demo/access only when no user
      setRole('CEO');
      localStorage.setItem('fleet_command_role', 'CEO');
      return;
    }

    // Only the specific admin (stratonflorentin@gmail.com) can switch roles
    if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      const savedRole = localStorage.getItem('fleet_command_role') as UserRole | null;
      if (savedRole && ['CEO', 'ADMIN', 'OPERATOR', 'DRIVER', 'MECHANIC', 'ACCOUNTANT', 'HR'].includes(savedRole)) {
        setRole(savedRole);
      } else {
        // Default to ADMIN if no saved role
        setRole('ADMIN');
        localStorage.setItem('fleet_command_role', 'ADMIN');
      }
    } else {
      // For non-admin users, always use their actual role
      setRole(user.role as UserRole);
      localStorage.removeItem('fleet_command_role');
    }
    
    setIsInitialized(true);
  }, [user]);

  const changeRole = (newRole: UserRole) => {
    // Only allow role switching for the specific admin email
    if (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      setRole(newRole);
      localStorage.setItem('fleet_command_role', newRole);
    }
  };

  // Permission check: Only the specific admin has full access regardless of impersonated role
  const hasPermission = useCallback((requiredRoles: UserRole[]) => {
    // The specific admin always has full access
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
    isInitialized,
    hasPermission,
    canAccess
  };
}
