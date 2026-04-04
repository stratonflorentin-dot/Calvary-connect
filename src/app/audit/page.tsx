"use client";

import { AuditView } from "@/components/audit/audit-view";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";

export default function AuditPage() {
  const { role, isAdmin } = useRole();

  if (!role) return <div className="p-8">Access Denied</div>;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <AuditView />
      </main>
    </div>
  );
}



