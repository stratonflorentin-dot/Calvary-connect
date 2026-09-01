"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { createCustomerPayment } from "@/lib/finance/customer-payment";
import { AuditTrailService } from "@/services/audit-trail-service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, DataTableFilterSelect, StatusBadge, StatCard } from "@/components/shell";
import { formatCurrency } from "@/components/ui/currency-badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, DollarSign, Loader2, Plus, Undo2, Wallet } from "lucide-react";
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
  const [allocatedByPayment, setAllocatedByPayment] = useState<Map<string, number>>(new Map());
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

  const [reversingPayment, setReversingPayment] = useState<any | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);

  const canManage = role ? ["CEO", "ADMIN", "ACCOUNTANT"].includes(role) : false;
  // reverse_customer_payment (132_payment_reversal.sql) is CEO/ADMIN-only —
  // matches reverse_bank_transfer's existing precedent for reversal actions.
  const canReverse = role ? ["CEO", "ADMIN"].includes(role) : false;

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

      // One aggregated query for the whole list's Allocated/Unallocated
      // columns instead of a per-row lookup.
      const paymentIds = (paymentsRes.data || []).map((p: any) => p.id);
      if (paymentIds.length > 0) {
        const { data: allocRows } = await supabase.from("payment_allocations").select("payment_id, amount").in("payment_id", paymentIds);
        const map = new Map<string, number>();
        for (const a of allocRows ?? []) map.set(a.payment_id, (map.get(a.payment_id) ?? 0) + (Number(a.amount) || 0));
        setAllocatedByPayment(map);
      } else {
        setAllocatedByPayment(new Map());
      }
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

      const result = await createCustomerPayment({
        customerId,
        customerName,
        bankAccountId,
        amount: amt,
        currency,
        paymentDate,
        method,
        notes,
        allocations: allocatedInvoices.map((a) => ({
          invoiceId: a.inv.id,
          invoiceNumber: a.inv.invoice_number,
          invoiceCurrency: a.inv.currency,
          invoiceTotal: Number(a.inv.total_amount ?? a.inv.amount ?? 0),
          invoicePaidAmount: Number(a.inv.paid_amount ?? 0),
          amount: a.amt,
        })),
        createdBy: user?.id,
      });

      await load();
      setModalOpen(false);
      resetForm();
      toast({ variant: "success", title: "Payment recorded", description: result.paymentNumber ? `${result.paymentNumber} saved` : undefined });
    } catch (err: any) {
      toast({ title: "Couldn't record payment", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const reversePayment = async () => {
    if (!reversingPayment) return;
    setReversing(true);
    try {
      const { error } = await supabase.rpc("reverse_customer_payment", {
        p_payment_id: reversingPayment.id,
        p_reason: reverseReason || null,
      });
      if (error) throw error;
      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "update", entity_type: "payment", entity_id: reversingPayment.id,
        description: `Payment ${reversingPayment.payment_number ?? reversingPayment.id} reversed${reverseReason ? `: ${reverseReason}` : ""}`,
      });
      toast({ variant: "success", title: "Payment reversed" });
      setReversingPayment(null);
      setReverseReason("");
      await load();
    } catch (err: any) {
      toast({ title: "Couldn't reverse payment", description: err.message, variant: "destructive" });
    } finally {
      setReversing(false);
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
          { key: "allocated", header: "Allocated", align: "right", hideBelow: "lg", accessor: (p) => formatCurrency(allocatedByPayment.get(p.id) ?? 0, p.currency) },
          {
            key: "unallocated", header: "Unallocated", align: "right", hideBelow: "lg",
            accessor: (p) => {
              const un = Math.max(0, (Number(p.amount) || 0) - (allocatedByPayment.get(p.id) ?? 0));
              return un > 0.01 ? <span className="text-warning font-medium">{formatCurrency(un, p.currency)}</span> : <span className="text-muted-foreground">—</span>;
            },
          },
          { key: "status", header: "Status", accessor: (p) => <StatusBadge status={p.status} />, sortValue: (p) => p.status ?? "" },
        ]}
        rowActions={canReverse ? (p) => (
          p.status === "posted" && !p.reconciled ? (
            <Button
              size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive"
              onClick={() => { setReversingPayment(p); setReverseReason(""); }}
            >
              <Undo2 className="w-3 h-3" /> Reverse
            </Button>
          ) : null
        ) : undefined}
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

      {/* Reverse payment confirmation */}
      <Dialog open={!!reversingPayment} onOpenChange={(o) => { if (!reversing) { if (!o) { setReversingPayment(null); setReverseReason(""); } } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Reverse Payment?</DialogTitle></DialogHeader>
          {reversingPayment && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 text-sm space-y-1">
                <p className="font-mono font-bold text-foreground">{reversingPayment.payment_number ?? reversingPayment.id}</p>
                <p className="text-muted-foreground">{reversingPayment.counterparty_name}</p>
                <p className="font-bold text-foreground">{formatCurrency(Number(reversingPayment.amount) || 0, reversingPayment.currency)}</p>
                {reversingPayment.reference && <p className="text-xs text-muted-foreground">{reversingPayment.reference}</p>}
              </div>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                <li>Reverses the accounting entry (a new journal entry, not an edit to the original)</li>
                <li>Removes this payment's effect on the bank balance</li>
                <li>Restores the outstanding balance on any invoice(s) it was allocated to</li>
                <li>Preserves the original payment in history, marked as voided</li>
              </ul>
              <div className="space-y-1">
                <Label className="text-xs">Reason (optional)</Label>
                <Input value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="e.g. recorded in error" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => { setReversingPayment(null); setReverseReason(""); }} disabled={reversing}>Cancel</Button>
                <Button onClick={reversePayment} disabled={reversing} variant="destructive" className="gap-2">
                  {reversing ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Reverse Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
