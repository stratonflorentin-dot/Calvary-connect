
"use client";

import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { AuthComponent } from '@/components/auth/auth-component';
import { CeoView } from '@/components/dashboard/ceo-view';
import { DriverView } from '@/components/dashboard/driver-view';
import { MechanicView } from '@/components/dashboard/mechanic-view';
import { AccountantView } from '@/components/dashboard/accountant-view';
import { HrView } from '@/components/dashboard/hr-view';
import { OperatorView } from '@/components/dashboard/operator-view';
import { NotificationsBell } from '@/components/shared/notifications-bell';
import { CurrencyDisplay } from '@/components/shared/currency-display';
import { AiInsightPanel } from '@/components/dashboard/ai-insight-panel';
import { useLanguage } from '@/hooks/use-language';
import { Button } from '@/components/ui/button';
import { Languages, Shield, User, Wrench, Calculator, Users, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ADMIN_EMAIL } from '@/lib/supabase';

const ROLE_BADGES: Record<string, { color: string; icon: any; label: string }> = {
  CEO: { color: 'bg-emerald-500', icon: User, label: 'CEO View' },
  ADMIN: { color: 'bg-blue-500', icon: Shield, label: 'Admin View' },
  OPERATOR: { color: 'bg-amber-500', icon: Truck, label: 'Operator View' },
  DRIVER: { color: 'bg-orange-500', icon: Truck, label: 'Driver View' },
  MECHANIC: { color: 'bg-purple-500', icon: Wrench, label: 'Mechanic View' },
  ACCOUNTANT: { color: 'bg-cyan-500', icon: Calculator, label: 'Accountant View' },
  HR: { color: 'bg-pink-500', icon: Users, label: 'HR View' },
};

export default function Home() {
  const { role, actualRole } = useRole();
  const { user, isLoading } = useSupabase();
  const { toggleLanguage, lang } = useLanguage();

  const isAdminUser = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const currentRoleBadge = ROLE_BADGES[role || 'CEO'];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthComponent />;
  }

  if (!role) return null;

  // Render role-specific content
  const renderContent = () => {
    switch (role) {
      case 'CEO':
      case 'ADMIN':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              <CeoView />
            </div>
            <div className="space-y-8">
              <AiInsightPanel />
            </div>
          </div>
        );
      case 'DRIVER':
        return <DriverView />;
      case 'OPERATOR':
        return <OperatorView />;
      case 'MECHANIC':
        return <MechanicView />;
      case 'ACCOUNTANT':
        return <AccountantView />;
      case 'HR':
        return <HrView />;
      default:
        return <CeoView />;
    }
  };

  // Driver view is full-screen mobile only
  if (role === 'DRIVER') {
    return (
      <main className="min-h-screen bg-background pb-20 safe-area-padding">
        {renderContent()}
        <BottomTabs role={role} />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      <main className="flex-1 md:ml-60 min-h-screen pb-24 md:pb-8 p-4 md:p-8">
        <header className="sticky top-0 h-16 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-6 z-40 mb-6">
          <div className="flex items-center gap-3">
            <div className="md:hidden font-headline tracking-tighter text-primary">Calvary Connect</div>
            {/* Role Badge - Shows current viewing role */}
            <Badge className={`${currentRoleBadge.color} text-white gap-1.5 px-3 py-1`}>
              <currentRoleBadge.icon className="size-3.5" />
              <span className="font-medium">{currentRoleBadge.label}</span>
            </Badge>
            {isAdminUser && (
              <span className="text-xs text-muted-foreground hidden md:inline">
                (Switch roles in sidebar)
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <CurrencyDisplay />
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="rounded-full gap-2 border text-primary">
              <Languages className="size-4" />
              <span className="font-bold text-xs">{lang === 'en' ? 'SW' : 'EN'}</span>
            </Button>
            <NotificationsBell />
          </div>
        </header>

        <div className="space-y-6">
          {renderContent()}
        </div>
      </main>

      <BottomTabs role={role} />
    </div>
  );
}
