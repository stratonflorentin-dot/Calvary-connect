"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { logCustomerActivity } from "@/lib/customer-activity";
import { resolveReceivableAccountCode } from "@/lib/finance/ar-ap-accounts";
import { AuditTrailService } from "@/services/audit-trail-service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, DataTableFilterSelect, StatusBadge, StatCard } from "@/components/shell";
import { formatCurrency } from "@/components/ui/currency-badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, DollarSign, Loader2, Plus, Wallet } from "lucide-react";
import { formatDate } from "@/lib/utils";

const CURRENCIES = ["TZS", "USD", "EUR"];

interface InvoiceOption {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string | null;
  total_amount: number;
  amount: number;
  paid_amount: number;
  currency: string;
  status: string;
  issue_date?: string;
  created_at: string;
}

interface CustomerOption {
  id: string;
  name: string;
}

/** payments.total_amount − paid_amount is the outstanding balance
 *  everywhere else this app computes it (see e.g. src/app/customers/[id]/page.tsx). */
function outstanding(inv: InvoiceOption): number {
  return Number(inv.total_amount ?? inv.amount ?? 0) - Number(inv.paid_amount ?? 0);
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const { user } = useSupabase();
  const { role } = useRole();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<InvoiceOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("TZS");
  const [method, setMethod] = useState("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const canManage = role ? ["CEO", "ADMIN", "ACCOUNTANT"].includes(role) : false;

  const load = async () => {
    setLoading(true);
    try {
      const [paymentsRes, invoicesRes, accountsRes] = await Promise.all([
        supabase.from("payments").select("*").order("payment_date", { ascending: false }),
        // This page records customer receipts against receivable invoices —
        // vendor bills (type='payable') are paid via /finance/invoicing/vendor-bills.
        supabase.from("invoices").select("*").eq("type", "receivable"),
        supabase.from("bank_accounts").select("id, account_name, account_number, currency").eq("is_active", true),
      ]);
      if (paymentsRes.error) throw paymentsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      setPayments(paymentsRes.data || []);
      setInvoices((invoicesRes.data as InvoiceOption[]) || []);
      setBankAccounts(accountsRes.data || []);
      if (accountsRes.data && accountsRes.data.length > 0) {
        setBankAccountId((prev) => prev || accountsRes.data[0].id);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load payments", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const customers = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of invoices) {
      if (inv.customer_id && !map.has(inv.customer_id)) map.set(inv.customer_id, inv.customer_name || "Unnamed customer");
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name } as CustomerOption)).sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices]);

  const openInvoicesForCustomer = useMemo(() => {
    if (!customerId) return [];
    return invoices
      .filter((inv) => inv.customer_id === customerId && !["cancelled", "voided"].includes(inv.status) && outstanding(inv) > 0.01)
      .sort((a, b) => (a.issue_date ?? a.created_at ?? "").localeCompare(b.issue_date ?? b.created_at ?? ""));
  }, [invoices, customerId]);

  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocations],
  );
  const unallocated = (Number(amount) || 0) - totalAllocated;

  const resetForm = () => {
    setCustomerId(""); setAmount(""); setCurrency("TZS"); setMethod("bank_transfer");
    setPaymentDate(new Date().toISOString().split("T")[0]); setNotes(""); setAllocations({});
  };

  const openNew = () => { resetForm(); setModalOpen(true); };

  const setAllocation = (invoiceId: string, value: string, invOutstanding: number) => {
    const n = Number(value);
    if (value !== "" && (Number.isNaN(n) || n < 0)) return;
    // Never let a single invoice's allocation exceed what it's actually owed —
    // the outstanding-balance guard this app uses everywhere else.
    const capped = value === "" ? "" : String(Math.min(n, invOutstanding));
    setAllocations((prev) => ({ ...prev, [invoiceId]: capped }));
  };

  const autoAllocate = () => {
    let remaining = Number(amount) || 0;
    const next: Record<string, string> = {};
    for (const inv of openInvoicesForCustomer) {
      if (remaining <= 0) break;
      const take = Math.min(outstanding(inv), remaining);
      next[inv.id] = String(take);
      remaining -= take;
    }
    setAllocations(next);
  };

  const savePayment = async () => {
    if (!customerId) { toast({ title: "Choose a customer", variant: "destructive" }); return; }
    if (!bankAccountId) { toast({ title: "Choose which account received this payment", variant: "destructive" }); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast({ title: "Amount must be greater than 0", variant: "destructive" }); return; }
    if (totalAllocated > amt + 0.01) { toast({ title: "Allocated more than the payment amount", description: "Reduce an allocation or increase the payment amount.", variant: "destructive" }); return; }

    const allocatedInvoices = openInvoicesForCustomer
      .map((inv) => ({ inv, amt: Number(allocations[inv.id]) || 0 }))
      .filter((a) => a.amt > 0);

    setSubmitting(true);
    try {
      const customerName = customers.find((c) => c.id === customerId)?.name ?? "Customer";

      // Same Accounts Receivable lookup postJournalEntry() uses for the
      // Invoice Detail page's single-invoice "Record Payment" — reused here
      // rather than re-deriving it, since this page's own post_bank_transaction
      // call previously omitted p_contra_account_code entirely, which meant
      // every payment recorded here moved the bank balance but never posted
      // a journal entry (no debit to bank, no credit to AR). That was a
      // pre-existing gap, not something a UI pass should leave in place.
      const contraCode = await resolveReceivableAccountCode(currency);
      if (!contraCode) {
        throw new Error(`No "Accounts Receivable" account exists in ${currency} — add one to the Chart of Accounts first.`);
      }

      // Atomically deposits into bank_accounts.current_balance and posts the
      // balanced journal entry (migration 035) — the same primitive every
      // other money-in flow in this app uses.
      const { data: bankTxn, error: txError } = await supabase.rpc("post_bank_transaction", {
        p_bank_account_id: bankAccountId,
        p_amount: amt,
        p_direction: "in",
        p_transaction_type: "deposit",
        p_currency: currency,
        p_description: `Payment received from ${customerName}`,
        p_reference: allocatedInvoices.length === 1 ? allocatedInvoices[0].inv.invoice_number : null,
        p_reference_type: "customer",
        p_reference_id: customerId,
        p_transaction_date: paymentDate,
        p_contra_account_code: contraCode,
        p_idempotency_key: crypto.randomUUID(),
      });
      if (txError) throw txError;
      const bankTxnRow = Array.isArray(bankTxn) ? bankTxn[0] : bankTxn;

      const { data: paymentNumber } = await supabase.rpc("next_doc_number", { p_type: "payment" });

      const referenceLabel = allocatedInvoices.length === 0
        ? null
        : allocatedInvoices.length <= 3
          ? allocatedInvoices.map((a) => a.inv.invoice_number).join(", ")
          : `${allocatedInvoices.length} invoices`;

      const { data: payment, error } = await supabase.from("payments").insert({
        payment_number: paymentNumber,
        direction: "in",
        counterparty_type: "customer",
        counterparty_id: customerId,
        counterparty_name: customerName,
        bank_account_id: bankAccountId,
        amount: amt,
        currency,
        payment_date: paymentDate,
        method,
        reference: referenceLabel,
        notes,
        status: "posted",
        bank_transaction_id: bankTxnRow?.id ?? null,
        journal_entry_id: bankTxnRow?.journal_entry_id ?? null,
        created_by: user?.id ?? null,
      }).select().single();
      if (error) throw error;

      if (allocatedInvoices.length > 0) {
        const { error: allocError } = await supabase.from("payment_allocations").insert(
          allocatedInvoices.map((a) => ({ payment_id: payment.id, invoice_id: a.inv.id, amount: a.amt })),
        );
        if (allocError) throw allocError;

        // Same-currency full/partial settlement — matches the rule already
        // used by the vendor-bills page and the Invoice Detail "Record
        // Payment" action. Cross-currency allocation isn't attempted; the
        // allocation is still recorded, but the invoice balance is left for
        // manual reconciliation exactly as those other flows already do.
        for (const { inv, amt: allocAmt } of allocatedInvoices) {
          if (currency !== inv.currency) continue;
          const newPaid = Number(inv.paid_amount ?? 0) + allocAmt;
          const total = Number(inv.total_amount ?? inv.amount ?? 0);
          await supabase.from("invoices").update({
            paid_amount: newPaid,
            status: newPaid >= total - 0.01 ? "paid" : "partial",
          }).eq("id", inv.id);
        }
      }

      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "create", entity_type: "payment", entity_id: payment.id,
        new_value: { amount: amt, currency, allocated: totalAllocated, unallocated: amt - totalAllocated },
        description: `Payment ${paymentNumber} of ${formatCurrency(amt, currency)} recorded from ${customerName}${allocatedInvoices.length > 0 ? ` — allocated to ${referenceLabel}` : " — not yet allocated"}`,
      });

      logCustomerActivity({
        customerId,
        activityType: "payment",
        description: `Payment ${paymentNumber} received${referenceLabel ? ` for ${referenceLabel}` : ""}`,
        amount: amt,
        createdBy: user?.id,
      });

      await load();
      setModalOpen(false);
      resetForm();
      toast({ variant: "success", title: "Payment recorded", description: paymentNumber ? `${paymentNumber} saved` : undefined });
    } catch (err: any) {
      toast({ title: "Couldn't record payment", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (filterCurrency !== "all" && p.currency !== filterCurrency) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (!q) return true;
      return [p.payment_number, p.reference, p.counterparty_name, p.notes].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [payments, search, filterCurrency, filterStatus]);

  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of filtered) map.set(p.currency, (map.get(p.currency) ?? 0) + (Number(p.amount) || 0));
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-headline tracking-tighter">Payments</h1>
          <p className="text-muted-foreground">Customer receipts — matched to bank transactions and allocated against invoices</p>
        </div>
        {canManage && (
          <Button className="gap-2" onClick={openNew}>
            <Plus className="size-4" /> Record Payment
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Payments" value={totalsByCurrency.size === 0 ? formatCurrency(0, "TZS") : Array.from(totalsByCurrency.entries()).map(([c, v]) => formatCurrency(v, c)).join(" · ")} icon={DollarSign} />
        <StatCard label="Total Transactions" value={payments.length} icon={CreditCard} />
        <StatCard label="Filtered View" value={filtered.length} icon={Wallet} />
      </div>

      <DataTable
        data={filtered}
        getRowId={(p) => p.id}
        loading={loading}
        onRowClick={(p) => { window.location.href = `/finance/transactions/payments/${p.id}`; }}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search payment #, customer, reference…"
        filters={
          <>
            <DataTableFilterSelect
              value={filterCurrency}
              onValueChange={setFilterCurrency}
              placeholder="Currency"
              options={[{ value: "all", label: "All Currencies" }, ...CURRENCIES.map((c) => ({ value: c, label: c }))]}
            />
            <DataTableFilterSelect
              value={filterStatus}
              onValueChange={setFilterStatus}
              placeholder="Status"
              options={[
                { value: "all", label: "All Statuses" },
                { value: "posted", label: "Posted" },
                { value: "draft", label: "Draft" },
                { value: "voided", label: "Voided" },
              ]}
            />
          </>
        }
        emptyIcon={CreditCard}
        emptyTitle="No payments recorded"
        emptyDescription="Record your first customer payment to get started."
        emptyAction={canManage ? <Button onClick={openNew} className="gap-2"><Plus className="size-4" /> Record Payment</Button> : undefined}
        initialSort={{ key: "date", dir: "desc" }}
        columns={[
          { key: "number", header: "Payment #", accessor: (p) => <span className="font-mono text-xs font-black text-foreground">{p.payment_number || "—"}</span>, sortValue: (p) => p.payment_number ?? "" },
          { key: "date", header: "Date", hideBelow: "md", accessor: (p) => <span className="text-xs text-muted-foreground">{formatDate(p.payment_date)}</span>, sortValue: (p) => p.payment_date ?? "" },
          { key: "customer", header: "Customer", accessor: (p) => <span className="font-medium text-foreground">{p.counterparty_name || "Unknown"}</span>, sortValue: (p) => p.counterparty_name ?? "" },
          { key: "reference", header: "Reference", hideBelow: "lg", accessor: (p) => <span className="text-xs text-muted-foreground">{p.reference || "—"}</span> },
          { key: "method", header: "Method", hideBelow: "lg", accessor: (p) => <span className="text-xs capitalize text-muted-foreground">{p.method?.replace(/_/g, " ") || "—"}</span> },
          { key: "bank_txn", header: "Bank Transaction", hideBelow: "lg", accessor: (p) => <span className="font-mono text-xs text-muted-foreground">{p.transaction_reference || (p.reconciled ? "—" : "Not yet reconciled")}</span> },
          { key: "amount", header: "Amount", align: "right", accessor: (p) => <span className="font-bold">{formatCurrency(Number(p.amount) || 0, p.currency)}</span>, sortValue: (p) => Number(p.amount) || 0 },
          { key: "status", header: "Status", accessor: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status ?? "" },
        ]}
      />

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!submitting) { setModalOpen(o); if (!o) resetForm(); } }}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Customer *</Label>
                <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setAllocations({}); }}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deposit To *</Label>
                <Select value={bankAccountId} onValueChange={setBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select bank account" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_name} · {a.account_number} ({a.currency})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount Received *</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment Date</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
            </div>

            {customerId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Allocate to Invoices</Label>
                  {openInvoicesForCustomer.length > 0 && Number(amount) > 0 && (
                    <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={autoAllocate}>
                      Auto-allocate oldest first
                    </Button>
                  )}
                </div>
                {openInvoicesForCustomer.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No outstanding invoices for this customer — the payment will be recorded unallocated.</p>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="text-left font-bold px-3 py-2">Invoice</th>
                          <th className="text-right font-bold px-3 py-2">Original</th>
                          <th className="text-right font-bold px-3 py-2">Outstanding</th>
                          <th className="text-right font-bold px-3 py-2 w-32">Allocation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openInvoicesForCustomer.map((inv) => {
                          const out = outstanding(inv);
                          return (
                            <tr key={inv.id} className="border-t border-border">
                              <td className="px-3 py-2 font-mono">{inv.invoice_number}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">{formatCurrency(Number(inv.total_amount ?? inv.amount) || 0, inv.currency)}</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(out, inv.currency)}</td>
                              <td className="px-3 py-2">
                                <Input
                                  type="number"
                                  className="h-7 text-right text-xs"
                                  value={allocations[inv.id] ?? ""}
                                  onChange={(e) => setAllocation(inv.id, e.target.value, out)}
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-between text-xs pt-1 border-t border-border">
                  <span className="text-muted-foreground">Allocated: <span className="font-bold text-foreground">{formatCurrency(totalAllocated, currency)}</span></span>
                  <span className={unallocated > 0.01 ? "text-warning font-bold" : "text-muted-foreground"}>
                    Unallocated: {formatCurrency(Math.max(0, unallocated), currency)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={savePayment} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Save Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
