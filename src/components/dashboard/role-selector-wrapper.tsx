"use client";

import { useSupabase } from '@/components/supabase-provider';
import { RoleSelector } from './role-selector';

export function RoleSelectorWrapper() {
  const { user } = useSupabase();

  // Only render RoleSelector if user is logged in
  // The RoleSelector component itself will check if the user is ADMIN
  if (!user) return null;

  return <RoleSelector />;
}
