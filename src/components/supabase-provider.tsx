'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, ADMIN_EMAIL, ADMIN_ROLE, DEMO_MODE } from '@/lib/supabase';
import { UserRole } from '@/types/roles';

interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  employeeId?: string;
  department?: string;
}

interface SupabaseContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Check for admin auto-login on mount
  useEffect(() => {
    // Check if admin is already logged in via localStorage
    const adminSession = localStorage.getItem('admin_session');
    if (adminSession) {
      setUser({
        id: 'admin-straton',
        email: ADMIN_EMAIL,
        name: 'straton florentin tesha',
        role: 'ADMIN'
      });
      setIsLoading(false);
      return;
    }
    
    // Check for local user login
    const currentUserId = localStorage.getItem('current_user_id');
    if (currentUserId) {
      const users = JSON.parse(localStorage.getItem('local_users') || '[]');
      const localUser = users.find((u: any) => u.id === currentUserId);
      if (localUser) {
        setUser({
          id: localUser.id,
          email: localUser.email,
          name: localUser.name,
          role: localUser.role as UserRole,
        });
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch user profile from Supabase
  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        // Check localStorage first before creating new profile
        const localProfile = localStorage.getItem('user_profile_' + userId);
        if (localProfile) {
          return JSON.parse(localProfile);
        }
        
        // If no profile exists, create one with default role
        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .insert([{
            id: userId,
            email: email,
            name: email.split('@')[0],
            role: 'DRIVER',
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();

        if (createError) throw createError;
        return newProfile;
      }

      return profile;
    } catch (err) {
      console.error('Error fetching/creating profile:', err);
      // Fallback to localStorage
      const localProfile = localStorage.getItem('user_profile_' + userId);
      if (localProfile) {
        return JSON.parse(localProfile);
      }
      return null;
    }
  };

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id, session.user.email!);
        if (profile) {
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role as UserRole,
            avatar: profile.avatar,
            phone: profile.phone,
            employeeId: profile.employee_id,
            department: profile.department,
          });
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id, session.user.email!);
        if (profile) {
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role as UserRole,
            avatar: profile.avatar,
            phone: profile.phone,
            employeeId: profile.employee_id,
            department: profile.department,
          });
        }
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await fetchUserProfile(session.user.id, session.user.email!);
      if (profile) {
        setUser({
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role as UserRole,
          avatar: profile.avatar,
          phone: profile.phone,
          employeeId: profile.employee_id,
          department: profile.department,
        });
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Admin auto-login with any password
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        localStorage.setItem('admin_session', 'true');
        setUser({
          id: 'admin-straton',
          email: ADMIN_EMAIL,
          name: 'straton florentin tesha',
          role: 'ADMIN'
        });
        setIsLoading(false);
        return;
      }
      
      // Try Supabase auth first
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        // Fallback: Check localStorage for local users
        console.log('Supabase auth failed, checking local users');
        const users = JSON.parse(localStorage.getItem('local_users') || '[]');
        const localUser = users.find((u: any) => u.email === email && u.password === password);
        
        if (localUser) {
          localStorage.setItem('current_user_id', localUser.id);
          setUser({
            id: localUser.id,
            email: localUser.email,
            name: localUser.name,
            role: localUser.role as UserRole,
          });
          setIsLoading(false);
          return;
        }
        
        throw error;
      }
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role?: string) => {
    setIsLoading(true);
    try {
      // Try Supabase auth first
      const { data: { user: authUser }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        // Fallback: Create local user if Supabase auth fails
        console.log('Supabase auth failed, using local storage fallback');
        const localUserId = 'local-' + Date.now();
        const newUser = {
          id: localUserId,
          email: email,
          name: name,
          role: (role as UserRole) || 'DRIVER',
          password: password, // Store password for local auth
          created_at: new Date().toISOString(),
        };
        
        // Store in localStorage
        const users = JSON.parse(localStorage.getItem('local_users') || '[]');
        users.push(newUser);
        localStorage.setItem('local_users', JSON.stringify(users));
        
        // Auto-login after signup
        localStorage.setItem('current_user_id', localUserId);
        setUser({
          id: localUserId,
          email: email,
          name: name,
          role: (role as UserRole) || 'DRIVER',
        });
        setIsLoading(false);
        return;
      }

      if (authUser) {
        // Create user profile in Supabase
        const { error: profileError } = await supabase.from('users').insert([{
          id: authUser.id,
          email: email,
          name: name,
          role: (role as UserRole) || 'DRIVER',
          created_at: new Date().toISOString(),
        }]);

        if (profileError) throw profileError;
      }
    } catch (err) {
      console.error('Sign up error:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('admin_session');
    await supabase.auth.signOut();
    setUser(null);
  };

  const updateRole = async (role: UserRole) => {
    if (!user) return;
    
    // Admin can switch roles locally without database update
    if (user.email === ADMIN_EMAIL) {
      setUser(prev => prev ? { ...prev, role } : null);
      return;
    }
    
    const { error } = await supabase
      .from('users')
      .update({ role })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating role:', error);
      return;
    }

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
      updateRole,
      refreshUser,
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
