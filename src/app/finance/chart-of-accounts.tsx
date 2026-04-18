"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, BookOpen, Calculator, ArrowLeft, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface Account {
  id: string;
  code: string;
  name: string;
  category: 'ASSETS' | 'LIABILITIES' | 'EQUITY' | 'REVENUE' | 'COST_OF_SALES' | 'OPERATING_EXPENSES' | 'OTHER_EXPENSES';
  sub_category: string;
  type: 'debit' | 'credit';
  parent_code?: string;
  current_balance: number;
  is_active: boolean;
  description?: string;
}

interface LedgerTransaction {
  id: string;
  journal_entry_id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  reference?: string;
  debit: number;
  credit: number;
  running_balance: number;
  created_at: string;
}

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  ASSETS: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  LIABILITIES: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  EQUITY: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  REVENUE: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  COST_OF_SALES: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  OPERATING_EXPENSES: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  OTHER_EXPENSES: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

export function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    category: 'ASSETS',
    sub_category: '',
    type: 'debit',
    description: ''
  });
  const [editAccount, setEditAccount] = useState({
    id: '',
    code: '',
    name: '',
    category: 'ASSETS',
    sub_category: '',
    type: 'debit' as 'debit' | 'credit',
    description: '',
    is_active: true
  });

  // Ledger view states
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [ledgerAccount, setLedgerAccount] = useState<Account | null>(null);
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  
  // Manual entry form for ledger - multi-line journal entry
  const [showAddEntryDialog, setShowAddEntryDialog] = useState(false);
  const [entryLines, setEntryLines] = useState([
    { date: new Date().toISOString().split('T')[0], account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' }
  ]);
  const [entryReference, setEntryReference] = useState('');
  const [entryDescription, setEntryDescription] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    filterAccounts();
  }, [accounts, activeFilter, searchQuery]);

  const loadAccounts = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('accounts').select('*').order('code');
    setAccounts(data || []);
    setIsLoading(false);
  };

  const filterAccounts = () => {
    let filtered = accounts;
    
    if (activeFilter !== 'All') {
      filtered = filtered.filter(a => a.category === activeFilter);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(a => 
        a.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredAccounts(filtered);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(amount);
  };

  const getCategoryTotal = (category: string) => {
    return accounts
      .filter(a => a.category === category && a.is_active)
      .reduce((sum, a) => sum + (a.type === 'debit' ? a.current_balance : -a.current_balance), 0);
  };

  const getParentName = (parentCode?: string) => {
    if (!parentCode) return '—';
    const parent = accounts.find(a => a.code === parentCode);
    return parent ? parent.name : parentCode;
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('accounts').insert({
        ...newAccount,
        is_active: true,
        opening_balance: 0,
        current_balance: 0,
        created_at: new Date().toISOString()
      });

      if (error) throw error;

      toast({ title: 'Success', description: `Account ${newAccount.code} created` });
      setShowCreateDialog(false);
      setNewAccount({ code: '', name: '', category: 'ASSETS', sub_category: '', type: 'debit', description: '' });
      loadAccounts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteAccount = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete account ${code}?`)) return;
    
    try {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Success', description: 'Account deleted' });
      loadAccounts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleViewAccount = (account: Account) => {
    setSelectedAccount(account);
    setShowViewDialog(true);
  };

  const handleEditClick = (account: Account) => {
    setEditAccount({
      id: account.id,
      code: account.code,
      name: account.name,
      category: account.category,
      sub_category: account.sub_category,
      type: account.type,
      description: account.description || '',
      is_active: account.is_active
    });
    setShowEditDialog(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('accounts').update({
        code: editAccount.code,
        name: editAccount.name,
        category: editAccount.category,
        sub_category: editAccount.sub_category,
        type: editAccount.type,
        description: editAccount.description,
        is_active: editAccount.is_active,
        updated_at: new Date().toISOString()
      }).eq('id', editAccount.id);

      if (error) throw error;

      toast({ title: 'Success', description: `Account ${editAccount.code} updated` });
      setShowEditDialog(false);
      loadAccounts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  // Ledger view functions
  const handleViewLedger = async (account: Account) => {
    setLedgerAccount(account);
    setShowLedgerDialog(true);
    setIsLoadingLedger(true);
    
    try {
      // Fetch journal entry lines for this account
      const { data, error } = await supabase
        .from('journal_entry_lines')
        .select(`
          id,
          journal_entry_id,
          description,
          debit_amount,
          credit_amount,
          created_at,
          journal_entries!inner(entry_number, entry_date)
        `)
        .eq('account_code', account.code)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Calculate running balance
      let runningBalance = 0;
      const transactions = (data || []).map((t: any) => {
        const debit = parseFloat(t.debit_amount) || 0;
        const credit = parseFloat(t.credit_amount) || 0;
        
        // For debit accounts: increase with debit, decrease with credit
        // For credit accounts: increase with credit, decrease with debit
        if (account.type === 'debit') {
          runningBalance += debit - credit;
        } else {
          runningBalance += credit - debit;
        }
        
        return {
          id: t.id,
          journal_entry_id: t.journal_entry_id,
          entry_number: t.journal_entries?.entry_number || 'N/A',
          entry_date: t.journal_entries?.entry_date || t.created_at,
          description: t.description,
          reference: undefined,
          debit: debit,
          credit: credit,
          running_balance: runningBalance,
          created_at: t.created_at
        };
      });

      setLedgerTransactions(transactions.reverse()); // Show newest first
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoadingLedger(false);
    }
  };

  // Multi-line journal entry handlers
  const addEntryLine = () => {
    setEntryLines([...entryLines, { 
      date: entryLines[0]?.date || new Date().toISOString().split('T')[0], 
      account_code: '', 
      account_name: '', 
      partner: '', 
      description: '', 
      debit: '', 
      credit: '' 
    }]);
  };

  const removeEntryLine = (index: number) => {
    if (entryLines.length > 1) {
      setEntryLines(entryLines.filter((_, i) => i !== index));
    }
  };

  const updateEntryLine = (index: number, field: string, value: string) => {
    const updated = [...entryLines];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-fill account name when code is entered
    if (field === 'account_code') {
      const account = accounts.find(a => a.code === value);
      updated[index].account_name = account?.name || '';
    }
    
    setEntryLines(updated);
  };

  const calculateEntryTotals = () => {
    const totalDebit = entryLines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = entryLines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
    return { totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  };

  const handleCreateLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerAccount) return;

    const { totalDebit, totalCredit, balanced } = calculateEntryTotals();

    if (!balanced) {
      toast({ title: 'Error', description: `Debits (${formatCurrency(totalDebit)}) must equal Credits (${formatCurrency(totalCredit)})`, variant: 'destructive' });
      return;
    }

    if (totalDebit === 0) {
      toast({ title: 'Error', description: 'Please enter at least one transaction', variant: 'destructive' });
      return;
    }

    try {
      // Create journal entry
      const entryNumber = `JE-${Date.now()}`;
      const { data: jeData, error: jeError } = await supabase.from('journal_entries').insert({
        entry_number: entryNumber,
        entry_date: entryLines[0]?.date || new Date().toISOString().split('T')[0],
        description: entryDescription || `Manual entry for ${ledgerAccount.name}`,
        reference: entryReference,
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_posted: true,
        source: 'manual',
        created_by: 'Super Admin',
        created_at: new Date().toISOString()
      }).select().single();

      if (jeError) throw jeError;

      // Create journal entry lines
      const linesToInsert = entryLines
        .filter(line => line.account_code && (parseFloat(line.debit) > 0 || parseFloat(line.credit) > 0))
        .map((line, index) => ({
          journal_entry_id: jeData.id,
          account_code: line.account_code,
          description: line.description || entryDescription,
          debit_amount: parseFloat(line.debit) || 0,
          credit_amount: parseFloat(line.credit) || 0,
          line_order: index
        }));

      const { error: linesError } = await supabase.from('journal_entry_lines').insert(linesToInsert);
      if (linesError) throw linesError;

      // Update account balances
      for (const line of linesToInsert) {
        const account = accounts.find(a => a.code === line.account_code);
        if (account) {
          const balanceChange = account.type === 'debit' 
            ? line.debit_amount - line.credit_amount
            : line.credit_amount - line.debit_amount;
          
          await supabase.from('accounts').update({
            current_balance: account.current_balance + balanceChange,
            updated_at: new Date().toISOString()
          }).eq('id', account.id);
        }
      }

      toast({ title: 'Success', description: `Journal Entry ${entryNumber} created` });
      setShowAddEntryDialog(false);
      setEntryLines([{ date: new Date().toISOString().split('T')[0], account_code: '', account_name: '', partner: '', description: '', debit: '', credit: '' }]);
      setEntryReference('');
      setEntryDescription('');
      
      // Refresh ledger and accounts
      handleViewLedger(ledgerAccount);
      loadAccounts();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const categories = ['All', 'ASSETS', 'LIABILITIES', 'EQUITY', 'REVENUE', 'COST_OF_SALES', 'OPERATING_EXPENSES', 'OTHER_EXPENSES'];

  if (isLoading) return <div className="p-8 text-center">Loading Chart of Accounts...</div>;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link href="/finance">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Finance
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold">Chart of Accounts</h1>
            <p className="text-muted-foreground">Double-entry ledger accounts</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-red-600 hover:bg-red-700">
                <Plus className="h-4 w-4 mr-2" /> New Account
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Account</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateAccount} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Account Code</Label>
                  <Input 
                    value={newAccount.code} 
                    onChange={(e) => setNewAccount({...newAccount, code: e.target.value})} 
                    placeholder="e.g., 1001"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Name</Label>
                  <Input 
                    value={newAccount.name} 
                    onChange={(e) => setNewAccount({...newAccount, name: e.target.value})} 
                    placeholder="e.g., Petty Cash"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select 
                    value={newAccount.category} 
                    onValueChange={(v) => setNewAccount({...newAccount, category: v as any})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASSETS">Assets</SelectItem>
                      <SelectItem value="LIABILITIES">Liabilities</SelectItem>
                      <SelectItem value="EQUITY">Equity</SelectItem>
                      <SelectItem value="REVENUE">Revenue</SelectItem>
                      <SelectItem value="COST_OF_SALES">Cost of Sales</SelectItem>
                      <SelectItem value="OPERATING_EXPENSES">Operating Expenses</SelectItem>
                      <SelectItem value="OTHER_EXPENSES">Other Expenses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sub Category</Label>
                  <Input 
                    value={newAccount.sub_category} 
                    onChange={(e) => setNewAccount({...newAccount, sub_category: e.target.value})} 
                    placeholder="e.g., Current Assets"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select 
                    value={newAccount.type} 
                    onValueChange={(v) => setNewAccount({...newAccount, type: v as 'debit' | 'credit'})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input 
                    value={newAccount.description} 
                    onChange={(e) => setNewAccount({...newAccount, description: e.target.value})} 
                    placeholder="Optional description"
                  />
                </div>
                <Button type="submit" className="w-full">Create Account</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Category Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {['ASSETS', 'LIABILITIES', 'EQUITY', 'REVENUE', 'OPERATING_EXPENSES'].map((category) => {
            const colors = categoryColors[category];
            const total = getCategoryTotal(category);
            return (
              <Card key={category} className={`${colors.bg} ${colors.border} border`}>
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-muted-foreground uppercase">{category.replace('_', ' ')}</p>
                  <p className={`text-2xl font-bold ${colors.text}`}>
                    {formatCurrency(total)}
                  </p>
                  <p className="text-xs text-muted-foreground">filter</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeFilter === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter(cat)}
              className={activeFilter === cat ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {cat === 'All' && <Calculator className="h-4 w-4 mr-2" />}
              {cat === 'ASSETS' && <span className="mr-2">💰</span>}
              {cat === 'LIABILITIES' && <span className="mr-2">📋</span>}
                  {cat === 'EQUITY' && <span className="mr-2">🏛️</span>}
                  {cat === 'REVENUE' && <span className="mr-2">📈</span>}
                  {cat === 'COST_OF_SALES' && <span className="mr-2">📉</span>}
                  {cat === 'OPERATING_EXPENSES' && <span className="mr-2">💸</span>}
                  {cat === 'OTHER_EXPENSES' && <span className="mr-2">📊</span>}
                  {cat.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by code or name..." 
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Accounts Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono font-medium">{account.code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{account.name}</div>
                        {account.description && (
                          <div className="text-xs text-muted-foreground">{account.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{account.type}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getParentName(account.parent_code)}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${
                        account.current_balance > 0 
                          ? account.type === 'debit' ? 'text-blue-600' : 'text-red-600'
                          : ''
                      }`}>
                        {formatCurrency(account.current_balance)}
                        {account.current_balance !== 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({account.type === 'debit' ? 'Dr' : 'Cr'})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={account.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewLedger(account)} title="View Ledger">
                            <BookOpen className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(account)} title="Edit">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteAccount(account.id, account.code)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAccounts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No accounts found. {searchQuery && 'Try a different search term.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>

            {/* View Account Dialog */}
            <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Account Details</DialogTitle>
        </DialogHeader>
        {selectedAccount && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Account Code</Label>
                <p className="font-semibold font-mono">{selectedAccount.code}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Type</Label>
                <p className="font-semibold capitalize">{selectedAccount.type}</p>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Account Name</Label>
              <p className="font-semibold text-lg">{selectedAccount.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Category</Label>
              <p className="font-semibold">{selectedAccount.category.replace(/_/g, ' ')}</p>
            </div>
            {selectedAccount.sub_category && (
              <div>
                <Label className="text-muted-foreground">Sub Category</Label>
                <p className="font-semibold">{selectedAccount.sub_category}</p>
              </div>
            )}
            {selectedAccount.description && (
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="font-semibold">{selectedAccount.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Current Balance</Label>
                <p className="font-semibold text-lg">{formatCurrency(selectedAccount.current_balance)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p><Badge className={selectedAccount.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                  {selectedAccount.is_active ? 'Active' : 'Inactive'}
                </Badge></p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Edit Account Dialog */}
    <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleUpdateAccount} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Account Code</Label>
            <Input 
              value={editAccount.code} 
              onChange={(e) => setEditAccount({...editAccount, code: e.target.value})} 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label>Account Name</Label>
            <Input 
              value={editAccount.name} 
              onChange={(e) => setEditAccount({...editAccount, name: e.target.value})} 
              required 
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select 
              value={editAccount.category} 
              onValueChange={(v) => setEditAccount({...editAccount, category: v as Account['category']})}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ASSETS">ASSETS</SelectItem>
                <SelectItem value="LIABILITIES">LIABILITIES</SelectItem>
                <SelectItem value="EQUITY">EQUITY</SelectItem>
                <SelectItem value="REVENUE">REVENUE</SelectItem>
                <SelectItem value="COST_OF_SALES">COST OF SALES</SelectItem>
                <SelectItem value="OPERATING_EXPENSES">OPERATING EXPENSES</SelectItem>
                <SelectItem value="OTHER_EXPENSES">OTHER EXPENSES</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sub Category</Label>
            <Input 
              value={editAccount.sub_category} 
              onChange={(e) => setEditAccount({...editAccount, sub_category: e.target.value})} 
              placeholder="e.g., Current Assets"
            />
          </div>
          <div className="space-y-2">
            <Label>Account Type</Label>
            <Select 
              value={editAccount.type} 
              onValueChange={(v) => setEditAccount({...editAccount, type: v as 'debit' | 'credit'})}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">Debit</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input 
              value={editAccount.description} 
              onChange={(e) => setEditAccount({...editAccount, description: e.target.value})} 
              placeholder="Optional description"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select 
              value={editAccount.is_active ? 'active' : 'inactive'} 
              onValueChange={(v) => setEditAccount({...editAccount, is_active: v === 'active'})}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button type="submit" className="flex-1">Update Account</Button>
          </div>
        </form>
          </DialogContent>
        </Dialog>

        {/* Ledger View Dialog */}
        <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto p-0">
            {/* Professional Ledger Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white/10 p-2 rounded-lg">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">General Ledger</h2>
                      <p className="text-slate-400 text-sm">Account Transaction History</p>
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowAddEntryDialog(true)} 
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Entry
                </Button>
              </div>
            </div>

            {/* Account Details Card */}
            {ledgerAccount && (
              <div className="px-6 py-4 bg-slate-50 border-b">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Account Code</p>
                    <p className="text-xl font-mono font-bold text-slate-900">{ledgerAccount.code}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Account Name</p>
                    <p className="text-lg font-semibold text-slate-900">{ledgerAccount.name}</p>
                    {ledgerAccount.description && (
                      <p className="text-sm text-muted-foreground mt-1">{ledgerAccount.description}</p>
                    )}
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Balance</p>
                    <p className={`text-xl font-bold ${ledgerAccount.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(ledgerAccount.current_balance)}
                    </p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {ledgerAccount.type === 'debit' ? 'Debit Account' : 'Credit Account'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Ledger Content */}
            <div className="p-6">
              {isLoadingLedger ? (
                <div className="py-12 text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading transactions...</p>
                </div>
              ) : ledgerTransactions.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-lg border-2 border-dashed">
                  <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-lg font-medium text-slate-600">No transactions found</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    This account has no transaction history yet. Click "Add Entry" to create your first journal entry.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Ledger Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-slate-100">
                        <TableRow className="hover:bg-slate-100">
                          <TableHead className="w-24 font-semibold text-slate-700">Date</TableHead>
                          <TableHead className="w-28 font-semibold text-slate-700">Entry #</TableHead>
                          <TableHead className="font-semibold text-slate-700">Description</TableHead>
                          <TableHead className="w-28 text-right font-semibold text-slate-700">Debit</TableHead>
                          <TableHead className="w-28 text-right font-semibold text-slate-700">Credit</TableHead>
                          <TableHead className="w-32 text-right font-semibold text-slate-700">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Opening Balance Row */}
                        {ledgerTransactions.length > 0 && (
                          <TableRow className="bg-slate-50/50 font-medium">
                            <TableCell colSpan={5} className="text-right text-slate-600">
                              Opening Balance
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-700">
                              {formatCurrency(ledgerTransactions[ledgerTransactions.length - 1]?.running_balance - 
                                (ledgerTransactions[ledgerTransactions.length - 1]?.debit - ledgerTransactions[ledgerTransactions.length - 1]?.credit)) || formatCurrency(0)}
                            </TableCell>
                          </TableRow>
                        )}
                        {/* Transaction Rows */}
                        {[...ledgerTransactions].reverse().map((tx, index) => (
                          <TableRow key={tx.id} className="hover:bg-slate-50/80">
                            <TableCell className="text-sm">
                              {new Date(tx.entry_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-blue-600 font-medium">
                              {tx.entry_number}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-900">{tx.description}</div>
                              {tx.reference && (
                                <div className="text-xs text-muted-foreground">Ref: {tx.reference}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {tx.debit > 0 ? (
                                <span className="text-slate-900 font-medium">{formatCurrency(tx.debit)}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {tx.credit > 0 ? (
                                <span className="text-slate-900 font-medium">{formatCurrency(tx.credit)}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold bg-slate-50/30">
                              <span className={tx.running_balance >= 0 ? 'text-green-700' : 'text-red-700'}>
                                {formatCurrency(tx.running_balance)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary Footer */}
                  <div className="bg-slate-900 text-white p-4 rounded-lg flex justify-between items-center">
                    <div className="flex gap-6">
                      <div>
                        <p className="text-xs text-slate-400 uppercase">Total Debits</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(ledgerTransactions.reduce((sum, tx) => sum + tx.debit, 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase">Total Credits</p>
                        <p className="text-lg font-semibold">
                          {formatCurrency(ledgerTransactions.reduce((sum, tx) => sum + tx.credit, 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase">Transactions</p>
                        <p className="text-lg font-semibold">{ledgerTransactions.length}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400 uppercase">Closing Balance</p>
                      <p className="text-2xl font-bold text-green-400">
                        {formatCurrency(ledgerTransactions[0]?.running_balance || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Manual Entry Dialog - Professional Journal Entry Form - Full Screen */}
        <Dialog open={showAddEntryDialog} onOpenChange={setShowAddEntryDialog}>
          <DialogContent className="max-w-[95vw] w-full min-h-[95vh] max-h-[95vh] overflow-y-auto p-0">
            {/* Header with Back Button */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white hover:bg-white/20"
                    onClick={() => setShowAddEntryDialog(false)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Chart of Accounts
                  </Button>
                  <div className="h-6 w-px bg-white/30"></div>
                  <div>
                    <DialogTitle className="text-xl text-white">Journal Entry</DialogTitle>
                    <p className="text-sm text-slate-400 mt-1">
                      Ledger: {ledgerAccount?.code} - {ledgerAccount?.name}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setShowAddEntryDialog(false)}
                >
                  <span className="text-2xl">&times;</span>
                </Button>
              </div>
            </div>
            
            <div className="p-6">
            
            <form onSubmit={handleCreateLedgerEntry} className="space-y-4 pt-4">
              {/* Header Fields */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Entry Date</Label>
                  <Input 
                    type="date"
                    value={entryLines[0]?.date || new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      const updated = entryLines.map(line => ({ ...line, date: e.target.value }));
                      setEntryLines(updated);
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reference</Label>
                  <Input 
                    value={entryReference}
                    onChange={(e) => setEntryReference(e.target.value)}
                    placeholder="e.g., Receipt #123"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input 
                    value={entryDescription}
                    onChange={(e) => setEntryDescription(e.target.value)}
                    placeholder="Overall description for this entry"
                  />
                </div>
              </div>

              {/* Journal Entry Lines Table */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead className="w-32">Date</TableHead>
                      <TableHead className="w-24">Account</TableHead>
                      <TableHead className="w-32">Partner</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-28 text-right">Dr (Tsh)</TableHead>
                      <TableHead className="w-28 text-right">Cr (Tsh)</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entryLines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell className="p-2">
                          <Input 
                            type="date"
                            value={line.date}
                            onChange={(e) => updateEntryLine(index, 'date', e.target.value)}
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Select 
                            value={line.account_code}
                            onValueChange={(v) => updateEntryLine(index, 'account_code', v)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {accounts.filter(a => a.is_active).map(acc => (
                                <SelectItem key={acc.code} value={acc.code}>
                                  {acc.code} - {acc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="p-2">
                          <Input 
                            value={line.partner}
                            onChange={(e) => updateEntryLine(index, 'partner', e.target.value)}
                            placeholder="Customer/Supplier"
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input 
                            value={line.description}
                            onChange={(e) => updateEntryLine(index, 'description', e.target.value)}
                            placeholder="Line description"
                            className="h-8 text-sm"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.debit}
                            onChange={(e) => updateEntryLine(index, 'debit', e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-sm text-right"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input 
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.credit}
                            onChange={(e) => updateEntryLine(index, 'credit', e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-sm text-right"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            onClick={() => removeEntryLine(index)}
                            disabled={entryLines.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Add Row Button */}
              <Button 
                type="button"
                variant="outline" 
                onClick={addEntryLine}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Row
              </Button>

              {/* Totals */}
              {(() => {
                const { totalDebit, totalCredit, balanced } = calculateEntryTotals();
                return (
                  <div className="flex justify-end">
                    <div className="bg-slate-100 p-4 rounded-lg flex gap-8">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase">Total Debits</p>
                        <p className={`text-lg font-bold ${balanced ? 'text-slate-900' : 'text-red-600'}`}>
                          {formatCurrency(totalDebit)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase">Total Credits</p>
                        <p className={`text-lg font-bold ${balanced ? 'text-slate-900' : 'text-red-600'}`}>
                          {formatCurrency(totalCredit)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase">Difference</p>
                        <p className={`text-lg font-bold ${balanced ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(totalDebit - totalCredit))}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowAddEntryDialog(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={!calculateEntryTotals().balanced}
                >
                  Create Entry
                </Button>
              </div>
            </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
