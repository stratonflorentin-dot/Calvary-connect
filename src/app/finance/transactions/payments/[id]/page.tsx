"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityHeader, StatCard, DataTable, StatusBadge } from "@/components/shell";
import { formatCurrency } from "@/components/ui/currency-badge";
import { AuditTrailService } from "@/services/audit-trail-service";
import { formatDate } from "@/lib/utils";
import {
  ArrowRight, BookOpen, CreditCard, FileText, Landmark, Loader2, Receipt, ShieldCheck, Undo2,
} from "lucide-react";

interface Payment {
  id: string;
  payment_number: string | null;
  direction: string;
  counterparty_name: string | null;
  counterparty_id: string | null;
  bank_account_id: string | null;
  amount: number;
  currency: string;
  payment_date: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  journal_entry_id: string | null;
  bank_transaction_id: string | null;
  transaction_reference: string | null;
  reconciled: boolean;
  reversed_at: string | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  reversal_journal_entry_id: string | null;
  reversal_bank_transaction_id: string | null;
}

interface AllocationRow {
  invoice_id: string;
  amount: number;
  invoices: {
    id: string;
    invoice_number: string;
    total_amount: number;
    amount: number;
    paid_amount: number;
    currency: string;
    status: string;
    issue_date?: string;
    created_at: string;
  } | null;
}

/** Same total_amount − paid_amount outstanding-balance convention this app
 *  uses everywhere (customers/[id], the Payments allocation form, etc). */
function invoiceOutstanding(inv: AllocationRow["invoices"]): number {
  if (!inv) return 0;
  return Number(inv.total_amount ?? inv.amount ?? 0) - Number(inv.paid_amount ?? 0);
}

