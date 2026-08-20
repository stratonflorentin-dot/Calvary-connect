"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PageHeader, SectionCard, StatCard } from "@/components/shell";
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
  summarizeByCurrency,
} from "@/lib/finance/aging";
import { normalizeCurrency, sortCurrencyKeys } from "@/lib/finance/multi-currency";
import { checkCreditLimit } from "@/lib/finance/credit-check";
import { postJournalEntry } from "@/lib/finance/journal";
import { calculateInvoiceTotals } from "@/lib/tanzania-tax-rules";
import { TRAInvoiceDialog } from "@/components/financial/tra-invoice-dialog";
import { AuditTrailService } from "@/services/audit-trail-service";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import {
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Columns3,
  FileText,
  Flame,
  Landmark,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Table2,
  Timer,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CURRENCIES = ["TZS", "USD", "EUR", "KES"];
const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);
/** Operating currency headline stat cards lead with; other currencies show as a note underneath. */
const PRIMARY_CCY = "TZS";

const STATUS_BADGES: Record<string, string> = {
  paid: "bg-success/10 text-success border-success/20",
  sent: "bg-info/10 text-info border-info/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  draft: "bg-muted text-muted-foreground border-border",
  partial: "bg-info/10 text-info border-info/20",
  cancelled: "bg-muted text-muted-foreground border-border",
};

type FilterKey = "all" | "open" | "overdue" | "paid" | "draft" | "cancelled";

