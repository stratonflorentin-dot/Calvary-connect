"use client";

import { PageShell } from "@/components/shell";

export default function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageShell>{children}</PageShell>;
}
