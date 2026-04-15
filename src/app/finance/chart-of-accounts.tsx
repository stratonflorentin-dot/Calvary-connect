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
                          <Button variant="ghost" size="icon" onClick={() => handleViewAccount(account)} title="View">
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
      </div>
    </div>
  );
}