export default function CustomerInvoicesPage() {
  const { toast } = useToast();
  const { user } = useSupabase();
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [paying, setPaying] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payBankAccountId, setPayBankAccountId] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [printing, setPrinting] = useState<any | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [view, setView] = useState<"table" | "split">("table");
  const [splitSelectedId, setSplitSelectedId] = useState<string | null>(null);

  const [quotations, setQuotations] = useState<any[]>([]);
  const [form, setForm] = useState({
    customer_id: "",
    customer_name: "",
    invoice_number: "",
    quotation_id: "",
    amount: "",
    vat_rate: "18",
    vat_applicable: true,
    wht_applicable: true,
    currency: "TZS",
    due_date: "",
    description: "",
    payment_terms: "30 days",
  });

  useEffect(() => {
    supabase
      .from("customers")
      .select("id, company_name, tax_id")
      .order("company_name")
      .then(({ data }) => setCustomers(data ?? []));

    supabase
      .from("bank_accounts")
      .select("id, account_name, bank_name, currency, current_balance, is_active")
      .eq("is_active", true)
      .then(({ data }) => setBankAccounts(data ?? []));

    supabase
      .from("quotations")
      .select("id, quotation_number, customer_id, origin, destination")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setQuotations(data ?? []));
  }, []);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === form.customer_id) ?? null,
    [customers, form.customer_id],
  );

  const quotationById = useMemo(
    () => new Map(quotations.map((q) => [q.id, q])),
    [quotations],
  );

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
        // Aging is about what's still owed, not the original invoice total —
        // a partially-paid invoice should only age its remaining balance.
        amount: Number(i.total_amount ?? i.amount ?? 0) - Number(i.paid_amount ?? 0),
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

  const overdueByCcy = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of currencies) out[c] = summaryByCcy[c]?.totalOverdue ?? 0;
    return out;
  }, [currencies, summaryByCcy]);

  const dueSoonByCcy = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of currencies) out[c] = summaryByCcy[c]?.totalDueSoon ?? 0;
    return out;
  }, [currencies, summaryByCcy]);

  const kpis = useMemo(() => {
    const openInv = invoices.filter((i) => isOpenForAging(i.status));
    const paid = invoices.filter((i) => i.status === "paid");
    const partial = invoices.filter((i) => i.status === "partial");
    const overdue = openInv.filter((i) => daysOverdue(i.due_date) > 0);
    const draft = invoices.filter((i) => i.status === "draft");
    const pending = invoices.filter((i) => i.status === "pending");
    const sent = invoices.filter((i) => i.status === "sent");
    const cancelled = invoices.filter((i) => i.status === "cancelled");
    return {
      paidCount: paid.length,
      partialCount: partial.length,
      openCount: openInv.length,
      overdueCount: overdue.length,
      draftCount: draft.length,
      pendingCount: pending.length,
      sentCount: sent.length,
      cancelledCount: cancelled.length,
    };
  }, [invoices]);

  const thisMonthCollected = useMemo(() => {
    const now = new Date();
    const byCcy: Record<string, number> = {};
    for (const inv of invoices) {
      const paidAt = inv.paid_at ? new Date(inv.paid_at) : null;
      if (!paidAt || paidAt.getFullYear() !== now.getFullYear() || paidAt.getMonth() !== now.getMonth()) continue;
      const cur = normalizeCurrency(inv.currency);
      byCcy[cur] = (byCcy[cur] ?? 0) + Number(inv.paid_amount ?? 0);
    }
    return byCcy;
  }, [invoices]);

  // Real average — mean of (paid_at - issue_date) across fully-paid invoices.
  // null (not 0) when there's no paid invoice yet, so the UI can say so
  // instead of showing a fake "0 days".
  const avgDaysToGetPaid = useMemo(() => {
    const samples: number[] = [];
    for (const inv of invoices) {
      if (inv.status !== "paid" || !inv.paid_at || !inv.issue_date) continue;
      const days = (new Date(inv.paid_at).getTime() - new Date(inv.issue_date).getTime()) / 86_400_000;
      if (Number.isFinite(days) && days >= 0) samples.push(days);
    }
    if (samples.length === 0) return null;
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }, [invoices]);

  // Real cash on hand — sum of active bank_accounts.current_balance, per currency.
  const cashByCcy = useMemo(() => {
    const byCcy: Record<string, number> = {};
    for (const acc of bankAccounts) {
      const cur = normalizeCurrency(acc.currency);
      byCcy[cur] = (byCcy[cur] ?? 0) + Number(acc.current_balance ?? 0);
    }
    return byCcy;
  }, [bankAccounts]);

  /** e.g. "+ USD 1,200 · EUR 300 elsewhere" for a stat card's sub line, or undefined if nothing else to show. */
  const otherCurrencyNote = (byCcy: Record<string, number>, primary = PRIMARY_CCY) => {
    const others = sortCurrencyKeys(Object.keys(byCcy)).filter((c) => c !== primary && byCcy[c] > 0);
    if (others.length === 0) return undefined;
    return `+ ${others.map((c) => fmt(byCcy[c], c)).join(" · ")} in other currencies`;
  };

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
      if (filter === "cancelled") return inv.status === "cancelled";
      return true;
    });
  }, [invoices, search, filter]);

  const splitSelected = useMemo(
    () => filtered.find((i) => i.id === splitSelectedId) ?? filtered[0] ?? null,
    [filtered, splitSelectedId],
  );

  const saveInvoice = async () => {
    if (!form.customer_name || !form.amount || !form.due_date) {
      toast({ title: "Missing fields", description: "Customer, amount and due date are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const amount = parseFloat(form.amount) || 0;
      const { vatAmount, whtAmount, totalPayable } = calculateInvoiceTotals({
        subtotal: amount,
        vatApplicable: form.vat_applicable,
        whtApplicable: form.wht_applicable,
      });
      const totalAmount = amount + vatAmount;
      const invoiceNum = form.invoice_number || `INV-${Date.now().toString().slice(-8)}`;

      const credit = await checkCreditLimit(form.customer_id, form.currency, totalAmount, role);
      if (credit.blocked) {
        toast({ title: "Credit limit exceeded", description: credit.message || "This customer is over their credit limit.", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      if (credit.overridable && !window.confirm(`${credit.message}\n\nRaise this invoice anyway?`)) {
        setSubmitting(false);
        return;
      }

      const { data, error } = await supabase.from("invoices").insert({
        customer_id: form.customer_id || null,
        customer_name: form.customer_name,
        invoice_number: invoiceNum,
        client_name: form.customer_name,
        quotation_id: form.quotation_id || null,
        amount,
        subtotal: amount,
        vat_applicable: form.vat_applicable,
        vat_amount: vatAmount,
        wht_applicable: form.wht_applicable,
        wht_amount: whtAmount,
        total_amount: totalAmount,
        total_payable: totalPayable,
        currency: form.currency,
        due_date: form.due_date,
        issue_date: new Date().toISOString().split("T")[0],
        description: form.description,
        payment_terms: form.payment_terms,
        status: "draft",
        type: "receivable",
      }).select().maybeSingle();
      if (error) throw error;

      if (data?.id) {
        await AuditTrailService.logCreate("finance", "invoice", data.id, data, user?.id, `Invoice ${invoiceNum} raised for ${form.customer_name}`);
      }

      await loadInvoices();
      setCreating(false);
      setForm({
        customer_id: "",
        customer_name: "",
        invoice_number: "",
        quotation_id: "",
        amount: "",
        vat_rate: "18",
        vat_applicable: true,
        wht_applicable: true,
        currency: "TZS",
        due_date: "",
        description: "",
        payment_terms: "30 days",
      });
      toast({ variant: "success", title: "Invoice created", description: `${invoiceNum} for ${fmt(totalAmount, form.currency)}` });
    } catch (err: any) {
      toast({ title: "Failed to create", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const sendInvoice = async (inv: any) => {
    setSendingId(inv.id);
    try {
      // Revenue is recognized right here, not at creation — this is the
      // Draft/Pending → Sent transition, and the moment the invoice locks
      // (guard_sent_invoice, 102_shipments_waybills_invoice_lock.sql).
      await postJournalEntry({ type: "invoice_sent", invoiceId: inv.id });
      await AuditTrailService.logUpdate("finance", "invoice", inv.id, { status: inv.status }, { status: "sent" }, user?.id, `Invoice ${inv.invoice_number} sent to ${inv.customer_name ?? inv.client_name}`);
      await loadInvoices();
      setDetail(null);
      toast({ variant: "success", title: "Invoice sent", description: `${inv.invoice_number} is now locked and posted to the ledger.` });
    } catch (err: any) {
      toast({ title: "Failed to send", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const recordPayment = async () => {
    if (!paying) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    if (!payBankAccountId) {
      toast({ title: "Choose which account received this payment", variant: "destructive" });
      return;
    }
    const total = Number(paying.total_amount ?? paying.amount ?? 0);
    const prevPaid = Number(paying.paid_amount ?? 0);
    const newPaid = prevPaid + amt;
    const newStatus = newPaid >= total ? "paid" : "partial";
    const currency = paying.currency || "TZS";

    // The invoice update alone was the whole bug: it flipped a status
    // label with no real money movement anywhere. This posts the actual
    // ledger entry — Dr the receiving bank account / Cr Accounts
    // Receivable — so the bank account's balance and the customer's
    // outstanding balance both genuinely reflect the payment, same
    // mechanism already used for expenses/cash requests/petty cash.
    try {
      await postJournalEntry({
        type: "invoice_payment",
        invoiceId: paying.id,
        invoiceNumber: paying.invoice_number,
        customerName: paying.customer_name,
        bankAccountId: payBankAccountId,
        amount: amt,
        currency,
      });
    } catch (err: any) {
      toast({ title: "Payment failed", description: err?.message ?? "Unknown error", variant: "destructive" });
      return;
    }

    // journal_entry_id stays as the revenue-recognition entry set at Send —
    // this payment's own entry is already linked from bank_transactions,
    // not duplicated onto the invoice.
    const { error } = await supabase
      .from("invoices")
      .update({
        paid_amount: newPaid,
        status: newStatus,
        paid_at: newStatus === "paid" ? new Date().toISOString() : paying.paid_at,
        payment_method: payMethod,
      })
      .eq("id", paying.id);
    if (error) {
      toast({ title: "Payment posted but invoice update failed", description: error.message, variant: "destructive" });
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
      variant: newStatus === "paid" ? "success" : "default",
      title: newStatus === "paid" ? "Fully paid" : "Partial payment recorded",
      description: `${fmt(amt, paying.currency)} · balance ${fmt(total - newPaid, paying.currency)}`,
    });
    setPaying(null);
    setPayAmount("");
    setPayBankAccountId("");
    loadInvoices();
  };

  const filterChips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: invoices.length },
    { key: "open", label: "Open", count: kpis.openCount },
    { key: "overdue", label: "Overdue", count: kpis.overdueCount },
    { key: "paid", label: "Paid", count: kpis.paidCount },
    { key: "draft", label: "Draft", count: kpis.draftCount },
    { key: "cancelled", label: "Cancelled", count: kpis.cancelledCount },
  ];

  return (
    <div className="space-y-6 pb-8 pb-safe-bottom">
      <PageHeader
        eyebrow="Accounts Receivable"
        title="Customer Invoices"
        subtitle="All invoices raised against customers"
        icon={Receipt}
        crumbs={[{ label: "Finance", href: "/finance" }, { label: "Invoices" }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={loadInvoices} className="h-9 gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
            <Button size="sm" className="h-9 gap-2" onClick={() => setCreating(true)}>
              <Plus className="w-3.5 h-3.5" /> New Invoice
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {/* Cash-flow headline row — real figures, {PRIMARY_CCY} leads, other currencies noted below */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Overdue"
            value={fmt(overdueByCcy[PRIMARY_CCY] ?? 0, PRIMARY_CCY)}
            sub={otherCurrencyNote(overdueByCcy) ?? "Past due date, unpaid"}
            icon={Flame}
            accent="bg-destructive/10 text-destructive"
          />
          <StatCard
            label="Due within 30 days"
            value={fmt(dueSoonByCcy[PRIMARY_CCY] ?? 0, PRIMARY_CCY)}
            sub={otherCurrencyNote(dueSoonByCcy) ?? "Not yet overdue"}
            icon={CalendarClock}
            accent="bg-warning/10 text-warning"
          />
          <StatCard
            label="Avg. time to get paid"
            value={avgDaysToGetPaid == null ? "—" : `${avgDaysToGetPaid.toFixed(0)} days`}
            sub={avgDaysToGetPaid == null ? "No paid invoices yet" : "Issue date → payment date"}
            icon={Timer}
            accent="bg-info/10 text-info"
          />
          <StatCard
            label="Cash & bank balance"
            value={fmt(cashByCcy[PRIMARY_CCY] ?? 0, PRIMARY_CCY)}
            sub={otherCurrencyNote(cashByCcy) ?? "Across active bank accounts"}
            icon={Landmark}
            accent="bg-success/10 text-success"
          />
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="All Invoices" value={invoices.length} sub="Draft + Open + Paid" icon={FileText} />
          <StatCard label="Overdue" value={kpis.overdueCount} sub="Past due date, unpaid" icon={Flame} accent="bg-destructive/10 text-destructive" />
          <StatCard label="Partially Paid" value={kpis.partialCount} sub="Awaiting remaining payment" icon={Clock} accent="bg-warning/10 text-warning" />
          <StatCard label="Paid" value={kpis.paidCount} sub="Fully settled" icon={CheckCircle2} accent="bg-success/10 text-success" />
        </div>

        {/* Outstanding / Collected / Pipeline — per currency, never summed */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SectionCard title="Total Outstanding" icon={Wallet}>
            {currencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
            ) : (
              <div className="space-y-2">
                {currencies.map((c) => (
                  <div key={c} className="flex items-center justify-between text-sm">
                    <span className="text-xs font-bold text-muted-foreground">{c}</span>
                    <span className="font-black text-foreground">{fmt(summaryByCcy[c].totalOutstanding, c)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title={`Collected — ${new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" })}`} icon={CheckCircle2}>
            {Object.keys(thisMonthCollected).length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments this month yet.</p>
            ) : (
              <div className="space-y-2">
                {sortCurrencyKeys(Object.keys(thisMonthCollected)).map((c) => (
                  <div key={c} className="flex items-center justify-between text-sm">
                    <span className="text-xs font-bold text-muted-foreground">{c}</span>
                    <span className="font-black text-success">{fmt(thisMonthCollected[c], c)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Pipeline" icon={Clock}>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Draft</span>
                <span className="font-black text-foreground">{kpis.draftCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-black text-foreground">{kpis.pendingCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sent</span>
                <span className="font-black text-foreground">{kpis.sentCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cancelled</span>
                <span className="font-black text-foreground">{kpis.cancelledCount}</span>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Aging strip — per currency */}
        {currencies.map((cur) => {
          const s = summaryByCcy[cur];
          return (
            <SectionCard
              key={`strip-${cur}`}
              title="Aging breakdown"
              subtitle={`${fmt(s.totalOutstanding, cur)} outstanding · ${fmt(s.totalOverdue, cur)} overdue`}
              actions={<Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest">{cur}</Badge>}
            >
              <div className="flex items-center justify-end mb-3 -mt-1">
                <Link href="/finance/reports/aging-report" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  Full report <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {AGING_BUCKETS.map((b) => (
                  <div key={b.key} className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{b.label}</p>
                    <p className="text-lg font-black text-foreground mt-1">{fmt(s.totals[b.key], cur)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.counts[b.key]} invoice{s.counts[b.key] === 1 ? "" : "s"}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
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
                  filter === c.key
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted",
                )}
              >
                {c.label}
                <span className="text-[10px] font-black bg-background/60 rounded-full px-1.5">{c.count}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search invoice #, customer…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 shrink-0">
            <button
              onClick={() => setView("table")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors",
                view === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              title="Table view"
            >
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setView("split")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors",
                view === "split" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              title="List + detail view"
            >
              <Columns3 className="w-3.5 h-3.5" /> List + Detail
            </button>
          </div>
        </div>

        {/* Table */}
        {view === "table" && (
        <div className="cv-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Quotation Ref</th>
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
                    <td colSpan={11} className="text-center py-16 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-16 text-muted-foreground">
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
                      <tr key={inv.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-black text-foreground">{inv.invoice_number}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{quotationById.get(inv.quotation_id)?.quotation_number ?? "—"}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{inv.customer_name ?? inv.client_name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : "—"}</td>
                        <td className={cn("px-4 py-3 text-xs", overdue ? "text-destructive font-bold" : "text-muted-foreground")}>
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {isOpenForAging(inv.status) ? (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground">
                              {overdue && <Flame className="inline w-2.5 h-2.5 mr-1 text-destructive" />}
                              {bucketMeta?.label}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">{fmt(total, inv.currency)}</td>
                        <td className="px-4 py-3 text-right text-success text-xs font-semibold">{paid > 0 ? fmt(paid, inv.currency) : "—"}</td>
                        <td className="px-4 py-3 text-right font-black text-foreground">{fmt(balance, inv.currency)}</td>
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
                            {["draft", "pending"].includes(inv.status) && (
                              <Button
                                size="sm"
                                className="h-8 gap-1 bg-info hover:bg-info/90 text-info-foreground text-xs"
                                disabled={sendingId === inv.id}
                                onClick={() => sendInvoice(inv)}
                              >
                                {sendingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUpRight className="w-3.5 h-3.5" />} Send
                              </Button>
                            )}
                            {!["draft", "pending", "paid", "cancelled"].includes(inv.status) && (
                              <Button
                                size="sm"
                                className="h-8 gap-1 bg-success hover:bg-success/90 text-success-foreground text-xs"
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
        )}

        {/* List + Detail — Finnova-style split layout, same data/actions as the table above */}
        {view === "split" && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-4 items-start">
            <div className="cv-surface overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {filter === "all" ? "All Invoices" : filterChips.find((c) => c.key === filter)?.label} · {filtered.length}
                </p>
              </div>
              <div className="max-h-[36rem] overflow-y-auto divide-y divide-border">
                {loading ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Loading…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No invoices match the current filter.
                  </div>
                ) : (
                  filtered.map((inv) => {
                    const total = Number(inv.total_amount ?? inv.amount ?? 0);
                    const paid = Number(inv.paid_amount ?? 0);
                    const balance = total - paid;
                    const overdue = isOpenForAging(inv.status) && daysOverdue(inv.due_date) > 0;
                    const d = daysOverdue(inv.due_date);
                    const badgeStatus = overdue ? "overdue" : inv.status ?? "pending";
                    const selected = splitSelected?.id === inv.id;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => setSplitSelectedId(inv.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 flex items-center gap-3 transition-colors",
                          selected ? "bg-primary/10" : "hover:bg-muted/40",
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-black text-muted-foreground uppercase">
                          {(inv.customer_name ?? inv.client_name ?? "?").slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black font-mono text-foreground truncate">{inv.invoice_number}</p>
                            <Badge className={cn("text-[9px] uppercase font-black tracking-wider border shrink-0", STATUS_BADGES[badgeStatus] ?? STATUS_BADGES.pending)}>
                              {badgeStatus}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{inv.customer_name ?? inv.client_name ?? "—"}</p>
                          <p className={cn("text-[10px] mt-0.5", overdue ? "text-destructive font-bold" : "text-muted-foreground")}>
                            {isOpenForAging(inv.status)
                              ? overdue
                                ? `${d} day${d === 1 ? "" : "s"} overdue`
                                : inv.due_date
                                  ? `Due in ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`
                                  : "No due date"
                              : badgeStatus}
                          </p>
                        </div>
                        <p className="text-sm font-black text-foreground shrink-0">{fmt(balance, inv.currency)}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="cv-surface overflow-hidden">
              {!splitSelected ? (
                <div className="text-center py-24 text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Select an invoice to see its details.
                </div>
              ) : (() => {
                const total = Number(splitSelected.total_amount ?? splitSelected.amount ?? 0);
                const paid = Number(splitSelected.paid_amount ?? 0);
                const balance = total - paid;
                const badgeStatus = isOpenForAging(splitSelected.status) && daysOverdue(splitSelected.due_date) > 0 ? "overdue" : splitSelected.status ?? "pending";
                const lineItems: { description?: string; qty?: number; unit_price?: number }[] = Array.isArray(splitSelected.line_items) ? splitSelected.line_items : [];
                return (
                  <>
                    <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Invoice details</p>
                        <h3 className="text-lg font-black text-foreground font-mono">{splitSelected.invoice_number}</h3>
                        <Badge className={cn("mt-1 text-[10px] uppercase font-black tracking-wider border", STATUS_BADGES[badgeStatus] ?? STATUS_BADGES.pending)}>
                          {badgeStatus}
                        </Badge>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Customer</p>
                        <p className="text-sm font-black text-foreground">{splitSelected.customer_name ?? splitSelected.client_name ?? "—"}</p>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {lineItems.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {lineItems.map((li, idx) => (
                            <div key={idx} className="rounded-xl border border-border bg-muted/30 p-3">
                              <p className="text-sm font-black text-foreground">{fmt((li.qty ?? 1) * (li.unit_price ?? 0), splitSelected.currency)}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{li.description ?? "Line item"}</p>
                              {li.qty != null && li.unit_price != null && (
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{li.qty} × {fmt(li.unit_price, splitSelected.currency)}</p>
                              )}
                            </div>
                          ))}
                          <button
                            onClick={() => setPrinting(splitSelected)}
                            className="rounded-xl border border-dashed border-border p-3 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            <span className="text-[10px] font-bold">View / edit items</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No itemized line items on this invoice —{" "}
                          <button className="text-primary font-bold hover:underline" onClick={() => setPrinting(splitSelected)}>add some</button>.
                        </p>
                      )}

                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="rounded-xl border border-border bg-muted/30 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Sub Total</p>
                          <p className="font-black text-foreground mt-0.5">{fmt(Number(splitSelected.amount) || total, splitSelected.currency)}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Total</p>
                          <p className="font-black text-foreground mt-0.5">{fmt(total, splitSelected.currency)}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-muted/30 p-3">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Balance Due</p>
                          <p className="font-black text-destructive mt-0.5">{fmt(balance, splitSelected.currency)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
                      <Button variant="outline" onClick={() => setPrinting(splitSelected)} className="gap-2">
                        <FileText className="w-4 h-4" /> Print / Download TRA Invoice
                      </Button>
                      {splitSelected.status !== "paid" && splitSelected.status !== "cancelled" && (
                        <Button
                          onClick={() => { setPaying(splitSelected); setPayAmount(String(balance)); }}
                          className="bg-success hover:bg-success/90 text-success-foreground gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Record Payment
                        </Button>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-black text-foreground">New Customer Invoice</h3>
                <p className="text-xs text-muted-foreground">Raise a receivable and route to Finance</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCreating(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer *</Label>
                <Select
                  value={form.customer_id}
                  onValueChange={(v) => {
                    const c = customers.find((x) => x.id === v);
                    setForm({ ...form, customer_id: v, customer_name: c?.company_name ?? "" });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {selectedCustomer ? `TIN: ${selectedCustomer.tax_id || "not on file"}` : (
                    <>Don&apos;t see them? <Link href="/customers" className="text-primary font-bold hover:underline">Add a customer</Link> first.</>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Invoice Number</Label>
                  <Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="Auto-generated if blank" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quotation Ref No</Label>
                  <Select value={form.quotation_id || "__none"} onValueChange={(v) => setForm({ ...form, quotation_id: v === "__none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Not tied to a quotation" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— No quotation —</SelectItem>
                      {quotations.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.quotation_number} · {q.origin} → {q.destination}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount (excl. VAT) *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">VAT Rate</Label>
                  <Input value={form.vat_applicable ? `${form.vat_rate}% (TRA standard)` : "Exempt"} disabled />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                  <input type="checkbox" className="rounded" checked={form.vat_applicable} onChange={(e) => setForm({ ...form, vat_applicable: e.target.checked })} />
                  Apply VAT
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                  <input type="checkbox" className="rounded" checked={form.wht_applicable} onChange={(e) => setForm({ ...form, wht_applicable: e.target.checked })} />
                  WHT deductible (5%, over TZS 500,000)
                </label>
              </div>
              {form.amount && (() => {
                const subtotal = parseFloat(form.amount) || 0;
                const { vatAmount, whtAmount, totalPayable } = calculateInvoiceTotals({
                  subtotal,
                  vatApplicable: form.vat_applicable,
                  whtApplicable: form.wht_applicable,
                });
                return (
                  <div className="rounded-xl bg-muted/30 border border-border p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">{fmt(subtotal, form.currency)}</span></div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{form.vat_applicable ? `VAT (${form.vat_rate}%)` : "VAT"}</span>
                      <span className="text-foreground">{form.vat_applicable ? fmt(vatAmount, form.currency) : "Exempt"}</span>
                    </div>
                    {whtAmount > 0 && (
                      <div className="flex justify-between text-destructive"><span>WHT deductible (5%)</span><span>({fmt(whtAmount, form.currency)})</span></div>
                    )}
                    <div className="flex justify-between font-black text-foreground pt-1 border-t border-border"><span>Total payable</span><span>{fmt(totalPayable, form.currency)}</span></div>
                  </div>
                );
              })()}
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
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={() => setCreating(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={saveInvoice} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Create Invoice
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {paying && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="text-base font-black text-foreground">Record Payment</h3>
                <p className="text-xs text-muted-foreground font-mono">{paying.invoice_number}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPaying(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-3">
              <div className="rounded-xl bg-muted/30 border border-border p-3 text-xs space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-bold text-foreground">{paying.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Invoice total</span><span className="text-foreground">{fmt(Number(paying.total_amount ?? paying.amount ?? 0), paying.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid so far</span><span className="text-foreground">{fmt(Number(paying.paid_amount ?? 0), paying.currency)}</span></div>
                <div className="flex justify-between font-black text-foreground pt-1 border-t border-border"><span>Outstanding</span><span>{fmt(Number(paying.total_amount ?? paying.amount ?? 0) - Number(paying.paid_amount ?? 0), paying.currency)}</span></div>
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
              <div className="space-y-1">
                <Label className="text-xs">Deposited to *</Label>
                <Select value={payBankAccountId} onValueChange={setPayBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Which account received this?" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts
                      .filter((b) => b.currency === (paying.currency || "TZS"))
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.bank_name} · {b.account_name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Posts this payment into the ledger — the account you pick here is what actually gets credited.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
              <Button onClick={recordPayment} className="bg-success hover:bg-success/90 text-success-foreground gap-2">
                <CheckCircle2 className="w-4 h-4" /> Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {detail && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl mt-16">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Invoice</p>
                <h3 className="text-lg font-black text-foreground font-mono">{detail.invoice_number}</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDetail(null)}><X className="w-4 h-4" /></Button>
            </div>
            {!["draft", "pending"].includes(detail.status) && (
              <div className="mx-5 mt-4 rounded-xl bg-warning/10 border border-warning/20 p-3 text-xs text-warning">
                This invoice is locked and cannot be edited — it has been issued and is a finalized financial document. Corrections go through a{" "}
                <Link href="/finance/invoicing/credit-notes" className="underline font-bold">Credit Note</Link> instead.
              </div>
            )}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Customer</p>
                  <p className="font-bold text-foreground">{detail.customer_name ?? detail.client_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Status</p>
                  <Badge className={STATUS_BADGES[detail.status ?? "pending"]}>{detail.status ?? "pending"}</Badge>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Quotation Ref No</p>
                  <p className="font-bold text-foreground font-mono">{quotationById.get(detail.quotation_id)?.quotation_number ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Issued</p>
                  <p className="text-foreground/80">{detail.issue_date}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Due</p>
                  <p className="text-foreground/80">{detail.due_date}</p>
                </div>
              </div>
              <div className="rounded-xl bg-muted/30 border border-border p-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">{fmt(Number(detail.amount) || 0, detail.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span className="text-foreground">{detail.vat_applicable === false ? "Exempt" : fmt(Number(detail.vat_amount) || 0, detail.currency)}</span></div>
                {Number(detail.wht_amount) > 0 && (
                  <div className="flex justify-between text-destructive"><span>WHT deductible</span><span>({fmt(Number(detail.wht_amount), detail.currency)})</span></div>
                )}
                <div className="flex justify-between font-black text-foreground pt-1 border-t border-border"><span>Total payable</span><span>{fmt(Number(detail.total_payable ?? detail.total_amount ?? detail.amount) || 0, detail.currency)}</span></div>
                <div className="flex justify-between text-success"><span>Paid</span><span>{fmt(Number(detail.paid_amount ?? 0), detail.currency)}</span></div>
                <div className="flex justify-between font-black text-destructive"><span>Outstanding</span><span>{fmt(Number(detail.total_payable ?? detail.total_amount ?? detail.amount ?? 0) - Number(detail.paid_amount ?? 0), detail.currency)}</span></div>
              </div>
              {detail.description && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Notes</p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{detail.description}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
              <Button variant="outline" onClick={() => setPrinting(detail)} className="gap-2">
                <FileText className="w-4 h-4" /> Print / Download TRA Invoice
              </Button>
              {["draft", "pending"].includes(detail.status) && (
                <Button onClick={() => sendInvoice(detail)} disabled={sendingId === detail.id} className="bg-info hover:bg-info/90 text-info-foreground gap-2">
                  {sendingId === detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />} Send Invoice
                </Button>
              )}
              {!["draft", "pending", "paid", "cancelled"].includes(detail.status) && (
                <Button onClick={() => { setPaying(detail); setPayAmount(String(Number(detail.total_payable ?? detail.total_amount ?? detail.amount) - Number(detail.paid_amount ?? 0))); setDetail(null); }} className="bg-success hover:bg-success/90 text-success-foreground gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Record Payment
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {printing && (
        <TRAInvoiceDialog
          open={!!printing}
          mode="view"
          invoice={printing}
          client={(() => {
            const c = customers.find((x) => x.id === printing.customer_id);
            return c ? { company_name: c.company_name, tin: c.tax_id } : { company_name: printing.customer_name };
          })()}
          onClose={() => setPrinting(null)}
          onSaved={() => { setPrinting(null); loadInvoices(); }}
        />
      )}
    </div>
  );
}
