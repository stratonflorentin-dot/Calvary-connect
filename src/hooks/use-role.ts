"use client";

import { useState, useEffect } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';

export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const { user } = useSupabase();

  useEffect(() => {
    // Clear any saved role from localStorage to use actual user role
    if (user?.role === 'ADMIN') {
      localStorage.removeItem('fleet_command_role');
    }
    
    if (user) {
      // Always use the actual user's role from Supabase first
      setRole(user.role);
    } else {
      // Default to CEO for demo/access only when no user
      setRole('CEO');
      localStorage.setItem('fleet_command_role', 'CEO');
    }
  }, [user]);

  const changeRole = (newRole: UserRole) => {
    // Only allow role switching if user is ADMIN
    if (user?.role === 'ADMIN') {
      setRole(newRole);
      localStorage.setItem('fleet_command_role', newRole);
    }
  };

  return { role, changeRole };
}
