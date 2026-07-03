"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, DollarSign, FileText, Plus, RefreshCw, Search } from "lucide-react";

const CURRENCIES = ["TZS", "USD", "EUR", "KES"];

const fmt = (v: number, cur = "TZS") =>
  new Intl.NumberFormat("en-TZ", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  overdue: "bg-red-500/10 text-red-700 border-red-500/20",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function CustomerInvoicesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [modal, setModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customer_name: "", invoice_number: "", amount: "", vat_rate: "18",
    currency: "TZS", due_date: "", description: "", payment_terms: "30 days",
  });

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (err: any) {
      console.error("Invoices load error:", err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInvoices(); }, []);

  const saveInvoice = async () => {
    if (!form.customer_name || !form.amount || !form.due_date) {
      toast({ title: "Validation Error", description: "Customer name, amount and due date are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const amount = parseFloat(form.amount) || 0;
      const vatRate = parseFloat(form.vat_rate) || 0;
      const vatAmount = amount * (vatRate / 100);
      const totalAmount = amount + vatAmount;
      const invoiceNum = form.invoice_number || `INV-${Date.now().toString().slice(-8)}`;

      const { error } = await supabase.from("invoices").insert({
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
      });
      if (error) throw error;
      await loadInvoices();
      setModal(false);
      setForm({ customer_name: "", invoice_number: "", amount: "", vat_rate: "18", currency: "TZS", due_date: "", description: "", payment_terms: "30 days" });
      toast({ title: "Invoice created successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to create invoice", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Invoice marked as paid" });
    loadInvoices();
  };

  const filtered = invoices.filter(inv => {
    const s = search.toLowerCase();
    const matchSearch = !s || inv.customer_name?.toLowerCase().includes(s) || inv.invoice_number?.toLowerCase().includes(s) || inv.client_name?.toLowerCase().includes(s);
    const isOverdue = inv.status === "pending" && inv.due_date && new Date(inv.due_date) < new Date();
    const effectiveStatus = isOverdue ? "overdue" : inv.status;
    const matchStatus = filterStatus === "ALL" || effectiveStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalReceivable = filtered.filter(i => i.status !== "paid").reduce((s, i) => s + (i.total_amount || i.amount || 0), 0);
  const pendingCount = filtered.filter(i => i.status === "pending").length;
  const paidCount = filtered.filter(i => i.status === "paid").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage accounts receivable and customer billing</p>
        </div>
        <Button className="gap-2" onClick={() => setModal(true)}>
          <Plus className="size-4" /> New Invoice
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><DollarSign className="size-4" /> Total Receivable</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{fmt(totalReceivable)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><FileText className="size-4" /> Pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{pendingCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><CheckCircle2 className="size-4" /> Paid</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600">{paidCount}</p></CardContent>
        </Card>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadInvoices}><RefreshCw className="size-4 mr-2" />Refresh</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="py-16 text-center text-muted-foreground">Loading invoices…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-16 text-center">
                    <FileText className="mx-auto size-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground text-sm">No invoices found. Create your first invoice above.</p>
                  </TableCell></TableRow>
                ) : filtered.map(inv => {
                  const isOverdue = inv.status === "pending" && inv.due_date && new Date(inv.due_date) < new Date();
                  const effectiveStatus = isOverdue ? "overdue" : (inv.status || "pending");
                  return (
                    <TableRow key={inv.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm font-semibold">{inv.invoice_number}</TableCell>
                      <TableCell className="font-medium">{inv.customer_name || inv.client_name}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className={`text-sm ${isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(inv.amount || 0, inv.currency)}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">{fmt(inv.vat_amount || 0, inv.currency)}</TableCell>
                      <TableCell className="text-right font-bold">{fmt(inv.total_amount || inv.amount || 0, inv.currency)}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[effectiveStatus] || STATUS_COLORS.pending}>{effectiveStatus}</Badge>
                      </TableCell>
                      <TableCell>
                        {inv.status !== "paid" && (
                          <Button variant="ghost" size="sm" onClick={() => markAsPaid(inv.id)}>
                            <CheckCircle2 className="size-4 text-emerald-600 mr-1" /> Mark Paid
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Invoice Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader><CardTitle>Create New Invoice</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Customer Name *</Label>
                <Input placeholder="e.g. Dangote Cement Tanzania" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Invoice Number</Label>
                <Input placeholder="INV-001 (auto-generated if blank)" value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Amount (excl. VAT) *</Label>
                  <Input type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>VAT Rate (%)</Label>
                  <Input type="number" placeholder="18" value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: e.target.value })} />
                </div>
              </div>
              {form.amount && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{fmt(parseFloat(form.amount) || 0, form.currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">VAT ({form.vat_rate}%):</span><span>{fmt((parseFloat(form.amount) || 0) * (parseFloat(form.vat_rate) || 0) / 100, form.currency)}</span></div>
                  <div className="flex justify-between font-bold border-t border-border mt-2 pt-2"><span>Total:</span><span>{fmt((parseFloat(form.amount) || 0) * (1 + (parseFloat(form.vat_rate) || 0) / 100), form.currency)}</span></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Payment Terms</Label>
                  <Select value={form.payment_terms} onValueChange={v => setForm({ ...form, payment_terms: v })}>
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
                <Label>Due Date *</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Description / Notes</Label>
                <Textarea placeholder="Invoice description, services rendered, etc." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setModal(false)} disabled={submitting}>Cancel</Button>
                <Button onClick={saveInvoice} disabled={submitting}>{submitting ? "Creating..." : "Create Invoice"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
