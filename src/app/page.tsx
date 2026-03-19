"use client";

import { useRole } from '@/hooks/use-role';
import { Sidebar } from '@/components/navigation/sidebar';
import { BottomTabs } from '@/components/navigation/bottom-tabs';
import { RoleSelector } from '@/components/dashboard/role-selector';
import { CeoView } from '@/components/dashboard/ceo-view';
import { DriverView } from '@/components/dashboard/driver-view';
import { NotificationsBell } from '@/components/shared/notifications-bell';
import { AiInsightPanel } from '@/components/dashboard/ai-insight-panel';

export default function Home() {
  const { role } = useRole();

  if (!role) return null;

  // Render role-specific content
  const renderContent = () => {
    switch (role) {
      case 'CEO':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              <CeoView />
            </div>
            <div className="space-y-8">
              <AiInsightPanel />
              {/* Other CEO sidebar widgets */}
            </div>
          </div>
        );
      case 'DRIVER':
        return <DriverView />;
      case 'OPERATIONS':
        return <CeoView />; // Fallback for demo
      case 'MECHANIC':
        return <CeoView />; // Fallback for demo
      case 'ACCOUNTANT':
        return <CeoView />; // Fallback for demo
      default:
        return <CeoView />;
    }
  };

  // Driver view is full-screen mobile only with no desktop sidebar/layout as per requirements
  if (role === 'DRIVER') {
    return (
      <main className="min-h-screen bg-background">
        {renderContent()}
        <BottomTabs role={role} />
        <RoleSelector />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar role={role} />
      
      <main className="flex-1 md:ml-60 min-h-screen pb-24 md:pb-8">
        <header className="sticky top-0 h-16 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-6 z-40">
          <div className="md:hidden font-headline tracking-tighter text-primary">Calvary Connect</div>
          <div className="hidden md:block" />
          <NotificationsBell />
        </header>

        <div className="p-4 md:p-8">
          {renderContent()}
        </div>
      </main>

      <BottomTabs role={role} />
      <RoleSelector />
    </div>
  );
}
