"use client";

import { useState, useEffect } from 'react';
import { UserRole } from '@/types/roles';

export function useRole() {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem('fleet_command_role') as UserRole;
    if (savedRole) {
      setRole(savedRole);
    } else {
      setRole('CEO'); // Default for demo
    }
  }, []);

  const changeRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('fleet_command_role', newRole);
  };

  return { role, changeRole };
}
