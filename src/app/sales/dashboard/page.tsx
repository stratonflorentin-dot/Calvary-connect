"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { getListStagger, listItem } from "@/lib/animations";
import { PageShell, PageHeader, StatCard, SectionCard, EmptyState, PageSkeleton, RefreshControl } from "@/components/shell";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, Users, FileText, DollarSign, Target,
  Activity, ArrowUpRight, Calendar, CheckCircle2, ShieldAlert, FileSignature,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatShort(v: number, cur: string): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${cur} ${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${cur} ${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${cur} ${(v / 1_000).toFixed(1)}K`;
  return `${cur} ${v.toFixed(0)}`;
}

function formatByCurrency(byCurrency: Record<string, number>): string {
  const entries = Object.entries(byCurrency);
  if (entries.length === 0) return formatShort(0, "TZS");
  return entries.map(([cur, amt]) => formatShort(amt, cur)).join(" · ");
}

const QUICK_ACTIONS = [
  { href: "/sales/leads", label: "Add lead", icon: Users, accent: "bg-primary/10 text-primary" },
  { href: "/quotations/new", label: "New quotation", icon: FileText, accent: "bg-info/10 text-info" },
  { href: "/sales?tab=contracts", label: "New contract", icon: CheckCircle2, accent: "bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" },
  { href: "/bookings", label: "View bookings", icon: Calendar, accent: "bg-warning/10 text-warning" },
];

export default function SalesDashboard() {
  const { toast } = useToast();
  const { role, isLoading: roleLoading, hasDepartmentAccess } = useRole();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    convertedLeads: 0,
    totalCustomers: 0,
    totalQuotations: 0,
    draftQuotations: 0,
    approvedQuotations: 0,
    sentQuotations: 0,
    convertedQuotations: 0,
    totalContracts: 0,
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    totalPipelineValueByCurrency: {} as Record<string, number>,
    monthlyRevenueByCurrency: {} as Record<string, number>,
    conversionRate: 0,
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [pendingQuotations, setPendingQuotations] = useState<any[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [
        leadsData,
        customersData,
        quotationsData,
        contractsData,
        bookingsData,
      ] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }),
        supabase.from("customers").select("*"),
        supabase.from("quotations").select("*").eq("status", "draft").limit(5),
        supabase.from("contracts").select("*"),
        supabase.from("bookings").select("*"),
      ]);

      const allQuotations = await supabase.from("quotations").select("*");
      const leads = leadsData.data ?? [];
      const customers = customersData.data ?? [];
      const allQuotationRows = allQuotations.data ?? [];
      const contractRows = contractsData.data ?? [];
      const bookingRows = bookingsData.data ?? [];
      const pendingQuotationRows = quotationsData.data ?? [];

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const bookedThisMonth = bookingRows.filter((b: any) => {
        const createdAt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return createdAt >= monthStart && ["confirmed", "in_progress", "completed"].includes(b.status);
      });

      setStats({
        totalLeads: leads.length,
        newLeads: leads.filter((l: any) => l.status === "new").length,
        qualifiedLeads: leads.filter((l: any) => l.status === "qualified").length,
        convertedLeads: leads.filter((l: any) => l.status === "converted").length,
        totalCustomers: customers.length,
        totalQuotations: allQuotationRows.length,
        draftQuotations: allQuotationRows.filter((q: any) => q.status === "draft").length,
        approvedQuotations: allQuotationRows.filter((q: any) => q.status === "accepted").length,
        sentQuotations: allQuotationRows.filter((q: any) => q.status === "sent" || q.status === "viewed").length,
        convertedQuotations: allQuotationRows.filter((q: any) => Boolean(q.shipment_id)).length,
        totalContracts: contractRows.length,
        totalBookings: bookingRows.length,
        pendingBookings: bookingRows.filter((b: any) => b.status === "pending").length,
        confirmedBookings: bookingRows.filter((b: any) => b.status === "confirmed").length,
        totalPipelineValueByCurrency: allQuotationRows
          .filter((q: any) => !["rejected", "expired"].includes(q.status))
          .reduce((acc: Record<string, number>, q: any) => {
            const cur = q.currency || "TZS";
            acc[cur] = (acc[cur] ?? 0) + (Number(q.total_amount ?? q.amount) || 0);
            return acc;
          }, {}),
        monthlyRevenueByCurrency: bookedThisMonth.reduce((acc: Record<string, number>, b: any) => {
          const cur = b.currency || "TZS";
          acc[cur] = (acc[cur] ?? 0) + (Number(b.amount) || 0);
          return acc;
        }, {}),
        conversionRate: leads.length > 0
          ? Math.round((leads.filter((l: any) => l.status === "converted").length / leads.length) * 100)
          : 0,
      });

      setRecentLeads(leads);
      setPendingQuotations(pendingQuotationRows);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
      toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (roleLoading) return <PageShell width="wide"><PageSkeleton kpiCount={8} /></PageShell>;

  if (!hasDepartmentAccess("SALES") && role !== "CEO" && role !== "ADMIN") {
    return (
      <PageShell width="wide">
        <EmptyState
          icon={ShieldAlert}
          title="Access denied"
          description="Sales dashboard requires Sales department access."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Sales"
        title="Sales Dashboard"
        subtitle="Sales pipeline performance and opportunities"
        icon={Target}
        iconAccent="bg-primary text-primary-foreground"
        actions={
          <>
            <RefreshControl onRefresh={loadDashboardData} storageKey="sales-dashboard" />
            <Link href="/sales/leads">
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Users className="w-3.5 h-3.5" /> Manage leads
              </Button>
            </Link>
          </>
        }
      />

      {loading ? (
        <PageSkeleton kpiCount={8} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatCard label="New leads" value={stats.newLeads} sub="Fresh opportunities" icon={Users} accent="bg-primary/10 text-primary" />
            <StatCard label="Qualified" value={stats.qualifiedLeads} sub="Ready to quote" icon={Target} accent="bg-info/10 text-info" />
            <StatCard label="Quotations" value={stats.totalQuotations} sub={`${stats.draftQuotations} draft · ${stats.approvedQuotations} approved`} icon={FileText} accent="bg-warning/10 text-warning" />
            <StatCard label="Bookings" value={stats.totalBookings} sub={`${stats.confirmedBookings} confirmed`} icon={Calendar} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
            <StatCard label="Conversion" value={`${stats.conversionRate}%`} sub="Lead to customer" icon={TrendingUp} accent="bg-primary/10 text-primary" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard label="Pipeline value" value={formatByCurrency(stats.totalPipelineValueByCurrency)} sub="Total quotations" icon={TrendingUp} accent="bg-primary/10 text-primary" />
            <StatCard label="Booked revenue" value={formatByCurrency(stats.monthlyRevenueByCurrency)} sub="Confirmed this month" icon={DollarSign} accent="bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]" />
            <StatCard label="Contracts" value={stats.totalContracts} sub="Active agreements" icon={FileSignature} accent="bg-info/10 text-info" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <SectionCard title="Pending quotations" icon={FileText} href="/quotations" padded={false}>
              {pendingQuotations.length === 0 ? (
                <EmptyState icon={FileText} title="No pending quotations" description="Draft quotations awaiting review will show up here." />
              ) : (
                <motion.ul
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: getListStagger(pendingQuotations.length) } } }}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-border"
                >
                  {pendingQuotations.map((quote) => (
                    <motion.li key={quote.id} variants={listItem} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{quote.quotation_number}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {quote.currency || "TZS"} {(quote.total_amount || 0).toLocaleString()}
                        </p>
                      </div>
                      <Link href={`/quotations/${quote.id}`} className="shrink-0">
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                          Review <ArrowUpRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </SectionCard>

            <SectionCard title="Recent leads" icon={Users} href="/sales/leads" padded={false}>
              {recentLeads.length === 0 ? (
                <EmptyState icon={Users} title="No recent leads" description="New leads will show up here as they come in." />
              ) : (
                <motion.ul
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: getListStagger(Math.min(recentLeads.length, 5)) } } }}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-border"
                >
                  {recentLeads.slice(0, 5).map((lead) => (
                    <motion.li key={lead.id} variants={listItem} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{lead.company_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.contact_person}</p>
                      </div>
                      <span
                        className={cn(
                          "cv-chip shrink-0",
                          lead.status === "new" ? "cv-chip-info" :
                            lead.status === "qualified" ? "cv-chip-success" :
                              "cv-chip-neutral",
                        )}
                      >
                        {lead.status}
                      </span>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </SectionCard>
          </div>

          <div>
            <h2 className="text-sm font-black text-foreground mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Quick actions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {QUICK_ACTIONS.map(({ href, label, icon: Icon, accent }) => (
                <Link key={href} href={href}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="cv-surface p-5 flex flex-col items-center justify-center gap-2 text-center transition-colors hover:border-primary/30 hover:shadow-md"
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", accent)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-foreground">{label}</span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
