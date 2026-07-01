"use client";

import { Sidebar } from "@/components/navigation/sidebar";
import { FinanceSidebar } from "@/components/finance/finance-sidebar";
import { useRole } from "@/hooks/use-role";

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = useRole();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="flex-1 flex">
        <FinanceSidebar />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
