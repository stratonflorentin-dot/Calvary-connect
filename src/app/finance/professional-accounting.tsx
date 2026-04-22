"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRole } from '@/hooks/use-role';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sidebar } from '@/components/navigation/sidebar';
import {
  FileText, Receipt, Wallet, CreditCard, Banknote, ArrowRightLeft, Landmark,
  TrendingUp, TrendingDown, Plus, Search, Download, BookOpen, Calculator,
  Building2, Clock, ArrowUpRight, ArrowDownLeft, FileSpreadsheet, BarChart3,
  ArrowLeft, LayoutDashboard, ChevronLeft, Trash2, Save, X
} from 'lucide-react';

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
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'awaiting-payment' | 'part-paid';
  trip_id?: string;
  amount?: number;
  vat_amount?: number;
  balance?: number;
  booking_reference?: string;
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
  reference_type?: string;
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
  status?: string;
  currency?: string;
  source?: string;
  created_by?: string;
  created_at: string;
}

interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_code: string;
  account_name: string;
  partner?: string;
  description: string;
  debit: number;
  credit: number;
}

interface CreditNote {
  id: string;
  credit_note_number: string;
  invoice_id: string;
  invoice_number: string;
  client_name: string;
  amount: number;
  reason: string;
  status: 'draft' | 'issued' | 'applied' | 'voided';
  issue_date: string;
  created_at: string;
}

interface BankStatementEntry {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference_number?: string;
  debit_amount?: number;
  credit_amount?: number;
  balance?: number;
  reconciled: boolean;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  account_number: string;
  branch?: string;
  account_type: string;
  currency: string;
  current_balance: number;
  is_active: boolean;
}

interface ChartAccount {
  code: string;
  name: string;
  type: string;
  balance: number;
}

