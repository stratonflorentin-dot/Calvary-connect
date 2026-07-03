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
import { useToast } from "@/hooks/use-toast";
import { Building2, DollarSign, Filter, Plus, RefreshCw, Search, Trash2, FileText, CheckCircle2 } from "lucide-react";

const CURRENCIES = {
  TZS: { code: "TZS", symbol: "TSh", flag: "🇹🇿" },
  USD: { code: "USD", symbol: "$", flag: "🇺🇸" },
  EUR: { code: "EUR", symbol: "€", flag: "🇪🇺" },
  KES: { code: "KES", symbol: "KSh", flag: "🇰🇪" },
};

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  overdue: "bg-red-500/10 text-red-700 border-red-500/20",
};

const fmt = (v: number, cur = "TZS") =>
  new Intl.NumberFormat("en-TZ", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);

export default function VendorBillsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [bills, setBills] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [modal, setModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [billForm, setBillForm] = useState({
    vendor_name: "", bill_number: "", amount: "", currency: "TZS",
    due_date: "", description: "", category: "",
  });

  const loadBills = async () => {
    setLoading(true);
    try {
      // Try vendor_bills table first, fallback to expenses with type filter
      let { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("category", "vendor_bill")
        .order("date", { ascending: false });
      
      if (error) {
        // If that fails, just load all expenses
        const res = await supabase.from("expenses").select("*").order("date", { ascending: false });
        data = res.data;
      }
      setBills(data || []);
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBills(); }, []);

  const saveBill = async () => {
    if (!billForm.vendor_name || !billForm.amount || !billForm.due_date) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const billNum = billForm.bill_number || `BILL-${Date.now().toString().slice(-6)}`;
      const { error } = await supabase.from("expenses").insert({
        vendor_name: billForm.vendor_name,
        expense_number: billNum,
        amount: parseFloat(billForm.amount),
        currency: billForm.currency,
        date: billForm.due_date,
        description: billForm.description,
        category: billForm.category || "vendor_bill",
        status: "pending",
      });
      if (error) throw error;
      await loadBills();
      setModal(false);
      setBillForm({ vendor_name: "", bill_number: "", amount: "", currency: "TZS", due_date: "", description: "", category: "" });
      toast({ title: "Vendor bill created successfully" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to create vendor bill", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteBill = async (id: string) => {
    if (!confirm("Delete this vendor bill?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Bill deleted" });
    loadBills();
  };

  const markAsPaid = async (id: string) => {
    const { error } = await supabase.from("expenses").update({ status: "paid" }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Bill marked as paid" });
    loadBills();
  };

  const filtered = bills.filter(b => {
    const s = search.toLowerCase();
    const matchSearch = !s || b.vendor_name?.toLowerCase().includes(s) || b.expense_number?.toLowerCase().includes(s);
    const matchStatus = filterStatus === "ALL" || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalOutstanding = filtered.filter(b => b.status !== "paid").reduce((s, b) => s + (b.amount || 0), 0);
  const pendingCount = filtered.filter(b => b.status === "pending").length;
  const overdueCount = filtered.filter(b => b.status === "pending" && b.date && new Date(b.date) < new Date()).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Bills</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage accounts payable and supplier invoices</p>
        </div>
        <Button className="gap-2" onClick={() => setModal(true)}>
          <Plus className="size-4" /> Add Vendor Bill
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><DollarSign className="size-4" /> Total Outstanding</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-foreground">{fmt(totalOutstanding)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground"><FileText className="size-4" /> Pending Bills</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-amber-600">{pendingCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2 text-red-600"><Filter className="size-4" /> Overdue Bills</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-red-600">{overdueCount}</p></CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadBills}><RefreshCw className="size-4 mr-2" />Refresh</Button>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-16 text-center text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-16 text-center">
                    <Building2 className="mx-auto size-8 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No vendor bills found</p>
                  </TableCell></TableRow>
                ) : filtered.map(bill => {
                  const isOverdue = bill.status === "pending" && bill.date && new Date(bill.date) < new Date();
                  const statusKey = isOverdue ? "overdue" : (bill.status || "pending");
                  return (
                    <TableRow key={bill.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{bill.expense_number || "—"}</TableCell>
                      <TableCell className="font-medium">{bill.vendor_name || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{bill.category || "General"}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{bill.date ? new Date(bill.date).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right font-bold text-red-700">{fmt(bill.amount || 0, bill.currency || "TZS")}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[statusKey] || STATUS_COLORS.pending}>{statusKey}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {bill.status !== "paid" && (
                            <Button variant="ghost" size="sm" onClick={() => markAsPaid(bill.id)}>
                              <CheckCircle2 className="size-4 text-emerald-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => deleteBill(bill.id)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Bill Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader><CardTitle>Add Vendor Bill</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>Vendor Name *</Label>
                <Input placeholder="Supplier / vendor name" value={billForm.vendor_name} onChange={e => setBillForm({ ...billForm, vendor_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Bill / Reference Number</Label>
                <Input placeholder="BILL-001 (auto if blank)" value={billForm.bill_number} onChange={e => setBillForm({ ...billForm, bill_number: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Amount *</Label>
                  <Input type="number" placeholder="0.00" value={billForm.amount} onChange={e => setBillForm({ ...billForm, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Currency</Label>
                  <Select value={billForm.currency} onValueChange={v => setBillForm({ ...billForm, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.values(CURRENCIES).map(c => <SelectItem key={c.code} value={c.code}>{c.flag} {c.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Due Date *</Label>
                <Input type="date" value={billForm.due_date} onChange={e => setBillForm({ ...billForm, due_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Input placeholder="Services, Goods, Fuel, etc." value={billForm.category} onChange={e => setBillForm({ ...billForm, category: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input placeholder="Brief description" value={billForm.description} onChange={e => setBillForm({ ...billForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => setModal(false)} disabled={submitting}>Cancel</Button>
                <Button onClick={saveBill} disabled={submitting}>{submitting ? "Saving..." : "Save Bill"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
