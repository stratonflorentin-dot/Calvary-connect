"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { RoleDashboard } from "./shared/role-dashboard";
import { EmptyState } from "@/components/shell";
import { useCurrency } from "@/hooks/use-currency";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  Handshake,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

export default function SalesmanDashboard() {
  const { format } = useCurrency();
  const [customers, setCustomers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const load = async () => {
    const [c, b, q, i] = await Promise.all([
      supabase.from("customers").select("*").is("deleted_at", null),
      supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("route_quotations").select("*, customers(company_name)").order("created_at", { ascending: false }).limit(50),
      supabase.from("invoices").select("*").eq("type", "receivable").limit(200),
    ]);
    setCustomers(c.data ?? []);
    setBookings(b.data ?? []);
    setQuotations(q.data ?? []);
    setInvoices(i.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthRevenue = invoices
      .filter((i) => i.status === "paid" && i.paid_at && new Date(i.paid_at).getTime() >= monthStart)
      .reduce((s, i) => s + Number(i.total_amount ?? i.amount ?? 0), 0);
    const openQuotes = quotations.filter((q) => ["sent", "viewed", "draft"].includes(q.approval_status ?? q.status)).length;
    const openBookings = bookings.filter((b) => ["confirmed", "in_progress"].includes(b.status)).length;
    return {
      customers: customers.length,
      openBookings,
      openQuotes,
      monthRevenue,
    };
  }, [customers, bookings, quotations, invoices]);

  const recentBookings = useMemo(() => bookings.slice(0, 5), [bookings]);
  const recentQuotes = useMemo(() => quotations.slice(0, 5), [quotations]);

  return (
    <RoleDashboard
      eyebrow="Sales Console"
      title="Welcome"
      subtitle={`${stats.openQuotes} open quotes · ${stats.openBookings} bookings live · ${format(stats.monthRevenue)} closed this month`}
      onRefresh={load}
      storageKey="salesman-dash"
      kpis={[
        { label: "Customers", value: stats.customers, icon: Building2, accent: "bg-primary/10 text-primary", href: "/customers" },
        { label: "Open quotes", value: stats.openQuotes, icon: FileText, accent: "bg-amber-100 text-amber-700", href: "/sales" },
        { label: "Live bookings", value: stats.openBookings, icon: Handshake, accent: "bg-sky-100 text-sky-700", href: "/bookings" },
        { label: "Revenue MTD", value: format(stats.monthRevenue), icon: TrendingUp, accent: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]", href: "/sales" },
      ]}
      sections={[
        {
          title: "Recent bookings",
          subtitle: "Last 5 across all customers",
          href: "/bookings",
          padded: false,
          colSpan: 2,
          content: recentBookings.length === 0 ? (
            <EmptyState icon={Handshake} title="No bookings yet" />
          ) : (
            <ul className="divide-y divide-border">
              {recentBookings.map((b) => (
                <li key={b.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Handshake className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{b.customer_name ?? b.client_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.booking_number ?? b.id.slice(0, 8)} · {b.status}</p>
                  </div>
                  {b.total_amount && <span className="text-sm font-black text-foreground">{format(Number(b.total_amount))}</span>}
                </li>
              ))}
            </ul>
          ),
        },
        {
          title: "Open quotations",
          subtitle: "Waiting on customer response",
          href: "/sales",
          padded: false,
          content: recentQuotes.length === 0 ? (
            <EmptyState icon={FileText} title="No open quotes" />
          ) : (
            <ul className="divide-y divide-border">
              {recentQuotes.map((q) => (
                <li key={q.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground truncate">{q.customers?.company_name ?? "Unknown customer"}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{q.quotation_number ?? q.id.slice(0, 8)}</p>
                  </div>
                  {q.total_amount && <span className="text-sm font-black text-foreground">{format(Number(q.total_amount))}</span>}
                </li>
              ))}
            </ul>
          ),
        },
      ]}
      quickActions={[
        { href: "/sales", label: "Sales pipeline", icon: Briefcase, tone: "bg-primary/10 text-primary" },
        { href: "/customers", label: "Customers", icon: Users, tone: "bg-sky-100 text-sky-700" },
        { href: "/bookings", label: "Bookings", icon: Handshake, tone: "bg-emerald-100 text-emerald-700" },
        { href: "/admin/contracts", label: "Contracts", icon: FileText, tone: "bg-violet-100 text-violet-700" },
        { href: "/customers", label: "New lead", icon: UserPlus, tone: "bg-amber-100 text-amber-700" },
        { href: "/finance/invoicing/customer-invoices", label: "Invoices", icon: DollarSign, tone: "bg-fuchsia-100 text-fuchsia-700" },
      ]}
    />
  );
}
