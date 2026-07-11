"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { useSupabase } from "@/components/supabase-provider";
import { AuditTrailService } from "@/services/audit-trail-service";
import {
  AGING_BUCKETS,
  bucketFor,
  daysOverdue,
  isOpenForAging,
  summarize,
  summarizeByCurrency,
} from "@/lib/finance/aging";
import { normalizeCurrency, sortCurrencyKeys } from "@/lib/finance/multi-currency";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Flame,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CURRENCIES = ["TZS", "USD", "EUR", "KES"];
const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

const STATUS_BADGES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  partial: "bg-sky-100 text-sky-700 border-sky-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

type FilterKey = "all" | "open" | "overdue" | "due_this_week" | "paid";

function within7Days(due: string | null | undefined): boolean {
  if (!due) return false;
  const d = new Date(due).getTime();
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  return d >= now && d - now <= week;
}

export default function VendorBillsPage() {
  const { toast } = useToast();
  const { user } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    vendor: "",
    invoice_number: "",
    amount: "",
    currency: "TZS",
    due_date: "",
    description: "",
    category: "",
  });

  const loadBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("type", "payable")
        .order("due_date", { ascending: true });
      if (error) throw error;
      setBills(data ?? []);
    } catch (err: any) {
      console.error("[bills]", err);
      setBills([]);
      toast({ title: "Load error", description: err?.message ?? "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputs = useMemo(
    () =>
      bills.map((b) => ({
        amount: b.total_amount ?? b.amount,
        due_date: b.due_date,
        status: b.status,
        vendor: b.customer_name ?? b.vendor,
        invoice_number: b.invoice_number,
        id: b.id,
        currency: normalizeCurrency(b.currency),
      })),
    [bills],
  );

  const summaryByCcy = useMemo(() => summarizeByCurrency(inputs), [inputs]);
  const currencies = useMemo(() => sortCurrencyKeys(Object.keys(summaryByCcy)), [summaryByCcy]);
  const summary = useMemo(() => summarize(inputs), [inputs]);

  const kpis = useMemo(() => {
    const open = bills.filter((b) => isOpenForAging(b.status));
    const paid = bills.filter((b) => b.status === "paid");
    const overdue = open.filter((b) => daysOverdue(b.due_date) > 0);
    const dueThisWeek = open.filter((b) => within7Days(b.due_date));
    return {
      openCount: open.length,
      overdueCount: overdue.length,
      paidCount: paid.length,
      dueThisWeekCount: dueThisWeek.length,
    };
  }, [bills]);

  const dueThisWeekByCcy = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of bills) {
      if (!isOpenForAging(b.status) || !within7Days(b.due_date)) continue;
      const cur = normalizeCurrency(b.currency);
      map[cur] = (map[cur] ?? 0) + (Number(b.total_amount ?? b.amount ?? 0) - Number(b.paid_amount ?? 0));
    }
    return map;
  }, [bills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((b) => {
      if (q) {
        const hay = [b.customer_name, b.vendor, b.invoice_number, b.description].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "open") return isOpenForAging(b.status);
      if (filter === "overdue") return isOpenForAging(b.status) && daysOverdue(b.due_date) > 0;
      if (filter === "due_this_week") return isOpenForAging(b.status) && within7Days(b.due_date);
      if (filter === "paid") return b.status === "paid";
      return true;
    });
  }, [bills, search, filter]);

  const selectedTotalsByCcy = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of filtered) {
      if (!selectedIds.has(b.id)) continue;
      const cur = normalizeCurrency(b.currency);
      const bal = Number(b.total_amount ?? b.amount ?? 0) - Number(b.paid_amount ?? 0);
      map[cur] = (map[cur] ?? 0) + bal;
    }
    return map;
  }, [selectedIds, filtered]);

  const selectedTotalLabel = useMemo(() => {
    const keys = sortCurrencyKeys(Object.keys(selectedTotalsByCcy));
    if (keys.length === 0) return "";
    return keys.map((c) => fmt(selectedTotalsByCcy[c], c)).join(" · ");
  }, [selectedTotalsByCcy]);

  const saveBill = async () => {
    if (!form.vendor || !form.amount || !form.due_date) {
      toast({ title: "Missing fields", description: "Vendor, amount and due date are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const amount = parseFloat(form.amount) || 0;
      const billNum = form.invoice_number || `BILL-${Date.now().toString().slice(-8)}`;

      const { data, error } = await supabase.from("invoices").insert({
        customer_name: form.vendor,
        vendor: form.vendor,
        invoice_number: billNum,
        amount,
        total_amount: amount,
        currency: form.currency,
        due_date: form.due_date,
        issue_date: new Date().toISOString().split("T")[0],
        description: form.description,
        category: form.category,
        status: "pending",
        type: "payable",
      }).select().maybeSingle();
      if (error) throw error;

      if (data?.id) {
        await AuditTrailService.logCreate("finance", "invoice", data.id, data, user?.id, `Bill ${billNum} from ${form.vendor}`);
      }

      await loadBills();
      setCreating(false);
      setForm({ vendor: "", invoice_number: "", amount: "", currency: "TZS", due_date: "", description: "", category: "" });
      toast({ title: "Bill saved", description: `${billNum} for ${fmt(amount, form.currency)}` });
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const recordPayment = async () => {
    if (!paying) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    const total = Number(paying.total_amount ?? paying.amount ?? 0);
    const prevPaid = Number(paying.paid_amount ?? 0);
    const newPaid = prevPaid + amt;
    const newStatus = newPaid >= total ? "paid" : "partial";

    const { error } = await supabase
      .from("invoices")
      .update({
        paid_amount: newPaid,
        status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : paying.paid_at,
        last_payment_method: payMethod,
      })
      .eq("id", paying.id);
    if (error) {
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
      return;
    }

    await AuditTrailService.log({
      user_id: user?.id,
      module: "finance",
      action: "update",
      entity_type: "payment",
      entity_id: paying.id,
      new_value: { amount: amt, method: payMethod, running_total: newPaid, status: newStatus },
      description: `Vendor payment ${fmt(amt, paying.currency)} recorded via ${payMethod.replace(/_/g, " ")}`,
    });

    toast({
      title: newStatus === "paid" ? "Bill fully paid" : "Partial payment recorded",
      description: `${fmt(amt, paying.currency)} · balance ${fmt(total - newPaid, paying.currency)}`,
    });
    setPaying(null);
    setPayAmount("");
    loadBills();
  };

  const runPayBatch = async () => {
    if (selectedIds.size === 0) return;
    const method = window.prompt("Payment method for the pay run (bank_transfer / cheque / cash)?", "bank_transfer") ?? "bank_transfer";
    let paidCount = 0;
    for (const bill of filtered.filter((b) => selectedIds.has(b.id))) {
      const total = Number(bill.total_amount ?? bill.amount ?? 0);
      const prevPaid = Number(bill.paid_amount ?? 0);
      const balance = total - prevPaid;
      if (balance <= 0) continue;
      await supabase.from("invoices").update({
        paid_amount: total,
        status: "paid",
        paid_at: new Date().toISOString(),
        last_payment_method: method,
      }).eq("id", bill.id);
      await AuditTrailService.log({
        user_id: user?.id,
        module: "finance",
        action: "update",
        entity_type: "payment",
        entity_id: bill.id,
        new_value: { amount: balance, method, batch: true },
        description: `Batch pay ${fmt(balance, bill.currency)} for ${bill.vendor ?? bill.customer_name}`,
      });
      paidCount += 1;
    }
    toast({ title: "Pay run complete", description: `${paidCount} bill(s) settled.` });
    setSelectedIds(new Set());
    loadBills();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filterChips: { key: FilterKey; label: string; count: number; tone: string }[] = [
    { key: "all", label: "All", count: bills.length, tone: "border-slate-200 bg-white text-slate-700" },
    { key: "open", label: "Open", count: kpis.openCount, tone: "border-amber-200 bg-amber-50 text-amber-700" },
    { key: "due_this_week", label: "Due ≤ 7d", count: kpis.dueThisWeekCount, tone: "border-sky-200 bg-sky-50 text-sky-700" },
    { key: "overdue", label: "Overdue", count: kpis.overdueCount, tone: "border-red-200 bg-red-50 text-red-700" },
    { key: "paid", label: "Paid", count: kpis.paidCount, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  ];

  return (
    <div className="space-y-6 pb-8 pb-safe-bottom">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest px-2 py-0.5 bg-orange-50 rounded-full">Accounts Payable</span>
            <Link href="/finance" className="text-[10px] text-muted-foreground hover:text-slate-600 flex items-center gap-0.5">
              Finance <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Vendor Bills</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {kpis.openCount} open · {kpis.overdueCount} overdue · {kpis.dueThisWeekCount} due ≤ 7d
            {currencies.length > 0 && (
              <>
                {" — "}
                {currencies.map((c) => `${c} ${fmt(summaryByCcy[c].totalOutstanding, c)}`).join(" · ")}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadBills} className="h-9 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" className="h-9 gap-2 bg-orange-600 hover:bg-orange-700" onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5" /> Enter Bill
          </Button>
        </div>
      </div>

      {/* Aging strip — per currency */}
      {currencies.length === 0 ? null : currencies.map((cur) => {
        const s = summaryByCcy[cur];
        const dueWeek = dueThisWeekByCcy[cur] ?? 0;
        return (
          <div key={`strip-${cur}`} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{cur}</span>
                <h2 className="text-sm font-black text-slate-800">Payables aging</h2>
                <span className="text-xs text-slate-500">{fmt(s.totalOutstanding, cur)} · {fmt(s.totalOverdue, cur)} overdue · {fmt(dueWeek, cur)} due ≤ 7d</span>
              </div>
              <Link href="/finance/reports/aging-report" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                Full report <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {AGING_BUCKETS.map((b) => (
                <div key={b.key} className={cn("rounded-xl border p-4", b.color)}>
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", b.textColor)}>{b.label}</p>
                  <p className="text-lg font-black text-slate-900 mt-1">{fmt(s.totals[b.key], cur)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.counts[b.key]} bill{s.counts[b.key] === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Filter chips + search + pay run */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {filterChips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                filter === c.key ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : c.tone,
              )}
            >
              {c.label}
              <span className="text-[10px] font-black bg-white/60 rounded-full px-1.5">{c.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {selectedIds.size > 0 && (
            <Button size="sm" onClick={runPayBatch} className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Wallet className="w-3.5 h-3.5" /> Pay {selectedIds.size} · {selectedTotalLabel}
            </Button>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search vendor, bill #…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Bill #</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Aging</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-16 text-muted-foreground"><Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" /> No bills match the current filter.</td></tr>
              ) : filtered.map((bill) => {
                const total = Number(bill.total_amount ?? bill.amount ?? 0);
                const paid = Number(bill.paid_amount ?? 0);
                const balance = total - paid;
                const overdue = isOpenForAging(bill.status) && daysOverdue(bill.due_date) > 0;
                const bucket = bucketFor(bill.due_date);
                const bucketMeta = AGING_BUCKETS.find((b) => b.key === bucket);
                const badgeStatus = overdue ? "overdue" : bill.status ?? "pending";
                const selectable = isOpenForAging(bill.status);
                return (
                  <tr key={bill.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        disabled={!selectable}
                        checked={selectedIds.has(bill.id)}
                        onChange={() => toggleSelect(bill.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-black text-slate-800">{bill.invoice_number}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{bill.customer_name ?? bill.vendor ?? "—"}</td>
                    <td className={cn("px-4 py-3 text-xs", overdue ? "text-red-600 font-bold" : "text-slate-500")}>
                      {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {isOpenForAging(bill.status) ? (
                        <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border", bucketMeta?.color, bucketMeta?.textColor)}>
                          {overdue && <Flame className="inline w-2.5 h-2.5 mr-1" />}
                          {bucketMeta?.label}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(total, bill.currency)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 text-xs font-semibold">{paid > 0 ? fmt(paid, bill.currency) : "—"}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">{fmt(balance, bill.currency)}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn("text-[10px] uppercase font-black tracking-wider border", STATUS_BADGES[badgeStatus] ?? STATUS_BADGES.pending)}>
                        {badgeStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {bill.status !== "paid" && bill.status !== "cancelled" && (
                        <Button
                          size="sm"
                          className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          onClick={() => { setPaying(bill); setPayAmount(String(balance)); }}
                        >
                          <CircleDollarSign className="w-3.5 h-3.5" /> Pay
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800">Enter Vendor Bill</h3>
                <p className="text-xs text-slate-500">Record a payable from a supplier</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCreating(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Vendor *</Label>
                <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Puma Energy" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bill Number</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="Auto-generated if blank" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Due Date *</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Fuel, parts, rent…" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Reference number, PO, notes…" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
              <Button variant="outline" onClick={() => setCreating(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={saveBill} disabled={submitting} className="bg-orange-600 hover:bg-orange-700">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Save Bill
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {paying && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-800">Pay Vendor</h3>
                <p className="text-xs text-slate-500 font-mono">{paying.invoice_number}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPaying(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Vendor</span><span className="font-bold">{paying.customer_name ?? paying.vendor}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Bill total</span><span>{fmt(Number(paying.total_amount ?? paying.amount ?? 0), paying.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Paid so far</span><span>{fmt(Number(paying.paid_amount ?? 0), paying.currency)}</span></div>
                <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200"><span>Outstanding</span><span>{fmt(Number(paying.total_amount ?? paying.amount ?? 0) - Number(paying.paid_amount ?? 0), paying.currency)}</span></div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount to pay</Label>
                <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
              <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
              <Button onClick={recordPayment} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <CheckCircle2 className="w-4 h-4" /> Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
