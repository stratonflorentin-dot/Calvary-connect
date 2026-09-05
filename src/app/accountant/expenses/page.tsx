"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRole } from "@/hooks/use-role";
import { useCurrency } from "@/hooks/use-currency";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { TransitionButtons } from "@/components/workflow/transition-buttons";
import {
  canRoleApprove,
  hoursSince,
  isOverdue,
  resolveApprovalLevel,
  slaHours,
} from "@/lib/workflow/approvals";
import {
  CheckCircle2,
  XCircle,
  Download,
  Receipt,
  DollarSign,
  Clock,
  MessageSquare,
  Fuel,
  Flame,
  AlertTriangle,
  Truck,
  User,
} from "lucide-react";
import {
  expenseAmount,
  expenseCategory,
  expenseComment,
  expenseDate,
  expenseDescription,
  expenseReceiptUrl,
  expenseReference,
  expenseStatus,
  exportExpensesCsv,
  type ExpenseRow,
} from "@/lib/expense-utils";
import { createNotification } from "@/services/notification-service";
import { IndustryRoleShell } from "@/components/role-shell/industry-role-shell";
import { IndustryCard, IndustryCardKicker } from "@/components/industry/card";
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from "@/components/industry/table";
import { IndustryTag } from "@/components/industry/tag";
import { IndustryButton } from "@/components/industry/button";
import {
  IndustryDialog,
  IndustryDialogContent,
  IndustryDialogTitle,
} from "@/components/industry/dialog";

const ACCOUNTANT_PAGES = [
  { label: "Dashboard", href: "/finance" },
  { label: "Customer invoices", href: "/finance/invoicing/customer-invoices" },
  { label: "Expenses & fuel", href: "/accountant/expenses" },
  { label: "Reconciliation", href: "/finance/reports/reconciliation" },
];

const REVIEW_ROLES = ["ACCOUNTANT", "CEO", "ADMIN", "HR"];
const FUEL_VIEW_ROLES = ["CEO", "ADMIN", "OPERATOR", "MECHANIC", "ACCOUNTANT"];

const EXPENSE_STATUS_VARIANT: Record<string, "accent" | "danger" | "warning"> = {
  approved: "accent",
  rejected: "danger",
  pending: "warning",
};

interface FuelRequestRow {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  amount: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  driver: { name: string } | null;
  vehicle: { plate_number: string; make?: string; model?: string } | null;
}

