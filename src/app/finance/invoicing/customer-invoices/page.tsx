"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
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
import { createCustomerPayment } from "@/lib/finance/customer-payment";
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
  FileText,
  Flame,
  Landmark,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Timer,
  Wallet,
  X,
} from "lucide-react";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard, IndustryCardKicker } from "@/components/industry/card";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";
import {
  IndustryDialog,
  IndustryDialogContent,
  IndustryDialogTitle,
} from "@/components/industry/dialog";

const ACCOUNTANT_PAGES = [
  { label: "Dashboard", href: "/finance" },
  { label: "Customer invoices", href: "/finance/invoicing/customer-invoices" },
  { label: "Expenses & fuel", href: "/accountant/expenses" },
  { label: "Reconciliation", href: "/finance/banking/bank-statements" },
];

const CURRENCIES = ["TZS", "USD", "EUR", "KES"];
const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);
const PRIMARY_CCY = "TZS";
const fieldClass = "w-full text-[13px] bg-transparent border border-[var(--ci-divider)] px-[9px] py-[6px] outline-none focus-visible:border-[var(--ci-accent)]";

const STATUS_VARIANT: Record<string, "accent" | "warning" | "danger" | "neutral"> = {
  paid: "accent",
  sent: "neutral",
  pending: "warning",
  overdue: "danger",
  draft: "neutral",
  partial: "warning",
  cancelled: "neutral",
};

type FilterKey = "all" | "open" | "overdue" | "paid" | "draft" | "cancelled";

