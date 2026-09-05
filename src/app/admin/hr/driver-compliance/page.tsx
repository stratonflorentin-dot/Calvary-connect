"use client";

import { PageShell, PageHeader, EmptyState } from "@/components/shell";
import { useRole } from "@/hooks/use-role";
import { DriverComplianceDashboard } from "@/components/driver/driver-compliance-tracker";
import { Shield, User } from "lucide-react";

const MANAGER_ROLES = ["CEO", "ADMIN", "OPERATOR", "HR"];

export default function DriverCompliancePage() {
  const { role, isAdmin, isLoading } = useRole();

  if (isLoading) return null;

  const canView = isAdmin || MANAGER_ROLES.includes(String(role || "").toUpperCase());
  if (!canView) {
    return (
      <PageShell>
        <EmptyState
          icon={Shield}
          title="Access denied"
          description="You don't have permission to view driver compliance records."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="HR"
        title="Driver Compliance"
        subtitle="License, medical certificate and cross-border pass expiry tracking"
        icon={User}
      />
      <DriverComplianceDashboard />
    </PageShell>
  );
}