function ExpensesView() {
  const { format } = useCurrency();
  const { user } = useSupabase();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [commentExpense, setCommentExpense] = useState<ExpenseRow | null>(null);
  const [accountantComment, setAccountantComment] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return expenses;
    return expenses.filter((e) => expenseStatus(e) === statusFilter);
  }, [expenses, statusFilter]);

  const pending = expenses.filter((e) => expenseStatus(e) === "pending");
  const approved = expenses.filter((e) => expenseStatus(e) === "approved");
  const rejected = expenses.filter((e) => expenseStatus(e) === "rejected");
  const totalAmount = expenses.reduce((s, e) => s + expenseAmount(e), 0);

  const notifyDriver = async (expense: ExpenseRow, status: "approved" | "rejected") => {
    const driverId = String(expense.driver_id || "");
    if (!driverId) return;
    await createNotification({
      userId: driverId,
      category: "expense_approval",
      title: status === "approved" ? "Expense approved" : "Expense rejected",
      message: `Your expense "${expenseDescription(expense)}" (${format(expenseAmount(expense))}) was ${status}.`,
      severity: status === "approved" ? "success" : "warning",
    });
  };

  const updateStatus = async (expense: ExpenseRow, status: "approved" | "rejected", comment?: string) => {
    const payload: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      approved_by: user?.id,
    };
    if (comment !== undefined) payload.accountant_comment = comment;

    const { error } = await supabase.from("expenses").update(payload).eq("id", expense.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    await notifyDriver(expense, status);
    toast({ title: `Expense ${status}` });
    setCommentExpense(null);
    setAccountantComment("");
    load();
  };

  const saveCommentOnly = async () => {
    if (!commentExpense) return;
    const { error } = await supabase
      .from("expenses")
      .update({ accountant_comment: accountantComment, updated_at: new Date().toISOString() })
      .eq("id", commentExpense.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ variant: "success", title: "Comment saved" });
    setCommentExpense(null);
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">Review, approve, reject, and export operational expenses.</p>
        <IndustryButton variant="secondary" onClick={() => exportExpensesCsv(filtered)} className="gap-1.5">
          <Download className="size-4" /> Export CSV
        </IndustryButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <IndustryCard className="gap-1">
          <IndustryCardKicker><Clock className="size-3 inline mr-1" />Pending</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{pending.length}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><CheckCircle2 className="size-3 inline mr-1" />Approved</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{approved.length}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><XCircle className="size-3 inline mr-1" />Rejected</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{rejected.length}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><DollarSign className="size-3 inline mr-1" />Total amount</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{format(totalAmount)}</p>
        </IndustryCard>
      </div>

      <div className="flex gap-1 mb-3">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={
              "px-3 py-[6px] text-[12px] border capitalize transition-colors duration-150 " +
              (statusFilter === f
                ? "bg-[var(--ci-text)] text-[var(--ci-bg)] border-[var(--ci-text)]"
                : "border-[var(--ci-divider)] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-row-hover)]")
            }
          >
            {f}
          </button>
        ))}
      </div>

      <IndustryCard>
        <IndustryTable>
          <thead>
            <tr>
              <IndustryTh>Description</IndustryTh>
              <IndustryTh>Category</IndustryTh>
              <IndustryTh align="right">Amount</IndustryTh>
              <IndustryTh>Date</IndustryTh>
              <IndustryTh>Status</IndustryTh>
              <IndustryTh align="right">Actions</IndustryTh>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><IndustryTd colSpan={6} className="text-center text-[var(--ci-text-tertiary)]">Loading…</IndustryTd></tr>
            ) : filtered.length === 0 ? (
              <tr><IndustryTd colSpan={6} className="text-center text-[var(--ci-text-tertiary)]">No expenses found.</IndustryTd></tr>
            ) : (
              filtered.map((expense) => {
                const status = expenseStatus(expense);
                const receipt = expenseReceiptUrl(expense);
                return (
                  <IndustryTr key={String(expense.id)}>
                    <IndustryTd>
                      <p className="text-[13px] font-medium">{expenseDescription(expense)}</p>
                      {expenseReference(expense) && <p className="text-[11px] text-[var(--ci-text-tertiary)]">Ref: {expenseReference(expense)}</p>}
                      {expenseComment(expense) && (
                        <p className="text-[11px] text-[#8c1d18] mt-0.5 flex items-center gap-1"><MessageSquare className="size-3" />{expenseComment(expense)}</p>
                      )}
                    </IndustryTd>
                    <IndustryTd className="capitalize">{expenseCategory(expense)}</IndustryTd>
                    <IndustryTd align="right" mono>{format(expenseAmount(expense))}</IndustryTd>
                    <IndustryTd mono>{expenseDate(expense)}</IndustryTd>
                    <IndustryTd><IndustryTag variant={EXPENSE_STATUS_VARIANT[status] ?? "neutral"}>{status}</IndustryTag></IndustryTd>
                    <IndustryTd align="right">
                      <div className="flex justify-end gap-1">
                        {receipt && (
                          <IndustryButton variant="ghost" onClick={() => setReceiptUrl(receipt)}><Receipt className="size-3.5" /></IndustryButton>
                        )}
                        <IndustryButton variant="ghost" onClick={() => { setCommentExpense(expense); setAccountantComment(expenseComment(expense)); }}>
                          Note
                        </IndustryButton>
                        {status === "pending" && (
                          <>
                            <IndustryButton variant="secondary" onClick={() => updateStatus(expense, "approved", accountantComment || undefined)}>Approve</IndustryButton>
                            <IndustryButton variant="secondary" onClick={() => updateStatus(expense, "rejected", accountantComment || undefined)} className="text-[#8c1d18]">Reject</IndustryButton>
                          </>
                        )}
                      </div>
                    </IndustryTd>
                  </IndustryTr>
                );
              })
            )}
          </tbody>
        </IndustryTable>
      </IndustryCard>

      <IndustryDialog open={!!commentExpense} onOpenChange={(v) => !v && setCommentExpense(null)}>
        <IndustryDialogContent open={!!commentExpense}>
          <IndustryDialogTitle>Accountant comment</IndustryDialogTitle>
          <textarea
            value={accountantComment}
            onChange={(e) => setAccountantComment(e.target.value)}
            rows={4}
            placeholder="Notes for the driver or internal review…"
            className="w-full text-[13px] bg-transparent border border-[var(--ci-divider)] px-[10px] py-[7px] outline-none focus-visible:border-[var(--ci-accent)] mt-2"
          />
          <div className="flex gap-2 mt-2">
            <IndustryButton variant="secondary" onClick={saveCommentOnly}>Save comment</IndustryButton>
            {commentExpense && expenseStatus(commentExpense) === "pending" && (
              <>
                <IndustryButton variant="primary" onClick={() => updateStatus(commentExpense, "approved", accountantComment)}>Approve</IndustryButton>
                <IndustryButton variant="secondary" onClick={() => updateStatus(commentExpense, "rejected", accountantComment)} className="text-[#8c1d18]">Reject</IndustryButton>
              </>
            )}
          </div>
        </IndustryDialogContent>
      </IndustryDialog>

      <IndustryDialog open={!!receiptUrl} onOpenChange={(v) => !v && setReceiptUrl(null)}>
        <IndustryDialogContent open={!!receiptUrl}>
          <IndustryDialogTitle>Receipt</IndustryDialogTitle>
          {receiptUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receiptUrl} alt="Receipt" className="w-full border border-[var(--ci-divider)] mt-2" />
          )}
        </IndustryDialogContent>
      </IndustryDialog>
    </>
  );
}

