"use client";

import { AuditView } from "@/components/audit/audit-view";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";

export default function AuditPage() {
  const { role, isAdmin, isLoading: roleLoading } = useRole();

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin && !role) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar role={role!} />
        <main className="flex-1 md:ml-60 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center bg-card p-8 rounded-2xl border shadow-sm max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
            <p className="text-muted-foreground text-sm">You do not have permission to view the audit log.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <AuditView />
      </main>
    </div>
  );
}




