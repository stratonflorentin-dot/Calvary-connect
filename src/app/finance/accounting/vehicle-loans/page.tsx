"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, ArrowLeft, RefreshCw, Banknote, Wallet, CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { cn, formatAmount } from "@/lib/utils";

type VehicleLoan = {
  id: string;
  loan_number: string | null;
  vehicle_id: string;
  lender: string;
  purchase_price: number;
  down_payment: number;
  principal_amount: number;
  outstanding_balance: number;
  currency: string;
  purchase_date: string;
  status: "active" | "completed" | "cancelled";
  vehicles?: { plate_number: string; make: string; model: string } | null;
};

type BankAccount = { id: string; account_name: string | null; bank_name: string | null };

const STATUS_TABS = ["all", "active", "completed", "cancelled"] as const;

export default function VehicleLoansPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<VehicleLoan[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("all");
  const [repayLoan, setRepayLoan] = useState<VehicleLoan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    principal_portion: "",
    interest_portion: "",
    bank_account_id: "",
    payment_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const [loansRes, banksRes] = await Promise.all([
        supabase.from("vehicle_loans").select("*, vehicles(plate_number, make, model)").order("created_at", { ascending: false }),
        supabase.from("bank_accounts").select("id, account_name, bank_name"),
      ]);
      if (loansRes.error) throw loansRes.error;
      if (banksRes.error) throw banksRes.error;
      setLoans((loansRes.data as any) ?? []);
      setBankAccounts((banksRes.data as any) ?? []);
    } catch (err: any) {
      toast({ title: "Error loading vehicle loans", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredLoans = useMemo(
    () => (statusFilter === "all" ? loans : loans.filter((l) => l.status === statusFilter)),
    [loans, statusFilter],
  );

  const totals = useMemo(() => {
    const totalFinanced = loans.reduce((s, l) => s + Number(l.principal_amount || 0), 0);
    const totalOutstanding = loans.reduce((s, l) => s + Number(l.outstanding_balance || 0), 0);
    const activeLoans = loans.filter((l) => l.status === "active").length;
    return { totalFinanced, totalOutstanding, totalRepaid: totalFinanced - totalOutstanding, activeLoans };
  }, [loans]);

  const openRepay = (loan: VehicleLoan) => {
    setRepayLoan(loan);
    setForm({
      amount: "",
      principal_portion: "",
      interest_portion: "",
      bank_account_id: "",
      payment_date: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const splitBalances = () => {
    const amount = Number(form.amount) || 0;
    const principal = Number(form.principal_portion) || 0;
    const interest = Number(form.interest_portion) || 0;
    return { amount, principal, interest, balanced: amount > 0 && Math.abs(principal + interest - amount) < 0.01 };
  };

  const submitRepayment = async () => {
    if (!repayLoan) return;
    const { amount, principal, interest, balanced } = splitBalances();
    if (!balanced) {
      toast({ title: "Amounts don't add up", description: "Principal + interest must equal the payment amount.", variant: "destructive" });
      return;
    }
    if (!form.bank_account_id) {
      toast({ title: "Bank account required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("post_vehicle_loan_repayment", {
        p_vehicle_loan_id: repayLoan.id,
        p_amount: amount,
        p_principal_portion: principal,
        p_interest_portion: interest,
        p_bank_account_id: form.bank_account_id,
        p_payment_date: form.payment_date,
        p_notes: form.notes || null,
      });
      if (error) throw error;
      toast({ variant: "success", title: "Repayment posted", description: `${repayLoan.loan_number ?? "Loan"} balance reduced by ${formatAmount(principal)}.` });
      setRepayLoan(null);
      load();
    } catch (err: any) {
      toast({ title: "Failed to post repayment", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-info/10 text-info border-info/20">Active</Badge>;
      case "completed":
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case "cancelled":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Vehicle Loans</h1>
        <p className="text-muted-foreground">Vehicles purchased on financing — posted to the Chart of Accounts as a fixed asset and a loan payable. Financing is set up when adding a vehicle in Fleet.</p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="size-4 text-primary" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Total Financed</p>
            </div>
            <p className="text-xl font-bold text-primary">{formatAmount(totals.totalFinanced)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="size-4 text-warning" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Outstanding</p>
            </div>
            <p className="text-xl font-bold text-warning">{formatAmount(totals.totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="size-4 text-success" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Repaid</p>
            </div>
            <p className="text-xl font-bold text-success">{formatAmount(totals.totalRepaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Truck className="size-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground uppercase">Active Loans</p>
            </div>
            <p className="text-xl font-bold">{totals.activeLoans}</p>
          </CardContent>
        </Card>
      </section>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="mb-4">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-4">
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize shrink-0">{s}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="size-5" /> Loans
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Lender</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Down Payment</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      No vehicle loans found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.loan_number ?? "—"}</TableCell>
                      <TableCell>{loan.vehicles?.plate_number ?? "—"} {loan.vehicles ? `(${loan.vehicles.make} ${loan.vehicles.model})` : ""}</TableCell>
                      <TableCell>{loan.lender}</TableCell>
                      <TableCell>{formatAmount(loan.purchase_price)}</TableCell>
                      <TableCell>{formatAmount(loan.down_payment)}</TableCell>
                      <TableCell>{formatAmount(loan.principal_amount)}</TableCell>
                      <TableCell className="font-medium text-warning">{formatAmount(loan.outstanding_balance)}</TableCell>
                      <TableCell>{getStatusBadge(loan.status)}</TableCell>
                      <TableCell>
                        {loan.status === "active" && (
                          <Button variant="outline" size="sm" onClick={() => openRepay(loan)}>
                            <Send className="size-3.5 mr-1.5" /> Record repayment
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!repayLoan} onOpenChange={(open) => !open && setRepayLoan(null)}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record repayment — {repayLoan?.loan_number ?? repayLoan?.lender}</DialogTitle>
          </DialogHeader>
          {repayLoan && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Outstanding balance: <span className="font-semibold text-foreground">{formatAmount(repayLoan.outstanding_balance)}</span> — {repayLoan.lender}
              </p>
              <p className="text-xs text-muted-foreground">Split evenly is not assumed — enter both the principal and interest portion of this payment.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount *</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment date</Label>
                  <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Principal portion *</Label>
                  <Input type="number" value={form.principal_portion} onChange={(e) => setForm({ ...form, principal_portion: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Interest portion</Label>
                  <Input type="number" value={form.interest_portion} onChange={(e) => setForm({ ...form, interest_portion: e.target.value })} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Bank account *</Label>
                  <Select value={form.bank_account_id} onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.account_name ?? b.id}{b.bank_name ? ` — ${b.bank_name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              {!splitBalances().balanced && form.amount && (
                <p className="text-xs text-destructive">Principal + interest must equal the payment amount.</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRepayLoan(null)}>Cancel</Button>
                <Button onClick={submitRepayment} disabled={submitting || !splitBalances().balanced}>
                  {submitting ? "Posting…" : "Post repayment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
