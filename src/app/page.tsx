
"use client";

import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { AuthComponent } from '@/components/auth/auth-component';
import { CeoView } from '@/components/dashboard/ceo-view';
import AdminDashboard from '@/components/dashboard/admin-view';
import { DriverView } from '@/components/dashboard/driver-view';
import { MechanicView } from '@/components/dashboard/mechanic-view';
import { AccountantView } from '@/components/dashboard/accountant-view';
import { HRView } from '@/components/dashboard/hr-view';
import { OperatorView } from '@/components/dashboard/operator-view';
import SalesmanDashboard from '@/components/dashboard/salesman-view';
import { NotificationsBell } from '@/components/shared/notifications-bell';
import { CurrencyDisplay } from '@/components/shared/currency-display';
import { AIAnalysisDashboard } from '@/components/dashboard/ai-analysis-dashboard';
import { WelcomeScreen } from '@/components/welcome-screen';
import { useLanguage } from '@/hooks/use-language';
import { useSidebar } from '@/hooks/use-sidebar';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Languages, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  const { role, isAdmin } = useRole();
  const { user, isLoading, signOut } = useSupabase();
  const { toggleLanguage, lang } = useLanguage();
  const { isCollapsed } = useSidebar();
  const [showWelcome, setShowWelcome] = useState(true);

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

  // Show welcome screen on first load
  if (showWelcome) {
    return <WelcomeScreen onComplete={() => setShowWelcome(false)} minimumDuration={2500} />;
  }

  // Render role-specific content
  const renderContent = () => {
    switch (role) {
      case 'ADMIN':
        return <AdminDashboard />;
      case 'CEO':
        return <CeoView />;
      case 'HR':
        return <HRView />;
      case 'DRIVER':
        return <DriverView />;
      case 'OPERATOR':
        return <OperatorView />;
      case 'MECHANIC':
        return <MechanicView />;
      case 'ACCOUNTANT':
        return <AccountantView />;
      case 'SALESMAN':
        return <SalesmanDashboard />;
      case 'WAREHOUSE_STAFF':
        return <OperatorView />;
      default:
        return <AdminDashboard />;
    }
  };

  // Standard layout for all roles including Driver

  return (
    <div className="min-h-screen bg-background flex transition-colors duration-300">
      <Sidebar role={role} />

      <main className={cn(
        "flex-1 min-h-screen pb-24 md:pb-8 p-4 md:p-8 overflow-x-hidden transition-all duration-300",
        isCollapsed ? "md:ml-20" : "md:ml-64"
      )}>
        {/* Sticky top header */}
        <header className="sticky top-0 h-14 md:h-16 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b flex items-center justify-between px-4 md:px-6 z-40 mb-4 md:mb-6 -mx-4 md:-mx-8">
          <div className="md:hidden font-headline tracking-tighter text-primary text-lg font-bold">Calvary Connect</div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <CurrencyDisplay />
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={toggleLanguage} className="rounded-full gap-2 border text-primary h-9 px-3">
              <Languages className="size-4" />
              <span className="font-bold text-xs">{lang === 'en' ? 'SW' : 'EN'}</span>
            </Button>
            <NotificationsBell />
            <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:flex rounded-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-9 px-3">
              <LogOut className="size-4" />
              <span className="font-bold text-xs">Logout</span>
            </Button>
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

