'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { UserRole } from '@/types/roles';
import { resolveUserRole } from '@/lib/user-role-utils';
import { SyncManager } from '@/lib/offline-sync';
import { toast } from '@/hooks/use-toast';
import { checkInviteAction, linkUserProfileAction, activateUserOnLoginAction } from '@/app/users/actions';

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
  role: UserRole | null;
  isLoading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  changeRole: (role: UserRole) => void;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<{ name: string; avatar: string; phone: string }>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string | undefined>;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch user profile from Supabase using the authenticated user's UUID
  const fetchUserProfile = useCallback(async (userId: string, email: string) => {
    const invitedLike = (s: unknown) => {
      const raw = String(s ?? '').toLowerCase().trim();
      return ['invited', 'pending', 'invite_pending', 'invitation_sent', 'invite'].includes(raw);
    };

    const recordLoginAndActivate = async (uid: string, status: unknown, userEmail: string) => {
      const wasInvited = invitedLike(status);
      try {
        const updated = await activateUserOnLoginAction(uid, userEmail);
        if (updated?.status === 'active') return true;
      } catch (err) {
        console.warn('[SupabaseProvider] activateUserOnLoginAction:', err);
      }
      return wasInvited;
    };

    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('[SupabaseProvider] Fetching profile for:', normalizedEmail, 'ID:', userId);

      // Try to get profile by auth UUID.
      // maybeSingle: zero rows is a valid outcome, not a PGRST116 error.
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile && !profileError) {
        console.log('[SupabaseProvider] Profile found by ID:', profile.role);
        const wasInvite = await recordLoginAndActivate(profile.id, profile.status, normalizedEmail);
        if (wasInvite) profile.status = 'active';
        return profile;
      }

      // Not found by UUID — check if a pre-created profile exists by email
      if (!profile) {
        console.log('[SupabaseProvider] Profile not found by ID, searching by email:', normalizedEmail);

        const { data: existingByEmail, error: emailError } = await supabase
          .from('user_profiles')
          .select('*')
          .ilike('email', normalizedEmail)
          .maybeSingle();

        if (!emailError && existingByEmail) {
          console.log('[SupabaseProvider] Found profile by email, linking to auth ID:', userId);

          // Update the pre-added profile with the real auth UUID
          const { data: updatedProfile, error: updateError } = await supabase
            .from('user_profiles')
            .update({
              id: userId,
              updated_at: new Date().toISOString(),
            })
            .eq('email', existingByEmail.email)
            .select()
            .maybeSingle();

          if (!updateError && updatedProfile) {
            console.log('[SupabaseProvider] Profile linked successfully');
            const wasInvite = await recordLoginAndActivate(
              updatedProfile.id,
              updatedProfile.status,
              normalizedEmail,
            );
            if (wasInvite) updatedProfile.status = 'active';
            return updatedProfile;
          }

          console.error('[SupabaseProvider] Error linking profile:', updateError);
          const wasInvite = await recordLoginAndActivate(
            userId,
            existingByEmail.status,
            normalizedEmail,
          );
          if (wasInvite) existingByEmail.status = 'active';
          return existingByEmail;
        }
      }

      // No profile found — create a new one using the real auth UUID
      console.log('[SupabaseProvider] No profile found, creating new one');
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert([{
          id: userId,
          email: normalizedEmail,
          name: email.split('@')[0],
          role: 'OPERATOR',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (createError) {
        console.error('[SupabaseProvider] Error creating profile:', createError);
        // Try with minimal data
        const { data: minimalProfile } = await supabase
          .from('user_profiles')
          .insert([{
            id: userId,
            email: normalizedEmail,
            name: 'User',
            role: 'OPERATOR',
            status: 'active',
          }])
          .select()
          .single();
        return minimalProfile || null;
      }

      return newProfile;
    } catch (err) {
      console.error('[SupabaseProvider] Error fetching/creating profile:', err);
      return null;
    }
  }, []);

  const applyProfile = useCallback((profile: Record<string, unknown>) => {
    setUser({
      id: profile.id as string,
      email: profile.email as string,
      name: profile.name as string | undefined,
      role: resolveUserRole(profile.role as string),
      avatar: (profile.avatar_url as string | undefined) || (profile.avatar as string | undefined),
      phone: profile.phone as string | undefined,
      employeeId: profile.employee_id as string | undefined,
      department: profile.department as string | undefined,
    });
    setRole(resolveUserRole(profile.role as string));
  }, []);

  // Listen for auth changes (single subscription)
  useEffect(() => {
    SyncManager.init();

    let initialized = false;
    let settled = false;

    const finishAuth = () => {
      if (settled) return;
      settled = true;
      initialized = true;
      setIsLoading(false);
    };

    const handleAuthState = async (event: string, session: any) => {
      try {
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id, session.user.email!);
          if (profile) {
            applyProfile(profile);
          } else {
            console.log('[SupabaseProvider] No profile after auth state change — signing out');
            await supabase.auth.signOut();
            setUser(null);
            setRole(null);
            toast({
              title: 'Account Error',
              description: 'Your user profile could not be found. Please contact your administrator.',
              variant: 'destructive',
            });
          }
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err) {
        console.error('[SupabaseProvider] Auth state handling error:', err);
        setUser(null);
        setRole(null);
      } finally {
        finishAuth();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      void handleAuthState(event, session);
    });

    // Check the initial session in case onAuthStateChange fires late
    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (initialized) return; // Already handled by onAuthStateChange
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id, session.user.email!);
          if (profile) {
            applyProfile(profile);
          } else {
            await supabase.auth.signOut();
            setUser(null);
            setRole(null);
            toast({
              title: 'Account Error',
              description: 'Your user profile could not be found. Please contact your administrator.',
              variant: 'destructive',
            });
          }
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err) {
        console.error('[SupabaseProvider] Initial session load error:', err);
        setUser(null);
        setRole(null);
      } finally {
        finishAuth();
      }
    };

    void initializeSession();

    return () => subscription.unsubscribe();
  }, [fetchUserProfile, applyProfile]);

  // Periodic validation to catch deleted users during active sessions
  useEffect(() => {
    const validateUserExists = async () => {
      if (!user?.id) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        console.log('[SupabaseProvider] User deleted during session, signing out');
        await supabase.auth.signOut();
        setUser(null);
        setRole(null);
        toast({
          title: 'Account Deleted',
          description: 'Your account has been removed from the system.',
          variant: 'destructive',
        });
      }
    };

    const interval = setInterval(validateUserExists, 30000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') validateUserExists();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await fetchUserProfile(session.user.id, session.user.email!);
      if (profile) applyProfile(profile);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (signInError) {
        console.error('[SupabaseProvider] Supabase login error:', signInError);
        throw signInError;
      }

      if (signInData?.user?.email) {
        try {
          await activateUserOnLoginAction(signInData.user.id, signInData.user.email);
        } catch (activateErr) {
          console.warn('[SupabaseProvider] Post-login activation:', activateErr);
        }
      }
    } catch (err) {
      console.error('[SupabaseProvider] Sign in error:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role?: string) => {
    setIsLoading(true);
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('[SupabaseProvider] Starting sign up for:', normalizedEmail);

      // Verify user was pre-invited by admin/HR/CEO
      const pendingUser = await checkInviteAction(normalizedEmail);

      if (!pendingUser) {
        console.warn('[SupabaseProvider] Sign up blocked: No invitation found for', normalizedEmail);
        throw new Error(
          'You must be invited by an administrator before signing up. Please contact HR or your manager.',
        );
      }

      console.log('[SupabaseProvider] Invitation found, creating Supabase auth account');
      const { data: { user: authUser }, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (signUpError) {
        console.error('[SupabaseProvider] Supabase auth signUp error:', signUpError);
        throw signUpError;
      }

      if (authUser) {
        console.log('[SupabaseProvider] Auth account created, linking profile');
        try {
          await linkUserProfileAction(normalizedEmail, authUser.id, name);
          console.log('[SupabaseProvider] Profile linked successfully via Server Action');
        } catch (profileError: unknown) {
          const msg = profileError instanceof Error ? profileError.message : String(profileError);
          console.warn('[SupabaseProvider] Server-side profile link error:', msg);

          // Verify if a database trigger already linked it
          const { data: verifiedProfile } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('id', authUser.id)
            .single();

          if (!verifiedProfile) {
            console.error('[SupabaseProvider] Profile is still unlinked after signup');
            throw profileError;
          }
          console.log('[SupabaseProvider] Profile verified: Linked successfully via database trigger.');
        }
        console.log('[SupabaseProvider] Sign up process complete');
      }
    } catch (err) {
      console.error('[SupabaseProvider] Sign up failed:', err);
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    // Clear any legacy localStorage keys that may have been set previously
    localStorage.removeItem('admin_session');
    localStorage.removeItem('fleet_command_role');
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const updateRole = async (newRole: UserRole) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', user.id);

    if (error) {
      console.error('[SupabaseProvider] Error updating role:', error);
      return;
    }

    setUser(prev => prev ? { ...prev, role: newRole } : null);
    setRole(newRole);
  };

  const updateProfile = async (updates: Partial<{ name: string; avatar: string; phone: string }>) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.avatar) dbUpdates.avatar_url = updates.avatar;
      if (updates.phone) dbUpdates.phone = updates.phone;
      dbUpdates.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('user_profiles')
        .update(dbUpdates)
        .eq('id', user.id);

      if (error) throw error;

      await refreshUser();
      toast({ title: 'Profile Updated', description: 'Your changes have been saved.' });
    } catch (err) {
      console.error('[SupabaseProvider] Error updating profile:', err);
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      await updateProfile({ avatar: publicUrl });
      return publicUrl;
    } catch (err) {
      console.error('[SupabaseProvider] Error uploading avatar:', err);
      toast({ title: 'Error', description: 'Failed to upload photo', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * changeRole — allows users with ADMIN/CEO role (verified from database) to
   * switch their UI view role WITHOUT changing the database.
   * This is a legitimate preview/impersonation tool for admins only.
   * Roles are resolved from the authenticated Supabase session, NOT localStorage.
   */
  const changeRole = (newRole: UserRole) => {
    if (!user) return;

    const isAdminUser = user.role === 'ADMIN' || user.role === 'CEO';

    if (!isAdminUser) {
      console.warn('[SupabaseProvider] changeRole ignored for non-admin user:', user.email);
      return;
    }

    console.log('[SupabaseProvider] changeRole (UI preview):', newRole);
    setRole(newRole);
    window.dispatchEvent(new Event('roleChanged'));
  };

  return (
    <SupabaseContext.Provider value={{
      user,
      role,
      isLoading,
      error,
      signIn,
      signUp,
      signOut,
      updateRole,
      changeRole,
      refreshUser,
      updateProfile,
      uploadAvatar,
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