export function ProfessionalAccounting() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState('operations');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalEntryLines, setJournalEntryLines] = useState<JournalEntryLine[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search and filter states
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [expenseDateFrom, setExpenseDateFrom] = useState('');
  const [expenseDateTo, setExpenseDateTo] = useState('');
  const [jeSearch, setJeSearch] = useState('');
  const [cnSearch, setCnSearch] = useState('');
  
  // Journal Entry filter states
  const [jeSearchQuery, setJeSearchQuery] = useState('');
  const [jeStatusFilter, setJeStatusFilter] = useState('all');
  const [jeSourceFilter, setJeSourceFilter] = useState('all');
  const [jeDateFrom, setJeDateFrom] = useState('');
  const [jeDateTo, setJeDateTo] = useState('');
  const [filteredJournalEntries, setFilteredJournalEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  // Sync filtered entries when journalEntries changes
  useEffect(() => {
    setFilteredJournalEntries(journalEntries);
  }, [journalEntries]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invoicesRes, expensesRes, jeRes, bankRes, tripsRes, accountsRes] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('journal_entries').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('bank_accounts').select('*'),
        supabase.from('trips').select('id, origin, destination, client, salesAmount, status, created_at, payment_status')
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('accounts').select('*').order('code')
      ]);
      
      setInvoices(invoicesRes.data || []);
      setExpenses(expensesRes.data || []);
      setJournalEntries(jeRes.data || []);
      setFilteredJournalEntries(jeRes.data || []);
      setBankAccounts(bankRes.data || []);
      setAccounts(accountsRes.data || []);
      
      // Load journal entry lines
      const { data: jeLinesData } = await supabase.from('journal_entry_lines').select('*');
      setJournalEntryLines(jeLinesData || []);
      // Filter trips with pending payment status on client side
      const tripsData = tripsRes.data || [];
      const pendingTrips = tripsData.filter((t: any) => t.payment_status === 'PENDING' || !t.payment_status);
      setTrips(pendingTrips);
      
      // Check for errors
      const errors = [invoicesRes.error, expensesRes.error, jeRes.error, bankRes.error, tripsRes.error].filter(Boolean);
      if (errors.length > 0) {
        console.warn('Some tables may not exist yet:', errors);
      }
    } catch (error) {
      console.error('Error loading financial data:', error);
    }
    setIsLoading(false);
  };

  const formatCurrency = (amount: number, currency: string = 'TZS') => {
    if (!amount || isNaN(amount)) return `${currency === 'USD' ? '$' : 'Tsh'} 0`;
    const symbol = currency === 'USD' ? '$' : 'Tsh';
    const locale = currency === 'USD' ? 'en-US' : 'en-TZ';
    return `${symbol} ${amount.toLocaleString(locale)}`;
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-green-100 text-green-700 border-green-200',
      'part-paid': 'bg-amber-100 text-amber-700 border-amber-200',
      'awaiting-payment': 'bg-blue-100 text-blue-700 border-blue-200',
      approved: 'bg-green-100 text-green-700',
      posted: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      overdue: 'bg-red-100 text-red-700',
      rejected: 'bg-red-100 text-red-700',
      voided: 'bg-red-100 text-red-700',
      issued: 'bg-purple-100 text-purple-700',
      applied: 'bg-green-100 text-green-700',
      reimbursed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100';
  };

  // Split cash totals by currency - do NOT mix currencies
  const totalCashTSH = bankAccounts.filter(a => a.currency === 'TZS').reduce((a, b) => a + b.current_balance, 0);
  const totalCashUSD = bankAccounts.filter(a => a.currency === 'USD').reduce((a, b) => a + b.current_balance, 0);
  const totalReceivables = invoices.filter(i => i.status !== 'paid').reduce((a, b) => a + b.total_amount, 0);
  const totalPayables = 0; // From supplier_payments
  const monthlyRevenue = invoices.filter(i => i.status === 'paid').reduce((a, b) => a + b.total_amount, 0);
  const monthlyExpenses = expenses.reduce((a, b) => a + b.amount, 0);

  // Dialog states
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showCreateExpense, setShowCreateExpense] = useState(false);
  const [showInlineExpenseAdd, setShowInlineExpenseAdd] = useState(false);
  const [showInlineInvoiceAdd, setShowInlineInvoiceAdd] = useState(false);
  const [showInlineJEAdd, setShowInlineJEAdd] = useState(false);
  const [showCreateJournalEntry, setShowCreateJournalEntry] = useState(false);
  const [showCreateCreditNote, setShowCreateCreditNote] = useState(false);
  const [showBankStatementImport, setShowBankStatementImport] = useState(false);
  const [showAddBankAccount, setShowAddBankAccount] = useState(false);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<JournalEntry | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showViewExpense, setShowViewExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  
  // Form states
  const [invoiceForm, setInvoiceForm] = useState({ 
    client_name: '', 
    amount: '', 
    vat_rate: '18', 
    description: '', 
    due_days: '30',
    trip_id: '',
    status: 'draft',
    currency: 'TZS'
  });
  const [expenseForm, setExpenseForm] = useState({ category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], vehicle_id: '', status: 'pending', payment_method: 'cash', account_code: '', currency: 'TZS' });
  
  // Journal Entry Form
  const [jeForm, setJeForm] = useState({
    description: '',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'TZS',
    lines: [
      { account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' },
      { account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' }
    ]
  });
  
  // Credit Note Form
  const [cnForm, setCnForm] = useState({
    invoice_id: '',
    amount: '',
    reason: '',
    description: ''
  });
  
  // Bank Account Form
  const [bankForm, setBankForm] = useState({
    account_name: '',
    bank_name: '',
    account_number: '',
    branch: '',
    account_type: 'current',
    currency: 'TZS',
    opening_balance: ''
  });
  
  // Bank Statement Import
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [statementPeriodFrom, setStatementPeriodFrom] = useState('');
  const [statementPeriodTo, setStatementPeriodTo] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleTripSelect = (tripId: string) => {
    const selectedTrip = trips.find(t => t.id === tripId);
    if (selectedTrip) {
      setInvoiceForm({
        ...invoiceForm,
        trip_id: tripId,
        client_name: selectedTrip.client || '',
        amount: selectedTrip.salesAmount?.toString() || '',
        description: `Trip: ${selectedTrip.origin} → ${selectedTrip.destination}`
      });
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = parseFloat(invoiceForm.amount);
      const vatAmount = amount * (parseInt(invoiceForm.vat_rate) / 100);
      const totalAmount = amount + vatAmount;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + parseInt(invoiceForm.due_days));

      const invoiceNumber = `INV-${Date.now()}`;

      // Insert invoice
      const { data: invoiceData, error } = await supabase.from('invoices').insert({
        invoice_number: invoiceNumber,
        client_name: invoiceForm.client_name,
        amount: amount,
        subtotal: amount,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        currency: invoiceForm.currency || 'TZS',
        issue_date: new Date().toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: invoiceForm.status || 'draft',
        description: invoiceForm.description,
        trip_id: invoiceForm.trip_id || null,
        items: [],
        created_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;

      // Update trip payment status if linked
      if (invoiceForm.trip_id) {
        await supabase.from('trips').update({
          payment_status: 'PAID',
          updated_at: new Date().toISOString()
        }).eq('id', invoiceForm.trip_id);
      }

      // Create journal entry for invoice with proper accounting entries
      const { data: journalId, error: jeError } = await supabase.rpc('create_invoice_journal_entry', {
        p_invoice_id: invoiceData.id,
        p_invoice_number: invoiceNumber,
        p_client_name: invoiceForm.client_name,
        p_amount: amount,
        p_vat_amount: vatAmount,
        p_total_amount: totalAmount,
        p_description: invoiceForm.description
      });

      if (jeError) {
        console.warn('Journal entry creation failed:', jeError);
      }

      toast({ 
        title: 'Success', 
        description: `Invoice ${invoiceNumber} created${journalId ? ' with journal entry' : ''}` 
      });
      setInvoiceForm({ client_name: '', amount: '', vat_rate: '18', description: '', due_days: '30', trip_id: '', status: 'draft', currency: 'TZS' });
      setShowInlineInvoiceAdd(false);
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expenseNumber = `EXP-${Date.now()}`;

      // Insert expense with approved status to trigger journal entry
      const { data: expenseData, error } = await supabase.from('expenses').insert({
        expense_number: expenseNumber,
        category: expenseForm.category,
        type: expenseForm.category?.toUpperCase() || 'OTHER',
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        currency: expenseForm.currency || 'TZS',
        date: expenseForm.date,
        status: 'approved', // Auto-approve to create journal entry
        created_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;

      // Create journal entry for this expense via RPC
      const { data: journalId, error: rpcError } = await supabase.rpc('create_expense_journal_entry', {
        p_expense_id: expenseData.id,
        p_expense_number: expenseNumber,
        p_category: expenseForm.category,
        p_amount: parseFloat(expenseForm.amount),
        p_description: expenseForm.description,
        p_payment_method: expenseForm.payment_method || 'cash'
      });

      if (rpcError) {
        console.warn('Journal entry creation failed:', rpcError);
        // Don't throw - expense is still created
      }

      toast({ 
        title: 'Success', 
        description: `Expense ${expenseNumber} recorded${journalId ? ' with journal entry' : ''}` 
      });
      setExpenseForm({ category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], vehicle_id: '', status: 'pending', payment_method: 'cash', account_code: '', currency: 'TZS' });
      setShowInlineExpenseAdd(false);
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const updateInvoiceStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('invoices').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: `Invoice status updated to ${status}` });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const updateExpenseStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('expenses').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: `Expense status updated to ${status}` });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Journal Entry Handlers
  const addJournalEntryLine = () => {
    setJeForm({
      ...jeForm,
      lines: [...jeForm.lines, { account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' }]
    });
  };

  const updateJournalEntryLine = (index: number, field: string, value: string) => {
    const updatedLines = [...jeForm.lines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    setJeForm({ ...jeForm, lines: updatedLines });
  };

  const removeJournalEntryLine = (index: number) => {
    if (jeForm.lines.length > 1) {
      const updatedLines = jeForm.lines.filter((_, i) => i !== index);
      setJeForm({ ...jeForm, lines: updatedLines });
    }
  };

  const calculateJournalEntryTotals = () => {
    const totalDebit = jeForm.lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = jeForm.lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  };

  const handleCreateJournalEntry = async (e: React.FormEvent, asDraft: boolean = false) => {
    e.preventDefault();
    const { totalDebit, totalCredit, balanced } = calculateJournalEntryTotals();
    
    // Only require balance check when posting (not for drafts)
    if (!asDraft && !balanced) {
      toast({ title: 'Error', description: 'Debits must equal credits. Difference: ' + formatCurrency(Math.abs(totalDebit - totalCredit), jeForm.currency), variant: 'destructive' });
      return;
    }

    try {
      const entryNumber = editingJournalEntry 
        ? editingJournalEntry.entry_number.replace('DRAFT-', 'MJE-')
        : (asDraft ? `DRAFT-${Date.now()}` : `MJE-${Date.now()}`);
      
      // If editing a draft and posting, delete the old draft first
      if (editingJournalEntry && !asDraft) {
        // Delete old journal entry lines
        await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', editingJournalEntry.id);
        // Delete old journal entry
        await supabase.from('journal_entries').delete().eq('id', editingJournalEntry.id);
      }
      
      const { data: jeData, error: jeError } = await supabase.from('journal_entries').insert({
        entry_number: entryNumber,
        entry_date: jeForm.date,
        description: jeForm.description,
        reference: jeForm.reference,
        currency: jeForm.currency || 'TZS',
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_posted: !asDraft,
        status: asDraft ? 'draft' : 'posted',
        source: 'manual',
        created_at: new Date().toISOString()
      }).select().single();

      if (jeError) throw jeError;

      // Insert journal entry lines - filter out empty lines
      const linesToInsert = jeForm.lines
        .filter(line => line.account_code && line.account_code.trim() !== '')
        .map(line => ({
          journal_entry_id: jeData.id,
          account_code: line.account_code,
          description: line.description || line.account_name,
          debit_amount: parseFloat(line.debit) || 0,
          credit_amount: parseFloat(line.credit) || 0
        }));

      if (linesToInsert.length === 0) {
        throw new Error('No valid journal entry lines. Please select accounts for at least one line.');
      }

      const { error: linesError } = await supabase.from('journal_entry_lines').insert(linesToInsert);
      if (linesError) throw linesError;

      toast({ 
        title: 'Success', 
        description: editingJournalEntry && !asDraft
          ? `Draft converted to Journal Entry ${entryNumber} and posted`
          : (asDraft ? `Draft ${entryNumber} saved` : `Journal Entry ${entryNumber} created and posted`)
      });
      
      // Clear editing state
      setEditingJournalEntry(null);
      setShowCreateJournalEntry(false);
      setShowInlineJEAdd(false);
      setJeForm({
        description: '',
        reference: '',
        date: new Date().toISOString().split('T')[0],
        currency: 'TZS',
        lines: [
          { account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' },
          { account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' }
        ]
      });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Journal Entry Filter & Action Handlers
  const filterJournalEntries = () => {
    let filtered = [...journalEntries];
    
    // Search filter
    if (jeSearchQuery) {
      const query = jeSearchQuery.toLowerCase();
      filtered = filtered.filter(je => 
        je.entry_number?.toLowerCase().includes(query) ||
        je.description?.toLowerCase().includes(query) ||
        je.reference?.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (jeStatusFilter !== 'all') {
      filtered = filtered.filter(je => 
        jeStatusFilter === 'posted' ? je.is_posted : !je.is_posted
      );
    }
    
    // Source filter
    if (jeSourceFilter !== 'all') {
      filtered = filtered.filter(je => 
        (je.reference_type || 'manual').toLowerCase() === jeSourceFilter
      );
    }
    
    // Date range filter
    if (jeDateFrom) {
      filtered = filtered.filter(je => new Date(je.entry_date) >= new Date(jeDateFrom));
    }
    if (jeDateTo) {
      filtered = filtered.filter(je => new Date(je.entry_date) <= new Date(jeDateTo));
    }
    
    setFilteredJournalEntries(filtered);
  };

  const resetJournalEntryFilters = () => {
    setJeSearchQuery('');
    setJeStatusFilter('all');
    setJeSourceFilter('all');
    setJeDateFrom('');
    setJeDateTo('');
    setFilteredJournalEntries(journalEntries);
  };

  const viewJournalEntry = (je: JournalEntry) => {
    setSelectedJournalEntry(je);
    // Show a detailed view dialog
    toast({ 
      title: `Journal Entry ${je.entry_number}`, 
      description: `Date: ${new Date(je.entry_date).toLocaleDateString()} | Amount: ${formatCurrency(je.total_debit, je.currency)}` 
    });
  };

  // State for editing journal entries
  const [editingJournalEntry, setEditingJournalEntry] = useState<JournalEntry | null>(null);

  const editJournalEntry = async (je: JournalEntry) => {
    // Load the journal entry lines
    const { data: lines, error } = await supabase
      .from('journal_entry_lines')
      .select('*')
      .eq('journal_entry_id', je.id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to load journal entry lines', variant: 'destructive' });
      return;
    }

    // Populate the form with the draft data
    setJeForm({
      description: je.description || '',
      reference: je.reference || '',
      date: je.entry_date.split('T')[0],
      currency: je.currency || 'TZS',
      lines: lines?.map(line => ({
        account_code: line.account_code || '',
        account_name: line.account_name || '',
        partner: line.partner || '',
        description: line.description || '',
        debit: line.debit_amount?.toString() || '',
        credit: line.credit_amount?.toString() || ''
      })) || [{ account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' }]
    });

    setEditingJournalEntry(je);
    setActiveTab('create_journal_entry');
    
    toast({ 
      title: 'Editing Draft', 
      description: `Editing ${je.entry_number}. Make changes and click "Post Entry" to finalize.` 
    });
  };

  const cancelEditJournalEntry = () => {
    setEditingJournalEntry(null);
    setJeForm({
      description: '',
      reference: '',
      date: new Date().toISOString().split('T')[0],
      currency: 'TZS',
      lines: [
        { account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' },
        { account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' }
      ]
    });
  };

  const exportJournalEntriesToExcel = () => {
    const dataToExport = filteredJournalEntries.map(je => ({
      'Entry #': je.entry_number,
      'Date': new Date(je.entry_date).toLocaleDateString(),
      'Description': je.description,
      'Reference': je.reference,
      'Source': je.reference_type || 'Manual',
      'Total Debit': je.total_debit,
      'Total Credit': je.total_credit,
      'Status': je.is_posted ? 'Posted' : 'Draft',
      'Created At': new Date(je.created_at).toLocaleString()
    }));
    
    // Convert to CSV
    const headers = Object.keys(dataToExport[0] || {});
    const csv = [
      headers.join(','),
      ...dataToExport.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-entries-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({ title: 'Success', description: `${dataToExport.length} journal entries exported to CSV` });
  };

  const forceDeleteJournalEntry = async (je: JournalEntry) => {
    if (!confirm(`Are you sure you want to delete Journal Entry ${je.entry_number}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // First delete the lines
      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', je.id);
      
      if (linesError) throw linesError;
      
      // Then delete the entry
      const { error: entryError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', je.id);
      
      if (entryError) throw entryError;
      
      toast({ title: 'Success', description: `Journal Entry ${je.entry_number} has been deleted` });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Credit Note Handlers
  const handleCreateCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const invoice = invoices.find(i => i.id === cnForm.invoice_id);
      if (!invoice) {
        toast({ title: 'Error', description: 'Please select an invoice', variant: 'destructive' });
        return;
      }

      const cnNumber = `CN-${Date.now()}`;
      
      const { error } = await supabase.from('credit_notes').insert({
        credit_note_number: cnNumber,
        invoice_id: cnForm.invoice_id,
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name,
        amount: parseFloat(cnForm.amount),
        reason: cnForm.reason,
        description: cnForm.description,
        status: 'draft',
        issue_date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      toast({ title: 'Success', description: `Credit Note ${cnNumber} created` });
      setShowCreateCreditNote(false);
      setCnForm({ invoice_id: '', amount: '', reason: '', description: '' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const updateCreditNoteStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('credit_notes').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: `Credit Note status updated to ${status}` });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Bank Account Handlers
  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('bank_accounts').insert({
        account_name: bankForm.account_name,
        bank_name: bankForm.bank_name,
        account_number: bankForm.account_number,
        branch: bankForm.branch,
        account_type: bankForm.account_type,
        currency: bankForm.currency,
        opening_balance: parseFloat(bankForm.opening_balance) || 0,
        current_balance: parseFloat(bankForm.opening_balance) || 0,
        is_active: true,
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      toast({ title: 'Success', description: `Bank account ${bankForm.account_name} created` });
      setShowAddBankAccount(false);
      setBankForm({
        account_name: '',
        bank_name: '',
        account_number: '',
        branch: '',
        account_type: 'current',
        currency: 'TZS',
        opening_balance: ''
      });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Expense Action Handlers
  const handleViewExpense = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowViewExpense(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      category: expense.category,
      description: expense.description,
      amount: expense.amount.toString(),
      date: expense.date,
      vehicle_id: expense.vehicle_id || ''
    });
    setShowEditExpense(true);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    
    try {
      const { error } = await supabase.from('expenses').update({
        category: expenseForm.category,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        date: expenseForm.date,
        vehicle_id: expenseForm.vehicle_id || null,
        updated_at: new Date().toISOString()
      }).eq('id', editingExpense.id);

      if (error) throw error;

      toast({ title: 'Success', description: 'Expense updated successfully' });
      setShowEditExpense(false);
      setEditingExpense(null);
      setExpenseForm({ category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], vehicle_id: '', currency: 'TZS' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!confirm(`Are you sure you want to delete expense ${expense.expense_number}?`)) return;
    
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expense.id);
      if (error) throw error;
      
      toast({ title: 'Success', description: `Expense ${expense.expense_number} deleted` });
      loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Filtered data
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = !invoiceSearch || 
      inv.invoice_number.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.client_name.toLowerCase().includes(invoiceSearch.toLowerCase());
    const matchesStatus = invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredExpenses = expenses.filter(exp => 
    !expenseSearch || 
    exp.expense_number?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
    exp.description?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
    exp.category?.toLowerCase().includes(expenseSearch.toLowerCase())
  );

  // Note: filteredJournalEntries is now a state variable managed by filterJournalEntries()

  const filteredCreditNotes = creditNotes.filter(cn =>
    !cnSearch ||
    cn.credit_note_number?.toLowerCase().includes(cnSearch.toLowerCase()) ||
    cn.client_name?.toLowerCase().includes(cnSearch.toLowerCase()) ||
    cn.invoice_number?.toLowerCase().includes(cnSearch.toLowerCase())
  );

  // Invoice statistics
  const invoiceStats = {
    total: invoices.length,
    awaiting: invoices.filter(i => i.status === 'sent' || i.status === 'awaiting-payment').length,
    partPaid: invoices.filter(i => i.status === 'part-paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    outstandingBalance: invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + (i.total_amount || 0), 0)
  };

  // Journal Entry statistics
  const jeStats = {
    total: journalEntries.length,
    draft: journalEntries.filter(j => !j.is_posted).length,
    posted: journalEntries.filter(j => j.is_posted).length
  };

  // Credit Note statistics
  const cnStats = {
    draft: creditNotes.filter(c => c.status === 'draft').length,
    issued: creditNotes.filter(c => c.status === 'issued').length,
    applied: creditNotes.filter(c => c.status === 'applied').length,
    voided: creditNotes.filter(c => c.status === 'voided').length
  };

  if (isLoading) return (
    <div className="flex min-h-screen">
      <Sidebar role={role || 'CEO'} />
      <main className="flex-1 md:ml-60 p-8 text-center">Loading...</main>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role || 'CEO'} />
      <main className="flex-1 md:ml-60">
        {/* Header */}
        <div className="bg-white border-b p-6">
          <div className="max-w-7xl mx-auto">
            {/* Back Navigation */}
            <div className="flex items-center gap-4 mb-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-2">
                  <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Button>
              </Link>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold">Financial Command Center</h1>
                <p className="text-muted-foreground">Full ledger management for fleet logistics and corporate accounting</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setActiveTab('reports')}>
                  <BarChart3 className="h-4 w-4 mr-2" /> Reports
                </Button>
                <Dialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-2" /> Quick Entry</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create Quick Invoice</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCreateInvoice} className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Client Name</Label>
                        <Input value={invoiceForm.client_name} onChange={(e) => setInvoiceForm({...invoiceForm, client_name: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Amount (excl. VAT)</Label>
                        <Input type="number" step="0.01" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({...invoiceForm, amount: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>VAT Rate (%)</Label>
                        <Select value={invoiceForm.vat_rate} onValueChange={(v) => setInvoiceForm({...invoiceForm, vat_rate: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0% (Transit)</SelectItem>
                            <SelectItem value="18">18% (Local)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Due (days)</Label>
                        <Select value={invoiceForm.due_days} onValueChange={(v) => setInvoiceForm({...invoiceForm, due_days: v})}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="14">14 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="60">60 days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input value={invoiceForm.description} onChange={(e) => setInvoiceForm({...invoiceForm, description: e.target.value})} />
                      </div>
                      
                      {/* Trip Linking */}
                      <div className="space-y-2">
                        <Label>Link to Trip (Optional)</Label>
                        <Select value={invoiceForm.trip_id || 'none'} onValueChange={(v) => v === 'none' ? setInvoiceForm({...invoiceForm, trip_id: ''}) : handleTripSelect(v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select pending trip..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None - Standalone Invoice</SelectItem>
                            {trips.map((trip) => (
                              <SelectItem key={trip.id} value={trip.id}>
                                {trip.origin} → {trip.destination} | {trip.client || 'No client'} | Tsh {trip.salesAmount?.toLocaleString() || 0}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {invoiceForm.trip_id && invoiceForm.trip_id !== 'none' && (
                          <p className="text-xs text-green-600">✓ Auto-filled from trip data</p>
                        )}
                      </div>
                      
                      <Button type="submit" className="w-full">Create Invoice</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">
        {/* Financial Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cash & Bank</p>
                  <div className="space-y-1">
                    {totalCashTSH > 0 && (
                      <p className="text-xl font-bold">Tsh {totalCashTSH.toLocaleString('en-TZ')}</p>
                    )}
                    {totalCashUSD > 0 && (
                      <p className="text-lg font-bold text-blue-600">$ {totalCashUSD.toLocaleString('en-US')}</p>
                    )}
                    {totalCashTSH === 0 && totalCashUSD === 0 && (
                      <p className="text-2xl font-bold">Tsh 0</p>
                    )}
                  </div>
                </div>
                <Wallet className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Receivables</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalReceivables)}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Payables</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalPayables)}</p>
                </div>
                <ArrowDownLeft className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(monthlyRevenue)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className="text-2xl font-bold">{formatCurrency(monthlyExpenses)}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px] mb-6">
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Operations
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" /> Reports & Setup
            </TabsTrigger>
          </TabsList>

          {/* OPERATIONS TAB */}
          <TabsContent value="operations">
            <Tabs defaultValue="invoices">
              <TabsList className="flex flex-wrap h-auto gap-2 mb-4">
                <TabsTrigger value="invoices" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Invoices
                </TabsTrigger>
                <TabsTrigger value="expenses" className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Expenses
                </TabsTrigger>
                <TabsTrigger value="cash_requests" className="flex items-center gap-2">
                  <Banknote className="h-4 w-4" /> Cash Requests
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Supplier Payments
                </TabsTrigger>
                <TabsTrigger value="credit_notes" className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" /> Credit Notes
                </TabsTrigger>
                <TabsTrigger value="journal" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Journal Entries
                </TabsTrigger>
                <TabsTrigger value="bank" className="flex items-center gap-2">
                  <Landmark className="h-4 w-4" /> Bank Statements
                </TabsTrigger>
              </TabsList>

              {/* Invoices */}
              <TabsContent value="invoices">
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Total</p>
                        <p className="text-3xl font-bold mt-1">{invoices.length}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Awaiting</p>
                        <p className="text-3xl font-bold mt-1 text-blue-600">
                          {invoices.filter(i => i.status === 'sent' || i.status === 'awaiting-payment').length}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Part Paid</p>
                        <p className="text-3xl font-bold mt-1 text-yellow-600">
                          {invoices.filter(i => i.status === 'part-paid').length}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Overdue</p>
                        <p className="text-3xl font-bold mt-1 text-red-600">
                          {invoices.filter(i => i.status === 'overdue').length}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Paid</p>
                        <p className="text-3xl font-bold mt-1 text-green-600">
                          {invoices.filter(i => i.status === 'paid').length}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Outstanding Balance Banner */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-amber-800 font-medium">Outstanding Balance</p>
                        <p className="text-xs text-amber-600">Total unpaid across all open invoices</p>
                      </div>
                      <p className="text-2xl font-bold text-amber-800">
                        {formatCurrency(invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + (i.balance || i.total_amount || 0), 0))}
                      </p>
                    </div>
                  </div>

                  {/* Filters & Actions */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto">
                          <Input 
                            placeholder="Invoice #, client, booking #..." 
                            className="max-w-xs"
                            value={invoiceSearch}
                            onChange={(e) => setInvoiceSearch(e.target.value)}
                          />
                          <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="awaiting-payment">Awaiting Payment</SelectItem>
                              <SelectItem value="part-paid">Part Paid</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 w-full lg:w-auto">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              const voidedCount = invoices.filter(i => i.status === 'cancelled').length;
                              toast({ title: 'Info', description: `${voidedCount} voided/cancelled invoices` });
                            }}
                          >
                            <span className="text-muted-foreground mr-2">/</span> Voided / Cancelled
                          </Button>
                          <Button 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => setShowInlineInvoiceAdd(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" /> New Invoice
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                          onClick={() => {
                            // Apply filters logic
                            toast({ title: 'Filtered', description: 'Invoice list filtered' });
                          }}
                        >
                          Filter
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setInvoiceSearch('');
                            setInvoiceStatusFilter('all');
                          }}
                        >
                          Reset
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Invoices Table */}
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">Invoice #</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead className="w-[100px]">Booking</TableHead>
                            <TableHead className="w-[120px]">Status</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Balance Due</TableHead>
                            <TableHead className="w-[100px]">Due Date</TableHead>
                            <TableHead className="text-right w-[80px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Inline Add Form */}
                          {showInlineInvoiceAdd && (
                            <TableRow className="bg-blue-50/50">
                              <TableCell className="p-2">
                                <Input 
                                  placeholder="Auto-generated"
                                  disabled
                                  className="h-9 text-sm bg-muted"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input 
                                  value={invoiceForm.client_name}
                                  onChange={(e) => setInvoiceForm({...invoiceForm, client_name: e.target.value})}
                                  placeholder="Client name..."
                                  className="h-9 text-sm"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Select 
                                  value={invoiceForm.trip_id || 'none'} 
                                  onValueChange={(v) => {
                                    const tripId = v === 'none' ? '' : v;
                                    setInvoiceForm({...invoiceForm, trip_id: tripId});
                                    const trip = trips.find(t => t.id === tripId);
                                    if (trip) {
                                      setInvoiceForm(prev => ({...prev, amount: trip.salesAmount?.toString() || ''}));
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Trip" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    {trips.map(trip => (
                                      <SelectItem key={trip.id} value={trip.id}>
                                        {trip.origin} → {trip.destination}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                <Select 
                                  value={invoiceForm.status || 'draft'} 
                                  onValueChange={(v) => setInvoiceForm({...invoiceForm, status: v})}
                                >
                                  <SelectTrigger className="h-9 text-sm w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-gray-500"></span> Draft
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="sent">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Sent
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="paid">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Paid
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="overdue">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span> Overdue
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="cancelled">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-gray-700"></span> Cancelled
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="flex gap-1">
                                  <Select 
                                    value={invoiceForm.currency} 
                                    onValueChange={(v) => setInvoiceForm({...invoiceForm, currency: v})}
                                  >
                                    <SelectTrigger className="h-9 w-20 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="TZS">TSH</SelectItem>
                                      <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input 
                                    type="number"
                                    step="0.01"
                                    value={invoiceForm.amount}
                                    onChange={(e) => setInvoiceForm({...invoiceForm, amount: e.target.value})}
                                    placeholder="0.00"
                                    className="h-9 text-sm text-right flex-1"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="p-2">
                                <Input 
                                  type="number"
                                  step="0.01"
                                  value={invoiceForm.balance || invoiceForm.amount}
                                  onChange={(e) => setInvoiceForm({...invoiceForm, balance: e.target.value})}
                                  placeholder="0.00"
                                  className="h-9 text-sm text-right"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input 
                                  type="date"
                                  value={invoiceForm.due_date}
                                  onChange={(e) => setInvoiceForm({...invoiceForm, due_date: e.target.value})}
                                  className="h-9 text-sm"
                                />
                              </TableCell>
                              <TableCell className="p-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button 
                                    size="sm" 
                                    className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={handleCreateInvoice}
                                  >
                                    <Save className="h-3 w-3 mr-1" /> Save
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() => {
                                      setShowInlineInvoiceAdd(false);
                                      setInvoiceForm({ 
                                        client_name: '', 
                                        amount: '', 
                                        vat_rate: '18', 
                                        description: '', 
                                        due_days: '30', 
                                        trip_id: '',
                                        status: 'draft',
                                        currency: 'TZS'
                                      });
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {invoices.filter(inv => {
                            const matchesSearch = !invoiceSearch || 
                              inv.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                              inv.client_name?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                              inv.booking_reference?.toLowerCase().includes(invoiceSearch.toLowerCase());
                            const matchesStatus = invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter;
                            return matchesSearch && matchesStatus;
                          }).length === 0 && !showInlineInvoiceAdd ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                No invoices found matching your criteria
                              </TableCell>
                            </TableRow>
                          ) : (
                            invoices.filter(inv => {
                              const matchesSearch = !invoiceSearch || 
                                inv.invoice_number?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                                inv.client_name?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                                inv.booking_reference?.toLowerCase().includes(invoiceSearch.toLowerCase());
                              const matchesStatus = invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter;
                              return matchesSearch && matchesStatus;
                            }).map((inv) => (
                              <TableRow key={inv.id} className="hover:bg-muted/50">
                                <TableCell className="font-medium text-sm">
                                  <div className="text-blue-600">{inv.invoice_number}</div>
                                  <div className="text-xs text-muted-foreground">{new Date(inv.created_at || inv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                </TableCell>
                                <TableCell className="font-medium">{inv.client_name}</TableCell>
                                <TableCell>
                                  {inv.trip_id ? (
                                    <span className="text-xs text-muted-foreground">{inv.booking_reference || 'BK-' + inv.trip_id?.slice(0, 8)}</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    className={
                                      inv.status === 'paid' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                      inv.status === 'overdue' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                                      inv.status === 'sent' || inv.status === 'awaiting-payment' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' :
                                      inv.status === 'part-paid' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100' :
                                      'bg-gray-100 text-gray-700 hover:bg-gray-100'
                                    }
                                  >
                                    {inv.status === 'sent' ? 'Sent — Awaiting Payment' : inv.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(inv.total_amount)}</TableCell>
                                <TableCell className="text-right font-semibold text-blue-600">{formatCurrency(inv.balance || inv.total_amount)}</TableCell>
                                <TableCell className="text-sm">{new Date(inv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(inv)}>
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Expenses */}
              <TabsContent value="expenses">
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">This Month</p>
                        <p className="text-3xl font-bold mt-1">
                          {formatCurrency(expenses.filter(e => {
                            const expenseMonth = new Date(e.date).getMonth();
                            const currentMonth = new Date().getMonth();
                            return expenseMonth === currentMonth;
                          }).reduce((sum, e) => sum + e.amount, 0))}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Pending Approval</p>
                        <p className="text-3xl font-bold mt-1 text-yellow-600">
                          {expenses.filter(e => e.status === 'pending').length}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Posted to Ledger</p>
                        <p className="text-3xl font-bold mt-1 text-green-600">
                          {expenses.filter(e => e.status === 'approved' || e.status === 'reimbursed').length}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Filters & Actions */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto">
                          <Input 
                            placeholder="Expense #, description..." 
                            className="max-w-xs"
                            value={expenseSearch}
                            onChange={(e) => setExpenseSearch(e.target.value)}
                          />
                          <Select value={expenseStatusFilter} onValueChange={setExpenseStatusFilter}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="reimbursed">Reimbursed</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              <SelectItem value="Fuel">Fuel</SelectItem>
                              <SelectItem value="Maintenance">Maintenance</SelectItem>
                              <SelectItem value="Spare Parts">Spare Parts</SelectItem>
                              <SelectItem value="Insurance">Insurance</SelectItem>
                              <SelectItem value="License">License</SelectItem>
                              <SelectItem value="Tolls">Tolls</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Input 
                              type="date" 
                              placeholder="From"
                              value={expenseDateFrom}
                              onChange={(e) => setExpenseDateFrom(e.target.value)}
                            />
                            <Input 
                              type="date" 
                              placeholder="To"
                              value={expenseDateTo}
                              onChange={(e) => setExpenseDateTo(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 w-full lg:w-auto">
                          <Button variant="outline">
                            <Download className="h-4 w-4 mr-2" /> Export Excel
                          </Button>
                          <Button 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => setShowInlineExpenseAdd(true)}
                          >
                            <Plus className="h-4 w-4 mr-2" /> New Expense
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                        >
                          Filter
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setExpenseSearch('');
                            setExpenseStatusFilter('all');
                            setExpenseCategoryFilter('all');
                            setExpenseDateFrom('');
                            setExpenseDateTo('');
                          }}
                        >
                          Reset
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Expenses Table */}
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Expense #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Inline Add Form */}
                          {showInlineExpenseAdd && (
                            <TableRow className="bg-blue-50/50">
                              <TableCell className="p-2">
                                <Input 
                                  placeholder="Auto-generated"
                                  disabled
                                  className="h-9 text-sm bg-muted"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input 
                                  type="date"
                                  value={expenseForm.date}
                                  onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})}
                                  className="h-9 text-sm"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Input 
                                  value={expenseForm.description}
                                  onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                                  placeholder="Description..."
                                  className="h-9 text-sm"
                                />
                              </TableCell>
                              <TableCell className="p-2">
                                <Select 
                                  value={expenseForm.category} 
                                  onValueChange={(v) => setExpenseForm({...expenseForm, category: v})}
                                >
                                  <SelectTrigger className="h-9 text-sm">
                                    <SelectValue placeholder="Category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Fuel">Fuel</SelectItem>
                                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                                    <SelectItem value="Spare Parts">Spare Parts</SelectItem>
                                    <SelectItem value="Insurance">Insurance</SelectItem>
                                    <SelectItem value="License">License</SelectItem>
                                    <SelectItem value="Tolls">Tolls</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="space-y-1">
                                  <Select 
                                    value={expenseForm.account_code || ''} 
                                    onValueChange={(v) => setExpenseForm({...expenseForm, account_code: v})}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Chart of Accounts">
                                        {expenseForm.account_code && accounts.find(a => a.code === expenseForm.account_code)?.code}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {accounts.filter(a => ['OPERATING_EXPENSES', 'COST_OF_SALES', 'OTHER_EXPENSES'].includes(a.category)).map(acc => (
                                        <SelectItem key={acc.id} value={acc.code} className="text-xs">
                                          {acc.code} - {acc.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Select 
                                    value={expenseForm.payment_method || 'cash'} 
                                    onValueChange={(v) => setExpenseForm({...expenseForm, payment_method: v})}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Payment" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="cash" className="text-xs">Cash</SelectItem>
                                      <SelectItem value="bank" className="text-xs">Bank</SelectItem>
                                      <SelectItem value="mobile" className="text-xs">Mobile Money</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="flex gap-1">
                                  <Select 
                                    value={expenseForm.currency} 
                                    onValueChange={(v) => setExpenseForm({...expenseForm, currency: v})}
                                  >
                                    <SelectTrigger className="h-9 w-20 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="TZS">TSH</SelectItem>
                                      <SelectItem value="USD">USD</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input 
                                    type="number"
                                    step="0.01"
                                    value={expenseForm.amount}
                                    onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                                    placeholder="0.00"
                                    className="h-9 text-sm text-right flex-1"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                <Select 
                                  value={expenseForm.status || 'pending'} 
                                  onValueChange={(v) => setExpenseForm({...expenseForm, status: v})}
                                >
                                  <SelectTrigger className="h-9 text-sm w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Pending
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="approved">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Approved
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="paid">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Paid
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="rejected">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500"></span> Rejected
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button 
                                    size="sm" 
                                    className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={handleCreateExpense}
                                  >
                                    <Save className="h-3 w-3 mr-1" /> Save
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    className="h-8"
                                    onClick={() => {
                                      setShowInlineExpenseAdd(false);
                                      setExpenseForm({ 
                                        category: '', 
                                        description: '', 
                                        amount: '',
                                        currency: 'TZS', 
                                        date: new Date().toISOString().split('T')[0], 
                                        vehicle_id: '',
                                        status: 'pending',
                                        payment_method: 'cash',
                                        account_code: ''
                                      });
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          {filteredExpenses.length === 0 && !showInlineExpenseAdd ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                No expenses found matching your criteria
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredExpenses.map((exp) => (
                              <TableRow key={exp.id}>
                                <TableCell className="font-medium text-sm">{exp.expense_number}</TableCell>
                                <TableCell className="text-sm">{new Date(exp.date).toLocaleDateString('en-GB')}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{exp.description}</TableCell>
                                <TableCell><Badge variant="outline">{exp.category}</Badge></TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(exp.amount)}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={getStatusBadge(exp.status)}>{exp.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleViewExpense(exp)} title="View">
                                      <BookOpen className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleEditExpense(exp)} title="Edit">
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(exp)} title="Delete" className="text-blue-600 hover:text-blue-700">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    
                    {/* View Expense Dialog */}
                    <Dialog open={showViewExpense} onOpenChange={setShowViewExpense}>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Expense Details</DialogTitle>
                        </DialogHeader>
                        {selectedExpense && (
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-muted-foreground">Expense Number</Label>
                                <p className="font-semibold">{selectedExpense.expense_number}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Date</Label>
                                <p className="font-semibold">{formatDate(selectedExpense.date)}</p>
                              </div>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Category</Label>
                              <p className="font-semibold"><Badge variant="outline">{selectedExpense.category}</Badge></p>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Description</Label>
                              <p className="font-semibold">{selectedExpense.description}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-muted-foreground">Amount</Label>
                                <p className="font-semibold text-lg">{formatCurrency(selectedExpense.amount)}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Status</Label>
                                <p><Badge className={getStatusBadge(selectedExpense.status)}>{selectedExpense.status}</Badge></p>
                              </div>
                            </div>
                            {selectedExpense.vehicle_id && (
                              <div>
                                <Label className="text-muted-foreground">Vehicle ID</Label>
                                <p className="font-semibold">{selectedExpense.vehicle_id}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    
                    {/* Edit Expense Dialog */}
                    <Dialog open={showEditExpense} onOpenChange={setShowEditExpense}>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit Expense</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleUpdateExpense} className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label>Category</Label>
                            <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({...expenseForm, category: v})} required>
                              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Fuel">Fuel</SelectItem>
                                <SelectItem value="Maintenance">Maintenance</SelectItem>
                                <SelectItem value="Spare Parts">Spare Parts</SelectItem>
                                <SelectItem value="Insurance">Insurance</SelectItem>
                                <SelectItem value="License">License</SelectItem>
                                <SelectItem value="Tolls">Tolls</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Amount</Label>
                            <Input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} required />
                          </div>
                          <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})} required />
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditExpense(false)}>Cancel</Button>
                            <Button type="submit" className="flex-1">Update Expense</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
                </div>
              </TabsContent>

              {/* Create Expense Form - Full Page */}
              <TabsContent value="create_expense">
                <div className="max-w-2xl mx-auto">
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <Button 
                      variant="ghost" 
                      onClick={() => setActiveTab('operations')}
                      className="text-muted-foreground"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back to Expenses
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">Record New Expense</h2>
                      <p className="text-sm text-muted-foreground">Enter expense details below</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateExpense} className="space-y-6">
                    <Card>
                      <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="expense_category">Category *</Label>
                          <Select 
                            value={expenseForm.category} 
                            onValueChange={(v) => setExpenseForm({...expenseForm, category: v})} 
                            required
                          >
                            <SelectTrigger id="expense_category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Fuel">Fuel</SelectItem>
                              <SelectItem value="Maintenance">Maintenance</SelectItem>
                              <SelectItem value="Spare Parts">Spare Parts</SelectItem>
                              <SelectItem value="Insurance">Insurance</SelectItem>
                              <SelectItem value="License">License</SelectItem>
                              <SelectItem value="Tolls">Tolls</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="expense_description">Description *</Label>
                          <Textarea 
                            id="expense_description"
                            value={expenseForm.description} 
                            onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} 
                            placeholder="Enter expense description..."
                            rows={3}
                            required 
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="expense_amount">Amount (Tsh) *</Label>
                            <Input 
                              id="expense_amount"
                              type="number" 
                              step="0.01" 
                              value={expenseForm.amount} 
                              onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} 
                              placeholder="0.00"
                              required 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="expense_date">Date *</Label>
                            <Input 
                              id="expense_date"
                              type="date" 
                              value={expenseForm.date} 
                              onChange={(e) => setExpenseForm({...expenseForm, date: e.target.value})} 
                              required 
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="expense_vehicle">Vehicle (Optional)</Label>
                          <Select 
                            value={expenseForm.vehicle_id || 'none'} 
                            onValueChange={(v) => setExpenseForm({...expenseForm, vehicle_id: v === 'none' ? '' : v})}
                          >
                            <SelectTrigger id="expense_vehicle">
                              <SelectValue placeholder="Select vehicle" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {/* Vehicle options would be populated here */}
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-end gap-4">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => {
                          setActiveTab('operations');
                          setExpenseForm({ 
                            category: '', 
                            description: '', 
                            amount: '', 
                            date: new Date().toISOString().split('T')[0], 
                            vehicle_id: '' 
                          });
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Record Expense
                      </Button>
                    </div>
                  </form>
                </div>
              </TabsContent>

              {/* Cash Requests */}
              <TabsContent value="cash_requests">
                <Card className="p-8 text-center">
                  <Banknote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Cash Requests</h3>
                  <p className="text-muted-foreground">Petty cash and cash request management</p>
                  <Button className="mt-4"><Plus className="h-4 w-4 mr-2" /> New Request</Button>
                </Card>
              </TabsContent>

              {/* Supplier Payments */}
              <TabsContent value="payments">
                <Card className="p-8 text-center">
                  <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Supplier Payments</h3>
                  <p className="text-muted-foreground">Manage payments to fuel suppliers, maintenance vendors, etc.</p>
                  <Button className="mt-4"><Plus className="h-4 w-4 mr-2" /> New Payment</Button>
                </Card>
              </TabsContent>

              {/* Credit Notes */}
              <TabsContent value="credit_notes">
                <Card className="p-8 text-center">
                  <ArrowRightLeft className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Credit Notes</h3>
                  <p className="text-muted-foreground">Issue credit notes for returns, discounts, or corrections</p>
                  <Button className="mt-4"><Plus className="h-4 w-4 mr-2" /> New Credit Note</Button>
                </Card>
              </TabsContent>

              {/* Journal Entries */}
              <TabsContent value="journal">
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Total Entries</p>
                        <p className="text-3xl font-bold mt-1">{journalEntries.length}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Draft</p>
                        <p className="text-3xl font-bold mt-1 text-yellow-600">
                          {journalEntries.filter(je => !je.is_posted).length}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground uppercase tracking-wide">Posted</p>
                        <p className="text-3xl font-bold mt-1 text-green-600">
                          {journalEntries.filter(je => je.is_posted).length}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Filters & Actions */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto">
                          <Input 
                            placeholder="JE number, description..." 
                            className="max-w-xs"
                            value={jeSearchQuery}
                            onChange={(e) => setJeSearchQuery(e.target.value)}
                          />
                          <Select value={jeStatusFilter} onValueChange={setJeStatusFilter}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="posted">Posted</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={jeSourceFilter} onValueChange={setJeSourceFilter}>
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="All Sources" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Sources</SelectItem>
                              <SelectItem value="manual">Manual Entry</SelectItem>
                              <SelectItem value="bank">Bank Statement</SelectItem>
                              <SelectItem value="trip">Trip Invoice</SelectItem>
                              <SelectItem value="expense">Expense</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Input 
                              type="date" 
                              placeholder="From"
                              value={jeDateFrom}
                              onChange={(e) => setJeDateFrom(e.target.value)}
                            />
                            <Input 
                              type="date" 
                              placeholder="To"
                              value={jeDateTo}
                              onChange={(e) => setJeDateTo(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 w-full lg:w-auto">
                          <Button variant="outline" onClick={exportJournalEntriesToExcel}>
                            <Download className="h-4 w-4 mr-2" /> Export Excel
                          </Button>
                          <Button onClick={() => setShowInlineJEAdd(true)}>
                            <Plus className="h-4 w-4 mr-2" /> Manual Entry
                          </Button>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={filterJournalEntries}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                        >
                          Filter
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={resetJournalEntryFilters}
                        >
                          Reset
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Journal Entries Table */}
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]">#</TableHead>
                            <TableHead className="w-[120px]">Account</TableHead>
                            <TableHead className="w-[100px]">Partner</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right w-[100px]">Dr</TableHead>
                            <TableHead className="text-right w-[100px]">Cr</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Inline Add Form - Multi-line Journal Entry */}
                          {showInlineJEAdd && (
                            <>
                              {/* Header Row with Date, Reference, Description */}
                              <TableRow className="bg-blue-50/30">
                                <TableCell className="p-2" colSpan={2}>
                                  <div className="flex gap-2">
                                    <Input 
                                      type="date"
                                      value={jeForm.date}
                                      onChange={(e) => setJeForm({...jeForm, date: e.target.value})}
                                      className="h-8 text-xs w-28"
                                    />
                                    <Input 
                                      value={jeForm.reference}
                                      onChange={(e) => setJeForm({...jeForm, reference: e.target.value})}
                                      placeholder="Ref #"
                                      className="h-8 text-xs w-20"
                                    />
                                    <Select 
                                      value={jeForm.currency}
                                      onValueChange={(v) => setJeForm({...jeForm, currency: v})}
                                    >
                                      <SelectTrigger className="h-8 w-20 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="TZS">TSH</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </TableCell>
                                <TableCell className="p-2" colSpan={3}>
                                  <Input 
                                    value={jeForm.description}
                                    onChange={(e) => setJeForm({...jeForm, description: e.target.value})}
                                    placeholder="Overall description for this entry..."
                                    className="h-8 text-xs"
                                  />
                                </TableCell>
                                <TableCell className="p-2 text-right" colSpan={3}>
                                  <Badge variant="outline" className="text-xs">Manual Entry</Badge>
                                </TableCell>
                              </TableRow>
                              {/* Line Items */}
                              {jeForm.lines.map((line, index) => (
                                <TableRow key={index} className="bg-blue-50/50">
                                  <TableCell className="p-1 text-center">
                                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                                  </TableCell>
                                  <TableCell className="p-1">
                                    <Select 
                                      value={line.account_code || ''} 
                                      onValueChange={(v) => {
                                        console.log('Selected account code:', v);
                                        const account = accounts.find(a => a.code === v);
                                        console.log('Found account:', account);
                                        // Update both fields in single state update
                                        const updatedLines = [...jeForm.lines];
                                        updatedLines[index] = { 
                                          ...updatedLines[index], 
                                          account_code: v,
                                          account_name: account?.name || ''
                                        };
                                        setJeForm({ ...jeForm, lines: updatedLines });
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs w-full">
                                        <SelectValue placeholder="Select account...">
                                          {line.account_code ? `${line.account_code} - ${line.account_name || 'Unknown'}` : 'Select account...'}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent className="max-h-[300px]">
                                        <SelectGroup>
                                          <SelectLabel className="text-xs font-bold text-blue-600">Assets (1000-1600)</SelectLabel>
                                          {accounts.filter(a => a.category === 'ASSETS').map(acc => (
                                            <SelectItem key={`asset-${acc.code}`} value={acc.code} className="text-xs pl-4">
                                              <span className="font-medium">{acc.code}</span> - {acc.name}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                        <SelectSeparator />
                                        <SelectGroup>
                                          <SelectLabel className="text-xs font-bold text-red-600">Liabilities (2000-2500)</SelectLabel>
                                          {accounts.filter(a => a.category === 'LIABILITIES').map(acc => (
                                            <SelectItem key={`liab-${acc.code}`} value={acc.code} className="text-xs pl-4">
                                              <span className="font-medium">{acc.code}</span> - {acc.name}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                        <SelectSeparator />
                                        <SelectGroup>
                                          <SelectLabel className="text-xs font-bold text-purple-600">Equity (3000)</SelectLabel>
                                          {accounts.filter(a => a.category === 'EQUITY').map(acc => (
                                            <SelectItem key={`equity-${acc.code}`} value={acc.code} className="text-xs pl-4">
                                              <span className="font-medium">{acc.code}</span> - {acc.name}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                        <SelectSeparator />
                                        <SelectGroup>
                                          <SelectLabel className="text-xs font-bold text-green-600">Revenue (4000-4100)</SelectLabel>
                                          {accounts.filter(a => a.category === 'REVENUE').map(acc => (
                                            <SelectItem key={`rev-${acc.code}`} value={acc.code} className="text-xs pl-4">
                                              <span className="font-medium">{acc.code}</span> - {acc.name}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                        <SelectSeparator />
                                        <SelectGroup>
                                          <SelectLabel className="text-xs font-bold text-orange-600">Cost of Sales (5000)</SelectLabel>
                                          {accounts.filter(a => a.category === 'COST_OF_SALES').map(acc => (
                                            <SelectItem key={`cos-${acc.code}`} value={acc.code} className="text-xs pl-4">
                                              <span className="font-medium">{acc.code}</span> - {acc.name}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                        <SelectSeparator />
                                        <SelectGroup>
                                          <SelectLabel className="text-xs font-bold text-yellow-600">Operating Expenses (6000)</SelectLabel>
                                          {accounts.filter(a => a.category === 'OPERATING_EXPENSES').map(acc => (
                                            <SelectItem key={`opex-${acc.code}`} value={acc.code} className="text-xs pl-4">
                                              <span className="font-medium">{acc.code}</span> - {acc.name}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                        <SelectSeparator />
                                        <SelectGroup>
                                          <SelectLabel className="text-xs font-bold text-gray-600">Other Expenses (7000)</SelectLabel>
                                          {accounts.filter(a => a.category === 'OTHER_EXPENSES').map(acc => (
                                            <SelectItem key={`other-${acc.code}`} value={acc.code} className="text-xs pl-4">
                                              <span className="font-medium">{acc.code}</span> - {acc.name}
                                            </SelectItem>
                                          ))}
                                        </SelectGroup>
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="p-1">
                                    <Input 
                                      value={line.partner}
                                      onChange={(e) => updateJournalEntryLine(index, 'partner', e.target.value)}
                                      placeholder="Partner..."
                                      className="h-7 text-xs"
                                    />
                                  </TableCell>
                                  <TableCell className="p-1">
                                    <Input 
                                      value={line.description}
                                      onChange={(e) => updateJournalEntryLine(index, 'description', e.target.value)}
                                      placeholder="Line description..."
                                      className="h-7 text-xs"
                                    />
                                  </TableCell>
                                  <TableCell className="p-1">
                                    <Input 
                                      type="number"
                                      step="0.01"
                                      value={line.debit}
                                      onChange={(e) => updateJournalEntryLine(index, 'debit', e.target.value)}
                                      placeholder="0.00"
                                      className="h-7 text-xs text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="p-1">
                                    <Input 
                                      type="number"
                                      step="0.01"
                                      value={line.credit}
                                      onChange={(e) => updateJournalEntryLine(index, 'credit', e.target.value)}
                                      placeholder="0.00"
                                      className="h-7 text-xs text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="p-1 text-center">
                                    {jeForm.lines.length > 1 && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        onClick={() => {
                                          const newLines = jeForm.lines.filter((_, i) => i !== index);
                                          setJeForm({...jeForm, lines: newLines});
                                        }}
                                      >
                                        <X className="h-3 w-3 text-red-500" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                              {/* Add Row & Totals */}
                              <TableRow className="bg-blue-50/30">
                                <TableCell className="p-2" colSpan={2}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={addJournalEntryLine}
                                  >
                                    <Plus className="h-3 w-3 mr-1" /> Add Row
                                  </Button>
                                </TableCell>
                                <TableCell className="p-2 text-right" colSpan={2}>
                                  <span className="text-xs font-medium">Totals ({jeForm.currency || 'TZS'}):</span>
                                </TableCell>
                                <TableCell className="p-2 text-right">
                                  <span className="text-xs font-medium text-blue-600">
                                    {formatCurrency(jeForm.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0), jeForm.currency)}
                                  </span>
                                </TableCell>
                                <TableCell className="p-2 text-right">
                                  <span className="text-xs font-medium text-blue-600">
                                    {formatCurrency(jeForm.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0), jeForm.currency)}
                                  </span>
                                </TableCell>
                                <TableCell className="p-2 text-center">
                                  {(() => {
                                    const totalDr = jeForm.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
                                    const totalCr = jeForm.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
                                    const diff = totalDr - totalCr;
                                    return (
                                      <span className={`text-xs font-medium ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {diff === 0 ? '✓ Balanced' : `Diff: ${formatCurrency(Math.abs(diff), jeForm.currency)}`}
                                      </span>
                                    );
                                  })()}
                                </TableCell>
                              </TableRow>
                              {/* Action Row */}
                              <TableRow className="bg-blue-50/50">
                                <TableCell className="p-2" colSpan={5}>
                                  <div className="flex gap-2">
                                    {!editingJournalEntry && (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-8"
                                        onClick={(e) => handleCreateJournalEntry(e, true)}
                                      >
                                        <FileText className="h-3 w-3 mr-1" /> Save Draft
                                      </Button>
                                    )}
                                    <Button 
                                      size="sm" 
                                      className="h-8 bg-green-600 hover:bg-green-700 text-white"
                                      onClick={(e) => handleCreateJournalEntry(e, false)}
                                      disabled={(() => {
                                        const totalDr = jeForm.lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
                                        const totalCr = jeForm.lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
                                        return totalDr !== totalCr || totalDr === 0;
                                      })()}
                                    >
                                      <Save className="h-3 w-3 mr-1" /> {editingJournalEntry ? 'Update & Post' : 'Post Entry'}
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="h-8"
                                      onClick={() => {
                                        setShowInlineJEAdd(false);
                                        setEditingJournalEntry(null);
                                        setJeForm({
                                          description: '',
                                          reference: '',
                                          date: new Date().toISOString().split('T')[0],
                                          currency: 'TZS',
                                          lines: [{ account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' }]
                                        });
                                      }}
                                    >
                                      <X className="h-3 w-3 mr-1" /> {editingJournalEntry ? 'Cancel Edit' : 'Cancel'}
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="p-2 text-right" colSpan={3}>
                                  <Badge className="bg-yellow-100 text-yellow-700">Draft</Badge>
                                </TableCell>
                              </TableRow>
                            </>
                          )}
                          {filteredJournalEntries.length === 0 && !showInlineJEAdd ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                No journal entries found matching your criteria
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredJournalEntries.map((je) => {
                              const lines = journalEntryLines.filter(l => l.journal_entry_id === je.id);
                              const debitAccounts = lines.filter(l => l.debit > 0).map(l => l.account_code);
                              const creditAccounts = lines.filter(l => l.credit > 0).map(l => l.account_code);
                              const accounts = [...new Set([...debitAccounts, ...creditAccounts])];
                              
                              return (
                                <TableRow key={je.id} className="hover:bg-muted/50">
                                  <TableCell className="font-medium text-sm">{je.entry_number}</TableCell>
                                  <TableCell className="text-sm">{new Date(je.entry_date).toLocaleDateString('en-GB')}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={je.description}>
                                    {je.description}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {je.reference_type || 'Manual'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="space-y-1">
                                      {lines.slice(0, 2).map((line, idx) => (
                                        <div key={idx} className="flex items-center gap-1">
                                          <span className={line.debit > 0 ? 'text-blue-600' : 'text-green-600'}>
                                            {line.debit > 0 ? 'DR' : 'CR'}
                                          </span>
                                          <span className="text-muted-foreground truncate max-w-[150px]">
                                            {line.account_code} {line.account_name && `- ${line.account_name}`}
                                          </span>
                                        </div>
                                      ))}
                                      {lines.length > 2 && (
                                        <div className="text-muted-foreground text-xs">
                                          +{lines.length - 2} more
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(je.total_debit, je.currency)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge 
                                      className={je.is_posted 
                                        ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                                      }
                                    >
                                      {je.is_posted ? 'Posted' : 'Draft'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={() => viewJournalEntry(je)}
                                      >
                                        View
                                      </Button>
                                      {!je.is_posted && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="text-amber-600 hover:text-amber-700"
                                          onClick={() => editJournalEntry(je)}
                                        >
                                          Edit
                                        </Button>
                                      )}
                                      {je.is_posted && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="text-blue-600 hover:text-blue-700"
                                          onClick={() => forceDeleteJournalEntry(je)}
                                        >
                                          Force Delete
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Create Journal Entry Form - Full Page */}
              <TabsContent value="create_journal_entry">
                <div className="max-w-5xl mx-auto">
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <Button 
                      variant="ghost" 
                      onClick={() => setActiveTab('operations')}
                      className="text-muted-foreground"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back to Journal Entries
                    </Button>
                    <div>
                      <h2 className="text-xl font-semibold">Manual Journal Entry</h2>
                      <p className="text-sm text-muted-foreground">Debits must equal credits</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateJournalEntry} className="space-y-6">
                    {/* Entry Info Card */}
                    <Card>
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="entry_date">Entry Date *</Label>
                            <Input 
                              id="entry_date"
                              type="date" 
                              value={jeForm.date}
                              onChange={(e) => setJeForm({...jeForm, date: e.target.value})}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="reference">Reference</Label>
                            <Input 
                              id="reference"
                              value={jeForm.reference}
                              onChange={(e) => setJeForm({...jeForm, reference: e.target.value})}
                              placeholder="Auto-generated if left empty"
                            />
                            <p className="text-xs text-muted-foreground">Auto-generated — you may edit if needed</p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <Label htmlFor="notes">Notes</Label>
                          <Textarea 
                            id="notes"
                            value={jeForm.description}
                            onChange={(e) => setJeForm({...jeForm, description: e.target.value})}
                            placeholder="Enter journal entry description..."
                            rows={3}
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {/* Entry Lines Card */}
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Entry Lines</CardTitle>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            onClick={addJournalEntryLine}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Plus className="h-4 w-4 mr-1" /> Add Line
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead className="w-[200px]">Account *</TableHead>
                                <TableHead className="w-[150px]">Partner</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[120px] text-right">Dr</TableHead>
                                <TableHead className="w-[120px] text-right">Cr</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {jeForm.lines.map((line, index) => (
                                <TableRow key={index}>
                                  <TableCell className="p-2">
                                    <Select 
                                      value={line.account_code} 
                                      onValueChange={(v) => {
                                        const account = accounts.find(a => a.code === v);
                                        updateJournalEntryLine(index, 'account_code', v);
                                        if (account) {
                                          updateJournalEntryLine(index, 'account_name', account.name);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select account..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {accounts.map((account) => (
                                          <SelectItem key={account.code} value={account.code}>
                                            {account.code} - {account.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="p-2">
                                    <Input 
                                      value={line.partner}
                                      onChange={(e) => updateJournalEntryLine(index, 'partner', e.target.value)}
                                      placeholder="Partner..."
                                      className="h-9"
                                    />
                                  </TableCell>
                                  <TableCell className="p-2">
                                    <Input 
                                      value={line.description}
                                      onChange={(e) => updateJournalEntryLine(index, 'description', e.target.value)}
                                      placeholder="Description..."
                                      className="h-9"
                                    />
                                  </TableCell>
                                  <TableCell className="p-2">
                                    <Input 
                                      type="number"
                                      step="0.01"
                                      value={line.debit}
                                      onChange={(e) => updateJournalEntryLine(index, 'debit', e.target.value)}
                                      placeholder="0.00"
                                      className="h-9 text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="p-2">
                                    <Input 
                                      type="number"
                                      step="0.01"
                                      value={line.credit}
                                      onChange={(e) => updateJournalEntryLine(index, 'credit', e.target.value)}
                                      placeholder="0.00"
                                      className="h-9 text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="p-2 text-center">
                                    {jeForm.lines.length > 1 && (
                                      <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => removeJournalEntryLine(index)}
                                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Totals */}
                        <div className="border-t bg-muted/30 p-4">
                          <div className="flex justify-end gap-8">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Debit ({jeForm.currency || 'TZS'})</p>
                              <p className="text-lg font-semibold">
                                {formatCurrency(calculateJournalEntryTotals().totalDebit, jeForm.currency)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Credit ({jeForm.currency || 'TZS'})</p>
                              <p className="text-lg font-semibold">
                                {formatCurrency(calculateJournalEntryTotals().totalCredit, jeForm.currency)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Difference</p>
                              <p className={`text-lg font-semibold ${calculateJournalEntryTotals().balanced ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(Math.abs(calculateJournalEntryTotals().totalDebit - calculateJournalEntryTotals().totalCredit), jeForm.currency)}
                              </p>
                            </div>
                          </div>
                          {!calculateJournalEntryTotals().balanced && (
                            <p className="text-center text-red-600 text-sm mt-2">
                              Debits and credits must balance before posting
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex justify-end gap-4">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => {
                          setShowCreateJournalEntry(false);
                          setActiveTab('operations');
                          setEditingJournalEntry(null);
                          setJeForm({
                            description: '',
                            reference: '',
                            date: new Date().toISOString().split('T')[0],
                            currency: 'TZS',
                            lines: [{ account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' }]
                          });
                        }}
                      >
                        {editingJournalEntry ? 'Cancel Edit' : 'Cancel'}
                      </Button>
                      <Button 
                        type="button"
                        variant="outline"
                        onClick={(e) => handleCreateJournalEntry(e, true)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Save as Draft
                      </Button>
                      <Button 
                        type="submit"
                        disabled={!calculateJournalEntryTotals().balanced}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Post Journal Entry
                      </Button>
                    </div>
                  </form>
                </div>
              </TabsContent>

              {/* Bank Statements */}
              <TabsContent value="bank">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {bankAccounts.map((acc) => (
                      <Card key={acc.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Landmark className="h-8 w-8 text-blue-500" />
                            <div>
                              <p className="font-semibold">{acc.bank_name}</p>
                              <p className="text-2xl font-bold">{formatCurrency(acc.current_balance)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Card className="p-8 text-center">
                    <h3 className="text-lg font-semibold">Bank Statement Import</h3>
                    <p className="text-muted-foreground">Import and reconcile bank statements</p>
                    <Link href="/finance/bank-statement">
                      <Button className="mt-4"><Download className="h-4 w-4 mr-2" /> Import Statement</Button>
                    </Link>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* REPORTS & SETUP TAB */}
          <TabsContent value="reports">
            <Tabs defaultValue="aging">
              <TabsList className="flex flex-wrap h-auto gap-2 mb-4">
                <TabsTrigger value="aging" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Aging Report
                </TabsTrigger>
                <TabsTrigger value="coa" className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> Chart of Accounts
                </TabsTrigger>
                <TabsTrigger value="bank_accounts" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Cash & Bank Accounts
                </TabsTrigger>
                <TabsTrigger value="tax" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Tax Reports
                </TabsTrigger>
                <TabsTrigger value="statements" className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Statement of Accounts
                </TabsTrigger>
                <TabsTrigger value="payables" className="flex items-center gap-2">
                  <ArrowDownLeft className="h-4 w-4" /> Payables Register
                </TabsTrigger>
              </TabsList>

              <TabsContent value="aging">
                <Card className="p-8 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">AR Aging Report</h3>
                  <p className="text-muted-foreground">Client balances aged by 30, 60, 90, 90+ days</p>
                </Card>
              </TabsContent>

              <TabsContent value="coa">
                <Card className="p-8 text-center">
                  <Calculator className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Chart of Accounts</h3>
                  <p className="text-muted-foreground">Manage your 1001-7004 account structure</p>
                  <Link href="/finance/chart-of-accounts">
                    <Button className="mt-4"><Plus className="h-4 w-4 mr-2" /> Manage Accounts</Button>
                  </Link>
                </Card>
              </TabsContent>

              <TabsContent value="bank_accounts">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Cash & Bank Accounts</CardTitle>
                      <p className="text-sm text-muted-foreground">Manage bank accounts, mobile money, petty cash</p>
                    </div>
                    <div className="flex gap-2">
                      <Link href="/finance/bank-statement">
                        <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Import Statement</Button>
                      </Link>
                      <Dialog open={showAddBankAccount} onOpenChange={setShowAddBankAccount}>
                        <DialogTrigger asChild>
                          <Button><Plus className="h-4 w-4 mr-2" /> Add Account</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Add New Bank Account</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleAddBankAccount} className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Account Name *</Label>
                              <Input 
                                value={bankForm.account_name} 
                                onChange={(e) => setBankForm({...bankForm, account_name: e.target.value})} 
                                placeholder="e.g. CRDB Main Operating"
                                required 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Bank Name *</Label>
                              <Input 
                                value={bankForm.bank_name} 
                                onChange={(e) => setBankForm({...bankForm, bank_name: e.target.value})} 
                                placeholder="e.g. CRDB Bank"
                                required 
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Account Number *</Label>
                                <Input 
                                  value={bankForm.account_number} 
                                  onChange={(e) => setBankForm({...bankForm, account_number: e.target.value})} 
                                  placeholder="e.g. 1234567890"
                                  required 
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Branch</Label>
                                <Input 
                                  value={bankForm.branch} 
                                  onChange={(e) => setBankForm({...bankForm, branch: e.target.value})} 
                                  placeholder="e.g. Dar es Salaam"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Account Type *</Label>
                                <Select 
                                  value={bankForm.account_type} 
                                  onValueChange={(v) => setBankForm({...bankForm, account_type: v})}
                                  required
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="current">Current Account</SelectItem>
                                    <SelectItem value="savings">Savings Account</SelectItem>
                                    <SelectItem value="fixed_deposit">Fixed Deposit</SelectItem>
                                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                    <SelectItem value="petty_cash">Petty Cash</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Currency *</Label>
                                <Select 
                                  value={bankForm.currency} 
                                  onValueChange={(v) => setBankForm({...bankForm, currency: v})}
                                  required
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="TZS">TSH (Tanzanian Shilling)</SelectItem>
                                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Opening Balance</Label>
                              <Input 
                                type="number" 
                                step="0.01"
                                value={bankForm.opening_balance} 
                                onChange={(e) => setBankForm({...bankForm, opening_balance: e.target.value})} 
                                placeholder="0.00"
                              />
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowAddBankAccount(false)}>Cancel</Button>
                              <Button type="submit" className="flex-1">Create Account</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Bank</TableHead>
                          <TableHead>Account Number</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Currency</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bankAccounts.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                              No bank accounts found. Click "Add Account" to create your first account.
                            </TableCell>
                          </TableRow>
                        ) : (
                          bankAccounts.map((acc) => (
                            <TableRow key={acc.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Landmark className="h-4 w-4 text-blue-500" />
                                  {acc.account_name}
                                </div>
                              </TableCell>
                              <TableCell>{acc.bank_name}</TableCell>
                              <TableCell>{acc.account_number}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {acc.account_type.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={acc.currency === 'USD' ? 'default' : 'secondary'}>
                                  {acc.currency}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {acc.currency === 'USD' 
                                  ? `$ ${acc.current_balance?.toLocaleString() || '0.00'}`
                                  : `Tsh ${acc.current_balance?.toLocaleString() || '0'}`
                                }
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => {
                                      // View account details
                                      toast({ title: 'Account Details', description: `${acc.account_name} - ${acc.bank_name}` });
                                    }}
                                    title="View Details"
                                  >
                                    <BookOpen className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => {
                                      // Edit functionality would go here
                                      toast({ title: 'Edit', description: 'Edit functionality coming soon' });
                                    }}
                                    title="Edit"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-blue-600 hover:text-blue-700"
                                    onClick={async () => {
                                      if (!confirm(`Delete ${acc.account_name}? This action cannot be undone.`)) return;
                                      try {
                                        const { error } = await supabase.from('bank_accounts').delete().eq('id', acc.id);
                                        if (error) throw error;
                                        toast({ title: 'Success', description: 'Account deleted successfully' });
                                        loadData();
                                      } catch (error: any) {
                                        toast({ title: 'Error', description: error.message, variant: 'destructive' });
                                      }
                                    }}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tax">
                <Card className="p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Tax Reports</h3>
                  <p className="text-muted-foreground">VAT, PAYE, and customs duty reports</p>
                </Card>
              </TabsContent>

              <TabsContent value="statements">
                <Card className="p-8 text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Statement of Accounts</h3>
                  <p className="text-muted-foreground">Trial balance and financial statements</p>
                </Card>
              </TabsContent>

              <TabsContent value="payables">
                <Card className="p-8 text-center">
                  <ArrowDownLeft className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Payables Register</h3>
                  <p className="text-muted-foreground">Supplier payment history and aging</p>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
        </div>
      </main>
    </div>
  );
}
