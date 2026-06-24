// Calvary Financial Operations - Complete Finance Dashboard
// Tailored for logistics: trips, fleet expenses, fuel, driver allowances
// For Calvary Investment Company Ltd

"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useRole } from '@/hooks/use-role';
import { useSupabase } from '@/components/supabase-provider';
import { useToast } from '@/hooks/use-toast';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  // Navigation & UI
  LayoutDashboard, ChevronLeft, ChevronRight, ChevronDown, Search, Filter,
  Plus, Edit, Trash2, Eye, Download, Upload, RefreshCw, MoreHorizontal,
  ArrowLeft, ArrowRight, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle,
  X, Save, Settings, FileText, Printer, Send, Copy, ExternalLink, Calendar,

  // Financial Icons
  DollarSign, CreditCard, Wallet, Banknote, Landmark, Receipt, FileSpreadsheet,
  TrendingUp, TrendingDown, BarChart3, PieChart, LineChart, Activity, Target,
  Percent, Calculator, Scale, Building2, Coins, Bitcoin,

  // Logistics-specific
  Truck, Fuel, Wrench, Users, Route, MapPin, Package, Weight, Timer,

  // Status Icons
  Clock, CheckCircle, XCircle, AlertTriangle, BadgeCheck, Shield,

  // Categories
  ArrowRightLeft, ReceiptText, PiggyBank, CreditCardIcon, BanknoteIcon,
  LandmarkIcon, ScrollText, PackageIcon, Car, FuelIcon, SettingsIcon
} from 'lucide-react';

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
  tripType: string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  total_amount: number;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'awaiting-payment' | 'part-paid';
  trip_id?: string;
  amount_paid?: number;
  balance?: number;
  tripType?: string;
  vat_amount?: number;
  created_at: string;
}

interface Expense {
  id: string;
  expense_number: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  vehicle_id?: string;
  vehicle_plate?: string;
  trip_id?: string;
  vendor_name?: string;
  payment_method?: string;
  created_at?: string;
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference?: string;
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
  source?: string;
  created_at: string;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  currency: string;
  current_balance: number;
  is_active: boolean;
}

interface Account {
  id: string;
  code: string;
  name: string;
  category: string;
  sub_category?: string;
  type: 'debit' | 'credit';
  current_balance: number;
  is_active: boolean;
  currency: string;
}

