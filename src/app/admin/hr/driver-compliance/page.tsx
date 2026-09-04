"use client";

import { useRole } from "@/hooks/use-role";
import { DriverComplianceDashboard } from "@/components/driver/driver-compliance-tracker";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryShell } from "@/components/industry/shell";
import { IndustryCard } from "@/components/industry/card";

const HR_PAGES = [
  { label: "People", href: "/users" },
  { label: "Payroll & allowances", href: "/allowances" },
  { label: "Leave", href: "/hr/leave" },
  { label: "Driver compliance", href: "/admin/hr/driver-compliance" },
];

const MANAGER_ROLES = ["CEO", "ADMIN", "OPERATOR", "HR"];

export default function DriverCompliancePage() {
  const { role, isAdmin, isLoading } = useRole();

  if (isLoading) return null;

  const canView = isAdmin || MANAGER_ROLES.includes(String(role || "").toUpperCase());
  if (!canView) {
    return (
      <IndustryShell className="min-h-screen flex items-center justify-center">
        <IndustryCard className="max-w-md text-center">
          <h1 className="text-[22px]" style={{ fontFamily: "var(--font-barlow-condensed)", fontWeight: 600, color: "#8c1d18" }}>Access denied</h1>
          <p className="text-[13px] text-[var(--ci-text-secondary)] mt-1">You don&apos;t have permission to view driver compliance records.</p>
        </IndustryCard>
      </IndustryShell>
    );
  }

  return (
    <IndustryRoleShell roleLabel="HR" pages={HR_PAGES}>
      <DriverComplianceDashboard />
    </IndustryRoleShell>
  );
}
