'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSupabase } from '@/components/supabase-provider';
import { useRole } from '@/hooks/use-role';
import { useCurrency } from '@/hooks/use-currency';
import { toast } from '@/hooks/use-toast';
import {
  Coins, Calculator, Plus, RefreshCw,
  User, DollarSign, Calendar, Search, Trash2,
  XCircle, Info, Landmark, FileText, HandCoins, Clock
} from 'lucide-react';
import { IndustryRoleShell } from '@/components/role-shell/industry-role-shell';
import { IndustryCard, IndustryCardKicker } from '@/components/industry/card';
import { IndustryTable, IndustryTh, IndustryTd, IndustryTr } from '@/components/industry/table';
import { IndustryTag } from '@/components/industry/tag';
import { IndustryButton } from '@/components/industry/button';
import {
  IndustryDialog,
  IndustryDialogContent,
  IndustryDialogTitle,
  IndustryDialogActions,
} from '@/components/industry/dialog';
import {
  getWorkersAction,
  savePayrollAction,
  getPayrollHistoryAction,
  approvePayrollRecordAction,
  markPayrollPaidAction,
  rejectPayrollRecordAction,
  deletePayrollRecordAction,
  updateWorkerSalaryAction,
  getActiveBankAccountsAction,
} from './actions';

const HR_PAGES = [
  { label: "People", href: "/users" },
  { label: "Payroll & allowances", href: "/allowances" },
  { label: "Leave", href: "/hr/leave" },
  { label: "Driver compliance", href: "/admin/hr/driver-compliance" },
];

const fieldClass = "w-full text-[13px] bg-transparent border border-[var(--ci-divider)] px-[9px] py-[6px] outline-none focus-visible:border-[var(--ci-accent)]";

/**
 * Payroll periods selectable for processing — the current month plus the
 * trailing 5, oldest first. Never offers a future month: workers must not
 * be paid before their actual pay date.
 */
function selectablePayrollPeriods(): string[] {
  const now = new Date();
  const periods: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(d.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
  }
  return periods;
}

interface Worker {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  salary: number | null;
  avatar_url: string | null;
  phone: string | null;
  hire_date: string | null;
  employee_id?: string | null;
}

interface PayrollRecord {
  id: string;
  driver_id: string;
  driver_name: string;
  role: string;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  reason: string;
  created_at: string;
  type: string;
  employee_name?: string;
  worker_role?: string;
  avatar_url?: string | null;
  employee_id?: string | null;
  loan_deduction_amount?: number;
}

const STATUS_VARIANT: Record<string, "accent" | "warning" | "danger" | "neutral"> = {
  paid: 'accent',
  approved: 'neutral',
  rejected: 'danger',
  pending: 'warning',
};

