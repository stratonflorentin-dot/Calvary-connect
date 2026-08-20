"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/navigation/sidebar";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/components/ui/currency-badge";
import { FileText, Loader2, Plus, Search } from "lucide-react";

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-info/10 text-info border-info/20",
  viewed: "bg-warning/10 text-warning border-warning/20",
  accepted: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  expired: "bg-muted text-muted-foreground border-border",
};

type StatusFilter = "all" | "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";

export default function QuotationsListPage() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("quotations")
      .select("*, customer:customer_id(company_name, contact_person)")
      .order("created_at", { ascending: false });
    setQuotations(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // A quotation past its valid_until with no customer decision yet reads
  // as expired here — same "derive, don't require a background job"
  // approach used for Cash Requests' overdue tile earlier this session.
  const todayStr = new Date().toISOString().slice(0, 10);
  const effectiveStatus = (q: any) =>
    ["sent", "viewed"].includes(q.status) && q.valid_until && q.valid_until < todayStr ? "expired" : q.status;

  // Single source of truth for both the stat cards and the table — the
  // exact bug this pasted spec called out (stat cards and the list
  // disagreeing) can't happen if both read the same filtered array.
  const withStatus = useMemo(() => quotations.map((q) => ({ ...q, _status: effectiveStatus(q) })), [quotations]);

  const stats = useMemo(() => {
    const total = withStatus.length;
    const draft = withStatus.filter((q) => q._status === "draft").length;
    const sent = withStatus.filter((q) => ["sent", "viewed"].includes(q._status)).length;
    const accepted = withStatus.filter((q) => q._status === "accepted").length;
    const totalValue = withStatus.reduce((sum, q) => sum + (Number(q.total_amount) || 0), 0);
    return { total, draft, sent, accepted, totalValue };
  }, [withStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withStatus.filter((row) => {
      if (filter !== "all" && row._status !== filter) return false;
      if (!q) return true;
      const hay = [row.quotation_number, row.customer?.company_name, row.customer?.contact_person, row.origin, row.destination]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [withStatus, search, filter]);

  if (!role) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0 md:ml-60 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-headline tracking-tighter flex items-center gap-2">
                <FileText className="size-7 text-primary" /> Created Quotations
              </h1>
              <p className="text-muted-foreground">Manage all quotations generated in the system</p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/quotations/new"><Plus className="size-4" /> New Quotation</Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
              <p className="text-2xl font-black text-foreground">{stats.total}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Draft</p>
              <p className="text-2xl font-black text-foreground">{stats.draft}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sent</p>
              <p className="text-2xl font-black text-info">{stats.sent}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Accepted</p>
              <p className="text-2xl font-black text-success">{stats.accepted}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Value</p>
              <p className="text-lg font-black text-foreground">{formatCurrency(stats.totalValue, "TZS")}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search quotations..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="viewed">Viewed</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="size-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="font-bold text-foreground">No quotations</p>
                <p className="text-sm text-muted-foreground mb-4">Get started by creating your first quotation.</p>
                <Button asChild><Link href="/quotations/new">Create Quotation</Link></Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3">Quotation #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Route</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Valid Until</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((q) => (
                      <tr key={q.id} className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => (window.location.href = `/quotations/${q.id}`)}>
                        <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{q.quotation_number || q.quote_number || q.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{q.customer?.company_name ?? q.customer?.contact_person ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{q.origin && q.destination ? `${q.origin} → ${q.destination}` : "—"}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(q.total_amount) || 0, q.currency || "TZS")}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={STATUS_BADGES[q._status] ?? ""}>{q._status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{q.created_at ? new Date(q.created_at).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
