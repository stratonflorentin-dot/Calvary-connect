"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RoleDashboard } from "./shared/role-dashboard";
import { EmptyState } from "@/components/shell";
import { useCurrency } from "@/hooks/use-currency";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Coins,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function HRView() {
  const { format } = useCurrency();
  const [staff, setStaff] = useState<any[]>([]);
  const [allowances, setAllowances] = useState<any[]>([]);

  const load = async () => {
    const [u, a] = await Promise.all([
      supabase.from("user_profiles").select("*"),
      supabase.from("allowances").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setStaff(u.data ?? []);
    setAllowances(a.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const active = staff.filter((u) => u.status === "active").length;
    const drivers = staff.filter((u) => u.role === "DRIVER").length;
    const pendingAllowance = allowances.filter((a) => a.status === "pending").length;
    const payMonth = allowances
      .filter((a) => (a.status === "approved" || a.status === "paid") && new Date(a.created_at).getTime() >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime())
      .reduce((s, a) => s + Number(a.amount || 0), 0);
    return { total: staff.length, active, drivers, pendingAllowance, payMonth };
  }, [staff, allowances]);

  const pendingList = useMemo(() => allowances.filter((a) => a.status === "pending").slice(0, 6), [allowances]);

  return (
    <RoleDashboard
      eyebrow="HR Console"
      title="Welcome"
      subtitle={`${stats.active} active team members · ${stats.pendingAllowance} allowances waiting · ${format(stats.payMonth)} paid this month`}
      onRefresh={load}
      storageKey="hr-dash"
      kpis={[
        { label: "Team size", value: stats.total, icon: Users, accent: "bg-primary/10 text-primary", href: "/users" },
        { label: "Active", value: stats.active, icon: UserCheck, accent: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" },
        { label: "Drivers", value: stats.drivers, icon: BadgeCheck, accent: "bg-sky-100 text-sky-700", href: "/drivers" },
        { label: "Pending allowances", value: stats.pendingAllowance, icon: Coins, accent: "bg-amber-100 text-amber-700", href: "/allowances" },
      ]}
      sections={[
        {
          title: "Pending allowance approvals",
          subtitle: "Route through the Approvals inbox",
          href: "/allowances",
          padded: false,
          colSpan: 2,
          content: pendingList.length === 0 ? (
            <EmptyState icon={UserCheck} title="Nothing to approve" />
          ) : (
            <ul className="divide-y divide-border">
              {pendingList.map((a) => (
                <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{a.workerName ?? a.employee_id ?? "Employee"}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.reason ?? "Allowance"} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                  </div>
                  <span className="text-sm font-black text-foreground">{format(Number(a.amount || 0))}</span>
                </li>
              ))}
            </ul>
          ),
        },
        {
          title: "Team breakdown",
          subtitle: "By role",
          content: (
            <div className="space-y-2">
              {["CEO", "ADMIN", "OPERATOR", "DRIVER", "MECHANIC", "ACCOUNTANT", "HR", "SALESMAN", "WAREHOUSE_STAFF"].map((role) => {
                const count = staff.filter((u) => u.role === role).length;
                return (
                  <div key={role} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{role.replace(/_/g, " ")}</span>
                    <span className="font-black">{count}</span>
                  </div>
                );
              })}
            </div>
          ),
        },
      ]}
      quickActions={[
        { href: "/users", label: "Users", icon: Users },
        { href: "/drivers", label: "Drivers", icon: BadgeCheck, tone: "bg-sky-100 text-sky-700" },
        { href: "/allowances", label: "Allowances", icon: Coins, tone: "bg-amber-100 text-amber-700" },
        { href: "/hr", label: "HR module", icon: CalendarDays, tone: "bg-primary/10 text-primary" },
        { href: "/approvals", label: "Approvals", icon: ClipboardList, tone: "bg-fuchsia-100 text-fuchsia-700" },
        { href: "/audit", label: "Audit trail", icon: UserPlus, tone: "bg-emerald-100 text-emerald-700" },
      ]}
    />
  );
}
