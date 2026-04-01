"use client";

import { useState, useEffect } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';

export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useSupabase();

  useEffect(() => {
    if (!user) {
      // Default to CEO for demo/access only when no user
      setRole('CEO');
      localStorage.setItem('fleet_command_role', 'CEO');
      return;
    }

    // For ADMIN users, check if there's a saved role preference
    if (user.role === 'ADMIN') {
      const savedRole = localStorage.getItem('fleet_command_role') as UserRole | null;
      if (savedRole && ['CEO', 'ADMIN', 'OPERATOR', 'DRIVER', 'MECHANIC', 'ACCOUNTANT', 'HR'].includes(savedRole)) {
        setRole(savedRole);
      } else {
        // Default to ADMIN if no saved role
        setRole('ADMIN');
        localStorage.setItem('fleet_command_role', 'ADMIN');
      }
    } else {
      // For non-ADMIN users, always use their actual role
      setRole(user.role);
      localStorage.removeItem('fleet_command_role');
    }
    
    setIsInitialized(true);
  }, [user]);

  const changeRole = (newRole: UserRole) => {
    // Only allow role switching if user is ADMIN
    if (user?.role === 'ADMIN') {
      setRole(newRole);
      localStorage.setItem('fleet_command_role', newRole);
    }
  };

  return { role, changeRole, isInitialized };
}