function FuelView() {
  const { role } = useRole();
  const { user } = useSupabase();
  const { format } = useCurrency();
  const [rows, setRows] = useState<FuelRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("fuel_requests")
      .select("id, driver_id, vehicle_id, amount, status, created_at, driver:user_profiles(name), vehicle:vehicles(plate_number, make, model)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Couldn't load fuel requests", description: error.message, variant: "destructive" });
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as FuelRequestRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.status === filter)), [rows, filter]);

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending");
    const overdue = pending.filter((r) => isOverdue("fuel_request", r.created_at));
    const approvedToday = rows.filter(
      (r) => r.status === "approved" && new Date(r.created_at).toDateString() === new Date().toDateString(),
    );
    return {
      pendingCount: pending.length,
      pendingTotal: pending.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      overdueCount: overdue.length,
      approvedToday: approvedToday.length,
    };
  }, [rows]);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Pending</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{stats.pendingCount}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Pending value</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{format(stats.pendingTotal)}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker><Flame className="size-3 inline mr-1" />Overdue (&gt;{slaHours.fuel_request}h)</IndustryCardKicker>
          <p className={"ci-mono text-[20px] font-bold leading-none " + (stats.overdueCount > 0 ? "text-[#8c1d18]" : "")}>{stats.overdueCount}</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Approved today</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{stats.approvedToday}</p>
        </IndustryCard>
      </div>

      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "px-3 py-[6px] text-[12px] border capitalize transition-colors duration-150 " +
                (filter === f
                  ? "bg-[var(--ci-text)] text-[var(--ci-bg)] border-[var(--ci-text)]"
                  : "border-[var(--ci-divider)] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-row-hover)]")
              }
            >
              {f}
            </button>
          ))}
        </div>
        <IndustryButton variant="secondary" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCwIcon spinning={loading} /> Refresh
        </IndustryButton>
      </div>

      {loading ? (
        <IndustryCard><p className="text-center text-[13px] text-[var(--ci-text-tertiary)] py-8">Loading…</p></IndustryCard>
      ) : visible.length === 0 ? (
        <IndustryCard>
          <p className="text-center text-[13px] text-[var(--ci-text-tertiary)] py-8">
            {filter === "pending" ? "No fuel requests awaiting a decision." : `No ${filter} fuel requests.`}
          </p>
        </IndustryCard>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((r) => {
            const overdue = r.status === "pending" && isOverdue("fuel_request", r.created_at);
            const level = resolveApprovalLevel("fuel_request", Number(r.amount) || 0);
            const age = hoursSince(r.created_at);
            const nearSla = !overdue && r.status === "pending" && age > slaHours.fuel_request * 0.6;

            return (
              <IndustryCard key={r.id} className="flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Fuel className="size-5 text-[var(--ci-accent)] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-1.5 mb-0.5">
                      {level && <IndustryTag variant="neutral">{level.label} tier</IndustryTag>}
                      {overdue && <IndustryTag variant="danger" pulse><Flame className="size-3" />Overdue {(age - slaHours.fuel_request).toFixed(1)}h</IndustryTag>}
                      {nearSla && <IndustryTag variant="warning"><AlertTriangle className="size-3" />Nearing SLA</IndustryTag>}
                      {r.status !== "pending" && <IndustryTag variant={r.status === "approved" ? "accent" : "danger"}>{r.status}</IndustryTag>}
                    </div>
                    <p className="ci-mono text-[15px] font-bold">{format(Number(r.amount) || 0)}</p>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--ci-text-tertiary)] mt-0.5">
                      <span className="flex items-center gap-1"><User className="size-3" />{r.driver?.name || "Unknown driver"}</span>
                      {r.vehicle?.plate_number && (
                        <span className="flex items-center gap-1"><Truck className="size-3" />{r.vehicle.plate_number}{r.vehicle.make ? ` · ${r.vehicle.make} ${r.vehicle.model ?? ""}`.trim() : ""}</span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="size-3" />{new Date(r.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  {r.status === "pending" ? (
                    canRoleApprove("fuel_request", Number(r.amount) || 0, role as any) ? (
                      <TransitionButtons kind="fuel_request" entity={r} actorId={user?.id ?? "system"} actorRole={role ?? undefined} onDone={load} size="sm" />
                    ) : (
                      <span className="text-[11px] text-[var(--ci-text-tertiary)] italic">Needs {level?.label ?? "higher"} approval</span>
                    )
                  ) : (
                    <Link href="/fleet/fuel-anomalies" className="text-[11px] text-[var(--ci-accent)] hover:underline">Check anomalies →</Link>
                  )}
                </div>
              </IndustryCard>
            );
          })}
        </div>
      )}
    </>
  );
}

