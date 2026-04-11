
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
import { Languages } from 'lucide-react';

export default function Home() {
  const { role, isAdmin } = useRole();
  const { user, isLoading } = useSupabase();
  const { toggleLanguage, lang } = useLanguage();

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
    // Show a public landing page with login/signup prompt, but do not block manifest/service worker
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="max-w-xl w-full p-8 bg-white rounded-xl shadow-xl mt-16">
          <h1 className="text-3xl font-bold mb-4 text-center">Welcome to Calvary Connect</h1>
          <p className="text-muted-foreground mb-6 text-center">
            Professional fleet management platform for logistics, drivers, vehicles, and operations.<br />
            Sign in or create an account to get started.
          </p>
          <AuthComponent />
        </div>
        <footer className="mt-8 text-xs text-muted-foreground text-center opacity-70">
          &copy; {new Date().getFullYear()} Calvary Connect. All rights reserved.
        </footer>
      </div>
    );
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
  if (role === 'DRIVER' && !isAdmin) {
    return (
      <main className="min-h-screen bg-background safe-area-padding">
        {renderContent()}
        <BottomTabs role={role} />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar role={role} />

      <main className="flex-1 md:ml-60 min-h-screen pb-24 md:pb-8 p-4 md:p-8 overflow-x-hidden">
        {/* Sticky top header */}
        <header className="sticky top-0 h-14 md:h-16 bg-white/90 backdrop-blur-md border-b flex items-center justify-between px-4 md:px-6 z-40 mb-4 md:mb-6 -mx-4 md:-mx-8">
          <div className="md:hidden font-headline tracking-tighter text-primary text-lg font-bold">Calvary Connect</div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <CurrencyDisplay />
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="rounded-full gap-2 border text-primary h-9 px-3">
              <Languages className="size-4" />
              <span className="font-bold text-xs">{lang === 'en' ? 'SW' : 'EN'}</span>
            </Button>
            <NotificationsBell />
          </div>
        </header>

        <div className="space-y-6">
          {renderContent()}
        </div>

        {/* Always show BottomTabs on mobile for all roles */}
        <BottomTabs role={role} />
      </main>
    </div>
  );
}

