"use client";

import { useEffect, useMemo, useState } from "react";
import { PageShell, PageHeader, SectionCard, StatCard, EmptyState } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { notifyCompanyLoanPaymentApproval } from "@/services/notification-service";
import { formatAmount } from "@/lib/utils";
import {
  Banknote,
  CheckCircle2,
  HandCoins,
  Landmark,
  Loader2,
  Send,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const ALLOWED_ROLES = ["CEO", "ADMIN", "HR", "ACCOUNTANT"];
const APPROVER_ROLES = ["CEO", "ADMIN", "HR"];

const STATUS_TABS = ["all", "active", "completed", "cancelled"] as const;
const PAYMENT_STATUS = ["pending", "submitted", "approved", "rejected"] as const;

const PURPOSE_LABEL: Record<string, string> = {
  truck: "Truck",
  trailer: "Trailer",
  land: "Land",
  business_expansion: "Business expansion",
  other: "Other",
};

type LoanRow = {
  id: string;
  loan_number: string | null;
  purpose: string;
  purpose_note: string | null;
  lender: string;
  currency: string;
  principal_amount: number;
  outstanding_balance: number;
  installment_amount: number;
  total_interest: number;
  total_cost: number;
  method: string;
  frequency: number;
  status: "active" | "completed" | "cancelled";
  created_at: string;
};

type PaymentRow = {
  id: string;
  period: number;
  due_date: string;
  principal_portion: number;
  interest_portion: number;
  amount: number;
  status: (typeof PAYMENT_STATUS)[number];
  rejection_reason: string | null;
  approved_at: string | null;
  submitted_at: string | null;
};

type BankAccount = { id: string; account_name: string | null; bank_name: string | null };

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-info/10 text-info border-info/20" },
  completed: { label: "Completed", className: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const PAYMENT_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground border-border" },
  submitted: { label: "Awaiting approval", className: "bg-warning/10 text-warning border-warning/20" },
  approved: { label: "Approved", className: "bg-success/10 text-success border-success/20" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function CompanyLoansPage() {
  const { role, isLoading: roleLoading } = useRole();
  const { toast } = useToast();

  const currentRole = String(role || "").toUpperCase();
  const canView = !roleLoading && ALLOWED_ROLES.includes(currentRole);
  const canApprove = APPROVER_ROLES.includes(currentRole);

  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_TABS)[number]>("all");

  const [detailLoan, setDetailLoan] = useState<LoanRow | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [approvePayment, setApprovePayment] = useState<PaymentRow | null>(null);
  const [rejectPayment, setRejectPayment] = useState<PaymentRow | null>(null);
  const [approveForm, setApproveForm] = useState({ bank_account_id: "", payment_date: new Date().toISOString().split("T")[0] });
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [loansRes, banksRes] = await Promise.all([
        supabase.from("company_loans").select("*").order("created_at", { ascending: false }),
        supabase.from("bank_accounts").select("id, account_name, bank_name").order("account_name"),
      ]);
      if (loansRes.error) throw loansRes.error;
      if (banksRes.error) throw banksRes.error;
      setLoans((loansRes.data as LoanRow[]) ?? []);
      setBankAccounts((banksRes.data as BankAccount[]) ?? []);
    } catch (err: any) {
      toast({ title: "Error loading company loans", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const loadPayments = async (loanId: string) => {
    setPaymentsLoading(true);
    try {
      const { data, error } = await supabase
        .from("company_loan_payments")
        .select("*")
        .eq("company_loan_id", loanId)
        .order("period", { ascending: true });
      if (error) throw error;
      setPayments((data as PaymentRow[]) ?? []);
    } catch (err: any) {
      toast({ title: "Error loading payment schedule", description: err.message, variant: "destructive" });
    } finally {
      setPaymentsLoading(false);
    }
  };

  const openDetail = (loan: LoanRow) => {
    setDetailLoan(loan);
    setPayments([]);
    loadPayments(loan.id);
  };

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

  const runRpc = async (fn: () => PromiseLike<{ error: any }>, successMsg: string) => {
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) throw error;
      toast({ variant: "success", title: successMsg });
      setApprovePayment(null);
      setRejectPayment(null);
      setRejectReason("");
      if (detailLoan) loadPayments(detailLoan.id);
      load();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const submitPayment = async (payment: PaymentRow) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("submit_company_loan_payment", { p_payment_id: payment.id });
      if (error) throw error;
      toast({ variant: "success", title: "Payment return submitted for approval." });
      if (detailLoan) {
        notifyCompanyLoanPaymentApproval(detailLoan.loan_number ?? "Company loan", payment.period, payment.amount, detailLoan.currency);
        loadPayments(detailLoan.id);
      }
      load();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const approvePaymentSubmit = () => {
    if (!approvePayment) return;
    if (!approveForm.bank_account_id) {
      toast({ title: "Bank account required", variant: "destructive" });
      return;
    }
    runRpc(
      () =>
        supabase.rpc("approve_company_loan_payment", {
          p_payment_id: approvePayment.id,
          p_bank_account_id: approveForm.bank_account_id,
          p_payment_date: approveForm.payment_date,
        }),
      "Payment approved and posted to the ledger.",
    );
  };

  const rejectPaymentSubmit = () => {
    if (!rejectPayment) return;
    runRpc(
      () => supabase.rpc("reject_company_loan_payment", { p_payment_id: rejectPayment.id, p_reason: rejectReason || null }),
      "Payment return rejected.",
    );
  };

  const cancelLoan = (loan: LoanRow) => {
    if (!window.confirm(`Cancel loan ${loan.loan_number ?? ""}? No further payments can be approved.`)) return;
    runRpc(() => supabase.rpc("cancel_company_loan", { p_loan_id: loan.id }), "Loan cancelled.");
  };

  if (roleLoading) return null;
  if (!canView) {
    return (
      <PageShell>
        <EmptyState icon={HandCoins} title="Access denied" description="You don't have permission to view company loans." />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="HR"
        title="Company Loans"
        subtitle="History of every loan the company has taken, with per-month payment returns approved by CEO / ADMIN / HR."
        icon={Landmark}
        actions={
          <Button variant="outline" asChild>
            <Link href="/hr/loan-calculator">
              <Banknote className="size-4 mr-2" /> Open calculator
            </Link>
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active loans" value={totals.activeLoans} icon={HandCoins} accent="bg-primary/10 text-primary" />
        <StatCard label="Total financed" value={formatAmount(totals.totalFinanced)} icon={Banknote} accent="bg-info/10 text-info" />
        <StatCard label="Outstanding" value={formatAmount(totals.totalOutstanding)} icon={Wallet} accent="bg-warning/10 text-warning" />
        <StatCard label="Repaid" value={formatAmount(totals.totalRepaid)} icon={CheckCircle2} accent="bg-success/10 text-success" />
      </section>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="mb-4">
        <TabsList className="flex w-full overflow-x-auto no-scrollbar justify-start sm:grid sm:grid-cols-4">
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize shrink-0">{s}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <SectionCard title="Loan history" icon={Truck} padded={false}>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filteredLoans.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="No company loans yet"
            description="Use the loan calculator to plan a loan, then save it as a company loan to start tracking repayments."
            action={
              <Button asChild>
                <Link href="/hr/loan-calculator">Open loan calculator</Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Lender</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Installment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLoans.map((loan) => {
                  const badge = STATUS_BADGE[loan.status] ?? { label: loan.status, className: "" };
                  return (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.loan_number ?? "—"}</TableCell>
                      <TableCell>
                        {PURPOSE_LABEL[loan.purpose] ?? loan.purpose}
                        {loan.purpose_note ? <span className="block text-xs text-muted-foreground">{loan.purpose_note}</span> : null}
                      </TableCell>
                      <TableCell>{loan.lender}</TableCell>
                      <TableCell className="text-right">{formatAmount(loan.principal_amount, loan.currency)}</TableCell>
                      <TableCell className="text-right font-semibold text-warning">{formatAmount(loan.outstanding_balance, loan.currency)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatAmount(loan.installment_amount, loan.currency)}</TableCell>
                      <TableCell><Badge className={badge.className}>{badge.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openDetail(loan)}>Schedule</Button>
                          {loan.status === "active" && (
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelLoan(loan)}>Cancel</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Loan detail — monthly schedule + approval */}
      <Dialog open={!!detailLoan} onOpenChange={(open) => !open && setDetailLoan(null)}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailLoan?.loan_number ?? "Loan"} — {detailLoan ? PURPOSE_LABEL[detailLoan.purpose] ?? detailLoan.purpose : ""}
            </DialogTitle>
          </DialogHeader>
          {detailLoan && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground block text-xs">Principal</span><span className="font-bold">{formatAmount(detailLoan.principal_amount, detailLoan.currency)}</span></div>
                <div><span className="text-muted-foreground block text-xs">Outstanding</span><span className="font-bold text-warning">{formatAmount(detailLoan.outstanding_balance, detailLoan.currency)}</span></div>
                <div><span className="text-muted-foreground block text-xs">Installment</span><span className="font-bold">{formatAmount(detailLoan.installment_amount, detailLoan.currency)}</span></div>
                <div><span className="text-muted-foreground block text-xs">Total cost</span><span className="font-bold">{formatAmount(detailLoan.total_cost, detailLoan.currency)}</span></div>
              </div>
              <p className="text-xs text-muted-foreground">
                {detailLoan.lender} · {detailLoan.method === "reducing" ? "Reducing balance" : "Flat rate"} · {detailLoan.frequency === 12 ? "monthly" : `${detailLoan.frequency}×/yr`} · interest {formatAmount(detailLoan.total_interest, detailLoan.currency)}
              </p>

              {paymentsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : payments.length === 0 ? (
                <EmptyState icon={HandCoins} title="No schedule" description="This loan has no payment schedule." />
              ) : (
                <div className="max-h-[420px] overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card">
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => {
                        const badge = PAYMENT_BADGE[p.status] ?? { label: p.status, className: "" };
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.period}</TableCell>
                            <TableCell className="text-xs">{p.due_date}</TableCell>
                            <TableCell className="text-right text-xs">{formatAmount(p.principal_portion, detailLoan.currency)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{formatAmount(p.interest_portion, detailLoan.currency)}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">{formatAmount(p.amount, detailLoan.currency)}</TableCell>
                            <TableCell>
                              <Badge className={badge.className}>{badge.label}</Badge>
                              {p.status === "rejected" && p.rejection_reason && (
                                <span className="block text-[11px] text-destructive mt-0.5">{p.rejection_reason}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {p.status === "pending" && (
                                <Button variant="outline" size="sm" onClick={() => submitPayment(p)} disabled={busy}>
                                  <Send className="size-3.5 mr-1.5" /> Submit
                                </Button>
                              )}
                              {p.status === "submitted" && canApprove && (
                                <div className="flex justify-end gap-1.5">
                                  <Button variant="outline" size="sm" className="text-success" onClick={() => setApprovePayment(p)} disabled={busy}>
                                    <CheckCircle2 className="size-3.5 mr-1.5" /> Approve
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRejectPayment(p)} disabled={busy}>
                                    <XCircle className="size-3.5 mr-1.5" /> Reject
                                  </Button>
                                </div>
                              )}
                              {p.status === "submitted" && !canApprove && (
                                <span className="text-xs text-muted-foreground">Awaiting CEO/ADMIN/HR</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve dialog */}
      <Dialog open={!!approvePayment} onOpenChange={(open) => !open && setApprovePayment(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Approve payment return</DialogTitle>
          </DialogHeader>
          {approvePayment && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Period {approvePayment.period} — <span className="font-semibold text-foreground">{formatAmount(approvePayment.amount, detailLoan?.currency ?? "TZS")}</span>.
                Approving posts this to the ledger and reduces the bank account balance.
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Bank account *</Label>
                <Select value={approveForm.bank_account_id} onValueChange={(v) => setApproveForm({ ...approveForm, bank_account_id: v })}>
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
              <div className="space-y-1">
                <Label className="text-xs">Payment date</Label>
                <Input type="date" value={approveForm.payment_date} onChange={(e) => setApproveForm({ ...approveForm, payment_date: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setApprovePayment(null)}>Cancel</Button>
                <Button onClick={approvePaymentSubmit} disabled={busy || !approveForm.bank_account_id}>
                  {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
                  Approve & post
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectPayment} onOpenChange={(open) => !open && setRejectPayment(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Reject payment return</DialogTitle>
          </DialogHeader>
          {rejectPayment && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Period {rejectPayment.period} — <span className="font-semibold text-foreground">{formatAmount(rejectPayment.amount, detailLoan?.currency ?? "TZS")}</span>.
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Reason (optional)</Label>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Why is this payment return being rejected?" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setRejectPayment(null)}>Cancel</Button>
                <Button variant="destructive" onClick={rejectPaymentSubmit} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <XCircle className="size-4 mr-2" />}
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