function RefreshCwIcon({ spinning }: { spinning: boolean }) {
  return <Clock className={spinning ? "size-4 animate-spin" : "size-4"} />;
}

export default function ExpensesAndFuelPage() {
  const { role } = useRole();
  const [view, setView] = useState<"expenses" | "fuel">("expenses");

  useEffect(() => {
    if (role && !REVIEW_ROLES.includes(role)) {
      window.location.replace("/");
    }
  }, [role]);

  if (!role || !REVIEW_ROLES.includes(role)) return null;

  const canSeeFuel = FUEL_VIEW_ROLES.includes(String(role || "").toUpperCase());

  return (
    <IndustryRoleShell roleLabel="Accountant" pages={ACCOUNTANT_PAGES}>
      <div className="flex gap-1 border-b border-[var(--ci-divider)] mb-4">
        <button
          onClick={() => setView("expenses")}
          className={
            "px-3 py-[8px] text-[13px] border-b-2 transition-colors duration-150 " +
            (view === "expenses" ? "border-[var(--ci-accent)] text-[var(--ci-text)] font-semibold" : "border-transparent text-[var(--ci-text-tertiary)] hover:text-[var(--ci-text)]")
          }
        >
          Expenses
        </button>
        {canSeeFuel && (
          <button
            onClick={() => setView("fuel")}
            className={
              "px-3 py-[8px] text-[13px] border-b-2 transition-colors duration-150 " +
              (view === "fuel" ? "border-[var(--ci-accent)] text-[var(--ci-text)] font-semibold" : "border-transparent text-[var(--ci-text-tertiary)] hover:text-[var(--ci-text)]")
            }
          >
            Fuel
          </button>
        )}
      </div>

      {view === "expenses" ? <ExpensesView /> : <FuelView />}
    </IndustryRoleShell>
  );
}
