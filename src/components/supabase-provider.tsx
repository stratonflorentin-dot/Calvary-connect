'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, ADMIN_EMAIL, ADMIN_ROLE } from '@/lib/supabase';
import { UserRole } from '@/types/roles';

interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
}

interface SupabaseContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>({
    id: 'admin-straton',
    email: 'stratonflorentin@gmail.com',
    name: 'straton florentin tesha',
    role: 'ADMIN'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signIn = async (email: string, password: string) => {
    setUser({
      id: 'admin-straton',
      email: ADMIN_EMAIL,
      name: 'straton florentin tesha',
      role: 'ADMIN'
    });
  };

  const signUp = async (email: string, password: string, name: string, role?: string) => {
    setUser({
      id: 'demo-user',
      email: email,
      name: name,
      role: (role as UserRole) || 'DRIVER'
    });
  };

  const signOut = async () => {
    setUser(null);
  };

  const updateRole = async (role: UserRole) => {
    setUser(prev => prev ? { ...prev, role } : null);
  };

  return (
    <SupabaseContext.Provider value={{
      user,
      isLoading,
      error,
      signIn,
      signUp,
      signOut,
      updateRole
    }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
