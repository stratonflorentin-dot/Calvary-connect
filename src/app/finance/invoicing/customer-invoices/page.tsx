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
import {
  AGING_BUCKETS,
  bucketFor,
  daysOverdue,
  isOpenForAging,
  summarize,
  summarizeByCurrency,
} from "@/lib/finance/aging";
import { normalizeCurrency, sortCurrencyKeys } from "@/lib/finance/multi-currency";
import { AuditTrailService } from "@/services/audit-trail-service";
import { useSupabase } from "@/components/supabase-provider";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  Flame,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CURRENCIES = ["TZS", "USD", "EUR", "KES"];
const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

const STATUS_BADGES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  overdue: "bg-red-100 text-red-700 border-red-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  partial: "bg-sky-100 text-sky-700 border-sky-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

type FilterKey = "all" | "open" | "overdue" | "paid" | "draft";

export default function CustomerInvoicesPage() {
  const { toast } = useToast();
  const { user } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [paying, setPaying] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");

  const [form, setForm] = useState({
    customer_name: "",
    invoice_number: "",
    amount: "",
    vat_rate: "18",
    currency: "TZS",
    due_date: "",
    description: "",
    payment_terms: "30 days",
  });

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .neq("type", "payable")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvoices(data ?? []);
    } catch (err: any) {
      console.error("[invoices]", err);
      setInvoices([]);
      toast({ title: "Load error", description: err?.message ?? "Failed to load", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputs = useMemo(
    () =>
      invoices.map((i) => ({
        amount: i.total_amount ?? i.amount,
        due_date: i.due_date,
        status: i.status,
        customer_name: i.customer_name ?? i.client_name,
        invoice_number: i.invoice_number,
        id: i.id,
        currency: normalizeCurrency(i.currency),
      })),
    [invoices],
  );

  const summaryByCcy = useMemo(() => summarizeByCurrency(inputs), [inputs]);
  const currencies = useMemo(() => sortCurrencyKeys(Object.keys(summaryByCcy)), [summaryByCcy]);

  // Kept for the aging strip's totalOutstanding bar-width math (single-currency at a time)
  const summary = useMemo(() => summarize(inputs), [inputs]);

  const kpis = useMemo(() => {
    const openInv = invoices.filter((i) => isOpenForAging(i.status));
    const paid = invoices.filter((i) => i.status === "paid");
    const overdue = openInv.filter((i) => daysOverdue(i.due_date) > 0);
    return {
      paidCount: paid.length,
      openCount: openInv.length,
      overdueCount: overdue.length,
    };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (q) {
        const hay = [inv.customer_name, inv.client_name, inv.invoice_number, inv.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "open") return isOpenForAging(inv.status);
      if (filter === "overdue") return isOpenForAging(inv.status) && daysOverdue(inv.due_date) > 0;
      if (filter === "paid") return inv.status === "paid";
      if (filter === "draft") return inv.status === "draft";
      return true;
    });
  }, [invoices, search, filter]);

  const saveInvoice = async () => {
    if (!form.customer_name || !form.amount || !form.due_date) {
      toast({ title: "Missing fields", description: "Customer, amount and due date are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const amount = parseFloat(form.amount) || 0;
      const vatRate = parseFloat(form.vat_rate) || 0;
      const vatAmount = amount * (vatRate / 100);
      const totalAmount = amount + vatAmount;
      const invoiceNum = form.invoice_number || `INV-${Date.now().toString().slice(-8)}`;

      const { data, error } = await supabase.from("invoices").insert({
        customer_name: form.customer_name,
        invoice_number: invoiceNum,
        client_name: form.customer_name,
        amount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        currency: form.currency,
        due_date: form.due_date,
        issue_date: new Date().toISOString().split("T")[0],
        description: form.description,
        payment_terms: form.payment_terms,
        status: "pending",
        type: "receivable",
      }).select().maybeSingle();
      if (error) throw error;

      if (data?.id) {
        await AuditTrailService.logCreate("finance", "invoice", data.id, data, user?.id, `Invoice ${invoiceNum} raised for ${form.customer_name}`);
      }

      await loadInvoices();
      setCreating(false);
      setForm({ customer_name: "", invoice_number: "", amount: "", vat_rate: "18", currency: "TZS", due_date: "", description: "", payment_terms: "30 days" });
      toast({ title: "Invoice created", description: `${invoiceNum} for ${fmt(totalAmount, form.currency)}` });
    } catch (err: any) {
      toast({ title: "Failed to create", description: err?.message ?? "Unknown error", variant: "destructive" });
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
      description: `Payment ${fmt(amt, paying.currency)} recorded via ${payMethod.replace(/_/g, " ")}`,
    });

    toast({
      title: newStatus === "paid" ? "Fully paid" : "Partial payment recorded",
      description: `${fmt(amt, paying.currency)} · balance ${fmt(total - newPaid, paying.currency)}`,
    });
    setPaying(null);
    setPayAmount("");
    loadInvoices();
  };

  const filterChips: { key: FilterKey; label: string; count: number; tone: string }[] = [
    { key: "all", label: "All", count: invoices.length, tone: "border-slate-200 bg-white text-slate-700" },
    { key: "open", label: "Open", count: kpis.openCount, tone: "border-amber-200 bg-amber-50 text-amber-700" },
    { key: "overdue", label: "Overdue", count: kpis.overdueCount, tone: "border-red-200 bg-red-50 text-red-700" },
    { key: "paid", label: "Paid", count: kpis.paidCount, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    { key: "draft", label: "Draft", count: invoices.filter((i) => i.status === "draft").length, tone: "border-slate-200 bg-slate-50 text-slate-600" },
  ];

  return (
    <div className="space-y-6 pb-8 pb-safe-bottom">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded-full">Accounts Receivable</span>
            <Link href="/finance" className="text-[10px] text-muted-foreground hover:text-slate-600 flex items-center gap-0.5">
              Finance <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">Customer Invoices</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {kpis.openCount} open · {kpis.overdueCount} overdue · {kpis.paidCount} paid
            {currencies.length > 0 && (
              <>
                {" — "}
                {currencies.map((c) => `${c} ${fmt(summaryByCcy[c].totalOutstanding, c)}`).join(" · ")}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadInvoices} className="h-9 gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" className="h-9 gap-2 bg-indigo-600 hover:bg-indigo-700" onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5" /> New Invoice
          </Button>
        </div>
      </div>

      {/* Aging strip — per currency */}
      {currencies.length === 0 ? null : currencies.map((cur) => {
        const s = summaryByCcy[cur];
        return (
          <div key={`strip-${cur}`} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-baseline justify-between mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{cur}</span>
                <h2 className="text-sm font-black text-slate-800">Aging breakdown</h2>
                <span className="text-xs text-slate-500">{fmt(s.totalOutstanding, cur)} · {fmt(s.totalOverdue, cur)} overdue</span>
              </div>
              <Link href="/finance/reports/aging-report" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                Full report <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {AGING_BUCKETS.map((b) => (
                <div key={b.key} className={cn("rounded-xl border p-4", b.color)}>
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", b.textColor)}>{b.label}</p>
                  <p className="text-lg font-black text-slate-900 mt-1">{fmt(s.totals[b.key], cur)}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{s.counts[b.key]} invoice{s.counts[b.key] === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Filter chips + search */}
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
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search invoice #, customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Aging</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No invoices match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const total = Number(inv.total_amount ?? inv.amount ?? 0);
                  const paid = Number(inv.paid_amount ?? 0);
                  const balance = total - paid;
                  const overdue = isOpenForAging(inv.status) && daysOverdue(inv.due_date) > 0;
                  const bucket = bucketFor(inv.due_date);
                  const bucketMeta = AGING_BUCKETS.find((b) => b.key === bucket);
                  const badgeStatus = overdue ? "overdue" : inv.status ?? "pending";
                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-black text-slate-800">{inv.invoice_number}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{inv.customer_name ?? inv.client_name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : "—"}</td>
                      <td className={cn("px-4 py-3 text-xs", overdue ? "text-red-600 font-bold" : "text-slate-500")}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isOpenForAging(inv.status) ? (
                          <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border", bucketMeta?.color, bucketMeta?.textColor)}>
                            {overdue && <Flame className="inline w-2.5 h-2.5 mr-1" />}
                            {bucketMeta?.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(total, inv.currency)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 text-xs font-semibold">{paid > 0 ? fmt(paid, inv.currency) : "—"}</td>
                      <td className="px-4 py-3 text-right font-black text-slate-900">{fmt(balance, inv.currency)}</td>
                      <td className="px-4 py-3">
                        <Badge className={cn("text-[10px] uppercase font-black tracking-wider border", STATUS_BADGES[badgeStatus] ?? STATUS_BADGES.pending)}>
                          {badgeStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDetail(inv)} title="View">
                            <ArrowUpRight className="w-4 h-4" />
                          </Button>
                          {inv.status !== "paid" && inv.status !== "cancelled" && (
                            <Button
                              size="sm"
                              className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                              onClick={() => {
                                setPaying(inv);
                                setPayAmount(String(balance));
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Pay
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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
                <h3 className="text-base font-black text-slate-800">New Customer Invoice</h3>
                <p className="text-xs text-slate-500">Raise a receivable and route to Finance</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCreating(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer Name *</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="e.g. Dangote Cement Tanzania" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Invoice Number</Label>
                <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="Auto-generated if blank" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount (excl. VAT) *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">VAT Rate (%)</Label>
                  <Input type="number" value={form.vat_rate} onChange={(e) => setForm({ ...form, vat_rate: e.target.value })} />
                </div>
              </div>
              {form.amount && (
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{fmt(parseFloat(form.amount) || 0, form.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">VAT ({form.vat_rate}%)</span><span>{fmt((parseFloat(form.amount) || 0) * (parseFloat(form.vat_rate) || 0) / 100, form.currency)}</span></div>
                  <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200"><span>Total</span><span>{fmt((parseFloat(form.amount) || 0) * (1 + (parseFloat(form.vat_rate) || 0) / 100), form.currency)}</span></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Terms</Label>
                  <Select value={form.payment_terms} onValueChange={(v) => setForm({ ...form, payment_terms: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="15 days">Net 15</SelectItem>
                      <SelectItem value="30 days">Net 30</SelectItem>
                      <SelectItem value="60 days">Net 60</SelectItem>
                      <SelectItem value="90 days">Net 90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Due Date *</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description / Notes</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Services rendered, trip reference, etc." />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
              <Button variant="outline" onClick={() => setCreating(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={saveInvoice} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Create Invoice
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
                <h3 className="text-base font-black text-slate-800">Record Payment</h3>
                <p className="text-xs text-slate-500 font-mono">{paying.invoice_number}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPaying(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-bold">{paying.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Invoice total</span><span>{fmt(Number(paying.total_amount ?? paying.amount ?? 0), paying.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Paid so far</span><span>{fmt(Number(paying.paid_amount ?? 0), paying.currency)}</span></div>
                <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200"><span>Outstanding</span><span>{fmt(Number(paying.total_amount ?? paying.amount ?? 0) - Number(paying.paid_amount ?? 0), paying.currency)}</span></div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount received</Label>
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

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl mt-16">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Invoice</p>
                <h3 className="text-lg font-black text-slate-800 font-mono">{detail.invoice_number}</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDetail(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Customer</p>
                  <p className="font-bold text-slate-800">{detail.customer_name ?? detail.client_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Status</p>
                  <Badge className={STATUS_BADGES[detail.status ?? "pending"]}>{detail.status ?? "pending"}</Badge>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Issued</p>
                  <p className="text-slate-700">{detail.issue_date}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Due</p>
                  <p className="text-slate-700">{detail.due_date}</p>
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{fmt(Number(detail.amount) || 0, detail.currency)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">VAT</span><span>{fmt(Number(detail.vat_amount) || 0, detail.currency)}</span></div>
                <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200"><span>Total</span><span>{fmt(Number(detail.total_amount ?? detail.amount) || 0, detail.currency)}</span></div>
                <div className="flex justify-between text-emerald-700"><span>Paid</span><span>{fmt(Number(detail.paid_amount ?? 0), detail.currency)}</span></div>
                <div className="flex justify-between font-black text-rose-600"><span>Outstanding</span><span>{fmt(Number(detail.total_amount ?? detail.amount ?? 0) - Number(detail.paid_amount ?? 0), detail.currency)}</span></div>
              </div>
              {detail.description && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              {detail.status !== "paid" && detail.status !== "cancelled" && (
                <Button onClick={() => { setPaying(detail); setPayAmount(String(Number(detail.total_amount ?? detail.amount) - Number(detail.paid_amount ?? 0))); setDetail(null); }} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Record Payment
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
