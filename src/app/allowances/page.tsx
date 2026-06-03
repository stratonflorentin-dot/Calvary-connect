"use client";

import { useState, useEffect } from 'react';
import { useSupabase } from '@/components/supabase-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Coins, Calculator, Truck, Globe, Plus, RefreshCw,
  User, DollarSign, Calendar, Search, Trash2, CheckCircle,
  XCircle, Info, Landmark, AlertCircle, FileText
} from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';
import { toast } from '@/hooks/use-toast';
import { Sidebar } from '@/components/navigation/sidebar';
import { useRole } from '@/hooks/use-role';
import {
  getWorkersAction,
  savePayrollAction,
  getPayrollHistoryAction,
  approvePayrollRecordAction,
  rejectPayrollRecordAction,
  deletePayrollRecordAction,
  updateWorkerSalaryAction
} from './actions';

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
}

export default function AllowancesPage() {
  const { user } = useSupabase();
  const { role } = useRole();
  const { format } = useCurrency();

  // State management
  const [activeTab, setActiveTab] = useState<'process' | 'history'>('process');
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [history, setHistory] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Manual payroll input states (indexed by workerId)
  const [baseSalaries, setBaseSalaries] = useState<Record<string, number>>({});
  const [allowancesInputs, setAllowancesInputs] = useState<Record<string, number>>({});
  const [deductionsInputs, setDeductionsInputs] = useState<Record<string, number>>({});
  const [periods, setPeriods] = useState<Record<string, string>>({});
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Filter history
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'payroll' | 'trip'>('all');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch Workers
      const workersRes = await getWorkersAction();
      if (workersRes.success && workersRes.workers) {
        // Initialize inputs with default values
        const initialSalaries: Record<string, number> = {};
        const initialAllowances: Record<string, number> = {};
        const initialDeductions: Record<string, number> = {};
        const initialPeriods: Record<string, string> = {};
        const initialMethods: Record<string, string> = {};
        const initialNotes: Record<string, string> = {};

        const currentMonthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

        workersRes.workers.forEach((w: any) => {
          // Fallback salaries based on role if not set in database
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

      // 2. Fetch History
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

  // Live input changes
  const handleNumChange = (workerId: string, value: string, setter: React.Dispatch<React.SetStateAction<Record<string, number>>>) => {
    const num = parseFloat(value.replace(/,/g, '')) || 0;
    setter(prev => ({ ...prev, [workerId]: num }));
  };

  // Process / Submit manual payroll for a worker
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
      // 1. If base salary changed, update their profile Master Salary
      if (base !== worker.salary) {
        await updateWorkerSalaryAction(workerId, base);
      }

      // 2. Save payroll record
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
        // Clear allowance/deductions/notes
        setAllowancesInputs(prev => ({ ...prev, [workerId]: 0 }));
        setDeductionsInputs(prev => ({ ...prev, [workerId]: 0 }));
        setNotes(prev => ({ ...prev, [workerId]: '' }));
        // Reload directories
        await loadHistory();
      } else {
        toast({ title: "Submission Failed", description: res.error || "Could not submit payroll.", variant: "destructive" });
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "Failed to process request.", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  // Approve payroll record (triggers Professional Accounting Journal Entries & Ledger Sync)
  const handleApprovePayroll = async (id: string) => {
    if (!user) return;
    setActionLoading(id);
    try {
      const res = await approvePayrollRecordAction(id, user.id);
      if (res.success) {
        toast({
          title: "Payroll Approved",
          description: "Compensation record approved, expense logged, and payable invoice generated."
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

  // Reject payroll record
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

  // Delete payroll record
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

  // Parse custom payroll breakdown from JSON reason field
  const parseReason = (reasonStr: string) => {
    try {
      if (reasonStr && reasonStr.startsWith('{')) {
        return JSON.parse(reasonStr);
      }
    } catch (e) { }
    return null;
  };

  // Search filter for process list
  const filteredWorkers = workers.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.employee_id && w.employee_id.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Search & Type filter for history
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

  // Calculate high-level financial summary cards (filter manual payroll paid/approved entries)
  const statsPending = history.filter(h => h.status === 'pending').reduce((sum, h) => sum + h.amount, 0);
  const statsApproved = history.filter(h => h.status === 'approved').reduce((sum, h) => sum + h.amount, 0);
  const statsPaid = history.filter(h => h.status === 'paid').reduce((sum, h) => sum + h.amount, 0);
  const statsTotalWorkers = workers.length;

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      <Sidebar role={role || 'DRIVER'} />

      <main className="flex-1 md:ml-60 p-6 md:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
                Calvary Worker Payroll & Allowances Center
              </h1>
              <p className="text-muted-foreground mt-1">
                Manually manage base salaries, process allowances, and track monthly staff compensation.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                onClick={loadData}
                disabled={loading}
                className="border-border bg-card hover:bg-muted text-foreground"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Sync System
              </Button>
              <Button asChild className="bg-sky-700 text-white hover:bg-sky-800">
                <a href="/admin/hr/payroll/statutory">
                  <FileText className="w-4 h-4 mr-2" />
                  Statutory Reports
                </a>
              </Button>
            </div>
          </div>

          {/* Premium Overview Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-card border-border backdrop-blur-md shadow-xl hover:border-amber-500/50 transition-all duration-300">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-500">Pending Approval</p>
                  <p className="text-2xl font-bold text-amber-500 dark:text-amber-400 mt-1">{format(statsPending)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Awaiting manager process</p>
                </div>
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-amber-500 dark:text-amber-400 animate-pulse" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border backdrop-blur-md shadow-xl hover:border-blue-500/50 transition-all duration-300">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Approved Ledger</p>
                  <p className="text-2xl font-bold text-blue-500 dark:text-blue-400 mt-1">{format(statsApproved)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Synced to bills & expenses</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                  <Coins className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border backdrop-blur-md shadow-xl hover:border-green-500/50 transition-all duration-300">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-500">Disbursed Wages</p>
                  <p className="text-2xl font-bold text-green-500 dark:text-green-400 mt-1">{format(statsPaid)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Successfully paid workers</p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center">
                  <Landmark className="w-6 h-6 text-green-500 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border backdrop-blur-md shadow-xl hover:border-indigo-500/50 transition-all duration-300">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Active Directory</p>
                  <p className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mt-1">{statsTotalWorkers}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Registered company profiles</p>
                </div>
                <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center">
                  <User className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-border gap-1">
            <button
              onClick={() => setActiveTab('process')}
              className={`px-6 py-3 font-semibold text-sm transition-all duration-200 border-b-2 flex items-center gap-2 ${activeTab === 'process'
                  ? 'border-primary text-primary bg-card'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              <Coins className="w-4 h-4" />
              Process Worker Payroll
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-3 font-semibold text-sm transition-all duration-200 border-b-2 flex items-center gap-2 ${activeTab === 'history'
                  ? 'border-primary text-primary bg-card'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              <FileText className="w-4 h-4" />
              Payroll Ledger & History
            </button>
          </div>

          {/* Processing Grid View */}
          {activeTab === 'process' && (
            <div className="space-y-6">
              {/* Directory Filter Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border p-4 rounded-xl backdrop-blur-sm">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search workers by name, role or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
                  />
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  Updating an employee's Base Salary updates their global master profile.
                </div>
              </div>

              {/* Workers Input Grid */}
              <div className="grid grid-cols-1 gap-6">
                {loading ? (
                  <div className="text-center py-16 bg-card border border-border rounded-2xl">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
                    <p className="text-muted-foreground mt-3 font-medium">Analyzing worker directories...</p>
                  </div>
                ) : filteredWorkers.length === 0 ? (
                  <div className="text-center py-16 bg-card border border-border rounded-2xl text-muted-foreground">
                    No active worker profiles match your criteria.
                  </div>
                ) : (
                  filteredWorkers.map((worker) => {
                    const baseSalary = baseSalaries[worker.id] || 0;
                    const allowances = allowancesInputs[worker.id] || 0;
                    const deductions = deductionsInputs[worker.id] || 0;
                    const netSalary = baseSalary + allowances - deductions;
                    const isProcessing = actionLoading === worker.id;

                    return (
                      <Card
                        key={worker.id}
                        className="bg-card border-border hover:border-muted-foreground/30 transition-all duration-200 overflow-hidden shadow-md"
                      >
                        {/* Worker Identity Header */}
                        <div className="p-4 md:p-6 bg-muted/30 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold border border-blue-400/20 shadow-md">
                              {worker.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-foreground">{worker.name}</h3>
                                <Badge className="bg-muted text-foreground border-border font-medium">
                                  {worker.role}
                                </Badge>
                                {(worker as any).employee_id && (worker as any).employee_id !== 'N/A' && (
                                  <Badge variant="outline" className="border-primary/50 text-primary font-mono text-[10px] tracking-wide">
                                    {(worker as any).employee_id}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{worker.email}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                            <div>
                              <label className="block text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Period</label>
                              <select
                                value={periods[worker.id]}
                                onChange={(e) => setPeriods(prev => ({ ...prev, [worker.id]: e.target.value }))}
                                className="mt-1 block w-44 rounded-lg bg-background border border-border text-foreground py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="May 2026">May 2026</option>
                                <option value="June 2026">June 2026</option>
                                <option value="July 2026">July 2026</option>
                                <option value="August 2026">August 2026</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Method</label>
                              <select
                                value={paymentMethods[worker.id]}
                                onChange={(e) => setPaymentMethods(prev => ({ ...prev, [worker.id]: e.target.value }))}
                                className="mt-1 block w-40 rounded-lg bg-background border border-border text-foreground py-1.5 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Mobile Money">Mobile Money</option>
                                <option value="Cash">Cash</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Input Controls Grid */}
                        <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                          {/* Base Salary */}
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                              <DollarSign className="w-3.5 h-3.5 text-primary" />
                              Base Salary (TZS)
                            </label>
                            <div className="relative">
                              <Input
                                value={baseSalary.toLocaleString()}
                                onChange={(e) => handleNumChange(worker.id, e.target.value, setBaseSalaries)}
                                className="bg-background border-border text-foreground focus-visible:ring-primary font-mono text-sm pr-12"
                              />
                              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">TZS</span>
                            </div>
                          </div>

                          {/* Allowances */}
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5 text-green-500" />
                              Allowances (TZS)
                            </label>
                            <div className="relative">
                              <Input
                                value={allowances.toLocaleString()}
                                onChange={(e) => handleNumChange(worker.id, e.target.value, setAllowancesInputs)}
                                className="bg-background border-border text-foreground focus-visible:ring-green-500 font-mono text-sm pr-12"
                              />
                              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">TZS</span>
                            </div>
                          </div>

                          {/* Deductions */}
                          <div>
                            <label className="block text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                              Deductions (TZS)
                            </label>
                            <div className="relative">
                              <Input
                                value={deductions.toLocaleString()}
                                onChange={(e) => handleNumChange(worker.id, e.target.value, setDeductionsInputs)}
                                className="bg-background border-border text-foreground focus-visible:ring-red-500 font-mono text-sm pr-12"
                              />
                              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">TZS</span>
                            </div>
                          </div>

                          {/* Live Net Calculations & Action */}
                          <div className="bg-muted/40 border border-border p-4 rounded-xl flex items-center justify-between col-span-1 sm:col-span-2 lg:col-span-1">
                            <div>
                              <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Calculated Net</p>
                              <p className={`text-xl font-black mt-1 font-mono ${netSalary >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {format(netSalary)}
                              </p>
                            </div>

                            <Button
                              onClick={() => handleProcessPayroll(worker)}
                              disabled={isProcessing || netSalary <= 0}
                              className="bg-primary hover:bg-primary/95 text-primary-foreground shadow-md font-semibold px-4"
                            >
                              {isProcessing ? 'Processing...' : 'Run Payroll'}
                            </Button>
                          </div>

                        </div>

                        {/* Extra Notes Input */}
                        <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-border pt-4 bg-muted/10">
                          <div className="relative flex items-center gap-3">
                            <Info className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <Input
                              placeholder="Add optional notes (e.g., 'Overtime 5 hours', 'Advance repayment')..."
                              value={notes[worker.id]}
                              onChange={(e) => setNotes(prev => ({ ...prev, [worker.id]: e.target.value }))}
                              className="bg-transparent border-none p-0 text-xs text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* History Ledger View */}
          {activeTab === 'history' && (
            <Card className="bg-card border-border shadow-xl backdrop-blur-sm overflow-hidden">
              <CardHeader className="border-b border-border p-6 bg-muted/20">
                <CardTitle className="text-xl font-bold text-foreground">Payroll Ledgers & Allowance Logs</CardTitle>
                <CardDescription className="text-muted-foreground">
                  History of manual payroll entries and automatic driver allowances processed in Supabase.
                </CardDescription>

                {/* History Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center gap-4 mt-6">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search history by employee name or details..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="pl-9 bg-background border-border text-foreground focus-visible:ring-primary"
                    />
                  </div>

                  <div className="flex gap-1 bg-background p-1 border border-border rounded-lg w-full sm:w-auto">
                    <button
                      onClick={() => setHistoryFilter('all')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 flex-1 sm:flex-none ${historyFilter === 'all' ? 'bg-muted text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      All Records
                    </button>
                    <button
                      onClick={() => setHistoryFilter('payroll')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 flex-1 sm:flex-none ${historyFilter === 'payroll' ? 'bg-muted text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Manual Payroll
                    </button>
                    <button
                      onClick={() => setHistoryFilter('trip')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 flex-1 sm:flex-none ${historyFilter === 'trip' ? 'bg-muted text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      Trip Allowances
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {loading ? (
                  <div className="text-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                    <p className="text-muted-foreground mt-3 text-sm">Synchronizing logs...</p>
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    No payroll or allowance records match the active criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/40 border-b border-border">
                        <TableRow className="border-b border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground font-bold text-xs uppercase py-4">Employee</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-xs uppercase py-4">Category</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-xs uppercase py-4">Period / Route</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-xs uppercase py-4">Breakdown</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-xs uppercase py-4">Net Salary</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-xs uppercase py-4">Status</TableHead>
                          <TableHead className="text-muted-foreground font-bold text-xs uppercase py-4">Processed At</TableHead>
                          <TableHead className="text-right text-muted-foreground font-bold text-xs uppercase py-4 pr-6">Ledger Actions</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filteredHistory.map((item) => {
                          const parsed = parseReason(item.reason);
                          const isManual = item.type === 'payroll';
                          const isActionLoading = actionLoading === item.id;

                          return (
                            <TableRow key={item.id} className="border-b border-border/80 hover:bg-muted/10">

                              {/* Employee */}
                              <TableCell className="py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center font-bold text-xs border border-border text-foreground">
                                    {item.employee_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground">{item.employee_name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted text-[10px] font-medium">
                                        {item.worker_role || 'Employee'}
                                      </Badge>
                                      {item.employee_id && item.employee_id !== 'N/A' && (
                                        <Badge variant="outline" className="border-primary/30 text-primary font-mono text-[9px] py-0 px-1.5 h-4 flex items-center">
                                          {item.employee_id}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Category */}
                              <TableCell className="py-4">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${isManual
                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-500 dark:text-blue-400'
                                    : 'bg-purple-500/10 border-purple-500/20 text-purple-500 dark:text-purple-400'
                                  }`}>
                                  {isManual ? 'Manual Payroll' : 'Trip Allowance'}
                                </span>
                              </TableCell>

                              {/* Period / Route */}
                              <TableCell className="py-4 text-xs font-semibold text-foreground">
                                {isManual ? (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-primary" />
                                    {parsed?.period || 'Monthly'}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground max-w-xs truncate block">
                                    Trip-based calculation
                                  </span>
                                )}
                              </TableCell>

                              {/* Breakdown details */}
                              <TableCell className="py-4 max-w-xs text-xs">
                                {isManual && parsed ? (
                                  <div className="space-y-1 text-muted-foreground font-mono">
                                    <p>Base: TZS {parsed.baseSalary?.toLocaleString()}</p>
                                    <p>Alw: TZS {parsed.allowances?.toLocaleString()}</p>
                                    <p>Ded: TZS {parsed.deductions?.toLocaleString()}</p>
                                    {parsed.note && <p className="text-[10px] text-muted-foreground/60 italic">"{parsed.note}"</p>}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic max-w-xs block truncate">
                                    {item.reason}
                                  </span>
                                )}
                              </TableCell>

                              {/* Net Salary Amount */}
                              <TableCell className="py-4 font-mono font-bold text-sm text-foreground">
                                {format(item.amount)}
                              </TableCell>

                              {/* Status Badge */}
                              <TableCell className="py-4">
                                <Badge
                                  variant="outline"
                                  className={`font-semibold capitalize text-[10px] ${item.status === 'paid' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' :
                                      item.status === 'approved' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                                        item.status === 'rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' :
                                          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 animate-pulse'
                                    }`}
                                >
                                  {item.status}
                                </Badge>
                              </TableCell>

                              {/* Date */}
                              <TableCell className="py-4 text-xs text-muted-foreground">
                                {new Date(item.created_at).toLocaleDateString()}
                              </TableCell>

                              {/* Actions */}
                              <TableCell className="py-4 text-right pr-6">
                                <div className="flex justify-end gap-2">
                                  {item.status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleApprovePayroll(item.id)}
                                        disabled={isActionLoading}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] h-7 px-3 font-semibold shadow-md"
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRejectPayroll(item.id)}
                                        disabled={isActionLoading}
                                        className="border-border hover:bg-muted text-foreground text-[10px] h-7 px-3 font-semibold"
                                      >
                                        Reject
                                      </Button>
                                    </>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeletePayroll(item.id)}
                                    disabled={isActionLoading}
                                    className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10 h-7 w-7 p-0 flex items-center justify-center rounded-lg"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>

                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </main>
    </div>
  );
}
