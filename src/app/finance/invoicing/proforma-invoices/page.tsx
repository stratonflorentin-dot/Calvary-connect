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
  accepted: "bg-success/10 text-success border-success/20",
  expired: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  converted: "bg-primary/10 text-primary border-primary/20",
};

type StatusFilter = "all" | "draft" | "sent" | "accepted" | "expired" | "cancelled" | "converted";

export default function ProformaInvoicesListPage() {
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("proforma_invoices")
      .select("*, customer:customer_id(company_name, contact_person), converted_invoice:converted_invoice_id(invoice_number)")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Same "derive, don't require a background job" approach as quotations —
  // a draft/sent proforma past its valid_until reads as expired here
  // without needing a cron to flip the stored status.
  const todayStr = new Date().toISOString().slice(0, 10);
  const effectiveStatus = (p: any) =>
    ["draft", "sent"].includes(p.status) && p.valid_until && p.valid_until < todayStr ? "expired" : p.status;

  const withStatus = useMemo(() => rows.map((p) => ({ ...p, _status: effectiveStatus(p) })), [rows]);

  const stats = useMemo(() => {
    const total = withStatus.length;
    const draft = withStatus.filter((p) => p._status === "draft").length;
    const sent = withStatus.filter((p) => p._status === "sent").length;
    const converted = withStatus.filter((p) => p._status === "converted").length;
    const totalValueByCurrency = new Map<string, number>();
    withStatus.forEach((p) => {
      if (p._status === "cancelled") return;
      const cur = p.currency || "TZS";
      totalValueByCurrency.set(cur, (totalValueByCurrency.get(cur) ?? 0) + (Number(p.total_amount) || 0));
    });
    return { total, draft, sent, converted, totalValueByCurrency };
  }, [withStatus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withStatus.filter((row) => {
      if (filter !== "all" && row._status !== filter) return false;
      if (!q) return true;
      const hay = [row.proforma_number, row.customer?.company_name, row.customer?.contact_person, row.customer_reference]
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
              <Link href="/finance/invoicing/customer-invoices" className="text-xs text-muted-foreground hover:text-foreground">
                Finance / Invoicing
              </Link>
              <h1 className="text-2xl md:text-3xl font-headline tracking-tighter flex items-center gap-2">
                <FileText className="size-7 text-primary" /> Proforma Invoices
              </h1>
              <p className="text-muted-foreground">Prepare quotations and preliminary billing documents before issuing final invoices</p>
            </div>
            <Button asChild className="gap-2">
              <Link href="/finance/invoicing/proforma-invoices/new"><Plus className="size-4" /> New Proforma Invoice</Link>
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
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Converted</p>
              <p className="text-2xl font-black text-primary">{stats.converted}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pipeline Value</p>
              {stats.totalValueByCurrency.size === 0 ? (
                <p className="text-lg font-black text-foreground">{formatCurrency(0, "TZS")}</p>
              ) : (
                Array.from(stats.totalValueByCurrency.entries()).map(([cur, val]) => (
                  <p key={cur} className="text-lg font-black text-foreground leading-tight">{formatCurrency(val, cur)}</p>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search proforma #, customer, reference…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="size-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="font-bold text-foreground">No proforma invoices</p>
                <p className="text-sm text-muted-foreground mb-4">Get started by creating your first proforma invoice.</p>
                <Button asChild><Link href="/finance/invoicing/proforma-invoices/new">Create Proforma Invoice</Link></Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-4 py-3">Proforma No.</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Reference</th>
                      <th className="px-4 py-3 text-right">Subtotal</th>
                      <th className="px-4 py-3 text-right">Tax</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3">Valid Until</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => (window.location.href = `/finance/invoicing/proforma-invoices/${p.id}`)}>
                        <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{p.proforma_number}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.issue_date ? new Date(p.issue_date).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{p.customer?.company_name ?? p.customer_name ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.customer_reference || "—"}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(Number(p.subtotal) || 0, p.currency || "TZS")}</td>
                        <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(Number(p.vat_amount) || 0, p.currency || "TZS")}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(Number(p.total_amount) || 0, p.currency || "TZS")}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.valid_until ? new Date(p.valid_until).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={STATUS_BADGES[p._status] ?? ""}>
                            {p._status === "converted" && p.converted_invoice ? `→ ${p.converted_invoice.invoice_number}` : p._status}
                          </Badge>
                        </td>
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
