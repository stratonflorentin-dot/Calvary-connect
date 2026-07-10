"use client";

import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = useRole();
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={role} />
      <main
        className={cn(
          "min-h-screen px-4 sm:px-6 lg:px-8 py-6 transition-all duration-300",
          isCollapsed ? "md:ml-20" : "md:ml-64",
        )}
      >
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
