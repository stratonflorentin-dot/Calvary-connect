"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, ArrowLeft, RefreshCw, Plus, Receipt, Send } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";
import { normalizeCurrency, REPORTING_CURRENCY } from "@/lib/finance/multi-currency";

const VAT_RATE = 0.18;

type CreditNote = {
  id: string;
  credit_note_number: string | null;
  customer_id: string | null;
  customer_name: string;
  original_invoice_id: string | null;
  amount: number;
  vat_amount: number;
  total_amount: number;
  currency: string;
  issue_date: string;
  reason: string | null;
  status: "draft" | "issued" | "voided";
  description: string | null;
};

type Invoice = {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  total_amount: number;
  currency: string;
  status: string;
};

export default function CreditNotesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [modal, setModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);

  const [form, setForm] = useState({
    customer_name: "",
    original_invoice_id: "",
    amount: "",
    vat_applicable: true,
    currency: "TZS",
    issue_date: new Date().toISOString().split("T")[0],
    reason: "correction",
    description: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [notesRes, invoicesRes] = await Promise.all([
        supabase.from("credit_notes").select("*").order("created_at", { ascending: false }),
        supabase.from("invoices").select("id, invoice_number, customer_id, customer_name, total_amount, currency, status")
          .not("invoice_number", "ilike", "CN-%")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      if (notesRes.error) throw notesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      setCreditNotes((notesRes.data as any) ?? []);
      setInvoices((invoicesRes.data as any) ?? []);
    } catch (err: any) {
      toast({ title: "Error loading credit notes", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pickInvoice = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    setForm((f) => ({
      ...f,
      original_invoice_id: invoiceId,
      customer_name: inv?.customer_name || f.customer_name,
      currency: inv?.currency || f.currency,
    }));
  };

  const saveCreditNote = async () => {
    const amount = parseFloat(form.amount);
    if (!form.customer_name || !amount || amount <= 0) {
      toast({ title: "Validation error", description: "Customer name and a positive amount are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const vatAmount = form.vat_applicable ? Math.round(amount * VAT_RATE) : 0;
      const { error } = await supabase.from("credit_notes").insert({
        customer_name: form.customer_name,
        original_invoice_id: form.original_invoice_id || null,
        amount,
        vat_amount: vatAmount,
        total_amount: amount + vatAmount,
        currency: form.currency,
        issue_date: form.issue_date,
        reason: form.reason,
        description: form.description || null,
        status: "draft",
      });
      if (error) throw error;

      toast({ title: "Draft credit note saved", description: "Post it to the ledger when ready." });
      setModal(false);
      setForm({
        customer_name: "", original_invoice_id: "", amount: "", vat_applicable: true,
        currency: "TZS", issue_date: new Date().toISOString().split("T")[0], reason: "correction", description: "",
      });
      load();
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const postCreditNote = async (note: CreditNote) => {
    setPosting(note.id);
    try {
      const { error } = await supabase.rpc("post_credit_note", { p_id: note.id });
      if (error) throw error;
      toast({ title: "Posted to ledger", description: `${note.credit_note_number ?? "Credit note"} reduced Accounts Receivable.` });
      load();
    } catch (err: any) {
      toast({ title: "Failed to post", description: err.message, variant: "destructive" });
    } finally {
      setPosting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "issued":
        return <Badge className="bg-success/10 text-success border-success/20">Issued</Badge>;
      case "voided":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Voided</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-muted">Draft</Badge>;
    }
  };

  // formatAmount() below has no currency arg, so it always renders these as
  // TZS — filtering to that currency here makes the label true instead of
  // silently blending every currency's credit notes into one TZS-labeled
  // number.
  const reportingCreditNotes = creditNotes.filter((n) => normalizeCurrency(n.currency) === REPORTING_CURRENCY);
  const totalCreditAmount = reportingCreditNotes.reduce((sum, n) => sum + n.total_amount, 0);
  const issuedCredit = reportingCreditNotes.filter((n) => n.status === "issued").reduce((sum, n) => sum + n.total_amount, 0);
  const draftCredit = reportingCreditNotes.filter((n) => n.status === "draft").reduce((sum, n) => sum + n.total_amount, 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <Button onClick={load} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Credit Notes</h1>
        <p className="text-muted-foreground">Issue credit notes against invoices — posts Dr Sales Returns / Dr VAT Payable / Cr Accounts Receivable when posted to the ledger.</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Dialog open={modal} onOpenChange={setModal}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> New Credit Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Credit Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Original Invoice (optional)</Label>
                <Select value={form.original_invoice_id} onValueChange={pickInvoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} — {invoice.customer_name} ({formatAmount(invoice.total_amount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (excl. VAT) *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="vat" checked={form.vat_applicable} onCheckedChange={(v) => setForm({ ...form, vat_applicable: !!v })} />
                <Label htmlFor="vat" className="cursor-pointer">VAT applicable (18%)</Label>
              </div>
              {form.amount && (
                <p className="text-xs text-muted-foreground">
                  Total credit: {formatAmount(parseFloat(form.amount) * (form.vat_applicable ? 1 + VAT_RATE : 1))}
                </p>
              )}
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={form.reason} onValueChange={(value) => setForm({ ...form, reason: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                    <SelectItem value="return">Goods Return</SelectItem>
                    <SelectItem value="correction">Correction</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
                <Button onClick={saveCreditNote} disabled={submitting}>
                  {submitting ? "Saving…" : "Save draft"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Credit Amount</p>
            </div>
            <p className="text-2xl font-bold text-primary">{formatAmount(totalCreditAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="size-4 text-success" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Posted to Ledger</p>
            </div>
            <p className="text-2xl font-bold text-success">{formatAmount(issuedCredit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Draft (not yet posted)</p>
            </div>
            <p className="text-2xl font-bold text-warning">{formatAmount(draftCredit)}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" /> Credit Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credit Note #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Original Invoice</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No credit notes found
                    </TableCell>
                  </TableRow>
                ) : (
                  creditNotes.map((note) => {
                    const originalInvoice = invoices.find((i) => i.id === note.original_invoice_id);
                    return (
                      <TableRow key={note.id}>
                        <TableCell className="font-medium">{note.credit_note_number ?? "—"}</TableCell>
                        <TableCell>{note.customer_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {originalInvoice ? originalInvoice.invoice_number : "-"}
                        </TableCell>
                        <TableCell>{formatDate(note.issue_date)}</TableCell>
                        <TableCell className="capitalize">{note.reason}</TableCell>
                        <TableCell>{getStatusBadge(note.status)}</TableCell>
                        <TableCell className="font-medium text-primary">{formatAmount(note.total_amount)}</TableCell>
                        <TableCell>
                          {note.status === "draft" && (
                            <Button variant="outline" size="sm" onClick={() => postCreditNote(note)} disabled={posting === note.id}>
                              <Send className="size-3.5 mr-1.5" />
                              {posting === note.id ? "Posting…" : "Post to ledger"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
