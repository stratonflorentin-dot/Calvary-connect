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
    // Check if admin is already logged in via localStorage (admin only)
    const adminSession = localStorage.getItem('admin_session');
    if (adminSession) {
      const adminUser = {
        id: 'admin-straton',
        email: ADMIN_EMAIL,
        name: 'Straton Florentin Tesha',
        role: 'ADMIN' as UserRole
      };
      setUser(adminUser);
      
      // Also sync admin to Supabase for tracking
      syncAdminToSupabase(adminUser).catch(console.error);
      
      setIsLoading(false);
      return;
    }
    
    // Check for Supabase authenticated user
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserProfile(session.user.id, session.user.email || '');
      }
      setIsLoading(false);
    };
    
    checkAuth();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await fetchUserProfile(session.user.id, session.user.email || '');
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Sync admin user to Supabase for tracking
  const syncAdminToSupabase = async (adminUser: User) => {
    try {
      // Check if admin already exists in Supabase
      const { data: existingUser, error: checkError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', adminUser.email)
        .single();

      if (checkError || !existingUser) {
        // Create admin record in Supabase
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert([{
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);

        if (insertError) {
          console.error('Error creating admin in Supabase:', insertError);
        } else {
          console.log('Admin user synced to Supabase successfully');
        }
      } else {
        // Update last login time
        await supabase
          .from('user_profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('email', adminUser.email);
      }
    } catch (err) {
      console.error('Error syncing admin to Supabase:', err);
    }
  };

  // Fetch user profile from Supabase
  const fetchUserProfile = async (userId: string, email: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        // If no profile exists, create one with default role
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
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
    setError(null);
    
    try {
      // Admin auto-login with any password
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail === ADMIN_EMAIL.toLowerCase()) {
        console.log('Admin login detected for:', email);
        localStorage.setItem('admin_session', 'true');
        const adminUser = {
          id: 'admin-straton',
          email: ADMIN_EMAIL,
          name: 'Straton Florentin Tesha',
          role: 'ADMIN' as UserRole
        };
        setUser(adminUser);
        console.log('Admin user set successfully:', adminUser);
        return;
      }
      
      // Use Supabase auth for all other users
      console.log('Attempting Supabase login for:', email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Supabase login error:', error);
        throw error;
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role?: string) => {
    setIsLoading(true);
    try {
      // Check if user was pre-added by admin/HR/CEO
      const { data: pendingUser, error: checkError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .is('password', null)
        .single();

      if (checkError || !pendingUser) {
        throw new Error('You must be invited by an administrator before signing up. Please contact HR or your manager.');
      }

      // Try Supabase auth
      const { data: { user: authUser }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;

      if (authUser) {
        // Update the pre-created profile with password/auth info
        const { error: profileError } = await supabase.from('user_profiles').update({
          id: authUser.id,
          name: name,
          updated_at: new Date().toISOString(),
        }).eq('email', email);

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
      .from('user_profiles')
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