export default function PaymentDetailPage() {
  const params = useParams();
  const paymentId = params.id as string;
  const { toast } = useToast();
  const { user } = useSupabase();
  const { role } = useRole();
  // reverse_customer_payment (132_payment_reversal.sql) is CEO/ADMIN-only.
  const canReverse = role ? ["CEO", "ADMIN"].includes(role) : false;

  const [payment, setPayment] = useState<Payment | null>(null);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [reversing, setReversing] = useState(false);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [bankAccount, setBankAccount] = useState<{ id: string; account_name: string; bank_name: string } | null>(null);
  const [bankTransaction, setBankTransaction] = useState<{ id: string; description: string; debit: number; credit: number; reference?: string; transaction_date: string } | null>(null);
  const [journalLines, setJournalLines] = useState<{ id: string; account_code: string; account_name: string; debit_amount: number; credit_amount: number }[]>([]);
  const [journalEntry, setJournalEntry] = useState<{ entry_number: string | null; status: string; reference: string | null } | null>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: paymentData, error } = await supabase.from("payments").select("*").eq("id", paymentId).single();
      if (error) throw error;
      setPayment(paymentData);

      const [allocRes, activityRes] = await Promise.all([
        supabase.from("payment_allocations").select("invoice_id, amount, invoices(id, invoice_number, total_amount, amount, paid_amount, currency, status, issue_date, created_at)").eq("payment_id", paymentId),
        AuditTrailService.getEntityLogs("payment", paymentId, 25),
      ]);
      setAllocations((allocRes.data as unknown as AllocationRow[]) ?? []);
      setActivity(activityRes ?? []);

      if (paymentData.bank_account_id) {
        const { data: acc } = await supabase.from("bank_accounts").select("id, account_name, bank_name").eq("id", paymentData.bank_account_id).single();
        setBankAccount(acc ?? null);
      }
      if (paymentData.bank_transaction_id) {
        const { data: txn } = await supabase.from("bank_transactions").select("id, description, debit, credit, reference, transaction_date").eq("id", paymentData.bank_transaction_id).single();
        setBankTransaction(txn ?? null);
      }
      if (paymentData.journal_entry_id) {
        const [{ data: je }, { data: lines }] = await Promise.all([
          supabase.from("journal_entries").select("entry_number, status, reference").eq("id", paymentData.journal_entry_id).single(),
          supabase.from("journal_entry_lines").select("id, account_code, account_name, debit_amount, credit_amount").eq("journal_entry_id", paymentData.journal_entry_id),
        ]);
        setJournalEntry(je ?? null);
        setJournalLines(lines ?? []);
      }
    } catch (err: any) {
      toast({ title: "Couldn't load payment", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (paymentId) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [paymentId]);

  const reversePayment = async () => {
    if (!payment) return;
    setReversing(true);
    try {
      const { error } = await supabase.rpc("reverse_customer_payment", {
        p_payment_id: payment.id,
        p_reason: reverseReason || null,
      });
      if (error) throw error;
      await AuditTrailService.log({
        user_id: user?.id, module: "finance", action: "update", entity_type: "payment", entity_id: payment.id,
        description: `Payment ${payment.payment_number ?? payment.id} reversed${reverseReason ? `: ${reverseReason}` : ""}`,
      });
      toast({ variant: "success", title: "Payment reversed" });
      setReverseOpen(false);
      setReverseReason("");
      await load();
    } catch (err: any) {
      toast({ title: "Couldn't reverse payment", description: err.message, variant: "destructive" });
    } finally {
      setReversing(false);
    }
  };

  const totals = useMemo(() => {
    const allocated = allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    const amount = Number(payment?.amount) || 0;
    return { allocated, unallocated: Math.max(0, amount - allocated) };
  }, [allocations, payment]);

  if (loading || !payment) {
    return <div className="max-w-6xl mx-auto"><p className="text-muted-foreground">Loading…</p></div>;
  }

  const singleInvoice = allocations.length === 1 ? allocations[0].invoices : null;

  return (
    <>
    <div className="max-w-6xl mx-auto space-y-6">
      <EntityHeader
        crumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Payments", href: "/finance/transactions/payments" },
          { label: payment.payment_number ?? "Payment" },
        ]}
        eyebrow="Payment"
        title={payment.payment_number ?? "Untitled Payment"}
        subtitle={payment.counterparty_name ?? "—"}
        status={payment.status}
        badges={payment.reconciled ? <StatusBadge status="reconciled" /> : undefined}
        primaryMetricLabel="Amount"
        primaryMetricValue={formatCurrency(payment.amount, payment.currency)}
        metadata={[
          { label: "Method", value: payment.method?.replace(/_/g, " ") ?? "—" },
          { label: "Date", value: formatDate(payment.payment_date) },
          { label: "Bank Transaction", value: payment.transaction_reference ?? bankTransaction?.reference ?? (payment.bank_transaction_id ? "Linked" : "—") },
        ]}
        secondaryActions={
          <>
            {bankAccount && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href={`/finance/banking/bank-accounts/${bankAccount.id}`}><Landmark className="size-4" /> View Bank Account</Link>
              </Button>
            )}
            {singleInvoice && (
              <Button asChild size="sm" variant="outline" className="gap-2">
                <Link href={`/finance/invoicing/customer-invoices/${singleInvoice.id}`}><FileText className="size-4" /> View Invoice</Link>
              </Button>
            )}
            {canReverse && payment.status === "posted" && !payment.reconciled && (
              <Button size="sm" variant="outline" className="gap-2 text-destructive border-destructive/30" onClick={() => setReverseOpen(true)}>
                <Undo2 className="size-4" /> Reverse Payment
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Amount" value={formatCurrency(payment.amount, payment.currency)} icon={CreditCard} />
        <StatCard label="Allocated" value={formatCurrency(totals.allocated, payment.currency)} icon={ShieldCheck} accent="bg-success/10 text-success" />
        <StatCard label="Unallocated" value={formatCurrency(totals.unallocated, payment.currency)} icon={Receipt} accent={totals.unallocated > 0.01 ? "bg-warning/10 text-warning" : undefined} />
        <StatCard label="Reconciled" value={payment.reconciled ? "Yes" : "No"} icon={ShieldCheck} accent={payment.reconciled ? "bg-success/10 text-success" : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Invoice Allocations</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={allocations}
            getRowId={(a) => a.invoice_id}
            emptyIcon={FileText}
            emptyTitle="Not allocated to any invoice"
            emptyDescription="This payment hasn't been applied to an invoice yet."
            columns={[
              { key: "invoice", header: "Invoice", accessor: (a) => a.invoices ? <span className="font-mono text-xs font-black text-foreground">{a.invoices.invoice_number}</span> : "—" },
              { key: "date", header: "Invoice Date", hideBelow: "md", accessor: (a) => <span className="text-xs text-muted-foreground">{a.invoices?.issue_date ? formatDate(a.invoices.issue_date) : a.invoices ? formatDate(a.invoices.created_at) : "—"}</span> },
              { key: "original", header: "Original Amount", align: "right", hideBelow: "md", accessor: (a) => a.invoices ? formatCurrency(Number(a.invoices.total_amount ?? a.invoices.amount) || 0, a.invoices.currency) : "—" },
              { key: "allocated", header: "Allocated", align: "right", accessor: (a) => <span className="font-bold">{formatCurrency(Number(a.amount) || 0, a.invoices?.currency ?? payment.currency)}</span> },
              { key: "remaining", header: "Remaining", align: "right", accessor: (a) => a.invoices ? formatCurrency(invoiceOutstanding(a.invoices), a.invoices.currency) : "—" },
              { key: "status", header: "Status", accessor: (a) => a.invoices ? <StatusBadge status={a.invoices.status} /> : "—" },
              {
                key: "actions", header: "", align: "right",
                accessor: (a) => a.invoices ? (
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <Link href={`/finance/invoicing/customer-invoices/${a.invoices.id}`}>View <ArrowRight className="size-3" /></Link>
                  </Button>
                ) : null,
              },
            ]}
          />
        </CardContent>
      </Card>

      {payment.status === "voided" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2 text-destructive"><Undo2 className="size-4" /> Reversed</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Original Amount</span><span className="font-bold text-foreground">{formatCurrency(payment.amount, payment.currency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Reversed</span><span className="text-foreground">{payment.reversed_at ? formatDate(payment.reversed_at) : "—"}</span></div>
            {payment.reversal_reason && <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span className="text-foreground text-right">{payment.reversal_reason}</span></div>}
            {payment.reversal_journal_entry_id && <div className="flex justify-between"><span className="text-muted-foreground">Reversal Journal</span><span className="font-mono text-xs text-foreground">{payment.reversal_journal_entry_id.slice(0, 8)}</span></div>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Landmark className="size-4" /> Bank Transaction</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!payment.bank_transaction_id ? (
              <p className="text-xs text-muted-foreground italic">No bank transaction linked to this payment.</p>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Description</span><span className="text-foreground text-right">{bankTransaction?.description ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="text-foreground">{bankTransaction ? formatDate(bankTransaction.transaction_date) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="text-foreground font-mono text-xs">{payment.transaction_reference ?? bankTransaction?.reference ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Reconciled</span><span className="text-foreground">{payment.reconciled ? "Yes" : "Not yet"}</span></div>
                {bankAccount && (
                  <div className="pt-2 border-t border-border">
                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                      <Link href={`/finance/banking/bank-accounts/${bankAccount.id}`}>{bankAccount.account_name} · {bankAccount.bank_name}</Link>
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BookOpen className="size-4" /> Accounting</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!payment.journal_entry_id ? (
              <p className="text-xs text-muted-foreground italic">No journal entry linked to this payment.</p>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Journal Entry</span><span className="text-foreground font-mono text-xs">{journalEntry?.entry_number ?? payment.journal_entry_id.slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Posting Status</span>{journalEntry ? <StatusBadge status={journalEntry.status} /> : "—"}</div>
                <div className="pt-2 border-t border-border space-y-1">
                  {journalLines.map((l) => (
                    <div key={l.id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{Number(l.debit_amount) > 0 ? "Debit" : "Credit"} · {l.account_code} {l.account_name}</span>
                      <span className="font-medium text-foreground">{formatCurrency(Number(l.debit_amount) > 0 ? Number(l.debit_amount) : Number(l.credit_amount), payment.currency)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Activity</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No recorded activity for this payment.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a) => (
                <li key={a.id} className="flex justify-between border-b border-border pb-2 last:border-0 text-sm">
                  <span className="text-foreground">{a.description}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">{formatDate(a.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>

    <Dialog open={reverseOpen} onOpenChange={(o) => { if (!reversing) { setReverseOpen(o); if (!o) setReverseReason(""); } }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader><DialogTitle>Reverse Payment?</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-sm space-y-1">
            <p className="font-mono font-bold text-foreground">{payment.payment_number ?? payment.id}</p>
            <p className="text-muted-foreground">{payment.counterparty_name}</p>
            <p className="font-bold text-foreground">{formatCurrency(payment.amount, payment.currency)}</p>
            {singleInvoice && <p className="text-xs text-muted-foreground">{singleInvoice.invoice_number}</p>}
          </div>
          <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
            <li>Reverses the accounting entry (a new journal entry, not an edit to the original)</li>
            <li>Removes this payment&apos;s effect on the bank balance</li>
            <li>Restores the outstanding balance on any invoice(s) it was allocated to</li>
            <li>Preserves the original payment in history, marked as voided</li>
          </ul>
          <div className="space-y-1">
            <Label className="text-xs">Reason (optional)</Label>
            <Input value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="e.g. recorded in error" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setReverseOpen(false)} disabled={reversing}>Cancel</Button>
            <Button onClick={reversePayment} disabled={reversing} variant="destructive" className="gap-2">
              {reversing ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Reverse Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