export default function CustomerInvoicesPage() {
  const { toast } = useToast();
  const { user } = useSupabase();
  const { role } = useRole();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [paying, setPaying] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payBankAccountId, setPayBankAccountId] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [printing, setPrinting] = useState<any | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

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
    supabase.from("customers").select("id, company_name, tax_id").is("deleted_at", null).order("company_name").then(({ data }) => setCustomers(data ?? []));
    supabase.from("bank_accounts").select("id, account_name, bank_name, currency, current_balance, is_active").eq("is_active", true).then(({ data }) => setBankAccounts(data ?? []));
    supabase.from("quotations").select("id, quotation_number, customer_id, origin, destination, subtotal, vat_rate, currency").order("created_at", { ascending: false }).limit(200).then(({ data }) => setQuotations(data ?? []));
  }, []);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === form.customer_id) ?? null, [customers, form.customer_id]);
  const quotationById = useMemo(() => new Map(quotations.map((q) => [q.id, q])), [quotations]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("invoices").select("*").neq("type", "payable").order("created_at", { ascending: false });
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
      paidCount: paid.length, partialCount: partial.length, openCount: openInv.length, overdueCount: overdue.length,
      draftCount: draft.length, pendingCount: pending.length, sentCount: sent.length, cancelledCount: cancelled.length,
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

  const cashByCcy = useMemo(() => {
    const byCcy: Record<string, number> = {};
    for (const acc of bankAccounts) {
      const cur = normalizeCurrency(acc.currency);
      byCcy[cur] = (byCcy[cur] ?? 0) + Number(acc.current_balance ?? 0);
    }
    return byCcy;
  }, [bankAccounts]);

  const otherCurrencyNote = (byCcy: Record<string, number>, primary = PRIMARY_CCY) => {
    const others = sortCurrencyKeys(Object.keys(byCcy)).filter((c) => c !== primary && byCcy[c] > 0);
    if (others.length === 0) return undefined;
    return `+ ${others.map((c) => fmt(byCcy[c], c)).join(" · ")} in other currencies`;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (q) {
        const hay = [inv.customer_name, inv.client_name, inv.invoice_number, inv.description].filter(Boolean).join(" ").toLowerCase();
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

  const saveInvoice = async () => {
    if (!form.customer_name || !form.amount || !form.due_date) {
      toast({ title: "Missing fields", description: "Customer, amount and due date are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const amount = parseFloat(form.amount) || 0;
      const { vatAmount, whtAmount, totalPayable } = calculateInvoiceTotals({ subtotal: amount, vatApplicable: form.vat_applicable, whtApplicable: form.wht_applicable });
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
        customer_id: form.customer_id || null, customer_name: form.customer_name, invoice_number: invoiceNum,
        client_name: form.customer_name, quotation_id: form.quotation_id || null, amount, subtotal: amount,
        vat_applicable: form.vat_applicable, vat_amount: vatAmount, wht_applicable: form.wht_applicable, wht_amount: whtAmount,
        total_amount: totalAmount, total_payable: totalPayable, currency: form.currency, due_date: form.due_date,
        issue_date: new Date().toISOString().split("T")[0], description: form.description, payment_terms: form.payment_terms,
        status: "draft", type: "receivable",
      }).select().maybeSingle();
      if (error) throw error;

      if (data?.id) {
        await AuditTrailService.logCreate("finance", "invoice", data.id, data, user?.id, `Invoice ${invoiceNum} raised for ${form.customer_name}`);
      }

      await loadInvoices();
      setCreating(false);
      setForm({ customer_id: "", customer_name: "", invoice_number: "", quotation_id: "", amount: "", vat_rate: "18", vat_applicable: true, wht_applicable: true, currency: "TZS", due_date: "", description: "", payment_terms: "30 days" });
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
      await postJournalEntry({ type: "invoice_sent", invoiceId: inv.id });
      await AuditTrailService.logUpdate("finance", "invoice", inv.id, { status: inv.status }, { status: "sent" }, user?.id, `Invoice ${inv.invoice_number} sent to ${inv.customer_name ?? inv.client_name}`);
      await loadInvoices();
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
    if (!amt || amt <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    if (!payBankAccountId) { toast({ title: "Choose which account received this payment", variant: "destructive" }); return; }
    if (!paying.customer_id) { toast({ title: "This invoice has no linked customer record", variant: "destructive" }); return; }
    const total = Number(paying.total_amount ?? paying.amount ?? 0);
    const prevPaid = Number(paying.paid_amount ?? 0);
    const currency = paying.currency || "TZS";

    let result;
    try {
      result = await createCustomerPayment({
        customerId: paying.customer_id, customerName: paying.customer_name, bankAccountId: payBankAccountId,
        amount: amt, currency, paymentDate: new Date().toISOString().slice(0, 10), method: payMethod,
        allocations: [{ invoiceId: paying.id, invoiceNumber: paying.invoice_number, invoiceCurrency: currency, invoiceTotal: total, invoicePaidAmount: prevPaid, amount: amt }],
        createdBy: user?.id,
      });
    } catch (err: any) {
      toast({ title: "Payment failed", description: err?.message ?? "Unknown error", variant: "destructive" });
      return;
    }

    const newPaid = prevPaid + result.allocatedTotal;
    toast({
      variant: newPaid >= total - 0.01 ? "success" : "default",
      title: newPaid >= total - 0.01 ? "Fully paid" : "Partial payment recorded",
      description: `${fmt(amt, paying.currency)} · balance ${fmt(Math.max(0, total - newPaid), paying.currency)}`,
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
    <IndustryRoleShell roleLabel="Accountant" pages={ACCOUNTANT_PAGES}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">All invoices raised against customers.</p>
        <div className="flex gap-2">
          <IndustryButton variant="secondary" asChild className="gap-1.5">
            <Link href="/finance/invoicing/proforma-invoices"><FileText className="size-4" /> Proforma invoices</Link>
          </IndustryButton>
          <IndustryButton variant="secondary" onClick={loadInvoices} disabled={loading} className="gap-1.5">
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Refresh
          </IndustryButton>
          <IndustryButton variant="primary" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="size-4" /> New invoice
          </IndustryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <IndustryCard className="gap-1">
          <IndustryCardKicker><Flame className="size-3 inline mr-1" />Overdue</IndustryCardKicker>
          <p className="ci-mono text-[18px] font-bold leading-none">{fmt(overdueByCcy[PRIMARY_CCY] ?? 0, PRIMARY_CCY)}</p>
          <p className="text-[10px] text-[var(--ci-text-tertiary)]">{otherCurrencyNote(overdueByCcy) ?? "Past due date, unpaid"}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><CalendarClock className="size-3 inline mr-1" />Due within 30 days</IndustryCardKicker>
          <p className="ci-mono text-[18px] font-bold leading-none">{fmt(dueSoonByCcy[PRIMARY_CCY] ?? 0, PRIMARY_CCY)}</p>
          <p className="text-[10px] text-[var(--ci-text-tertiary)]">{otherCurrencyNote(dueSoonByCcy) ?? "Not yet overdue"}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><Timer className="size-3 inline mr-1" />Avg. time to get paid</IndustryCardKicker>
          <p className="ci-mono text-[18px] font-bold leading-none">{avgDaysToGetPaid == null ? "—" : `${avgDaysToGetPaid.toFixed(0)}d`}</p>
          <p className="text-[10px] text-[var(--ci-text-tertiary)]">{avgDaysToGetPaid == null ? "No paid invoices yet" : "Issue date → payment date"}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><Landmark className="size-3 inline mr-1" />Cash & bank balance</IndustryCardKicker>
          <p className="ci-mono text-[18px] font-bold leading-none">{fmt(cashByCcy[PRIMARY_CCY] ?? 0, PRIMARY_CCY)}</p>
          <p className="text-[10px] text-[var(--ci-text-tertiary)]">{otherCurrencyNote(cashByCcy) ?? "Across active bank accounts"}</p>
        </IndustryCard>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <IndustryCard className="gap-1">
          <IndustryCardKicker>All invoices</IndustryCardKicker>
          <p className="ci-mono text-[18px] font-bold leading-none">{invoices.length}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Overdue</IndustryCardKicker>
          <p className="ci-mono text-[18px] font-bold leading-none text-[#8c1d18]">{kpis.overdueCount}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Partially paid</IndustryCardKicker>
          <p className="ci-mono text-[18px] font-bold leading-none">{kpis.partialCount}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Paid</IndustryCardKicker>
          <p className="ci-mono text-[18px] font-bold leading-none">{kpis.paidCount}</p>
        </IndustryCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <IndustryCard>
          <IndustryCardKicker><Wallet className="size-3 inline mr-1" />Total outstanding</IndustryCardKicker>
          {currencies.length === 0 ? (
            <p className="text-[12px] text-[var(--ci-text-tertiary)]">Nothing outstanding.</p>
          ) : (
            currencies.map((c) => (
              <div key={c} className="flex items-center justify-between text-[13px]">
                <span className="ci-mono text-[11px] text-[var(--ci-text-tertiary)]">{c}</span>
                <span className="ci-mono font-bold">{fmt(summaryByCcy[c].totalOutstanding, c)}</span>
              </div>
            ))
          )}
        </IndustryCard>
        <IndustryCard>
          <IndustryCardKicker><CheckCircle2 className="size-3 inline mr-1" />Collected — {new Date().toLocaleDateString(undefined, { month: "short", year: "numeric" })}</IndustryCardKicker>
          {Object.keys(thisMonthCollected).length === 0 ? (
            <p className="text-[12px] text-[var(--ci-text-tertiary)]">No payments this month yet.</p>
          ) : (
            sortCurrencyKeys(Object.keys(thisMonthCollected)).map((c) => (
              <div key={c} className="flex items-center justify-between text-[13px]">
                <span className="ci-mono text-[11px] text-[var(--ci-text-tertiary)]">{c}</span>
                <span className="ci-mono font-bold">{fmt(thisMonthCollected[c], c)}</span>
              </div>
            ))
          )}
        </IndustryCard>
        <IndustryCard>
          <IndustryCardKicker><Clock className="size-3 inline mr-1" />Pipeline</IndustryCardKicker>
          <div className="flex items-center justify-between text-[13px]"><span className="text-[var(--ci-text-tertiary)]">Draft</span><span className="ci-mono font-bold">{kpis.draftCount}</span></div>
          <div className="flex items-center justify-between text-[13px]"><span className="text-[var(--ci-text-tertiary)]">Pending</span><span className="ci-mono font-bold">{kpis.pendingCount}</span></div>
          <div className="flex items-center justify-between text-[13px]"><span className="text-[var(--ci-text-tertiary)]">Sent</span><span className="ci-mono font-bold">{kpis.sentCount}</span></div>
          <div className="flex items-center justify-between text-[13px]"><span className="text-[var(--ci-text-tertiary)]">Cancelled</span><span className="ci-mono font-bold">{kpis.cancelledCount}</span></div>
        </IndustryCard>
      </div>

      {currencies.map((cur) => {
        const s = summaryByCcy[cur];
        return (
          <IndustryCard key={`strip-${cur}`} className="mb-3">
            <div className="flex items-center justify-between">
              <IndustryCardKicker>Aging breakdown — {cur}</IndustryCardKicker>
              <Link href="/finance/reports/aging-report" className="text-[11px] text-[var(--ci-accent)] hover:underline flex items-center gap-0.5">
                Full report <ChevronRight className="size-3" />
              </Link>
            </div>
            <p className="text-[11px] text-[var(--ci-text-tertiary)] -mt-1 mb-1">{fmt(s.totalOutstanding, cur)} outstanding · {fmt(s.totalOverdue, cur)} overdue</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {AGING_BUCKETS.map((b) => (
                <div key={b.key} className="border border-[var(--ci-divider)] p-[10px]">
                  <p className="ci-lbl">{b.label}</p>
                  <p className="ci-mono text-[14px] font-bold mt-0.5">{fmt(s.totals[b.key], cur)}</p>
                  <p className="text-[10px] text-[var(--ci-text-tertiary)] mt-0.5">{s.counts[b.key]} invoice{s.counts[b.key] === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          </IndustryCard>
        );
      })}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1">
          {filterChips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={
                "px-3 py-[6px] text-[12px] border transition-colors duration-150 " +
                (filter === c.key ? "bg-[var(--ci-text)] text-[var(--ci-bg)] border-[var(--ci-text)]" : "border-[var(--ci-divider)] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-row-hover)]")
              }
            >
              {c.label} <span className="ci-mono opacity-70">{c.count}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-[9px] top-1/2 -translate-y-1/2 size-3.5 text-[var(--ci-text-tertiary)]" />
          <input placeholder="Search invoice #, customer…" value={search} onChange={(e) => setSearch(e.target.value)} className={fieldClass + " pl-8"} />
        </div>
      </div>

      <IndustryCard>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Invoice #</IndustryTh>
              <IndustryTh>Customer</IndustryTh>
              <IndustryTh>Issued</IndustryTh>
              <IndustryTh>Due</IndustryTh>
              <IndustryTh>Aging</IndustryTh>
              <IndustryTh align="right">Total</IndustryTh>
              <IndustryTh align="right">Paid</IndustryTh>
              <IndustryTh align="right">Balance</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh align="right">Action</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><IndustryTd className="text-center text-[var(--ci-text-tertiary)]">Loading…</IndustryTd></tr>
            ) : filtered.length === 0 ? (
              <tr><IndustryTd className="text-center text-[var(--ci-text-tertiary)]">No invoices match the current filter.</IndustryTd></tr>
            ) : (
              filtered.map((inv) => {
                const total = Number(inv.total_amount ?? inv.amount ?? 0);
                const paid = Number(inv.paid_amount ?? 0);
                const balance = total - paid;
                const overdue = isOpenForAging(inv.status) && daysOverdue(inv.due_date) > 0;
                const badgeStatus = overdue ? "overdue" : inv.status ?? "pending";
                const bucketMeta = isOpenForAging(inv.status) ? AGING_BUCKETS.find((b) => b.key === bucketFor(inv.due_date)) : null;
                return (
                  <IndustryTr key={inv.id}>
                    <IndustryTd mono>{inv.invoice_number}</IndustryTd>
                    <IndustryTd>{inv.customer_name ?? inv.client_name ?? "—"}</IndustryTd>
                    <IndustryTd mono className="text-[11px]">{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : "—"}</IndustryTd>
                    <IndustryTd mono className={overdue ? "text-[11px] text-[#8c1d18] font-bold" : "text-[11px]"}>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</IndustryTd>
                    <IndustryTd className="text-[10px] text-[var(--ci-text-tertiary)]">{bucketMeta ? (overdue ? <span className="text-[#8c1d18]"><Flame className="size-2.5 inline mr-0.5" />{bucketMeta.label}</span> : bucketMeta.label) : "—"}</IndustryTd>
                    <IndustryTd align="right" mono>{fmt(total, inv.currency)}</IndustryTd>
                    <IndustryTd align="right" mono className="text-[12px]">{paid > 0 ? fmt(paid, inv.currency) : "—"}</IndustryTd>
                    <IndustryTd align="right" mono className="font-bold">{fmt(balance, inv.currency)}</IndustryTd>
                    <IndustryTd><IndustryTag variant={STATUS_VARIANT[badgeStatus] ?? "neutral"}>{badgeStatus}</IndustryTag></IndustryTd>
                    <IndustryTd align="right">
                      <div className="flex justify-end gap-1">
                        <IndustryButton variant="ghost" onClick={() => router.push(`/finance/invoicing/customer-invoices/${inv.id}`)}>
                          <ArrowUpRight className="size-3.5" />
                        </IndustryButton>
                        {["draft", "pending"].includes(inv.status) && (
                          <IndustryButton variant="secondary" disabled={sendingId === inv.id} onClick={() => sendInvoice(inv)} className="gap-1">
                            {sendingId === inv.id ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowUpRight className="size-3.5" />} Send
                          </IndustryButton>
                        )}
                        {!["draft", "pending", "paid", "cancelled"].includes(inv.status) && (
                          <IndustryButton variant="primary" onClick={() => { setPaying(inv); setPayAmount(String(balance)); }} className="gap-1">
                            <CheckCircle2 className="size-3.5" /> Pay
                          </IndustryButton>
                        )}
                      </div>
                    </IndustryTd>
                  </IndustryTr>
                );
              })
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>

      <IndustryDialog open={creating} onOpenChange={setCreating}>
        <IndustryDialogContent open={creating} className="max-w-[520px]">
          <div className="flex items-center justify-between">
            <IndustryDialogTitle>New customer invoice</IndustryDialogTitle>
            <button onClick={() => setCreating(false)}><X className="size-4" /></button>
          </div>
          <div className="flex flex-col gap-3 mt-2">
            <div>
              <label className="ci-lbl block mb-1">Customer *</label>
              <select
                value={form.customer_id}
                onChange={(e) => {
                  const c = customers.find((x) => x.id === e.target.value);
                  setForm({ ...form, customer_id: e.target.value, customer_name: c?.company_name ?? "" });
                }}
                className={fieldClass}
              >
                <option value="">Select a customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <p className="text-[10px] text-[var(--ci-text-tertiary)] mt-1">
                {selectedCustomer ? `TIN: ${selectedCustomer.tax_id || "not on file"}` : (<>Don&apos;t see them? <Link href="/customers" className="text-[var(--ci-accent)] font-bold hover:underline">Add a customer</Link> first.</>)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ci-lbl block mb-1">Invoice number</label>
                <input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} placeholder="Auto-generated if blank" className={fieldClass} />
              </div>
              <div>
                <label className="ci-lbl block mb-1">Quotation ref</label>
                <select
                  value={form.quotation_id || "__none"}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__none") { setForm({ ...form, quotation_id: "" }); return; }
                    const q = quotations.find((x) => x.id === v);
                    const linkedCustomer = q?.customer_id ? customers.find((c) => c.id === q.customer_id) : null;
                    setForm({
                      ...form, quotation_id: v,
                      ...(q ? { amount: q.subtotal != null ? String(q.subtotal) : form.amount, vat_rate: q.vat_rate != null ? String(q.vat_rate) : form.vat_rate, currency: q.currency || form.currency } : {}),
                      ...(linkedCustomer && !form.customer_id ? { customer_id: linkedCustomer.id, customer_name: linkedCustomer.company_name } : {}),
                    });
                  }}
                  className={fieldClass}
                >
                  <option value="__none">— No quotation —</option>
                  {quotations.map((q) => <option key={q.id} value={q.id}>{q.quotation_number} · {q.origin} → {q.destination}</option>)}
                </select>
                <p className="text-[10px] text-[var(--ci-text-tertiary)] mt-1">Selecting a quotation fills in its agreed price.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ci-lbl block mb-1">Amount (excl. VAT) *</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className={fieldClass + " ci-mono"} />
              </div>
              <div>
                <label className="ci-lbl block mb-1">VAT rate</label>
                <input value={form.vat_applicable ? `${form.vat_rate}% (TRA standard)` : "Exempt"} disabled className={fieldClass + " opacity-60"} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-[12px]">
                <input type="checkbox" checked={form.vat_applicable} onChange={(e) => setForm({ ...form, vat_applicable: e.target.checked })} className="accent-[var(--ci-accent)]" /> Apply VAT
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[12px]">
                <input type="checkbox" checked={form.wht_applicable} onChange={(e) => setForm({ ...form, wht_applicable: e.target.checked })} className="accent-[var(--ci-accent)]" /> WHT deductible (5%, over TZS 500,000)
              </label>
            </div>
            {form.amount && (() => {
              const subtotal = parseFloat(form.amount) || 0;
              const { vatAmount, whtAmount, totalPayable } = calculateInvoiceTotals({ subtotal, vatApplicable: form.vat_applicable, whtApplicable: form.wht_applicable });
              return (
                <div className="border border-[var(--ci-divider)] p-[10px] text-[12px] flex flex-col gap-1">
                  <div className="flex justify-between"><span className="text-[var(--ci-text-tertiary)]">Subtotal</span><span className="ci-mono">{fmt(subtotal, form.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--ci-text-tertiary)]">{form.vat_applicable ? `VAT (${form.vat_rate}%)` : "VAT"}</span><span className="ci-mono">{form.vat_applicable ? fmt(vatAmount, form.currency) : "Exempt"}</span></div>
                  {whtAmount > 0 && <div className="flex justify-between text-[#8c1d18]"><span>WHT deductible (5%)</span><span className="ci-mono">({fmt(whtAmount, form.currency)})</span></div>}
                  <div className="flex justify-between font-bold pt-1 border-t border-[var(--ci-divider)]"><span>Total payable</span><span className="ci-mono">{fmt(totalPayable, form.currency)}</span></div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ci-lbl block mb-1">Currency</label>
                <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={fieldClass}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="ci-lbl block mb-1">Payment terms</label>
                <select value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} className={fieldClass}>
                  <option value="immediate">Immediate</option>
                  <option value="15 days">Net 15</option>
                  <option value="30 days">Net 30</option>
                  <option value="60 days">Net 60</option>
                  <option value="90 days">Net 90</option>
                </select>
              </div>
            </div>
            <div>
              <label className="ci-lbl block mb-1">Due date *</label>
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className={fieldClass} />
            </div>
            <div>
              <label className="ci-lbl block mb-1">Description / notes</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Services rendered, trip reference, etc." className={fieldClass} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ci-divider)]">
              <IndustryButton variant="secondary" onClick={() => setCreating(false)} disabled={submitting}>Cancel</IndustryButton>
              <IndustryButton variant="primary" onClick={saveInvoice} disabled={submitting} className="gap-1.5">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create invoice
              </IndustryButton>
            </div>
          </div>
        </IndustryDialogContent>
      </IndustryDialog>

      <IndustryDialog open={!!paying} onOpenChange={(v) => !v && setPaying(null)}>
        <IndustryDialogContent open={!!paying}>
          <div className="flex items-center justify-between">
            <IndustryDialogTitle>Record payment</IndustryDialogTitle>
            <button onClick={() => setPaying(null)}><X className="size-4" /></button>
          </div>
          {paying && (
            <div className="flex flex-col gap-3 mt-2">
              <p className="ci-mono text-[12px] text-[var(--ci-text-tertiary)]">{paying.invoice_number}</p>
              <div className="border border-[var(--ci-divider)] p-[10px] text-[12px] flex flex-col gap-1">
                <div className="flex justify-between"><span className="text-[var(--ci-text-tertiary)]">Customer</span><span className="font-bold">{paying.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ci-text-tertiary)]">Invoice total</span><span className="ci-mono">{fmt(Number(paying.total_amount ?? paying.amount ?? 0), paying.currency)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ci-text-tertiary)]">Paid so far</span><span className="ci-mono">{fmt(Number(paying.paid_amount ?? 0), paying.currency)}</span></div>
                <div className="flex justify-between font-bold pt-1 border-t border-[var(--ci-divider)]"><span>Outstanding</span><span className="ci-mono">{fmt(Number(paying.total_amount ?? paying.amount ?? 0) - Number(paying.paid_amount ?? 0), paying.currency)}</span></div>
              </div>
              <div>
                <label className="ci-lbl block mb-1">Amount received</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={fieldClass + " ci-mono"} />
              </div>
              <div>
                <label className="ci-lbl block mb-1">Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={fieldClass}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="ci-lbl block mb-1">Deposited to *</label>
                <select value={payBankAccountId} onChange={(e) => setPayBankAccountId(e.target.value)} className={fieldClass}>
                  <option value="">Which account received this?</option>
                  {bankAccounts.filter((b) => b.currency === (paying.currency || "TZS")).map((b) => <option key={b.id} value={b.id}>{b.bank_name} · {b.account_name}</option>)}
                </select>
                <p className="text-[10px] text-[var(--ci-text-tertiary)] mt-1">Posts this payment into the ledger — the account you pick here is what actually gets credited.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ci-divider)]">
                <IndustryButton variant="secondary" onClick={() => setPaying(null)}>Cancel</IndustryButton>
                <IndustryButton variant="primary" onClick={recordPayment} className="gap-1.5"><CheckCircle2 className="size-4" /> Record payment</IndustryButton>
              </div>
            </div>
          )}
        </IndustryDialogContent>
      </IndustryDialog>

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
    </IndustryRoleShell>
  );
}
