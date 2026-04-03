"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserRole } from '@/types/roles';
import { useSupabase } from '@/components/supabase-provider';
import { ADMIN_EMAIL } from '@/lib/supabase';

interface RoleContextType {
  role: UserRole | null;
  actualRole: UserRole | null;
  isAdmin: boolean;
  changeRole: (newRole: UserRole) => void;
  isInitialized: boolean;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
  canAccess: (allowedRoles: UserRole[]) => boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { user } = useSupabase();

  const actualRole = user?.role || null;
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!user) {
      setRole('CEO');
      localStorage.setItem('fleet_command_role', 'CEO');
      setIsInitialized(true);
      return;
    }

    if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      const savedRole = localStorage.getItem('fleet_command_role') as UserRole | null;
      if (savedRole && ['CEO', 'ADMIN', 'OPERATOR', 'DRIVER', 'MECHANIC', 'ACCOUNTANT', 'HR'].includes(savedRole)) {
        setRole(savedRole);
      } else {
        setRole('ADMIN');
        localStorage.setItem('fleet_command_role', 'ADMIN');
      }
    } else {
      setRole(user.role as UserRole);
      localStorage.removeItem('fleet_command_role');
    }
    
    setIsInitialized(true);
  }, [user]);

  const changeRole = useCallback((newRole: UserRole) => {
    if (user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      setRole(newRole);
      localStorage.setItem('fleet_command_role', newRole);
    }
  }, [user]);

  const hasPermission = useCallback((requiredRoles: UserRole[]) => {
    if (isAdmin) return true;
    if (!role) return false;
    return requiredRoles.includes(role);
  }, [isAdmin, role]);

  const canAccess = useCallback((allowedRoles: UserRole[]) => {
    if (isAdmin) return true;
    if (!role) return false;
    return allowedRoles.includes(role);
  }, [isAdmin, role]);

  return (
    <RoleContext.Provider value={{ 
      role, 
      actualRole, 
      isAdmin, 
      changeRole, 
      isInitialized,
      hasPermission,
      canAccess
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
