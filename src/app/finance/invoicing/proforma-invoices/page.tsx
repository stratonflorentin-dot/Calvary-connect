"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/components/ui/currency-badge";
import { DataTable, StatusBadge } from "@/components/shell";
import { FileText, Plus, Search } from "lucide-react";

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

          <DataTable
            data={filtered}
            getRowId={(p) => p.id}
            loading={loading}
            onRowClick={(p) => { window.location.href = `/finance/invoicing/proforma-invoices/${p.id}`; }}
            emptyIcon={FileText}
            emptyTitle="No proforma invoices"
            emptyDescription="Get started by creating your first proforma invoice."
            emptyAction={<Button asChild><Link href="/finance/invoicing/proforma-invoices/new">Create Proforma Invoice</Link></Button>}
            initialSort={{ key: "date", dir: "desc" }}
            columns={[
              { key: "number", header: "Proforma No.", accessor: (p) => <span className="font-mono text-xs font-black text-foreground">{p.proforma_number}</span>, sortValue: (p) => p.proforma_number ?? "" },
              { key: "date", header: "Date", hideBelow: "md", accessor: (p) => <span className="text-xs text-muted-foreground">{p.issue_date ? new Date(p.issue_date).toLocaleDateString() : "—"}</span>, sortValue: (p) => p.issue_date ?? "" },
              { key: "customer", header: "Customer", accessor: (p) => <span className="font-medium text-foreground">{p.customer?.company_name ?? p.customer_name ?? "—"}</span>, sortValue: (p) => p.customer?.company_name ?? p.customer_name ?? "" },
              { key: "reference", header: "Reference", hideBelow: "lg", accessor: (p) => <span className="text-xs text-muted-foreground">{p.customer_reference || "—"}</span> },
              { key: "subtotal", header: "Subtotal", align: "right", hideBelow: "lg", accessor: (p) => formatCurrency(Number(p.subtotal) || 0, p.currency || "TZS") },
              { key: "tax", header: "Tax", align: "right", hideBelow: "lg", accessor: (p) => <span className="text-muted-foreground">{formatCurrency(Number(p.vat_amount) || 0, p.currency || "TZS")}</span> },
              { key: "total", header: "Total", align: "right", accessor: (p) => <span className="font-bold">{formatCurrency(Number(p.total_amount) || 0, p.currency || "TZS")}</span>, sortValue: (p) => Number(p.total_amount) || 0 },
              { key: "valid_until", header: "Valid Until", hideBelow: "md", accessor: (p) => <span className="text-xs text-muted-foreground">{p.valid_until ? new Date(p.valid_until).toLocaleDateString() : "—"}</span>, sortValue: (p) => p.valid_until ?? "" },
              {
                key: "status", header: "Status",
                accessor: (p) => p._status === "converted" && p.converted_invoice
                  ? <StatusBadge status="converted" label={`→ ${p.converted_invoice.invoice_number}`} />
                  : <StatusBadge status={p._status} />,
                sortValue: (p) => p._status,
              },
            ]}
      />
    </div>
  );
}
