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
import { useToast } from "@/hooks/use-toast";
import { CreditCard, DollarSign, Filter, Plus, RefreshCw, Search } from "lucide-react";
import { formatDate, formatAmount } from "@/lib/utils";

const CURRENCIES = {
  TZS: { code: "TZS", symbol: "TSh", flag: "🇹🇿" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺" },
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  cancelled: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

export default function PaymentsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [modal, setModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    invoice_id: "",
    amount: "",
    currency: "TZS",
    payment_method: "",
    payment_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const loadPayments = async () => {
    setLoading(true);
    try {
      const [paymentsData, invoicesData] = await Promise.all([
        supabase.from("payments").select("*").order("payment_date", { ascending: false }),
        supabase.from("invoices").select("*"),
      ]);
      if (paymentsData.error) throw paymentsData.error;
      if (invoicesData.error) throw invoicesData.error;
      setPayments(paymentsData.data || []);
      setInvoices(invoicesData.data || []);
    } catch (err) {
      console.error("Error loading payments:", err);
      toast({ title: "Error", description: "Failed to load payments", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const savePayment = async () => {
    if (!paymentForm.invoice_id || !paymentForm.amount || !paymentForm.payment_date) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (parseFloat(paymentForm.amount) <= 0) {
      toast({ title: "Validation Error", description: "Amount must be greater than 0", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("payments").insert({
        invoice_id: paymentForm.invoice_id,
        amount: parseFloat(paymentForm.amount),
        currency: paymentForm.currency,
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        notes: paymentForm.notes,
        status: "completed",
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadPayments();
      setModal(null);
      setPaymentForm({
        invoice_id: "",
        amount: "",
        currency: "TZS",
        payment_method: "",
        payment_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      toast({ title: "Success", description: "Payment recorded successfully" });
    } catch (err) {
      console.error("Error saving payment:", err);
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deletePayment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;
    try {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
      await loadPayments();
      toast({ title: "Success", description: "Payment deleted successfully" });
    } catch (err) {
      console.error("Error deleting payment:", err);
      toast({ title: "Error", description: "Failed to delete payment", variant: "destructive" });
    }
  };

  const getInvoiceDetails = (invoiceId: string) => {
    return invoices.find((inv) => inv.id === invoiceId);
  };

  const filteredPayments = payments.filter((p) => {
    const invoice = getInvoiceDetails(p.invoice_id);
    const matchesSearch = !search || 
      invoice?.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      invoice?.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.notes?.toLowerCase().includes(search.toLowerCase());
    const matchesCurrency = filterCurrency === "ALL" || p.currency === filterCurrency;
    const matchesStatus = filterStatus === "ALL" || p.status === filterStatus;
    return matchesSearch && matchesCurrency && matchesStatus;
  });

  const totalPayments = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground">Manage invoice payments and transactions</p>
        </div>
        <Button className="gap-2" onClick={() => setModal("new")}>
          <Plus className="size-4" />
          Record Payment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="size-4" />
              Total Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatAmount(totalPayments, "TZS")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="size-4" />
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{payments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="size-4" />
              Filtered View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filteredPayments.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9 w-64" placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <SelectItem value="ALL">All Status.</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={loadPayments}>
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
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
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
                      <p className="text-muted-foreground">Loading payments...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <EmptyState icon={CreditCard} title="No payments recorded" description="Record your first payment to get started" />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => {
                    const invoice = getInvoiceDetails(payment.invoice_id);
                    return (
                      <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="text-muted-foreground font-medium whitespace-nowrap">
                          {formatDate(payment.payment_date)}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          {invoice?.invoice_number || "N/A"}
                        </TableCell>
                        <TableCell className="text-foreground">
                          {invoice?.customer_name || "Unknown"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {payment.payment_method?.replace("_", " ") || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-emerald-700 dark:text-emerald-400 text-right whitespace-nowrap">
                          {formatAmount(payment.amount, payment.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {CURRENCIES[payment.currency as keyof typeof CURRENCIES]?.flag || ""} {payment.currency}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_STYLES[payment.status] || STATUS_STYLES.pending} className="capitalize">
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => deletePayment(payment.id)}>
                            Delete
                          </Button>
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
              <CardTitle>Record New Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invoice">Invoice</Label>
                <Select value={paymentForm.invoice_id} onValueChange={(value) => setPaymentForm({ ...paymentForm, invoice_id: value })}>
                  <SelectTrigger id="invoice">
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} - {inv.customer_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={paymentForm.currency} onValueChange={(value) => setPaymentForm({ ...paymentForm, currency: value })}>
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
                <Label htmlFor="method">Payment Method</Label>
                <Select value={paymentForm.payment_method} onValueChange={(value) => setPaymentForm({ ...paymentForm, payment_method: value })}>
                  <SelectTrigger id="method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Payment Date</Label>
                <Input id="date" type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" placeholder="Payment reference or notes" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setModal(null)} disabled={submitting}>Cancel</Button>
                <Button onClick={savePayment} disabled={submitting}>
                  {submitting ? "Saving..." : "Save Payment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
