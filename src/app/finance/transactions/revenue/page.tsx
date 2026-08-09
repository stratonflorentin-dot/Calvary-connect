"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2, RefreshCw, Search, TrendingUp, Wallet } from "lucide-react";

interface RevenueInvoice {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  client_name: string | null;
  status: string | null;
  currency: string | null;
  total_amount: number | null;
  amount: number | null;
  paid_at: string | null;
  due_date: string | null;
  created_at: string | null;
}

// Never blend currencies — same discipline as Reports > Executive Summary.
type MoneyByCurrency = Record<string, number>;
const PRIMARY_CURRENCY = "TZS";
function normCurrency(c: string | null | undefined): string {
  return (c || PRIMARY_CURRENCY).toUpperCase();
}
function addTo(map: MoneyByCurrency, currency: string, amount: number) {
  map[currency] = (map[currency] || 0) + amount;
}
function otherCurrencies(map: MoneyByCurrency): string[] {
  return Object.keys(map).filter((c) => c !== PRIMARY_CURRENCY && Math.abs(map[c]) > 0.001).sort();
}

function statusTone(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s === "paid") return "bg-success/10 text-success border-success/20";
  if (s === "overdue") return "bg-destructive/10 text-destructive border-destructive/20";
  if (s === "cancelled") return "bg-muted text-muted-foreground border-border";
  if (s === "draft") return "bg-muted text-muted-foreground border-border";
  return "bg-warning/10 text-warning border-warning/20"; // pending / sent
}

export default function RevenuePage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<RevenueInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "outstanding">("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_name, client_name, status, currency, total_amount, amount, paid_at, due_date, created_at, type")
      .neq("type", "payable") // revenue side only — payables are Finance > Expenses' concern
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast({ title: "Couldn't load revenue transactions", description: error.message, variant: "destructive" });
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as RevenueInvoice[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amountOf = (r: RevenueInvoice) => Number(r.total_amount ?? r.amount ?? 0);

  const visible = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "paid" && !r.paid_at) return false;
      if (filter === "outstanding" && r.paid_at) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.invoice_number} ${r.customer_name ?? ""} ${r.client_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const totals = useMemo(() => {
    const all: MoneyByCurrency = {};
    const collected: MoneyByCurrency = {};
    const outstanding: MoneyByCurrency = {};
    rows.forEach((r) => {
      const cur = normCurrency(r.currency);
      const amt = amountOf(r);
      addTo(all, cur, amt);
      if (r.paid_at) addTo(collected, cur, amt);
      else addTo(outstanding, cur, amt);
    });
    return { all, collected, outstanding, count: rows.length };
  }, [rows]);

  const Money = ({ map }: { map: MoneyByCurrency }) => {
    const primary = map[PRIMARY_CURRENCY] || 0;
    const others = otherCurrencies(map);
    return (
      <div>
        <div className="text-2xl font-black text-foreground">{formatCurrency(primary, PRIMARY_CURRENCY)}</div>
        {others.map((cur) => (
          <div key={cur} className="text-xs font-semibold text-muted-foreground mt-0.5">
            + {formatCurrency(map[cur], cur)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link href="/finance">
            <ArrowLeft className="size-4 mr-2" /> Back to Finance
          </Link>
        </Button>
        <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
          <Wallet className="size-6 text-primary" /> Revenue Transactions
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Every receivable — freight billing, collected and outstanding
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="pt-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Revenue</p>
            <Money map={totals.all} />
            <p className="text-xs text-muted-foreground mt-1">{totals.count} transaction(s)</p>
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="pt-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1">
              <TrendingUp className="size-3 text-success" /> Collected
            </p>
            <Money map={totals.collected} />
          </CardContent>
        </Card>
        <Card className="border-border shadow-sm">
          <CardContent className="pt-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Outstanding</p>
            <Money map={totals.outstanding} />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {(["all", "paid", "outstanding"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all border",
                filter === f
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted border-border",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice # or customer..."
              className="h-9 pl-8 w-64"
            />
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground" title="Refresh">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground"><Loader2 className="size-6 animate-spin mx-auto" /></div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground italic">No revenue transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Invoice #</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Customer</th>
                  <th className="text-right py-3 px-4 font-semibold text-foreground">Amount</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Due</th>
                  <th className="text-left py-3 px-4 font-semibold text-foreground">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-bold text-foreground">{r.invoice_number}</td>
                    <td className="py-3 px-4 text-foreground">{r.customer_name || r.client_name || "—"}</td>
                    <td className="py-3 px-4 text-right font-semibold text-foreground">
                      {formatCurrency(amountOf(r), normCurrency(r.currency))}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={cn("text-[10px] capitalize", statusTone(r.status))}>
                        {r.status || "pending"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {r.paid_at ? new Date(r.paid_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