export default function AllowancesPage() {
  const { user } = useSupabase();
  const { role } = useRole();
  const { format } = useCurrency();

  const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [history, setHistory] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [markPaidTarget, setMarkPaidTarget] = useState<PayrollRecord | null>(null);
  const [markPaidAccounts, setMarkPaidAccounts] = useState<{ id: string; account_name: string; currency: string }[]>([]);
  const [markPaidAccountId, setMarkPaidAccountId] = useState('');
  const [markPaidAccountsLoading, setMarkPaidAccountsLoading] = useState(false);

  const [baseSalaries, setBaseSalaries] = useState<Record<string, number>>({});
  const [allowancesInputs, setAllowancesInputs] = useState<Record<string, number>>({});
  const [deductionsInputs, setDeductionsInputs] = useState<Record<string, number>>({});
  const [periods, setPeriods] = useState<Record<string, string>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [payrollPeriods] = useState<string[]>(selectablePayrollPeriods);

  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'payroll' | 'trip'>('all');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const workersRes = await getWorkersAction();
      if (workersRes.success && workersRes.workers) {
        const initialSalaries: Record<string, number> = {};
        const initialAllowances: Record<string, number> = {};
        const initialDeductions: Record<string, number> = {};
        const initialPeriods: Record<string, string> = {};
        const initialMethods: Record<string, string> = {};
        const initialNotes: Record<string, string> = {};

        const currentMonthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

        workersRes.workers.forEach((w: any) => {
          let defaultSalary = w.salary || 0;
          if (!defaultSalary) {
            const roleUpper = (w.role || '').toUpperCase();
            if (roleUpper.includes('CEO')) defaultSalary = 2500000;
            else if (roleUpper.includes('ADMIN')) defaultSalary = 1800000;
            else if (roleUpper.includes('ACCOUNTANT')) defaultSalary = 1500000;
            else if (roleUpper.includes('HR')) defaultSalary = 1200000;
            else if (roleUpper.includes('DRIVER')) defaultSalary = 800000;
            else if (roleUpper.includes('MECHANIC')) defaultSalary = 900000;
            else if (roleUpper.includes('SALESMAN')) defaultSalary = 1000000;
            else defaultSalary = 750000;
          }

          initialSalaries[w.id] = defaultSalary;
          initialAllowances[w.id] = 0;
          initialDeductions[w.id] = 0;
          initialPeriods[w.id] = currentMonthYear;
          initialMethods[w.id] = 'Bank Transfer';
          initialNotes[w.id] = '';
        });

        setWorkers(workersRes.workers as Worker[]);
        setBaseSalaries(initialSalaries);
        setAllowancesInputs(initialAllowances);
        setDeductionsInputs(initialDeductions);
        setPeriods(initialPeriods);
        setPaymentMethods(initialMethods);
        setNotes(initialNotes);
      }

      await loadHistory();
    } catch (error: any) {
      console.error("Error loading payroll details:", error);
      toast({ title: "Load Failure", description: "Could not load payroll and worker directories.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    const historyRes = await getPayrollHistoryAction();
    if (historyRes.success && historyRes.history) {
      setHistory(historyRes.history as PayrollRecord[]);
    }
  };

  const handleNumChange = (workerId: string, value: string, setter: React.Dispatch<React.SetStateAction<Record<string, number>>>) => {
    const num = parseFloat(value.replace(/,/g, '')) || 0;
    setter(prev => ({ ...prev, [workerId]: num }));
  };

  const handleProcessPayroll = async (worker: Worker) => {
    const workerId = worker.id;
    const base = baseSalaries[workerId] || 0;
    const alw = allowancesInputs[workerId] || 0;
    const ded = deductionsInputs[workerId] || 0;
    const net = base + alw - ded;
    const period = periods[workerId] || 'Current Month';
    const method = paymentMethods[workerId] || 'Bank Transfer';
    const note = notes[workerId] || 'Processed manually';

    if (net <= 0) {
      toast({ title: "Invalid Amount", description: "Net salary must be greater than 0.", variant: "destructive" });
      return;
    }

    setActionLoading(workerId);
    try {
      if (base !== worker.salary) {
        await updateWorkerSalaryAction(workerId, base);
      }

      const res = await savePayrollAction({
        employeeId: workerId,
        employeeName: worker.name,
        role: worker.role,
        baseSalary: base,
        allowances: alw,
        deductions: ded,
        netSalary: net,
        period,
        paymentMethod: method,
        note
      });

      if (res.success) {
        toast({ title: "Payroll Submitted", description: `Manual payroll for ${worker.name} submitted successfully!` });
        setAllowancesInputs(prev => ({ ...prev, [workerId]: 0 }));
        setDeductionsInputs(prev => ({ ...prev, [workerId]: 0 }));
        setNotes(prev => ({ ...prev, [workerId]: '' }));
        await loadHistory();
      } else {
        toast({ title: "Submission Failed", description: res.error || "Could not submit payroll.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to process request.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprovePayroll = async (id: string) => {
    if (!user) return;
    setActionLoading(id);
    try {
      const res = await approvePayrollRecordAction(id, user.id);
      if (res.success) {
        const deduction = (res as any).loanDeductionAmount as number | undefined;
        toast({
          title: "Payroll Approved",
          description:
            deduction && deduction > 0
              ? `Expense logged and payable invoice generated. TZS ${deduction.toLocaleString()} will be withheld for an active salary advance.`
              : "Compensation record approved, expense logged, and payable invoice generated."
        });
        await loadHistory();
      } else {
        toast({ title: "Approval Failed", description: res.error || "Could not approve.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to approve record.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const openMarkPaidDialog = async (record: PayrollRecord) => {
    setMarkPaidTarget(record);
    setMarkPaidAccountId('');
    setMarkPaidAccountsLoading(true);
    try {
      const res = await getActiveBankAccountsAction('TZS');
      setMarkPaidAccounts(res.accounts || []);
      if ((res.accounts || []).length === 1) setMarkPaidAccountId(res.accounts[0].id);
      if (!res.success) {
        toast({ title: "Error", description: res.error || "Failed to load bank accounts.", variant: "destructive" });
      }
    } finally {
      setMarkPaidAccountsLoading(false);
    }
  };

  const handleMarkPaidPayroll = async () => {
    if (!markPaidTarget) return;
    const id = markPaidTarget.id;
    setActionLoading(id);
    try {
      const res = await markPayrollPaidAction(id, markPaidAccountId || undefined);
      if (res.success) {
        toast({ title: "Payroll Paid", description: "Marked as disbursed — linked invoice and expense updated." });
        setMarkPaidTarget(null);
        await loadHistory();
      } else {
        toast({ title: "Could Not Mark Paid", description: res.error || "Please try again.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update record.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectPayroll = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await rejectPayrollRecordAction(id);
      if (res.success) {
        toast({ title: "Record Rejected", description: "Payroll entry rejected successfully." });
        await loadHistory();
      } else {
        toast({ title: "Rejection Failed", description: res.error || "Could not reject.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to reject.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePayroll = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this payroll record?")) return;
    setActionLoading(id);
    try {
      const res = await deletePayrollRecordAction(id);
      if (res.success) {
        toast({ title: "Record Deleted", description: "Record removed permanently from ledger history." });
        await loadHistory();
      } else {
        toast({ title: "Deletion Failed", description: res.error || "Could not delete.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to delete.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const parseReason = (reasonStr: string) => {
    try {
      if (reasonStr && reasonStr.startsWith('{')) {
        return JSON.parse(reasonStr);
      }
    } catch { /* not JSON — plain reason string */ }
    return null;
  };

  const filteredWorkers = workers.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.employee_id && w.employee_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredHistory = history.filter(item => {
    const isManual = item.type === 'payroll';
    const matchesSearch = item.employee_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.worker_role?.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.reason.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.employee_id?.toLowerCase().includes(historySearch.toLowerCase());

    if (historyFilter === 'payroll') return isManual && matchesSearch;
    if (historyFilter === 'trip') return !isManual && matchesSearch;
    return matchesSearch;
  });

  const statsPending = useMemo(() => history.filter(h => h.status === 'pending').reduce((sum, h) => sum + h.amount, 0), [history]);
  const statsApproved = useMemo(() => history.filter(h => h.status === 'approved').reduce((sum, h) => sum + h.amount, 0), [history]);
  const statsPaid = useMemo(() => history.filter(h => h.status === 'paid').reduce((sum, h) => sum + h.amount, 0), [history]);
  const statsTotalWorkers = workers.length;

  return (
    <IndustryRoleShell roleLabel="HR" pages={HR_PAGES}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-[12px] text-[var(--ci-text-secondary)]">
          Manually manage base salaries, process allowances, and track monthly staff compensation.
        </p>
        <div className="flex flex-wrap gap-2">
          <IndustryButton variant="secondary" onClick={loadData} disabled={loading} className="gap-1.5">
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /> Sync
          </IndustryButton>
          <IndustryButton variant="secondary" asChild className="gap-1.5">
            <Link href="/admin/hr/payroll/overtime"><Clock className="size-4" /> Overtime</Link>
          </IndustryButton>
          <IndustryButton variant="secondary" asChild className="gap-1.5">
            <Link href="/admin/hr/payroll/loans"><HandCoins className="size-4" /> Loans</Link>
          </IndustryButton>
          <IndustryButton variant="primary" asChild className="gap-1.5">
            <Link href="/admin/hr/payroll/statutory"><FileText className="size-4" /> Statutory reports</Link>
          </IndustryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Pending approval</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{format(statsPending)}</p>
          <p className="text-[10px] text-[var(--ci-text-tertiary)]">Awaiting manager process</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Approved ledger</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{format(statsApproved)}</p>
          <p className="text-[10px] text-[var(--ci-text-tertiary)]">Synced to bills & expenses</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Disbursed wages</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{format(statsPaid)}</p>
          <p className="text-[10px] text-[var(--ci-text-tertiary)]">Successfully paid workers</p>
        </IndustryCard>
        <IndustryCard className="gap-1">
          <IndustryCardKicker>Active directory</IndustryCardKicker>
          <p className="ci-mono text-[20px] font-bold leading-none">{statsTotalWorkers}</p>
          <p className="text-[10px] text-[var(--ci-text-tertiary)]">Registered company profiles</p>
        </IndustryCard>
      </div>

      <div className="flex gap-1 border-b border-[var(--ci-divider)] mb-4">
        <button
          onClick={() => setActiveTab('process')}
          className={
            "px-3 py-[8px] text-[13px] border-b-2 flex items-center gap-1.5 transition-colors duration-150 " +
            (activeTab === 'process' ? "border-[var(--ci-accent)] text-[var(--ci-text)] font-semibold" : "border-transparent text-[var(--ci-text-tertiary)] hover:text-[var(--ci-text)]")
          }
        >
          <Coins className="size-3.5" /> Process worker payroll
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={
            "px-3 py-[8px] text-[13px] border-b-2 flex items-center gap-1.5 transition-colors duration-150 " +
            (activeTab === 'history' ? "border-[var(--ci-accent)] text-[var(--ci-text)] font-semibold" : "border-transparent text-[var(--ci-text-tertiary)] hover:text-[var(--ci-text)]")
          }
        >
          <FileText className="size-3.5" /> Payroll ledger & history
        </button>
      </div>

      {activeTab === 'process' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-[9px] top-1/2 -translate-y-1/2 size-3.5 text-[var(--ci-text-tertiary)]" />
              <input
                placeholder="Search workers by name, role or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={fieldClass + " pl-8"}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--ci-text-tertiary)]">
              <Info className="size-3.5" />
              Updating a base salary updates the worker&apos;s global master profile.
            </div>
          </div>

          {loading ? (
            <IndustryCard><p className="text-center text-[13px] text-[var(--ci-text-tertiary)] py-8">Analyzing worker directories…</p></IndustryCard>
          ) : filteredWorkers.length === 0 ? (
            <IndustryCard><p className="text-center text-[13px] text-[var(--ci-text-tertiary)] py-8">No active worker profiles match your criteria.</p></IndustryCard>
          ) : (
            filteredWorkers.map((worker) => {
              const baseSalary = baseSalaries[worker.id] || 0;
              const allowances = allowancesInputs[worker.id] || 0;
              const deductions = deductionsInputs[worker.id] || 0;
              const netSalary = baseSalary + allowances - deductions;
              const isProcessing = actionLoading === worker.id;

              return (
                <IndustryCard key={worker.id} className="gap-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--ci-divider)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 border border-[var(--ci-divider)] flex items-center justify-center ci-mono text-[12px] font-bold shrink-0">
                        {worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-[14px] font-semibold">{worker.name}</h3>
                          <IndustryTag variant="neutral">{worker.role}</IndustryTag>
                          {worker.employee_id && worker.employee_id !== 'N/A' && (
                            <span className="ci-mono text-[10px] text-[var(--ci-text-tertiary)]">{worker.employee_id}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--ci-text-tertiary)] mt-0.5">{worker.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <label className="ci-lbl block mb-1">Period</label>
                        <select
                          value={periods[worker.id]}
                          onChange={(e) => setPeriods(prev => ({ ...prev, [worker.id]: e.target.value }))}
                          className={fieldClass}
                        >
                          {payrollPeriods.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="ci-lbl block mb-1">Method</label>
                        <select
                          value={paymentMethods[worker.id]}
                          onChange={(e) => setPaymentMethods(prev => ({ ...prev, [worker.id]: e.target.value }))}
                          className={fieldClass}
                        >
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Mobile Money">Mobile Money</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="ci-lbl flex items-center gap-1 mb-1"><DollarSign className="size-3" /> Base salary (TZS)</label>
                      <input
                        value={baseSalary.toLocaleString()}
                        onChange={(e) => handleNumChange(worker.id, e.target.value, setBaseSalaries)}
                        className={fieldClass + " ci-mono"}
                      />
                    </div>
                    <div>
                      <label className="ci-lbl flex items-center gap-1 mb-1"><Plus className="size-3" /> Allowances (TZS)</label>
                      <input
                        value={allowances.toLocaleString()}
                        onChange={(e) => handleNumChange(worker.id, e.target.value, setAllowancesInputs)}
                        className={fieldClass + " ci-mono"}
                      />
                    </div>
                    <div>
                      <label className="ci-lbl flex items-center gap-1 mb-1"><XCircle className="size-3" /> Deductions (TZS)</label>
                      <input
                        value={deductions.toLocaleString()}
                        onChange={(e) => handleNumChange(worker.id, e.target.value, setDeductionsInputs)}
                        className={fieldClass + " ci-mono"}
                      />
                    </div>
                    <div className="border border-[var(--ci-divider)] p-[10px] flex items-center justify-between gap-2">
                      <div>
                        <p className="ci-lbl">Calculated net</p>
                        <p className={"ci-mono text-[16px] font-bold mt-0.5 " + (netSalary >= 0 ? "" : "text-[#8c1d18]")}>{format(netSalary)}</p>
                      </div>
                      <IndustryButton variant="primary" onClick={() => handleProcessPayroll(worker)} disabled={isProcessing || netSalary <= 0}>
                        {isProcessing ? 'Processing…' : 'Run payroll'}
                      </IndustryButton>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--ci-divider)]">
                    <Info className="size-3.5 text-[var(--ci-text-tertiary)] shrink-0" />
                    <input
                      placeholder="Add optional notes (e.g., 'Overtime 5 hours', 'Advance repayment')…"
                      value={notes[worker.id]}
                      onChange={(e) => setNotes(prev => ({ ...prev, [worker.id]: e.target.value }))}
                      className="flex-1 text-[12px] bg-transparent border-none outline-none text-[var(--ci-text-secondary)] placeholder:text-[var(--ci-text-tertiary)]"
                    />
                  </div>
                </IndustryCard>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <IndustryCard>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-[9px] top-1/2 -translate-y-1/2 size-3.5 text-[var(--ci-text-tertiary)]" />
              <input
                placeholder="Search history by employee name or details…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className={fieldClass + " pl-8"}
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'payroll', 'trip'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={
                    "px-3 py-[6px] text-[12px] border transition-colors duration-150 " +
                    (historyFilter === f
                      ? "bg-[var(--ci-text)] text-[var(--ci-bg)] border-[var(--ci-text)]"
                      : "border-[var(--ci-divider)] text-[var(--ci-text-secondary)] hover:bg-[var(--ci-row-hover)]")
                  }
                >
                  {f === 'all' ? 'All records' : f === 'payroll' ? 'Manual payroll' : 'Trip allowances'}
                </button>
              ))}
            </div>
          </div>

          <IndustryTable>
            <thead>
              <tr>
                <IndustryTh>Employee</IndustryTh>
                <IndustryTh>Category</IndustryTh>
                <IndustryTh>Period / route</IndustryTh>
                <IndustryTh>Breakdown</IndustryTh>
                <IndustryTh align="right">Net salary</IndustryTh>
                <IndustryTh>Status</IndustryTh>
                <IndustryTh align="right">Processed</IndustryTh>
                <IndustryTh align="right">Actions</IndustryTh>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><IndustryTd className="text-center text-[var(--ci-text-tertiary)]">Synchronizing logs…</IndustryTd></tr>
              ) : filteredHistory.length === 0 ? (
                <tr><IndustryTd className="text-center text-[var(--ci-text-tertiary)]">No payroll or allowance records match the active criteria.</IndustryTd></tr>
              ) : (
                filteredHistory.map((item) => {
                  const parsed = parseReason(item.reason);
                  const isManual = item.type === 'payroll';
                  const isActionLoading = actionLoading === item.id;

                  return (
                    <IndustryTr key={item.id}>
                      <IndustryTd>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 border border-[var(--ci-divider)] flex items-center justify-center ci-mono text-[10px] font-bold shrink-0">
                            {item.employee_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[13px] font-medium">{item.employee_name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <IndustryTag variant="neutral">{item.worker_role || 'Employee'}</IndustryTag>
                              {item.employee_id && item.employee_id !== 'N/A' && (
                                <span className="ci-mono text-[9px] text-[var(--ci-text-tertiary)]">{item.employee_id}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </IndustryTd>
                      <IndustryTd>
                        <IndustryTag variant={isManual ? "outline" : "neutral"}>{isManual ? 'Manual payroll' : 'Trip allowance'}</IndustryTag>
                      </IndustryTd>
                      <IndustryTd className="text-[12px]">
                        {isManual ? (
                          <span className="flex items-center gap-1"><Calendar className="size-3" />{parsed?.period || 'Monthly'}</span>
                        ) : (
                          <span className="text-[var(--ci-text-tertiary)]">Trip-based calculation</span>
                        )}
                      </IndustryTd>
                      <IndustryTd className="text-[11px] max-w-xs">
                        {isManual && parsed ? (
                          <div className="ci-mono text-[var(--ci-text-tertiary)] leading-relaxed">
                            <p>Base: {parsed.baseSalary?.toLocaleString()}</p>
                            <p>Alw: {parsed.allowances?.toLocaleString()}</p>
                            <p>Ded: {parsed.deductions?.toLocaleString()}</p>
                          </div>
                        ) : (
                          <span className="text-[var(--ci-text-tertiary)] italic truncate block max-w-xs">{item.reason}</span>
                        )}
                      </IndustryTd>
                      <IndustryTd align="right" mono>
                        {format(item.amount)}
                        {(item.loan_deduction_amount ?? 0) > 0 && (
                          <p className="text-[10px] text-[#8c1d18] mt-0.5">
                            -{format(item.loan_deduction_amount!)} advance · net {format(item.amount - item.loan_deduction_amount!)}
                          </p>
                        )}
                      </IndustryTd>
                      <IndustryTd><IndustryTag variant={STATUS_VARIANT[item.status] ?? "neutral"}>{item.status}</IndustryTag></IndustryTd>
                      <IndustryTd align="right" mono className="text-[11px]">{new Date(item.created_at).toLocaleDateString()}</IndustryTd>
                      <IndustryTd align="right">
                        <div className="flex justify-end gap-1">
                          {item.status === 'pending' && (
                            <>
                              <IndustryButton variant="primary" onClick={() => handleApprovePayroll(item.id)} disabled={isActionLoading}>Approve</IndustryButton>
                              <IndustryButton variant="secondary" onClick={() => handleRejectPayroll(item.id)} disabled={isActionLoading}>Reject</IndustryButton>
                            </>
                          )}
                          {item.status === 'approved' && (
                            <IndustryButton variant="primary" onClick={() => openMarkPaidDialog(item)} disabled={isActionLoading}>Mark paid</IndustryButton>
                          )}
                          <IndustryButton variant="ghost" onClick={() => handleDeletePayroll(item.id)} disabled={isActionLoading} className="text-[#8c1d18]">
                            <Trash2 className="size-3.5" />
                          </IndustryButton>
                        </div>
                      </IndustryTd>
                    </IndustryTr>
                  );
                })
              )}
            </tbody>
          </IndustryTable>
        </IndustryCard>
      )}

      <IndustryDialog open={!!markPaidTarget} onOpenChange={(open) => { if (!open) setMarkPaidTarget(null); }}>
        <IndustryDialogContent open={!!markPaidTarget}>
          <IndustryDialogTitle>Mark payroll as paid</IndustryDialogTitle>
          <p className="text-[13px] text-[var(--ci-text-secondary)] mt-1">
            {markPaidTarget?.driver_name} — {format(markPaidTarget?.amount || 0)}
          </p>
          <div className="mt-2">
            <label className="ci-lbl block mb-1">Pay from</label>
            {markPaidAccountsLoading ? (
              <p className="text-[13px] text-[var(--ci-text-tertiary)]">Loading bank accounts…</p>
            ) : markPaidAccounts.length === 0 ? (
              <p className="text-[13px] text-[#8c1d18]">No active TZS bank account found to pay this from.</p>
            ) : (
              <select value={markPaidAccountId} onChange={(e) => setMarkPaidAccountId(e.target.value)} className={fieldClass}>
                <option value="" disabled>Choose a bank account</option>
                {markPaidAccounts.map((acct) => (
                  <option key={acct.id} value={acct.id}>{acct.account_name} ({acct.currency})</option>
                ))}
              </select>
            )}
          </div>
          <IndustryDialogActions>
            <IndustryButton variant="secondary" onClick={() => setMarkPaidTarget(null)}>Cancel</IndustryButton>
            <IndustryButton
              variant="primary"
              onClick={handleMarkPaidPayroll}
              disabled={!markPaidAccountId || actionLoading === markPaidTarget?.id}
            >
              {actionLoading === markPaidTarget?.id ? "Paying…" : "Confirm payment"}
            </IndustryButton>
          </IndustryDialogActions>
        </IndustryDialogContent>
      </IndustryDialog>
    </IndustryRoleShell>
  );
}
