"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/components/ui/currency-badge";
import { postJournalEntry } from "@/lib/finance/journal";
import { createCustomerPayment } from "@/lib/finance/customer-payment";
import { getRate } from "@/lib/finance/fx";
import { TRAInvoiceDialog } from "@/components/financial/tra-invoice-dialog";
import { AuditTrailService } from "@/services/audit-trail-service";
import { useSupabase } from "@/components/supabase-provider";
import { useRole } from "@/hooks/use-role";
import { EntityHeader } from "@/components/shell";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Download, Loader2, AlertTriangle, Ban, Send, X,
} from "lucide-react";

const fmt = (v: number, cur = "TZS") => formatCurrency(v, cur);

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning border-warning/20" },
  sent: { label: "Sent — Awaiting Payment", className: "bg-info/10 text-info border-info/20" },
  partial: { label: "Partial Payment", className: "bg-info/10 text-info border-info/20" },
  paid: { label: "Paid", className: "bg-success/10 text-success border-success/20" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive border-destructive/20" },
  unpaid: { label: "Unpaid", className: "bg-warning/10 text-warning border-warning/20" },
  cancelled: { label: "Void", className: "bg-muted text-muted-foreground border-border" },
};

export default function CustomerInvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { hasPermission } = useRole();
  const { user } = useSupabase();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [sourceProforma, setSourceProforma] = useState<any | null>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [printing, setPrinting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payBankAccountId, setPayBankAccountId] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
    setInvoice(inv);
    if (inv?.proforma_invoice_id) {
      const { data: pf } = await supabase.from("proforma_invoices").select("id, proforma_number").eq("id", inv.proforma_invoice_id).maybeSingle();
      setSourceProforma(pf);
    } else {
      setSourceProforma(null);
    }
    if (inv?.customer_id) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", inv.customer_id).maybeSingle();
      setCustomer(c);
    } else {
      setCustomer(null);
    }
    // Invoices can be paid through either of this app's two payment paths —
    // the Record Payment button below (writes bank_transactions directly)
    // or /finance/transactions/payments (writes payments + payment_allocations,
    // see supabase/migrations/125_payment_bank_transaction_linking.sql). Show
    // both so the accountant sees the full trail regardless of which was used.
    const [{ data: pays }, { data: allocations }] = await Promise.all([
      supabase
        .from("bank_transactions")
        .select("id, transaction_date, description, reference, credit, currency")
        .eq("reference_type", "invoice")
        .eq("reference_id", id)
        .order("transaction_date", { ascending: true }),
      supabase
        .from("payment_allocations")
        .select("amount, payments(id, payment_number, payment_date, method, currency, reference, transaction_reference, status, bank_account_id, bank_accounts(account_name, bank_name))")
        .eq("invoice_id", id),
    ]);
    const paymentRows = (allocations ?? [])
      .map((a: any) => a.payments)
      .filter(Boolean)
      .map((p: any) => ({
        id: `pay-${p.id}`,
        transaction_date: p.payment_date,
        description: p.bank_accounts ? `${p.bank_accounts.account_name} — ${p.bank_accounts.bank_name}` : (p.method ?? "Payment"),
        reference: p.payment_number,
        transaction_reference: p.transaction_reference,
        credit: (allocations ?? []).find((a: any) => a.payments?.id === p.id)?.amount ?? 0,
        currency: p.currency,
        status: p.status,
        source: "payments" as const,
      }));
    const bankTxnRows = (pays ?? []).map((p: any) => ({ ...p, transaction_reference: p.reference, status: null, source: "bank_transactions" as const }));
    setPayments([...paymentRows, ...bankTxnRows].sort((a, b) => String(a.transaction_date).localeCompare(String(b.transaction_date))));
    const { data: banks } = await supabase.from("bank_accounts").select("id, account_name, bank_name, currency, current_balance, is_active").eq("is_active", true);
    setBankAccounts(banks ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  useEffect(() => {
    if (!invoice || !invoice.currency || invoice.currency === "TZS") { setFxRate(null); return; }
    getRate(invoice.currency, "TZS").then(setFxRate).catch(() => setFxRate(null));
  }, [invoice?.currency]);

  const canManage = hasPermission(["CEO", "ADMIN", "ACCOUNTANT"]);

  const sendInvoice = async () => {
    if (!invoice) return;
    setBusy(true);
    try {
      await postJournalEntry({ type: "invoice_sent", invoiceId: invoice.id });
      await AuditTrailService.logUpdate("finance", "invoice", invoice.id, { status: invoice.status }, { status: "sent" }, user?.id, `Invoice ${invoice.invoice_number} sent`);
      toast({ variant: "success", title: "Invoice sent", description: "Posted to the ledger and locked." });
      load();
    } catch (err: any) {
      toast({ title: "Failed to send", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const voidInvoice = async () => {
    if (!invoice) return;
    if (!window.confirm(`Void ${invoice.invoice_number}? This cancels the invoice — it stays on record but is no longer collectible. Corrections to a sent invoice go through a Credit Note instead.`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", invoice.id);
      if (error) throw error;
      await AuditTrailService.logUpdate("finance", "invoice", invoice.id, { status: invoice.status }, { status: "cancelled" }, user?.id, `Invoice ${invoice.invoice_number} voided`);
      toast({ variant: "success", title: "Invoice voided" });
      load();
    } catch (err: any) {
      toast({ title: "Couldn't void invoice", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const submitDispute = async () => {
    if (!invoice) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("invoices").update({
        disputed: true, dispute_reason: disputeReason || null, disputed_at: new Date().toISOString(), disputed_by: user?.id,
      }).eq("id", invoice.id);
      if (error) throw error;
      await AuditTrailService.logUpdate("finance", "invoice", invoice.id, { disputed: false }, { disputed: true, reason: disputeReason }, user?.id, `Invoice ${invoice.invoice_number} disputed: ${disputeReason || "no reason given"}`);
      toast({ variant: "success", title: "Marked as disputed" });
      setDisputing(false);
      setDisputeReason("");
      load();
    } catch (err: any) {
      toast({ title: "Couldn't record dispute", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const resolveDispute = async () => {
    if (!invoice) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("invoices").update({ disputed: false }).eq("id", invoice.id);
      if (error) throw error;
      await AuditTrailService.logUpdate("finance", "invoice", invoice.id, { disputed: true }, { disputed: false }, user?.id, `Dispute resolved on ${invoice.invoice_number}`);
      toast({ variant: "success", title: "Dispute resolved" });
      load();
    } catch (err: any) {
      toast({ title: "Couldn't resolve dispute", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async () => {
    if (!invoice) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    if (!payBankAccountId) { toast({ title: "Choose which account received this payment", variant: "destructive" }); return; }
    if (!invoice.customer_id) { toast({ title: "This invoice has no linked customer record", variant: "destructive" }); return; }
    const total = Number(invoice.total_payable ?? invoice.total_amount ?? 0);
    const prevPaid = Number(invoice.paid_amount ?? 0);
    const currency = invoice.currency || "TZS";

    setBusy(true);
    try {
      // Same canonical path /finance/transactions/payments uses — creates a
      // real payments + payment_allocations record (not just an invoice
      // field flip + a bare journal entry), so a payment recorded from here
      // shows up in the Payments list, is matchable by findPaymentMatches,
      // and is reconcilable through the existing bank-statement workflow.
      const result = await createCustomerPayment({
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        bankAccountId: payBankAccountId,
        amount: amt,
        currency,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: payMethod,
        allocations: [{
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          invoiceCurrency: currency,
          invoiceTotal: total,
          invoicePaidAmount: prevPaid,
          amount: amt,
        }],
        createdBy: user?.id,
      });
      const newPaid = prevPaid + result.allocatedTotal;
      toast({ variant: newPaid >= total - 0.01 ? "success" : "default", title: newPaid >= total - 0.01 ? "Fully paid" : "Partial payment recorded", description: `${fmt(amt, currency)} · balance ${fmt(Math.max(0, total - newPaid), currency)}` });
      setPaying(false);
      setPayAmount("");
      setPayBankAccountId("");
      load();
    } catch (err: any) {
      toast({ title: "Payment failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!invoice) return <div className="p-8 text-center text-muted-foreground">Invoice not found.</div>;

  const currency = invoice.currency || "TZS";
  const subtotal = Number(invoice.amount ?? invoice.subtotal) || 0;
  const vat = Number(invoice.vat_amount) || 0;
  const total = Number(invoice.total_payable ?? invoice.total_amount) || 0;
  const paidAmount = Number(invoice.paid_amount) || 0;
  const balance = total - paidAmount;
  const progress = total > 0 ? Math.min(100, (paidAmount / total) * 100) : 0;
  const zeroRated = invoice.vat_applicable === false;
  const locked = !["draft", "pending"].includes(invoice.status);
  const statusMeta = STATUS_META[invoice.status] ?? STATUS_META.pending;
  const lines: any[] = Array.isArray(invoice.line_items) && invoice.line_items.length
    ? invoice.line_items
    : [{ description: invoice.description || "Services rendered", item_type_label: null, quantity: 1, duration_days: null, unit_price: subtotal, line_total: subtotal }];

  return (
    <>
      <div className="space-y-6 pb-8 pb-safe-bottom">
        <EntityHeader
          crumbs={[
            { label: "Finance", href: "/finance" },
            { label: "Invoices", href: "/finance/invoicing/customer-invoices" },
            { label: invoice.invoice_number },
          ]}
          eyebrow="Invoice"
          title={invoice.invoice_number}
          subtitle={invoice.customer_name ?? invoice.client_name ?? "—"}
          status={invoice.status}
          statusLabel={statusMeta.label}
          badges={
            <>
              {zeroRated && <Badge variant="outline" className="bg-success/10 text-success border-success/20">Zero Rated</Badge>}
              {currency !== "TZS" && <Badge variant="outline" className="bg-info/10 text-info border-info/20">{currency}{fxRate ? ` — @ ${fxRate.toLocaleString()} TZS` : ""}</Badge>}
              {invoice.disputed && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1"><AlertTriangle className="size-3" /> Disputed</Badge>}
            </>
          }
          primaryMetricLabel="Total"
          primaryMetricValue={fmt(total, currency)}
          metadata={[
            { label: "Issued", value: invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
            { label: "Due", value: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
          ]}
          secondaryActions={
            <>
              {["draft", "pending"].includes(invoice.status) && canManage && (
                <Button size="sm" variant="outline" onClick={sendInvoice} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send
                </Button>
              )}
              {canManage && (
                invoice.disputed
                  ? <Button variant="outline" size="sm" onClick={resolveDispute} disabled={busy} className="gap-2 text-success border-success/30"><CheckCircle2 className="size-4" /> Resolve Dispute</Button>
                  : <Button variant="outline" size="sm" onClick={() => setDisputing(true)} disabled={busy || invoice.status === "cancelled"} className="gap-2 text-warning border-warning/30"><AlertTriangle className="size-4" /> Dispute</Button>
              )}
              {canManage && !["cancelled", "paid"].includes(invoice.status) && (
                <Button variant="outline" size="sm" onClick={voidInvoice} disabled={busy} className="gap-2 text-destructive border-destructive/30"><Ban className="size-4" /> Void</Button>
              )}
            </>
          }
          primaryAction={
            <Button size="sm" onClick={() => setPrinting(true)} className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              <Download className="size-4" /> Download PDF
            </Button>
          }
        />

          {disputing && (
            <div className="rounded-xl bg-warning/5 border border-warning/20 p-4 space-y-3">
              <Label className="text-xs">Reason for dispute</Label>
              <Textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={2} placeholder="What's being disputed and why..." />
              <div className="flex gap-2">
                <Button size="sm" onClick={submitDispute} disabled={busy} className="gap-2 bg-warning hover:bg-warning/90 text-warning-foreground">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Confirm Dispute
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setDisputing(false); setDisputeReason(""); }}>Cancel</Button>
              </div>
            </div>
          )}

          {locked && (
            <div className="rounded-xl bg-muted/30 border border-border p-3 text-xs text-muted-foreground">
              This invoice is locked and cannot be edited — it has been issued and is a finalized financial document. Corrections go through a{" "}
              <Link href="/finance/invoicing/credit-notes" className="underline font-bold text-foreground">Credit Note</Link> instead.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="font-black text-sm text-foreground">Invoice Items</h2>
                  <span className="text-xs text-muted-foreground">{lines.length} item{lines.length === 1 ? "" : "s"}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                    <tr><th className="px-4 py-2 text-left">Description</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Unit Price</th><th className="px-4 py-2 text-right">Days</th><th className="px-4 py-2 text-right">Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 py-2">
                          <p className="text-foreground">{l.description}</p>
                          {l.item_type_label && <p className="text-[11px] text-muted-foreground">{l.item_type_label}</p>}
                        </td>
                        <td className="px-4 py-2 text-right">{l.quantity ?? 1}</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(Number(l.unit_price) || 0, currency)}</td>
                        <td className="px-4 py-2 text-right">{l.duration_days || "—"}</td>
                        <td className="px-4 py-2 text-right font-mono font-bold">{fmt(Number(l.line_total) || 0, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 border-t border-border ml-auto max-w-xs space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Items Subtotal</span><span className="font-bold text-foreground">{fmt(subtotal, currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT {zeroRated ? "" : ""}</span><span className={cn("font-bold", zeroRated ? "text-success" : "text-foreground")}>{zeroRated ? "— 0%" : fmt(vat, currency)}</span></div>
                  <div className="flex justify-between font-black text-base pt-2 border-t border-border"><span>Total</span><span>{fmt(total, currency)}</span></div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="font-black text-sm text-foreground">Payment History</h2>
                  {!["cancelled"].includes(invoice.status) && balance > 0 && canManage && (
                    <Button size="sm" onClick={() => { setPaying(true); setPayAmount(String(balance)); }} className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                      + Record Payment
                    </Button>
                  )}
                </div>
                {payments.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">No payments recorded yet</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Reference</th>
                        <th className="px-4 py-2 text-left">Bank Transaction</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: any) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(p.transaction_date).toLocaleDateString()}</td>
                          <td className="px-4 py-2 text-foreground">
                            <p>{p.reference || "—"}</p>
                            <p className="text-[11px] text-muted-foreground">{p.description}</p>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                            {p.transaction_reference || <span className="italic">Not yet reconciled</span>}
                          </td>
                          <td className="px-4 py-2">
                            {p.status ? (
                              <Badge variant="outline" className="capitalize">{p.status}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-success">{fmt(Number(p.credit) || 0, p.currency || currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h2 className="font-black text-sm text-foreground">Payment Summary</h2>
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Progress</span><span>{progress.toFixed(1)}%</span></div>
                  <div className="w-full bg-muted rounded-full h-2"><div className="bg-success h-2 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Items Subtotal</span><span className="font-bold text-foreground">{fmt(subtotal, currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span className={cn("font-bold", zeroRated ? "text-success" : "text-foreground")}>{zeroRated ? "Zero Rated (0%)" : fmt(vat, currency)}</span></div>
                  <div className="flex justify-between font-black pt-2 border-t border-border"><span>Total</span><span>{fmt(total, currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span className="font-bold text-success">{fmt(paidAmount, currency)}</span></div>
                  <div className="flex justify-between font-black text-destructive pt-2 border-t border-border"><span>Balance Due</span><span>{fmt(balance, currency)}</span></div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h2 className="font-black text-sm text-foreground">Invoice Details</h2>
                <div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Client</p>
                  <p className="font-bold text-foreground">{invoice.customer_name ?? invoice.client_name ?? "—"}</p>
                  {customer?.vrn && <p className="text-xs text-muted-foreground">VRN: {customer.vrn}</p>}
                  {customer?.tax_id && <p className="text-xs text-muted-foreground">TIN: {customer.tax_id}</p>}
                  {(customer?.email || invoice.client_email) && <p className="text-xs text-muted-foreground">{customer?.email ?? invoice.client_email}</p>}
                  {(customer?.phone || invoice.client_phone) && <p className="text-xs text-muted-foreground">{customer?.phone ?? invoice.client_phone}</p>}
                  {(customer?.address || invoice.client_address) && <p className="text-xs text-muted-foreground">{customer?.address ?? invoice.client_address}</p>}
                </div>
                {invoice.trip_number && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Trip Ref</p><p className="text-foreground font-mono text-sm">{invoice.trip_number}</p></div>
                )}
                {sourceProforma && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Source Proforma</p>
                    <Link href={`/finance/invoicing/proforma-invoices/${sourceProforma.id}`} className="text-primary font-mono text-sm font-bold hover:underline">
                      {sourceProforma.proforma_number}
                    </Link>
                  </div>
                )}
                {invoice.payment_terms && (
                  <div><p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Payment Terms</p><p className="text-foreground text-sm">{invoice.payment_terms}</p></div>
                )}
                {invoice.disputed && (
                  <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-2">
                    <p className="text-[10px] font-bold uppercase text-destructive tracking-widest">Dispute Reason</p>
                    <p className="text-xs text-foreground">{invoice.dispute_reason || "No reason given"}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
      </div>

      {paying && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-black text-foreground">Record Payment</h3>
              <Button variant="ghost" size="icon" onClick={() => setPaying(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Amount ({currency})</Label>
                <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Deposited to</Label>
                <Select value={payBankAccountId} onValueChange={setPayBankAccountId}>
                  <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.filter((b) => b.currency === currency).map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.account_name} — {b.bank_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
              <Button variant="outline" onClick={() => setPaying(false)}>Cancel</Button>
              <Button onClick={recordPayment} disabled={busy} className="bg-success hover:bg-success/90 text-success-foreground gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {printing && (
        <TRAInvoiceDialog
          open={printing}
          mode="view"
          invoice={invoice}
          client={customer ? { company_name: customer.company_name, tin: customer.tax_id } : { company_name: invoice.customer_name }}
          onClose={() => setPrinting(false)}
          onSaved={() => { setPrinting(false); load(); }}
        />
      )}
    </>
  );
}
