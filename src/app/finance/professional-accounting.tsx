"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRole } from "@/hooks/use-role";
import { useSupabase } from "@/components/supabase-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Search, Plus, Download, RefreshCw, 
  TrendingUp, TrendingDown, Calculator, Landmark, Wallet,
  Clock, AlertTriangle, FileText, Receipt, PieChart, Activity,
  Users, Fuel, Wrench, Shield, Send, Eye, ArrowRight, ArrowLeft,
  ChevronDown, Filter, FileSpreadsheet, History
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// INTERFACES
// ============================================================

interface Trip {
  id: string;
  origin: string;
  destination: string;
  client: string;
  salesAmount: number;
  status: string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  total_amount: number;
  due_date: string;
  status: string;
  trip_id?: string;
  amount_paid?: number;
  currency?: string;
  created_at: string;
}

interface Expense {
  id: string;
  expense_number: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: string;
  vehicle_plate?: string;
  created_at: string;
}

interface JournalEntryLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
  lines?: JournalEntryLine[];
  created_at: string;
}

interface ChartOfAccount {
  code: string;
  name: string;
  type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  balance: number;
  group: string;
  normal: 'debit' | 'credit';
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  current_balance: number;
  is_active: boolean;
}

interface FinanceStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  pendingAmount: number;
  cashBalance: number;
  fuelCosts: number;
  driverCosts: number;
  maintenanceCosts: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const EXPENSE_CATEGORIES: Record<string, any> = {
  FUEL: { label: 'Fuel', icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-100' },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-100' },
  DRIVER_ALLOWANCE: { label: 'Driver Allowance', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
  TOLL: { label: 'Toll & Border', icon: Shield, color: 'text-purple-600', bg: 'bg-purple-100' },
  OTHER: { label: 'Other', icon: Receipt, color: 'text-slate-600', bg: 'bg-slate-100' },
};

const INVOICE_STATUS: Record<string, any> = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-700' },
  sent: { label: 'Sent', bg: 'bg-blue-100', text: 'text-blue-700' },
  paid: { label: 'Paid', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  overdue: { label: 'Overdue', bg: 'bg-red-100', text: 'text-red-700' },
  pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-700' },
};

export function FinancialOperations() {
  const { role } = useRole();
  const { user } = useSupabase();
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);

  // Data States
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [coa, setCoa] = useState<ChartOfAccount[]>([]);

  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');

  // Dialog States
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddJournal, setShowAddJournal] = useState(false);
  const [showCOA, setShowCOA] = useState(false);

  // Form States
  const [newInvoice, setNewInvoice] = useState({
    client_name: '',
    total_amount: '',
    due_date: '',
    description: '',
    trip_id: '',
  });

  const [newExpense, setNewExpense] = useState({
    category: 'FUEL',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    trip_id: '',
  });

  const [newJournal, setNewJournal] = useState({
    description: '',
    entry_date: new Date().toISOString().split('T')[0],
    lines: [
      { account_code: '', debit: 0, credit: 0 },
      { account_code: '', debit: 0, credit: 0 }
    ]
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invoicesRes, expensesRes, jeRes, bankRes, tripsRes, coaRes] = await Promise.all([
        supabase.from("invoices").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("expenses").select("*").order("date", { ascending: false }).limit(50),
        supabase.from("journal_entries").select("*").order("entry_date", { ascending: false }).limit(20),
        supabase.from("bank_accounts").select("*").eq('is_active', true),
        supabase.from("trips").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("chart_of_accounts").select("*").order("code"),
      ]);

      setInvoices(invoicesRes.data || []);
      setExpenses(expensesRes.data || []);
      setJournalEntries(jeRes.data || []);
      setBankAccounts(bankRes.data || []);
      setTrips(tripsRes.data || []);
      setCoa(coaRes.data || []);
    } catch (error) {
      console.error("Error loading financial data:", error);
      toast({ title: "Error", description: "Failed to load financial data", variant: "destructive" });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const stats = useMemo<FinanceStats>(() => {
    const totalRevenue = invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + (i.total_amount || 0), 0);

    const totalExpenses = expenses
      .filter(e => e.status === 'approved' || e.status === 'reimbursed')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const pendingAmount = invoices
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + ((i.total_amount || 0) - (i.amount_paid || 0)), 0);

    const fuelCosts = expenses.filter(e => e.category === 'FUEL').reduce((sum, e) => sum + (e.amount || 0), 0);
    const driverCosts = expenses.filter(e => e.category === 'DRIVER_ALLOWANCE').reduce((sum, e) => sum + (e.amount || 0), 0);
    const maintenanceCosts = expenses.filter(e => e.category === 'MAINTENANCE').reduce((sum, e) => sum + (e.amount || 0), 0);
    const cashBalance = bankAccounts.reduce((sum, b) => sum + (b.current_balance || 0), 0);

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
      pendingAmount,
      cashBalance,
      fuelCosts,
      driverCosts,
      maintenanceCosts,
    };
  }, [invoices, expenses, bankAccounts]);

  const formatCurrency = (amount: number, currency: string = "TZS") => {
    const symbol = currency === "USD" ? "$" : "Tsh";
    return `${symbol} ${Math.abs(amount || 0).toLocaleString()}`;
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                         inv.client_name?.toLowerCase().includes(invoiceSearch.toLowerCase());
    const matchesStatus = invoiceStatusFilter === 'all' || inv.status.toLowerCase() === invoiceStatusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.expense_number?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
                         exp.description?.toLowerCase().includes(expenseSearch.toLowerCase());
    const matchesCategory = expenseCategoryFilter === 'all' || exp.category === expenseCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('invoices').insert({
        invoice_number: `INV-${Date.now()}`,
        client_name: newInvoice.client_name,
        total_amount: parseFloat(newInvoice.total_amount),
        due_date: newInvoice.due_date,
        status: 'draft',
        description: newInvoice.description,
        trip_id: newInvoice.trip_id || null,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'Invoice created successfully' });
      setShowAddInvoice(false);
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('expenses').insert({
        expense_number: `EXP-${Date.now()}`,
        category: newExpense.category,
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        date: newExpense.date,
        status: 'pending',
        trip_id: newExpense.trip_id || null,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'Expense recorded successfully' });
      setShowAddExpense(false);
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="bg-white border-b sticky top-0 z-50 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200">
              <Landmark className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Financial Operations</h1>
              <p className="text-sm text-slate-500 font-medium">Calvary Investment Company Ltd</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadData} size="sm" className="gap-2 h-10 px-4 border-slate-200 hover:bg-slate-50">
              <RefreshCw className="w-4 h-4 text-slate-500" /> Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2 h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white shadow-sm">
                  <Plus className="w-4 h-4" /> New Transaction <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-2">
                <DropdownMenuItem onClick={() => setShowAddInvoice(true)} className="gap-2 py-2 cursor-pointer">
                  <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600"><FileText className="w-4 h-4" /></div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Customer Invoice</span>
                    <span className="text-[10px] text-slate-500">Bill a client for services</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddExpense(true)} className="gap-2 py-2 cursor-pointer">
                  <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600"><Receipt className="w-4 h-4" /></div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Operational Expense</span>
                    <span className="text-[10px] text-slate-500">Record costs and payments</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddJournal(true)} className="gap-2 py-2 cursor-pointer">
                  <div className="p-1.5 bg-purple-50 rounded-lg text-purple-600"><Activity className="w-4 h-4" /></div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Journal Entry</span>
                    <span className="text-[10px] text-slate-500">Manual ledger adjustment</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowCOA(true)} className="gap-2 py-2 cursor-pointer">
                  <div className="p-1.5 bg-slate-50 rounded-lg text-slate-600"><LayoutDashboard className="w-4 h-4" /></div>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">Chart of Accounts</span>
                    <span className="text-[10px] text-slate-500">Manage ledger structure</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/finance/bank-statement">
              <Button size="sm" className="gap-2 h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                <Landmark className="w-4 h-4" /> Reconcile Bank
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {[
            { label: 'Total Revenue', val: stats.totalRevenue, icon: TrendingUp, col: 'text-emerald-600', bg: 'bg-emerald-100', desc: 'Paid invoices' },
            { label: 'Total Expenses', val: stats.totalExpenses, icon: TrendingDown, col: 'text-red-600', bg: 'bg-red-100', desc: 'Operating costs' },
            { label: 'Net Profit', val: stats.netProfit, icon: Calculator, col: 'text-blue-600', bg: 'bg-blue-100', desc: `${stats.profitMargin.toFixed(1)}% margin` },
            { label: 'Receivables', val: stats.pendingAmount, icon: Clock, col: 'text-amber-600', bg: 'bg-amber-100', desc: 'Unpaid amount' },
            { label: 'Cash Balance', val: stats.cashBalance, icon: Wallet, col: 'text-purple-600', bg: 'bg-purple-100', desc: 'All bank accounts' },
            { label: 'Fuel Costs', val: stats.fuelCosts, icon: Fuel, col: 'text-orange-600', bg: 'bg-orange-100', desc: 'This period' },
          ].map((s, i) => (
            <Card key={i} className="border-none shadow-sm overflow-hidden group">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className={cn("p-2 rounded-lg", s.bg)}>
                    <s.icon className={cn("w-5 h-5", s.col)} />
                  </div>
                  <Badge variant="secondary" className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider">TSH</Badge>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                <p className="text-xl font-black text-slate-800">{formatCurrency(s.val)}</p>
                <p className="text-[10px] font-medium text-slate-500 mt-1">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl w-fit">
            <TabsTrigger value="overview" className="rounded-lg px-6">Overview</TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-lg px-6">Invoices</TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg px-6">Expenses</TabsTrigger>
            <TabsTrigger value="journals" className="rounded-lg px-6">Journal</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-indigo-600" />
                    Expense Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    { label: 'Fuel', amount: stats.fuelCosts, color: 'bg-amber-500' },
                    { label: 'Driver Allowance', amount: stats.driverCosts, color: 'bg-blue-500' },
                    { label: 'Maintenance', amount: stats.maintenanceCosts, color: 'bg-orange-500' },
                    { label: 'Other', amount: stats.totalExpenses - stats.fuelCosts - stats.driverCosts - stats.maintenanceCosts, color: 'bg-slate-400' },
                  ].map((item, i) => {
                    const pct = stats.totalExpenses > 0 ? (item.amount / stats.totalExpenses) * 100 : 0;
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-sm font-bold text-slate-700">
                          <span>{item.label}</span>
                          <span>{formatCurrency(item.amount)} ({pct.toFixed(1)}%)</span>
                        </div>
                        <Progress value={pct} className={cn("h-2", item.color)} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-emerald-600" />
                    Bank Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bankAccounts.map((acc) => (
                    <div key={acc.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-200 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-slate-800">{acc.account_name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{acc.bank_name}</p>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">{acc.currency}</Badge>
                      </div>
                      <p className="text-xl font-black text-emerald-600">{formatCurrency(acc.current_balance)}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-1">****{acc.account_number.slice(-4)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Recent Ledger Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="font-bold">Date</TableHead>
                      <TableHead className="font-bold">Description</TableHead>
                      <TableHead className="font-bold">Entry #</TableHead>
                      <TableHead className="text-right font-bold">Debit</TableHead>
                      <TableHead className="text-right font-bold">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.slice(0, 8).map((je) => (
                      <TableRow key={je.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="text-xs font-medium">{new Date(je.entry_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-bold text-slate-700">{je.description}</TableCell>
                        <TableCell className="font-mono text-xs text-blue-600 font-bold">{je.entry_number}</TableCell>
                        <TableCell className="text-right font-bold text-red-500">{formatCurrency(je.total_debit)}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(je.total_credit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      placeholder="Search by invoice number or client name..." 
                      className="pl-10 h-11 bg-slate-50 border-none focus-visible:ring-blue-500"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                      <SelectTrigger className="w-[160px] h-11 bg-white border-slate-200">
                        <div className="flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-slate-400" />
                          <SelectValue placeholder="All Status" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" className="h-11 px-4 gap-2 border-slate-200">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Invoice #</TableHead>
                    <TableHead className="font-bold">Client</TableHead>
                    <TableHead className="text-right font-bold">Amount</TableHead>
                    <TableHead className="font-bold">Due Date</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => {
                    const status = INVOICE_STATUS[inv.status.toLowerCase()] || INVOICE_STATUS.draft;
                    const isOverdue = new Date(inv.due_date) < new Date() && inv.status !== 'paid';
                    return (
                      <TableRow key={inv.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono font-bold text-blue-600">{inv.invoice_number}</TableCell>
                        <TableCell className="font-bold text-slate-700">{inv.client_name}</TableCell>
                        <TableCell className="text-right font-black text-slate-900">{formatCurrency(inv.total_amount)}</TableCell>
                        <TableCell className={cn("text-xs font-bold", isOverdue ? "text-red-500" : "text-slate-500")}>
                          {new Date(inv.due_date).toLocaleDateString()}
                          {isOverdue && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                        </TableCell>
                        <TableCell><Badge className={cn("border-none", status.bg, status.text)}>{status.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600"><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600"><Download className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600"><Send className="w-4 h-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-6">
            <Card className="border-none shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      placeholder="Search expenses by number or description..." 
                      className="pl-10 h-11 bg-slate-50 border-none focus-visible:ring-amber-500"
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                      <SelectTrigger className="w-[180px] h-11 bg-white border-slate-200">
                        <div className="flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-slate-400" />
                          <SelectValue placeholder="All Categories" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {Object.entries(EXPENSE_CATEGORIES).map(([key, config]) => (
                          <SelectItem key={key} value={key}>{config.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" className="h-11 px-4 gap-2 border-slate-200">
                      <History className="w-4 h-4 text-blue-600" /> Audit Trail
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-bold">Expense #</TableHead>
                    <TableHead className="font-bold">Category</TableHead>
                    <TableHead className="font-bold">Description</TableHead>
                    <TableHead className="text-right font-bold">Amount</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="text-right font-bold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((exp) => {
                    const cat = EXPENSE_CATEGORIES[exp.category] || EXPENSE_CATEGORIES.OTHER;
                    return (
                      <TableRow key={exp.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono font-bold text-amber-600">{exp.expense_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1.5 rounded-lg", cat.bg)}><cat.icon className={cn("w-3 h-3", cat.color)} /></div>
                            <span className="text-xs font-bold text-slate-700">{cat.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-600 max-w-xs truncate">{exp.description}</TableCell>
                        <TableCell className="text-right font-black text-red-500">{formatCurrency(exp.amount)}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-500">{new Date(exp.date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600"><Eye className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Invoice Dialog */}
      <Dialog open={showAddInvoice} onOpenChange={setShowAddInvoice}>
        <DialogContent className="max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" /> Create New Invoice
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddInvoice} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Client Name</Label>
              <Input className="bg-slate-50 border-none" value={newInvoice.client_name} onChange={(e) => setNewInvoice({...newInvoice, client_name: e.target.value})} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Amount (TSH)</Label>
                <Input type="number" className="bg-slate-50 border-none h-11" value={newInvoice.total_amount} onChange={(e) => setNewInvoice({...newInvoice, total_amount: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Due Date</Label>
                <Input type="date" className="bg-slate-50 border-none h-11" value={newInvoice.due_date} onChange={(e) => setNewInvoice({...newInvoice, due_date: e.target.value})} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Related Trip</Label>
              <Select value={newInvoice.trip_id} onValueChange={(v) => setNewInvoice({...newInvoice, trip_id: v})}>
                <SelectTrigger className="bg-slate-50 border-none h-11"><SelectValue placeholder="Select a trip (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No related trip</SelectItem>
                  {trips.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.origin} → {t.destination} ({t.client})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Description</Label>
              <Textarea className="bg-slate-50 border-none min-h-[100px]" value={newInvoice.description} onChange={(e) => setNewInvoice({...newInvoice, description: e.target.value})} placeholder="Enter trip or service details..." />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11 font-bold">Generate Invoice</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
        <DialogContent className="max-w-md border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-600" /> Record Expense
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddExpense} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Category</Label>
              <Select value={newExpense.category} onValueChange={(v) => setNewExpense({...newExpense, category: v})}>
                <SelectTrigger className="bg-slate-50 border-none h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORIES).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Amount (TSH)</Label>
              <Input type="number" className="bg-slate-50 border-none h-11 font-bold" value={newExpense.amount} onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Date</Label>
              <Input type="date" className="bg-slate-50 border-none" value={newExpense.date} onChange={(e) => setNewExpense({...newExpense, date: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Related Trip</Label>
              <Select value={newExpense.trip_id} onValueChange={(v) => setNewExpense({...newExpense, trip_id: v})}>
                <SelectTrigger className="bg-slate-50 border-none h-11"><SelectValue placeholder="Link to trip (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General Expense</SelectItem>
                  {trips.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.origin} → {t.destination}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Description</Label>
              <Input className="bg-slate-50 border-none" value={newExpense.description} onChange={(e) => setNewExpense({...newExpense, description: e.target.value})} required placeholder="e.g. Fuel for T.255 AAA" />
            </div>
            <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 h-11 font-bold">Record Transaction</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Journal Entry Dialog */}
      <Dialog open={showAddJournal} onOpenChange={setShowAddJournal}>
        <DialogContent className="max-w-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-600" /> New Journal Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Description</Label>
                <Input value={newJournal.description} onChange={(e) => setNewJournal({...newJournal, description: e.target.value})} placeholder="e.g. Year-end adjustment" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Entry Date</Label>
                <Input type="date" value={newJournal.entry_date} onChange={(e) => setNewJournal({...newJournal, entry_date: e.target.value})} />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Entry Lines</Label>
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {newJournal.lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Select 
                            value={line.account_code} 
                            onValueChange={(val) => {
                              const updatedLines = [...newJournal.lines];
                              updatedLines[idx].account_code = val;
                              setNewJournal({...newJournal, lines: updatedLines});
                            }}
                          >
                            <SelectTrigger className="border-none shadow-none h-8 bg-transparent text-xs font-bold">
                              <SelectValue placeholder="Select Account" />
                            </SelectTrigger>
                            <SelectContent>
                              {coa.map(account => (
                                <SelectItem key={account.code} value={account.code} className="text-xs">
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-0">
                          <Input 
                            type="number" 
                            className="border-none shadow-none text-right font-bold text-red-500 h-10 bg-transparent"
                            value={line.debit}
                            onChange={(e) => {
                              const updatedLines = [...newJournal.lines];
                              updatedLines[idx].debit = parseFloat(e.target.value) || 0;
                              setNewJournal({...newJournal, lines: updatedLines});
                            }}
                          />
                        </TableCell>
                        <TableCell className="p-0">
                          <Input 
                            type="number" 
                            className="border-none shadow-none text-right font-bold text-emerald-600 h-10 bg-transparent"
                            value={line.credit}
                            onChange={(e) => {
                              const updatedLines = [...newJournal.lines];
                              updatedLines[idx].credit = parseFloat(e.target.value) || 0;
                              setNewJournal({...newJournal, lines: updatedLines});
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-300 hover:text-red-500"
                            onClick={() => {
                              const updatedLines = newJournal.lines.filter((_, i) => i !== idx);
                              setNewJournal({...newJournal, lines: updatedLines});
                            }}
                          >
                            <Plus className="w-4 h-4 rotate-45" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 text-xs font-bold gap-2"
                onClick={() => setNewJournal({...newJournal, lines: [...newJournal.lines, { account_code: '', debit: 0, credit: 0 }]})}
              >
                <Plus className="w-3 h-3" /> Add Line
              </Button>
            </div>

            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl mt-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Debit</p>
                  <p className="text-sm font-black text-red-500">{formatCurrency(newJournal.lines.reduce((s, l) => s + l.debit, 0))}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Credit</p>
                  <p className="text-sm font-black text-emerald-600">{formatCurrency(newJournal.lines.reduce((s, l) => s + l.credit, 0))}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {newJournal.lines.reduce((s, l) => s + l.debit, 0) !== newJournal.lines.reduce((s, l) => s + l.credit, 0) && (
                  <Badge variant="destructive" className="text-[9px] uppercase font-bold">Entry Unbalanced</Badge>
                )}
                <Button 
                  disabled={newJournal.lines.reduce((s, l) => s + l.debit, 0) !== newJournal.lines.reduce((s, l) => s + l.credit, 0)}
                  className="bg-purple-600 hover:bg-purple-700 font-bold"
                >
                  Post Entry
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chart of Accounts Dialog */}
      <Dialog open={showCOA} onOpenChange={setShowCOA}>
        <DialogContent className="max-w-4xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-slate-600" /> Chart of Accounts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="flex justify-between items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Search accounts..." className="pl-10 h-10 bg-slate-50 border-none" />
              </div>
              <Button className="bg-slate-900 font-bold gap-2"><Plus className="w-4 h-4" /> New Account</Button>
            </div>
            
            <div className="border rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  <TableRow>
                    <TableHead className="font-bold">Code</TableHead>
                    <TableHead className="font-bold">Account Name</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Normal</TableHead>
                    <TableHead className="text-right font-bold">Current Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coa.map(account => (
                    <TableRow key={account.code} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-bold text-blue-600">{account.code}</TableCell>
                      <TableCell className="font-bold text-slate-700">{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100 text-[10px] uppercase font-bold text-slate-500">{account.type}</Badge>
                      </TableCell>
                      <TableCell className="text-[10px] uppercase font-bold text-slate-400">{account.normal}</TableCell>
                      <TableCell className="text-right font-black text-slate-900">{formatCurrency(account.balance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
