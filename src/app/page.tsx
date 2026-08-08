
"use client";

import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { Sidebar } from '@/components/navigation/sidebar';
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
        <header className="sticky top-0 h-14 md:h-16 bg-card/90 backdrop-blur-md border-b border-border flex items-center justify-between px-4 md:px-6 z-40 mb-4 md:mb-6 -mx-4 md:-mx-8">
          <div className="md:hidden font-headline tracking-tighter text-primary text-lg font-bold">Calvary Connect</div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* Too wide for a phone header row — the bell/language buttons were
                pushed past the clipped edge and became unreachable. */}
            <div className="hidden md:block">
              <CurrencyDisplay />
            </div>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLanguage}
              title={`Switch to ${lang === 'en' ? 'Swahili' : 'English'}`}
              className="rounded-full text-muted-foreground hover:text-primary"
            >
              <Languages className="size-4" />
            </Button>
            <NotificationsBell />
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              title="Logout"
              className="hidden sm:flex rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <div className="space-y-6">
          {renderContent()}
        </div>

        {/* Always show BottomTabs on mobile for all roles */}      </main>
    </div>
  );
}

