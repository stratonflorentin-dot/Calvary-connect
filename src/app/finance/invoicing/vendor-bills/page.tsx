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
import { Building2, DollarSign, Filter, Plus, RefreshCw, Search, Trash2, FileText } from "lucide-react";
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

export default function VendorBillsPage() {
  const { role } = useRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterCurrency, setFilterCurrency] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [modal, setModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [billForm, setBillForm] = useState({
    vendor_name: "",
    bill_number: "",
    amount: "",
    currency: "TZS",
    due_date: "",
    description: "",
    category: "",
  });

  const loadBills = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendor_bills")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      setBills(data || []);
    } catch (err) {
      console.error("Error loading vendor bills:", err);
      toast({ title: "Error", description: "Failed to load vendor bills", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBills();
  }, []);

  const saveBill = async () => {
    if (!billForm.vendor_name || !billForm.bill_number || !billForm.amount || !billForm.due_date) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (parseFloat(billForm.amount) <= 0) {
      toast({ title: "Validation Error", description: "Amount must be greater than 0", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("vendor_bills").insert({
        vendor_name: billForm.vendor_name,
        bill_number: billForm.bill_number,
        amount: parseFloat(billForm.amount),
        currency: billForm.currency,
        due_date: billForm.due_date,
        description: billForm.description,
        category: billForm.category,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await loadBills();
      setModal(null);
      setBillForm({
        vendor_name: "",
        bill_number: "",
        amount: "",
        currency: "TZS",
        due_date: "",
        description: "",
        category: "",
      });
      toast({ title: "Success", description: "Vendor bill created successfully" });
    } catch (err) {
      console.error("Error saving vendor bill:", err);
      toast({ title: "Error", description: "Failed to create vendor bill", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBill = async (id: string) => {
    if (!confirm("Are you sure you want to delete this vendor bill?")) return;
    try {
      const { error } = await supabase.from("vendor_bills").delete().eq("id", id);
      if (error) throw error;
      await loadBills();
      toast({ title: "Success", description: "Vendor bill deleted successfully" });
    } catch (err) {
      console.error("Error deleting vendor bill:", err);
      toast({ title: "Error", description: "Failed to delete vendor bill", variant: "destructive" });
    }
  };

  const markAsPaid = async (id: string) => {
    try {
      const { error } = await supabase.from("vendor_bills").update({
        status: "paid",
        paid_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      await loadBills();
      toast({ title: "Success", description: "Vendor bill marked as paid" });
    } catch (err) {
      console.error("Error marking bill as paid:", err);
      toast({ title: "Error", description: "Failed to mark bill as paid", variant: "destructive" });
    }
  };

  const filteredBills = bills.filter((b) => {
    const matchesSearch = !search || 
      b.vendor_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.bill_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCurrency = filterCurrency === "ALL" || b.currency === filterCurrency;
    const matchesStatus = filterStatus === "ALL" || b.status === filterStatus;
    return matchesSearch && matchesCurrency && matchesStatus;
  });

  const totalBills = filteredBills.reduce((sum, b) => sum + (b.amount || 0), 0);
  const pendingBills = filteredBills.filter((b) => b.status === "pending").length;
  const overdueBills = filteredBills.filter((b) => {
    if (b.status !== "pending") return false;
    const dueDate = new Date(b.due_date);
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
                <h1 className="text-2xl font-bold text-foreground">Vendor Bills</h1>
                <p className="text-muted-foreground">Manage accounts payable and vendor invoices</p>
              </div>
              <Button className="gap-2" onClick={() => setModal("new")}>
                <Plus className="size-4" />
                Add Vendor Bill
              </Button>
            </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="size-4" />
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatAmount(totalBills, "TZS")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="size-4" />
              Pending Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingBills}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600">
              <Filter className="size-4" />
              Overdue Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{overdueBills}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9 w-64" placeholder="Search bills..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <Button variant="outline" size="sm" onClick={loadBills}>
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
                  <TableHead>Bill #</TableHead>
                  <TableHead>Vendor</TableHead>
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
                      <p className="text-muted-foreground">Loading vendor bills...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredBills.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <EmptyState icon={Building2} title="No vendor bills" description="Add your first vendor bill to get started" />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBills.map((bill) => {
                    const isOverdue = bill.status === "pending" && new Date(bill.due_date) < new Date();
                    const status = isOverdue ? "overdue" : bill.status;
                    return (
                      <TableRow key={bill.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-semibold text-foreground">
                          {bill.bill_number}
                        </TableCell>
                        <TableCell className="text-foreground font-medium">
                          {bill.vendor_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{bill.category || "General"}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-medium whitespace-nowrap">
                          {formatDate(bill.due_date)}
                        </TableCell>
                        <TableCell className="font-bold text-red-700 dark:text-red-400 text-right whitespace-nowrap">
                          {formatAmount(bill.amount, bill.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {CURRENCIES[bill.currency as keyof typeof CURRENCIES]?.flag || ""} {bill.currency}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_STYLES[status] || STATUS_STYLES.pending} className="capitalize">
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {bill.status === "pending" && (
                              <Button variant="ghost" size="sm" onClick={() => markAsPaid(bill.id)}>
                                Mark Paid
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => deleteBill(bill.id)}>
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
              <CardTitle>Add Vendor Bill</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor Name</Label>
                <Input id="vendor" placeholder="Vendor name" value={billForm.vendor_name} onChange={(e) => setBillForm({ ...billForm, vendor_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bill-number">Bill Number</Label>
                <Input id="bill-number" placeholder="BILL-001" value={billForm.bill_number} onChange={(e) => setBillForm({ ...billForm, bill_number: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" type="number" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={billForm.currency} onValueChange={(value) => setBillForm({ ...billForm, currency: value })}>
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
                <Input id="category" placeholder="Services, Goods, etc." value={billForm.category} onChange={(e) => setBillForm({ ...billForm, category: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date</Label>
                <Input id="due-date" type="date" value={billForm.due_date} onChange={(e) => setBillForm({ ...billForm, due_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" placeholder="Bill description" value={billForm.description} onChange={(e) => setBillForm({ ...billForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setModal(null)} disabled={submitting}>Cancel</Button>
                <Button onClick={saveBill} disabled={submitting}>
                  {submitting ? "Saving..." : "Save Bill"}
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
