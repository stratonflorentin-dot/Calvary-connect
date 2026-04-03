"use client";

import { useState } from 'react';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { FleetDashboard } from '@/components/fleet/fleet-dashboard';
import { SupabaseSetupAssistant } from '@/components/supabase-setup-assistant';
import { RoleSelector } from '@/components/dashboard/role-selector';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

export default function FleetPage() {
  const { role } = useRole();

  if (!['CEO', 'ADMIN', 'OPERATOR', 'MECHANIC'].includes(role || '')) {
    return (
      <main className="min-h-screen bg-background safe-area-padding">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-muted-foreground text-sm">You don't have permission to access fleet management.</p>
        </div>
        <BottomTabs role={role!} />
        <RoleSelector />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar role={role!} />
      <main className="flex-1 md:ml-60 min-h-screen pb-24 md:pb-8 safe-area-padding">
        <div className="p-4 md:p-8">
          <SupabaseSetupAssistant />
          <div className="mb-8">
            <h1 className="text-3xl font-headline tracking-tighter">Fleet Management</h1>
            <p className="text-muted-foreground text-sm">Monitor and manage your logistics fleet including trucks, trailers, escort cars, and hoses.</p>
          </div>
          <FleetDashboard />
        </div>
      </main>
      <BottomTabs role={role!} />
      <RoleSelector />
    </div>
  );
}
