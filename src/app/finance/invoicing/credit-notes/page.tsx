"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, ArrowLeft, RefreshCw, Plus, Trash2, Edit2, Receipt } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";

type CreditNote = {
  id?: string;
  credit_note_number: string;
  customer_name: string;
  original_invoice_id?: string;
  amount: number;
  currency: string;
  issue_date: string;
  reason: string;
  status: "draft" | "issued" | "applied";
  description: string;
};

type Invoice = {
  id: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  currency: string;
  status: string;
};

export default function CreditNotesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [creditNoteForm, setCreditNoteForm] = useState({
    credit_note_number: "",
    customer_name: "",
    original_invoice_id: "",
    amount: "",
    currency: "TZS",
    issue_date: "",
    reason: "",
    status: "draft" as const,
    description: "",
  });

  const [editingCreditNote, setEditingCreditNote] = useState<CreditNote | null>(null);

  const loadCreditNotes = async () => {
    setLoading(true);
    try {
      const [notesData, invoicesData] = await Promise.all([
        supabase.from("credit_notes").select("*").order("issue_date", { ascending: false }),
        supabase.from("invoices").select("*").eq("status", "paid"),
      ]);

      setCreditNotes(notesData.data || []);
      setInvoices(invoicesData.data || []);
    } catch (err) {
      console.error("Error loading credit notes:", err);
      toast({ title: "Error", description: "Failed to load credit notes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCreditNotes();
  }, []);

  const saveCreditNote = async () => {
    if (!creditNoteForm.credit_note_number || !creditNoteForm.customer_name || !creditNoteForm.amount) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const noteData: CreditNote = {
        credit_note_number: creditNoteForm.credit_note_number,
        customer_name: creditNoteForm.customer_name,
        original_invoice_id: creditNoteForm.original_invoice_id || undefined,
        amount: parseFloat(creditNoteForm.amount),
        currency: creditNoteForm.currency,
        issue_date: creditNoteForm.issue_date,
        reason: creditNoteForm.reason,
        status: creditNoteForm.status,
        description: creditNoteForm.description,
      };

      let error;
      if (editingCreditNote?.id) {
        error = (await supabase.from("credit_notes").update(noteData).eq("id", editingCreditNote.id)).error;
      } else {
        error = (await supabase.from("credit_notes").insert(noteData)).error;
      }

      if (error) throw error;

      await loadCreditNotes();
      setModal(null);
      setCreditNoteForm({
        credit_note_number: "",
        customer_name: "",
        original_invoice_id: "",
        amount: "",
        currency: "TZS",
        issue_date: "",
        reason: "",
        status: "draft",
        description: "",
      });
      setEditingCreditNote(null);
      toast({ title: "Success", description: editingCreditNote ? "Credit note updated" : "Credit note created" });
    } catch (err) {
      console.error("Error saving credit note:", err);
      toast({ title: "Error", description: "Failed to save credit note", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCreditNote = async (id: string) => {
    if (!confirm("Are you sure you want to delete this credit note?")) return;

    try {
      const { error } = await supabase.from("credit_notes").delete().eq("id", id);
      if (error) throw error;
      await loadCreditNotes();
      toast({ title: "Success", description: "Credit note deleted" });
    } catch (err) {
      console.error("Error deleting credit note:", err);
      toast({ title: "Error", description: "Failed to delete credit note", variant: "destructive" });
    }
  };

  const editCreditNote = (note: CreditNote) => {
    setEditingCreditNote(note);
    setCreditNoteForm({
      credit_note_number: note.credit_note_number,
      customer_name: note.customer_name,
      original_invoice_id: note.original_invoice_id || "",
      amount: String(note.amount),
      currency: note.currency,
      issue_date: note.issue_date,
      reason: note.reason,
      status: note.status,
      description: note.description,
    });
    setModal("creditNote");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "issued":
        return <Badge className="bg-success/10 text-success border-success/20">Issued</Badge>;
      case "applied":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Applied</Badge>;
      case "draft":
        return <Badge className="bg-muted/10 text-muted-foreground border-muted/20">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalCreditAmount = creditNotes.reduce((sum, n) => sum + n.amount, 0);
  const appliedCredit = creditNotes.filter((n) => n.status === "applied").reduce((sum, n) => sum + n.amount, 0);
  const pendingCredit = creditNotes.filter((n) => n.status === "draft").reduce((sum, n) => sum + n.amount, 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <Button onClick={loadCreditNotes} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Credit Notes</h1>
        <p className="text-muted-foreground">Manage credit notes for refunds and invoice adjustments</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Dialog open={modal === "creditNote"} onOpenChange={(open) => setModal(open ? "creditNote" : null)}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> New Credit Note
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingCreditNote ? "Edit Credit Note" : "New Credit Note"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Credit Note #</Label>
                  <Input value={creditNoteForm.credit_note_number} onChange={(e) => setCreditNoteForm({ ...creditNoteForm, credit_note_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={creditNoteForm.status} onValueChange={(value: any) => setCreditNoteForm({ ...creditNoteForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="issued">Issued</SelectItem>
                      <SelectItem value="applied">Applied</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input value={creditNoteForm.customer_name} onChange={(e) => setCreditNoteForm({ ...creditNoteForm, customer_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Original Invoice (Optional)</Label>
                <Select value={creditNoteForm.original_invoice_id} onValueChange={(value) => setCreditNoteForm({ ...creditNoteForm, original_invoice_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoice_number} - {invoice.customer_name} ({formatAmount(invoice.amount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={creditNoteForm.amount} onChange={(e) => setCreditNoteForm({ ...creditNoteForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <Input type="date" value={creditNoteForm.issue_date} onChange={(e) => setCreditNoteForm({ ...creditNoteForm, issue_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={creditNoteForm.reason} onValueChange={(value) => setCreditNoteForm({ ...creditNoteForm, reason: value })}>
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
                <Input value={creditNoteForm.description} onChange={(e) => setCreditNoteForm({ ...creditNoteForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setModal(null); setEditingCreditNote(null); }}>Cancel</Button>
                <Button onClick={saveCreditNote} disabled={submitting}>
                  {submitting ? "Saving..." : editingCreditNote ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
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
              <p className="text-xs font-medium text-muted-foreground uppercase">Applied Credit</p>
            </div>
            <p className="text-2xl font-bold text-success">{formatAmount(appliedCredit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Pending Credit</p>
            </div>
            <p className="text-2xl font-bold text-warning">{formatAmount(pendingCredit)}</p>
          </CardContent>
        </Card>
      </section>

      {/* Credit Notes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" /> Credit Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credit Note #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Original Invoice</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
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
                        <TableCell className="font-medium">{note.credit_note_number}</TableCell>
                        <TableCell>{note.customer_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {originalInvoice ? originalInvoice.invoice_number : "-"}
                        </TableCell>
                        <TableCell>{formatDate(note.issue_date)}</TableCell>
                        <TableCell className="capitalize">{note.reason}</TableCell>
                        <TableCell>{getStatusBadge(note.status)}</TableCell>
                        <TableCell className="font-medium text-primary">{formatAmount(note.amount)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => editCreditNote(note)}>
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteCreditNote(note.id!)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
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