interface FinanceStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  pendingInvoices: number;
  pendingAmount: number;
  cashBalance: number;
  fuelCosts: number;
  driverCosts: number;
  maintenanceCosts: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const EXPENSE_CATEGORIES = {
  FUEL: { label: 'Fuel', icon: Fuel, color: 'text-amber-600', bg: 'bg-amber-100' },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-100' },
  DRIVER_ALLOWANCE: { label: 'Driver Allowance', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
  TOLL: { label: 'Toll & Border', icon: MapPin, color: 'text-purple-600', bg: 'bg-purple-100' },
  INSURANCE: { label: 'Insurance', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  OTHER: { label: 'Other', icon: Receipt, color: 'text-slate-600', bg: 'bg-slate-100' },
};

const INVOICE_STATUS = {
  draft: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-700' },
  sent: { label: 'Sent', bg: 'bg-blue-100', text: 'text-blue-700' },
  paid: { label: 'Paid', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'awaiting-payment': { label: 'Awaiting', bg: 'bg-amber-100', text: 'text-amber-700' },
  'part-paid': { label: 'Part Paid', bg: 'bg-cyan-100', text: 'text-cyan-700' },
  overdue: { label: 'Overdue', bg: 'bg-red-100', text: 'text-red-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100', text: 'text-gray-700' },
};

const EXPENSE_STATUS = {
  pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-700' },
  approved: { label: 'Approved', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-700' },
  reimbursed: { label: 'Reimbursed', bg: 'bg-blue-100', text: 'text-blue-700' },
};

const categoryColors: Record<string, { bg: string; text: string }> = {
  ASSETS: { bg: 'bg-blue-50', text: 'text-blue-700' },
  LIABILITIES: { bg: 'bg-red-50', text: 'text-red-700' },
  EQUITY: { bg: 'bg-purple-50', text: 'text-purple-700' },
  REVENUE: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  OPERATING_EXPENSES: { bg: 'bg-amber-50', text: 'text-amber-700' },
  EXPENSES: { bg: 'bg-amber-50', text: 'text-amber-700' },
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export function FinancialOperations() {
  const { role } = useRole();
  const { user } = useSupabase();
  const { toast } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview');

  // Data States
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stats
  const [stats, setStats] = useState<FinanceStats>({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    profitMargin: 0,
    pendingInvoices: 0,
    pendingAmount: 0,
    cashBalance: 0,
    fuelCosts: 0,
    driverCosts: 0,
    maintenanceCosts: 0,
  });

  // Filter States
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseDateFrom, setExpenseDateFrom] = useState('');
  const [expenseDateTo, setExpenseDateTo] = useState('');

  // Dialog States
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddJournalEntry, setShowAddJournalEntry] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);

  // Form States
  const [newInvoice, setNewInvoice] = useState({
    client_name: '',
    total_amount: '',
    due_date: '',
    trip_id: '',
    description: '',
  });

  const [newExpense, setNewExpense] = useState({
    category: 'FUEL',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    vehicle_id: '',
    vendor_name: '',
    payment_method: 'cash',
  });

  // Load all data
  useEffect(() => {
    loadAllData();
  }, [user]);

  const loadAllData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Load invoices
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setInvoices(invoicesData || []);

      // Load expenses
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);
      setExpenses(expensesData || []);

      // Load journal entries
      const { data: jeData } = await supabase
        .from('journal_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .limit(50);
      setJournalEntries(jeData || []);

      // Load bank accounts
      const { data: bankData } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true);
      setBankAccounts(bankData || []);

      // Load chart of accounts
      const { data: accountsData } = await supabase
        .from('accounts')
        .select('*')
        .order('code');
      setAccounts(accountsData || []);

      // Load trips for linking
      const { data: tripsData } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      setTrips(tripsData || []);

      // Calculate stats
      calculateStats(invoicesData || [], expensesData || [], bankData || []);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (inv: Invoice[], exp: Expense[], bank: BankAccount[]) => {
    const totalRevenue = inv
      .filter(i => i.status === 'paid' || i.status === 'part-paid')
      .reduce((sum, i) => sum + (i.amount_paid || 0), (inv.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.total_amount - (i.amount_paid || 0)), 0)));

    const totalExpenses = exp
      .filter(e => e.status === 'approved' || e.status === 'reimbursed')
      .reduce((sum, e) => sum + e.amount, 0);

    const pendingAmount = inv
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((sum, i) => sum + (i.total_amount - (i.amount_paid || 0)), 0);

    const fuelCosts = exp.filter(e => e.category === 'FUEL').reduce((sum, e) => sum + e.amount, 0);
    const driverCosts = exp.filter(e => e.category === 'DRIVER_ALLOWANCE').reduce((sum, e) => sum + e.amount, 0);
    const maintenanceCosts = exp.filter(e => e.category === 'MAINTENANCE').reduce((sum, e) => sum + e.amount, 0);
    const cashBalance = bank.reduce((sum, b) => sum + b.current_balance, 0);

    setStats({
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
      pendingInvoices: inv.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length,
      pendingAmount,
      cashBalance,
      fuelCosts,
      driverCosts,
      maintenanceCosts,
    });
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'TZS') => {
    if (!amount && amount !== 0) return 'Tsh 0';
    const symbol = currency === 'USD' ? '$' : 'Tsh';
    return `${symbol} ${amount.toLocaleString()}`;
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (invoiceStatusFilter !== 'all' && inv.status !== invoiceStatusFilter) return false;
    if (invoiceSearch) {
      const term = invoiceSearch.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(term) ||
        inv.client_name?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Filter expenses
  const filteredExpenses = expenses.filter(exp => {
    if (expenseCategoryFilter !== 'all' && exp.category !== expenseCategoryFilter) return false;
    if (expenseSearch) {
      const term = expenseSearch.toLowerCase();
      return (
        exp.expense_number?.toLowerCase().includes(term) ||
        exp.description?.toLowerCase().includes(term) ||
        exp.vehicle_plate?.toLowerCase().includes(term)
      );
    }
    if (expenseDateFrom && exp.date < expenseDateFrom) return false;
    if (expenseDateTo && exp.date > expenseDateTo) return false;
    return true;
  });

  // Add Invoice
  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const invoiceData = {
        invoice_number: `INV-${Date.now()}`,
        client_name: newInvoice.client_name,
        total_amount: parseFloat(newInvoice.total_amount),
        due_date: newInvoice.due_date,
        status: 'draft',
        description: newInvoice.description,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('invoices').insert([invoiceData]);
      if (error) throw error;

      toast({ title: 'Success', description: 'Invoice created successfully' });
      setShowAddInvoice(false);
      setNewInvoice({ client_name: '', total_amount: '', due_date: '', trip_id: '', description: '' });
      loadAllData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Add Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expenseData = {
        expense_number: `EXP-${Date.now()}`,
        category: newExpense.category,
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        date: newExpense.date,
        status: 'pending',
        vendor_name: newExpense.vendor_name,
        payment_method: newExpense.payment_method,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('expenses').insert([expenseData]);
      if (error) throw error;

      toast({ title: 'Success', description: 'Expense recorded successfully' });
      setShowAddExpense(false);
      setNewExpense({ category: 'FUEL', description: '', amount: '', date: new Date().toISOString().split('T')[0], vehicle_id: '', vendor_name: '', payment_method: 'cash' });
      loadAllData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Approve/Reject Expense
  const handleExpenseAction = async (id: string, action: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase.from('expenses').update({ status: action }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: `Expense ${action}` });
      loadAllData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Get account totals by category
  const getCategoryTotal = (category: string) => {
    return accounts
      .filter(a => a.category === category && a.is_active)
      .reduce((sum, a) => sum + (a.type === 'debit' ? a.current_balance : -a.current_balance), 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl shadow-lg">
                <Landmark className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Financial Operations</h1>
                <p className="text-sm text-slate-500">Calvary Investment Company Ltd - Finance Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={loadAllData} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
              {(role === 'CEO' || role === 'ADMIN' || role === 'ACCOUNTANT') && (
                <>
                  <Dialog open={showAddInvoice} onOpenChange={setShowAddInvoice}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4" /> New Invoice
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create New Invoice</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddInvoice} className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Client Name</Label>
                          <Input
                            value={newInvoice.client_name}
                            onChange={(e) => setNewInvoice({...newInvoice, client_name: e.target.value})}
                            placeholder="Client name"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Amount (Tsh)</Label>
                          <Input
                            type="number"
                            value={newInvoice.total_amount}
                            onChange={(e) => setNewInvoice({...newInvoice, total_amount: e.target.value})}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input
                            type="date"
                            value={newInvoice.due_date}
                            onChange={(e) => setNewInvoice({...newInvoice, due_date: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={newInvoice.description}
                            onChange={(e) => setNewInvoice({...newInvoice, description: e.target.value})}
                            placeholder="Trip reference, cargo details"
                          />
                        </div>
                        <Button type="submit" className="w-full">Create Invoice</Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
                        <Plus className="w-4 h-4" /> Record Expense
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Record New Expense</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleAddExpense} className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Select value={newExpense.category} onValueChange={(v) => setNewExpense({...newExpense, category: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(EXPENSE_CATEGORIES).map(([key, config]) => (
                                <SelectItem key={key} value={key}>{config.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            value={newExpense.description}
                            onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                            placeholder="Brief description"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Amount (Tsh)</Label>
                          <Input
                            type="number"
                            value={newExpense.amount}
                            onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={newExpense.date}
                            onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Payment Method</Label>
                          <Select value={newExpense.payment_method} onValueChange={(v) => setNewExpense({...newExpense, payment_method: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="bank">Bank Transfer</SelectItem>
                              <SelectItem value="mpesa">M-Pesa</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700">Record Expense</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Financial Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 font-medium">Total Revenue</p>
                <p className="text-xl font-bold text-emerald-700">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-slate-500">From invoices paid</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 font-medium">Total Expenses</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(stats.totalExpenses)}</p>
                <p className="text-xs text-slate-500">Operational costs</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Net Profit</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(stats.netProfit)}</p>
                <p className="text-xs text-slate-500">{stats.profitMargin.toFixed(1)}% margin</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg"><Calculator className="w-5 h-5 text-blue-600" /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 font-medium">Pending Invoices</p>
                <p className="text-xl font-bold text-amber-700">{formatCurrency(stats.pendingAmount)}</p>
                <p className="text-xs text-slate-500">{stats.pendingInvoices} invoices</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-600 font-medium">Cash Balance</p>
                <p className="text-xl font-bold text-purple-700">{formatCurrency(stats.cashBalance)}</p>
                <p className="text-xs text-slate-500">Across all accounts</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg"><Wallet className="w-5 h-5 text-purple-600" /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Fuel Costs</p>
                <p className="text-xl font-bold text-orange-700">{formatCurrency(stats.fuelCosts)}</p>
                <p className="text-xs text-slate-500">This period</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg"><Fuel className="w-5 h-5 text-orange-600" /></div>
            </div>
          </motion.div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="journals">Journals</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Expense Breakdown */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-violet-600" />
                    Expense Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { key: 'FUEL', label: 'Fuel', amount: stats.fuelCosts, color: 'bg-amber-500' },
                      { key: 'DRIVER_ALLOWANCE', label: 'Driver Allowances', amount: stats.driverCosts, color: 'bg-blue-500' },
                      { key: 'MAINTENANCE', label: 'Maintenance', amount: stats.maintenanceCosts, color: 'bg-orange-500' },
                      { key: 'OTHER', label: 'Other Expenses', amount: stats.totalExpenses - stats.fuelCosts - stats.driverCosts - stats.maintenanceCosts, color: 'bg-slate-500' },
                    ].map((item) => {
                      const percentage = stats.totalExpenses > 0 ? (item.amount / stats.totalExpenses) * 100 : 0;
                      return (
                        <div key={item.key} className="flex items-center gap-4">
                          <div className={cn('w-3 h-8 rounded-full', item.color)} />
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium">{item.label}</span>
                              <span className="text-slate-500">{formatCurrency(item.amount)} ({percentage.toFixed(1)}%)</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Bank Accounts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-emerald-600" />
                    Bank Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {bankAccounts.map((account) => (
                      <div key={account.id} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-slate-900">{account.account_name}</p>
                            <p className="text-sm text-slate-500">{account.bank_name}</p>
                          </div>
                          <Badge variant="outline">{account.currency}</Badge>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(account.current_balance)}</p>
                        <p className="text-xs text-slate-400">****{account.account_number}</p>
                      </div>
                    ))}
                    {bankAccounts.length === 0 && (
                      <p className="text-center text-slate-500 py-4">No bank accounts configured</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.slice(0, 5).map((je) => (
                      <TableRow key={je.id}>
                        <TableCell className="text-sm">{new Date(je.entry_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{je.description}</TableCell>
                        <TableCell className="font-mono text-sm text-blue-600">{je.entry_number}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(je.total_debit)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(je.total_credit)}</TableCell>
                      </TableRow>
                    ))}
                    {journalEntries.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">No transactions yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INVOICES TAB */}
          <TabsContent value="invoices" className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search invoices..."
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="awaiting-payment">Awaiting</SelectItem>
                      <SelectItem value="part-paid">Part Paid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => {
                    const statusConfig = INVOICE_STATUS[inv.status] || INVOICE_STATUS.draft;
                    const isOverdue = new Date(inv.due_date) < new Date() && inv.status !== 'paid';

                    return (
                      <TableRow key={inv.id} className={isOverdue ? 'bg-red-50/50' : ''}>
                        <TableCell className="font-mono font-semibold">{inv.invoice_number}</TableCell>
                        <TableCell className="font-medium">{inv.client_name}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(inv.total_amount)}</TableCell>
                        <TableCell className={cn('text-sm', isOverdue ? 'text-red-600 font-medium' : '')}>
                          {new Date(inv.due_date).toLocaleDateString()}
                          {isOverdue && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(statusConfig.bg, statusConfig.text)}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-4 h-4" /></Button>
                            {inv.status === 'draft' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Send className="w-4 h-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredInvoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">No invoices found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* EXPENSES TAB */}
          <TabsContent value="expenses" className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row gap-4 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search expenses..."
                      value={expenseSearch}
                      onChange={(e) => setExpenseSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.entries(EXPENSE_CATEGORIES).map(([key, config]) => (
                        <SelectItem key={key} value={key}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={expenseDateFrom}
                      onChange={(e) => setExpenseDateFrom(e.target.value)}
                      className="w-36"
                      placeholder="From"
                    />
                    <span className="text-slate-400">-</span>
                    <Input
                      type="date"
                      value={expenseDateTo}
                      onChange={(e) => setExpenseDateTo(e.target.value)}
                      className="w-36"
                      placeholder="To"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Expense #</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((exp) => {
                    const categoryConfig = EXPENSE_CATEGORIES[exp.category as keyof typeof EXPENSE_CATEGORIES] || EXPENSE_CATEGORIES.OTHER;
                    const statusConfig = EXPENSE_STATUS[exp.status] || EXPENSE_STATUS.pending;
                    const Icon = categoryConfig.icon;

                    return (
                      <TableRow key={exp.id}>
                        <TableCell className="font-mono font-semibold">{exp.expense_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn('p-1.5 rounded', categoryConfig.bg)}>
                              <Icon className={cn('w-4 h-4', categoryConfig.color)} />
                            </div>
                            <span className="font-medium">{categoryConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{exp.description}</TableCell>
                        <TableCell className="text-sm">{exp.vehicle_plate || '-'}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">{formatCurrency(exp.amount)}</TableCell>
                        <TableCell className="text-sm">{new Date(exp.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge className={cn(statusConfig.bg, statusConfig.text)}>{statusConfig.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {exp.status === 'pending' && (role === 'CEO' || role === 'ADMIN' || role === 'ACCOUNTANT') && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-emerald-600 hover:text-emerald-700"
                                onClick={() => handleExpenseAction(exp.id, 'approved')}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-red-600 hover:text-red-700"
                                onClick={() => handleExpenseAction(exp.id, 'rejected')}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredExpenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500">No expenses found</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* ACCOUNTS TAB (Chart of Accounts) */}
          <TabsContent value="accounts" className="space-y-6">
            {/* Category Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {['ASSETS', 'LIABILITIES', 'EQUITY', 'REVENUE', 'OPERATING_EXPENSES'].map((category) => {
                const colors = categoryColors[category] || { bg: 'bg-slate-50', text: 'text-slate-700' };
                const total = getCategoryTotal(category);

                return (
                  <Card key={category} className={cn(colors.bg, 'border')}>
                    <CardContent className="p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{category.replace('_', ' ')}</p>
                      <p className={cn('text-xl font-bold mt-1', colors.text)}>{formatCurrency(Math.abs(total))}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Accounts Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-24">Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Currency</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => {
                    const categoryConfig = categoryColors[account.category] || { bg: 'bg-slate-50', text: 'text-slate-700' };

                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono font-semibold">{account.code}</TableCell>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell>
                          <Badge className={cn(categoryConfig.bg, categoryConfig.text)}>{account.category.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{account.type}</Badge>
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-semibold',
                          account.current_balance >= 0 ? 'text-emerald-600' : 'text-red-600'
                        )}>
                          {formatCurrency(Math.abs(account.current_balance))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{account.currency || 'TZS'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={account.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}>
                            {account.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {accounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">No accounts configured</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* JOURNALS TAB */}
          <TabsContent value="journals" className="space-y-6">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Entry #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journalEntries.map((je) => (
                    <TableRow key={je.id}>
                      <TableCell className="font-mono font-semibold text-blue-600">{je.entry_number}</TableCell>
                      <TableCell className="text-sm">{new Date(je.entry_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{je.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{je.source || 'manual'}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(je.total_debit)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(je.total_credit)}</TableCell>
                      <TableCell>
                        {je.is_posted ? (
                          <Badge className="bg-emerald-100 text-emerald-700">Posted</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">Draft</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {journalEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">No journal entries yet</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
