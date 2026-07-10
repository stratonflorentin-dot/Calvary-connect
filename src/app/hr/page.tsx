"use client";

import Link from "next/link";
import { PageShell, PageHeader } from "@/components/shell";
import {
  CalendarDays,
  Coins,
  FileSpreadsheet,
  Shield,
  Users,
  Wallet,
} from "lucide-react";

const MODULES = [
  {
    href: "/hr/meetings",
    icon: CalendarDays,
    title: "Meetings",
    description: "Schedule, minutes and follow-ups for staff meetings.",
    tone: "bg-primary/10 text-primary",
  },
  {
    href: "/hr/insurance",
    icon: Shield,
    title: "Insurance",
    description: "Employee and vehicle insurance policies and renewals.",
    tone: "bg-emerald-100 text-emerald-700",
  },
  {
    href: "/admin/hr/payroll/statutory",
    icon: Wallet,
    title: "Payroll & statutory",
    description: "Worker payroll, PAYE, NSSF and statutory deductions.",
    tone: "bg-violet-100 text-violet-700",
  },
  {
    href: "/allowances",
    icon: Coins,
    title: "Allowances",
    description: "Driver trip allowances and per-diem payments.",
    tone: "bg-amber-100 text-amber-700",
  },
  {
    href: "/users",
    icon: Users,
    title: "Staff & users",
    description: "Employee records, roles and account access.",
    tone: "bg-sky-100 text-sky-700",
  },
  {
    href: "/reports",
    icon: FileSpreadsheet,
    title: "Reports",
    description: "Fleet and workforce reporting.",
    tone: "bg-rose-100 text-rose-700",
  },
];

export default function HrHubPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Human Resources"
        title="HR module"
        subtitle="People, payroll, insurance and meetings in one place"
        icon={Users}
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="cv-surface p-5 flex flex-col gap-3 hover:border-primary/50 transition-colors group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.tone}`}>
              <m.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                {m.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
