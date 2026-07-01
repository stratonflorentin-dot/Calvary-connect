"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sidebar } from "@/components/navigation/sidebar";
import { FinanceSidebar } from "@/components/finance/finance-sidebar";
import { useRole } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { Building2, DollarSign, Filter, Plus, RefreshCw, Search, Trash2, FileText, CheckCircle2 } from "lucide-react";
import { formatDate, formatAmount } from "@/lib/utils";

const CURRENCIES = {
  TZS: { code: "TZS", symbol: "TSh", flag: "🇹🇿" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺" },
};

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  overdue: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

export default function CustomerInvoicesPage() {
  const { role } = useRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [modal, setModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    customer_name: "",
    invoice_number: "",
    amount: "",
    currency: "TZS",
    due_date: "",
    description: "",
    category: "",
  });

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("type", "receivable")
        .order("due_date", { ascending: true });
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error("Error loading customer invoices:", err);
      toast({ title: "Error", description: "Failed to load customer invoices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const saveInvoice = async () => {
    if (!invoiceForm.customer_name || !invoiceForm.invoice_number || !invoiceForm.amount || !invoiceForm.due_date) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (parseFloat(invoiceForm.amount) <= 0) {
      toast({ title: "Validation Error", description: "Amount must be greater than 0", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("invoices").insert({
        customer_name: invoiceForm.customer_name,
        invoice_number: invoiceForm.invoice_number,
        amount: parseFloat(invoiceForm.amount),
        currency: invoiceForm.currency,
        due_date: invoiceForm.due_date,
        description: invoiceForm.description,
        category: invoiceForm.category,
        status: "pending",
        type: "receivable",
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadInvoices();
      setModal(null);
      setInvoiceForm({
        customer_name: "",
        invoice_number: "",
        amount: "",
        currency: "TZS",
        due_date: "",
        description: "",
        category: "",
      });
      toast({ title: "Success", description: "Customer invoice created successfully" });
    } catch (err) {
      console.error("Error saving customer invoice:", err);
      toast({ title: "Error", description: "Failed to create customer invoice", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    try {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
      await loadInvoices();
      toast({ title: "Success", description: "Customer invoice deleted successfully" });
    } catch (err) {
      console.error("Error deleting invoice:", err);
      toast({ title: "Error", description: "Failed to delete invoice", variant: "destructive" });
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase.from("invoices").update({
        status: "paid",
        paid_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      await loadInvoices();
      toast({ title: "Success", description: "Invoice marked as paid" });
    } catch (err) {
      console.error("Error marking invoice as paid:", err);
      toast({ title: "Error", description: "Failed to mark invoice as paid", variant: "destructive" });
    }
  };

  const filteredInvoices = invoices.filter((i) => {
    const matchesSearch = !search || 
      i.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCurrency = filterCurrency === "ALL" || i.currency === filterCurrency;
    const matchesStatus = filterStatus === "ALL" || i.status === filterStatus;
    return matchesSearch && matchesCurrency && matchesStatus;
  });

  const totalInvoices = filteredInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  const pendingInvoices = filteredInvoices.filter((i) => i.status === "pending").length;
  const overdueInvoices = filteredInvoices.filter((i) => {
    if (i.status !== "pending") return false;
    const dueDate = new Date(i.due_date);
    return dueDate < new Date();
  }).length;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="flex flex-1">
        <FinanceSidebar />
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Customer Invoices</h1>
                <p className="text-muted-foreground">Manage accounts receivable and customer invoices</p>
              </div>
              <Button className="gap-2" onClick={() => setModal("new")}>
                <Plus className="size-4" />
                Add Invoice
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="size-4" />
                    Total Receivable
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{formatAmount(totalInvoices, "TZS")}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="size-4" />
                    Pending Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{pendingInvoices}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
                    <Filter className="size-4" />
                    Overdue Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-600">{overdueInvoices}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border border-border">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9 w-64" placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Currencies</SelectItem>
                        {Object.values(CURRENCIES).map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadInvoices}>
                    <RefreshCw className="size-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-16 text-center">
                            <RefreshCw className="mx-auto size-8 text-muted-foreground animate-spin mb-3" />
                            <p className="text-muted-foreground">Loading invoices...</p>
                          </TableCell>
                        </TableRow>
                      ) : filteredInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-16 text-center">
                            <EmptyState icon={Building2} title="No customer invoices" description="Add your first invoice to get started" />
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInvoices.map((invoice) => {
                          const isOverdue = invoice.status === "pending" && new Date(invoice.due_date) < new Date();
                          const status = isOverdue ? "overdue" : invoice.status;
                          return (
                            <TableRow key={invoice.id} className="hover:bg-muted/50 transition-colors">
                              <TableCell className="font-semibold text-foreground">
                                {invoice.invoice_number}
                              </TableCell>
                              <TableCell className="text-foreground font-medium">
                                {invoice.customer_name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{invoice.category || "General"}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground font-medium whitespace-nowrap">
                                {formatDate(invoice.due_date)}
                              </TableCell>
                              <TableCell className="font-bold text-emerald-700 dark:text-emerald-400 text-right whitespace-nowrap">
                                {formatAmount(invoice.amount, invoice.currency)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-medium">
                                  {CURRENCIES[invoice.currency as keyof typeof CURRENCIES]?.flag || ""} {invoice.currency}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={STATUS_STYLES[status] || STATUS_STYLES.pending} className="capitalize">
                                  {status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  {invoice.status === "pending" && (
                                    <Button variant="ghost" size="sm" onClick={() => markAsPaid(invoice.id)}>
                                      <CheckCircle2 className="size-4 mr-1" />
                                      Mark Paid
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => deleteInvoice(invoice.id)}>
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

            {modal === "new" && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="w-full max-w-md mx-4">
                  <CardHeader>
                    <CardTitle>Add Customer Invoice</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer">Customer Name</Label>
                      <Input id="customer" placeholder="Customer name" value={invoiceForm.customer_name} onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice-number">Invoice Number</Label>
                      <Input id="invoice-number" placeholder="INV-001" value={invoiceForm.invoice_number} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_number: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Amount</Label>
                        <Input id="amount" type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Select value={invoiceForm.currency} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, currency: value })}>
                          <SelectTrigger id="currency">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(CURRENCIES).map((c) => (
                              <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input id="category" placeholder="Transport, Services, etc." value={invoiceForm.category} onChange={(e) => setInvoiceForm({ ...invoiceForm, category: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="due-date">Due Date</Label>
                      <Input id="due-date" type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Input id="description" placeholder="Invoice description" value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="outline" onClick={() => setModal(null)} disabled={submitting}>Cancel</Button>
                      <Button onClick={saveInvoice} disabled={submitting}>
                        {submitting ? "Saving..." : "Save Invoice"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
