"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

// Pages already restyled onto the Industry role shell (its own full-page
// rail + header, see IndustryRoleShell) bring their own chrome — wrapping
// them in the old Sidebar here would double the nav, the same bug the
// Mechanic pages hit under /maintenance/layout.tsx before being moved out
// from under it. These routes can't move (too many existing links point at
// them), so this layout skips its own wrapper for them instead.
const INDUSTRY_SHELL_PATHS = [
  "/finance",
  "/finance/invoicing/customer-invoices",
  "/finance/banking/bank-statements",
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role } = useRole();
  const { isCollapsed } = useSidebar();
  const pathname = usePathname();

  if (INDUSTRY_SHELL_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

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
