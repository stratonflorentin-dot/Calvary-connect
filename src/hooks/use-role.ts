"use client";

import { useState, useEffect } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';

export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null);
  const { user } = useSupabase();

  useEffect(() => {
    const savedRole = localStorage.getItem('fleet_command_role') as UserRole;
    if (savedRole) {
      setRole(savedRole);
    } else if (user) {
      // User has a role from Supabase profile
      setRole(user.role);
    } else {
      // Default to CEO for demo/access
      setRole('CEO');
      localStorage.setItem('fleet_command_role', 'CEO');
    }
  }, [user]);

  const changeRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('fleet_command_role', newRole);
  };

  return { role, changeRole };
}
