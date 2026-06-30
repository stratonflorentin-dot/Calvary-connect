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
import { Receipt, ArrowLeft, RefreshCw, Plus, Trash2, Edit2, TrendingDown, FileText, AlertCircle, CreditCard } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate } from "@/lib/utils";

type Expense = {
  id?: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  vendor: string;
  status: string;
  tax_deductible?: boolean;
  vendor_bill_id?: string;
};

type VendorBill = {
  id: string;
  bill_number: string;
  vendor_name: string;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
};

export default function ExpensesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [modal, setModal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoCreateBill, setAutoCreateBill] = useState(true);

  const [expenseForm, setExpenseForm] = useState({
    description: "",
    amount: "",
    currency: "TZS",
    date: "",
    category: "",
    vendor: "",
    status: "pending",
    tax_deductible: true,
  });

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [paymentModal, setPaymentModal] = useState<VendorBill | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: "",
    payment_method: "bank_transfer",
    bank_account_id: "",
    reference: "",
  });

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const [expensesData, billsData, bankAccountsData] = await Promise.all([
        supabase.from("expenses").select("*").order("date", { ascending: false }),
        supabase.from("vendor_bills").select("*"),
        supabase.from("bank_accounts").select("*"),
      ]);

      setExpenses(expensesData.data || []);
      setVendorBills(billsData.data || []);
      setBankAccounts(bankAccountsData.data || []);
    } catch (err) {
      console.error("Error loading expenses:", err);
      toast({ title: "Error", description: "Failed to load expenses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const saveExpense = async () => {
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.date) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const expenseData: Expense = {
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        currency: expenseForm.currency,
        date: expenseForm.date,
        category: expenseForm.category,
        vendor: expenseForm.vendor,
        status: expenseForm.status,
        tax_deductible: expenseForm.tax_deductible,
      };

      let savedExpense;
      let error;
      if (editingExpense?.id) {
        const result = await supabase.from("expenses").update(expenseData).eq("id", editingExpense.id).select().single();
        error = result.error;
        savedExpense = result.data;
      } else {
        const result = await supabase.from("expenses").insert(expenseData).select().single();
        error = result.error;
        savedExpense = result.data;
      }

      if (error) throw error;

      // Auto-create vendor bill if enabled and vendor is provided
      if (autoCreateBill && expenseForm.vendor && !editingExpense?.vendor_bill_id) {
        const billNumber = `VB-${Date.now().toString().slice(-8)}`;
        const billData = {
          bill_number: billNumber,
          vendor_name: expenseForm.vendor,
          amount: expenseData.amount,
          currency: expenseData.currency,
          due_date: expenseForm.date,
          status: "pending",
          expense_ids: [savedExpense.id],
        };

        const { error: billError, data: bill } = await supabase.from("vendor_bills").insert(billData).select().single();
        if (!billError && bill) {
          // Link expense to vendor bill
          await supabase.from("expenses").update({ vendor_bill_id: bill.id }).eq("id", savedExpense.id);
          toast({ title: "Success", description: "Expense saved and vendor bill created automatically" });
        } else {
          toast({ title: "Success", description: "Expense saved (vendor bill creation failed)" });
        }
      } else {
        toast({ title: "Success", description: editingExpense ? "Expense updated" : "Expense saved" });
      }

      await loadExpenses();
      setModal(null);
      setExpenseForm({
        description: "",
        amount: "",
        currency: "TZS",
        date: "",
        category: "",
        vendor: "",
        status: "pending",
        tax_deductible: true,
      });
      setEditingExpense(null);
    } catch (err) {
      console.error("Error saving expense:", err);
      toast({ title: "Error", description: "Failed to save expense", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      await loadExpenses();
      toast({ title: "Success", description: "Expense deleted" });
    } catch (err) {
      console.error("Error deleting expense:", err);
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    }
  };

  const editExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      description: expense.description,
      amount: String(expense.amount),
      currency: expense.currency,
      date: expense.date,
      category: expense.category,
      vendor: expense.vendor,
      status: expense.status,
      tax_deductible: expense.tax_deductible ?? true,
    });
    setModal("expense");
  };

  const createVendorBill = async (expense: Expense) => {
    if (!expense.vendor) {
      toast({ title: "Error", description: "Expense must have a vendor to create a bill", variant: "destructive" });
      return;
    }

    try {
      const billNumber = `VB-${Date.now().toString().slice(-8)}`;
      const billData = {
        bill_number: billNumber,
        vendor_name: expense.vendor,
        amount: expense.amount,
        currency: expense.currency,
        due_date: expense.date,
        status: "pending",
        expense_ids: [expense.id],
      };

      const { error, data: bill } = await supabase.from("vendor_bills").insert(billData).select().single();
      if (error) throw error;

      // Link expense to vendor bill
      await supabase.from("expenses").update({ vendor_bill_id: bill.id }).eq("id", expense.id);

      await loadExpenses();
      toast({ title: "Success", description: "Vendor bill created" });
    } catch (err) {
      console.error("Error creating vendor bill:", err);
      toast({ title: "Error", description: "Failed to create vendor bill", variant: "destructive" });
    }
  };

  const recordPayment = async () => {
    if (!paymentModal || !paymentForm.amount || !paymentForm.payment_date) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const paymentAmount = parseFloat(paymentForm.amount);

      // Create bank transaction for payment
      const transactionData = {
        bank_account_id: paymentForm.bank_account_id || bankAccounts[0]?.id,
        transaction_type: "withdrawal",
        amount: paymentAmount,
        currency: paymentModal.currency,
        transaction_date: paymentForm.payment_date,
        description: `Payment for vendor bill ${paymentModal.bill_number} - ${paymentModal.vendor_name}`,
        reference: paymentForm.reference,
      };

      const { error: txError } = await supabase.from("bank_transactions").insert(transactionData);
      if (txError) throw txError;

      // Update vendor bill status
      const { error: billError } = await supabase.from("vendor_bills").update({
        status: "paid",
        paid_amount: paymentAmount,
        paid_date: paymentForm.payment_date,
      }).eq("id", paymentModal.id);
      if (billError) throw billError;

      // Update linked expenses to paid
      const { error: expenseError } = await supabase.from("expenses").update({ status: "paid" }).eq("vendor_bill_id", paymentModal.id);
      if (expenseError) throw expenseError;

      await loadExpenses();
      setPaymentModal(null);
      setPaymentForm({
        amount: "",
        payment_date: "",
        payment_method: "bank_transfer",
        bank_account_id: "",
        reference: "",
      });
      toast({ title: "Success", description: "Payment recorded successfully" });
    } catch (err) {
      console.error("Error recording payment:", err);
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-success/10 text-success border-success/20">Paid</Badge>;
      case "pending":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case "approved":
        return <Badge className="bg-primary/10 text-primary border-primary/20">Approved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const paidExpenses = expenses.filter((e) => e.status === "paid").reduce((sum, e) => sum + e.amount, 0);
  const pendingExpenses = expenses.filter((e) => e.status === "pending").reduce((sum, e) => sum + e.amount, 0);
  const linkedToBills = expenses.filter((e) => e.vendor_bill_id).length;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/finance/dashboard">
            <ArrowLeft className="size-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
        <Button onClick={loadExpenses} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Expense Management</h1>
        <p className="text-muted-foreground">Track expenses and automatically generate vendor bills</p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Dialog open={modal === "expense"} onOpenChange={(open) => setModal(open ? "expense" : null)}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="size-4" /> Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fuel">Fuel</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="tyre">Tyre</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                      <SelectItem value="utilities">Utilities</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vendor</Label>
                  <Input value={expenseForm.vendor} onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={expenseForm.status} onValueChange={(value) => setExpenseForm({ ...expenseForm, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex items-center pt-6">
                  <input
                    type="checkbox"
                    id="taxDeductible"
                    checked={expenseForm.tax_deductible}
                    onChange={(e) => setExpenseForm({ ...expenseForm, tax_deductible: e.target.checked })}
                    className="mr-2"
                  />
                  <Label htmlFor="taxDeductible">Tax Deductible</Label>
                </div>
              </div>
              {!editingExpense && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <input
                    type="checkbox"
                    id="autoCreateBill"
                    checked={autoCreateBill}
                    onChange={(e) => setAutoCreateBill(e.target.checked)}
                    className="mr-2"
                  />
                  <Label htmlFor="autoCreateBill" className="text-sm">
                    Auto-create vendor bill when vendor is specified
                  </Label>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setModal(null); setEditingExpense(null); }}>Cancel</Button>
                <Button onClick={saveExpense} disabled={submitting}>
                  {submitting ? "Saving..." : editingExpense ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Modal */}
        <Dialog open={!!paymentModal} onOpenChange={(open) => setPaymentModal(open ? paymentModal : null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Record Payment for Vendor Bill</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {paymentModal && (
                <>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">Bill: {paymentModal.bill_number}</p>
                    <p className="text-sm text-muted-foreground">Vendor: {paymentModal.vendor_name}</p>
                    <p className="text-sm text-muted-foreground">Amount Due: {formatAmount(paymentModal.amount)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Amount</Label>
                    <Input
                      type="number"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      placeholder={String(paymentModal.amount)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Date</Label>
                    <Input
                      type="date"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Account</Label>
                    <Select
                      value={paymentForm.bank_account_id}
                      onValueChange={(value) => setPaymentForm({ ...paymentForm, bank_account_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank account" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.account_number} - {account.bank_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference (Optional)</Label>
                    <Input
                      value={paymentForm.reference}
                      onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                      placeholder="Payment reference"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setPaymentModal(null)}>Cancel</Button>
                    <Button onClick={recordPayment} disabled={submitting}>
                      {submitting ? "Recording..." : "Record Payment"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="size-4 text-destructive" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Expenses</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{formatAmount(totalExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="size-4 text-success" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Paid</p>
            </div>
            <p className="text-2xl font-bold text-success">{formatAmount(paidExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Pending</p>
            </div>
            <p className="text-2xl font-bold text-warning">{formatAmount(pendingExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Linked to Bills</p>
            </div>
            <p className="text-2xl font-bold text-primary">{linkedToBills}</p>
          </CardContent>
        </Card>
      </section>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-5" /> Expense Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tax Deductible</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Vendor Bill</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => {
                    const vendorBill = vendorBills.find((b) => b.id === expense.vendor_bill_id);
                    return (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDate(expense.date)}</TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{expense.vendor || "-"}</TableCell>
                        <TableCell>{getStatusBadge(expense.status)}</TableCell>
                        <TableCell>
                          {expense.tax_deductible ? (
                            <Badge className="bg-success/10 text-success border-success/20">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-destructive">{formatAmount(expense.amount)}</TableCell>
                        <TableCell>
                          {vendorBill ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-primary/10 text-primary border-primary/20">
                                {vendorBill.bill_number}
                              </Badge>
                              {vendorBill.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setPaymentModal(vendorBill);
                                    setPaymentForm({
                                      amount: String(vendorBill.amount),
                                      payment_date: new Date().toISOString().split('T')[0],
                                      payment_method: "bank_transfer",
                                      bank_account_id: bankAccounts[0]?.id || "",
                                      reference: "",
                                    });
                                  }}
                                  className="text-xs h-7"
                                  title="Record Payment"
                                >
                                  <CreditCard className="size-3" />
                                </Button>
                              )}
                            </div>
                          ) : expense.vendor ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => createVendorBill(expense)}
                              className="text-xs h-7"
                            >
                              Create Bill
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => editExpense(expense)}>
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteExpense(expense.id!)}>
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
