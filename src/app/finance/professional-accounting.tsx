"use client";

import { useState, useEffect } from 'react';
import { useRole } from '@/hooks/use-role';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  FileText, Receipt, Wallet, CreditCard, Banknote, ArrowRightLeft, Landmark,
  TrendingUp, TrendingDown, Plus, Search, Download, BookOpen, Calculator,
  Building2, Clock, ArrowUpRight, ArrowDownLeft, FileSpreadsheet, BarChart3
} from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  total_amount: number;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
}

interface Expense {
  id: string;
  expense_number: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
}

interface JournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  total_debit: number;
  total_credit: number;
  is_posted: boolean;
}

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  current_balance: number;
}

export function ProfessionalAccounting() {
  const { role } = useRole();
  const [activeTab, setActiveTab] = useState('operations');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [{ data: invoicesData }, { data: expensesData }, { data: jeData }, { data: bankData }] = await Promise.all([
      supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('journal_entries').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('bank_accounts').select('*')
    ]);
    setInvoices(invoicesData || []);
    setExpenses(expensesData || []);
    setJournalEntries(jeData || []);
    setBankAccounts(bankData || []);
    setIsLoading(false);
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS' }).format(amount);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      approved: 'bg-green-100 text-green-700',
      posted: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      overdue: 'bg-red-100 text-red-700',
      rejected: 'bg-red-100 text-red-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-gray-100';
  };

  const totalCash = bankAccounts.reduce((a, b) => a + b.current_balance, 0);
  const totalReceivables = invoices.filter(i => i.status !== 'paid').reduce((a, b) => a + b.total_amount, 0);
  const totalPayables = 0; // From supplier_payments
  const monthlyRevenue = invoices.filter(i => i.status === 'paid').reduce((a, b) => a + b.total_amount, 0);
  const monthlyExpenses = expenses.reduce((a, b) => a + b.amount, 0);

  if (isLoading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Financial Command Center</h1>
            <p className="text-muted-foreground">Full ledger management for fleet logistics and corporate accounting</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><BarChart3 className="h-4 w-4 mr-2" /> Reports</Button>
            <Button><Plus className="h-4 w-4 mr-2" /> Quick Entry</Button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6">
        {/* Financial Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cash & Bank</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalCash)}</p>
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
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Invoices</CardTitle>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search..." className="pl-10 w-64" />
                      </div>
                      <Button><Plus className="h-4 w-4 mr-2" /> New Invoice</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                            <TableCell>{inv.client_name}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(inv.total_amount)}</TableCell>
                            <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                            <TableCell><Badge className={getStatusBadge(inv.status)}>{inv.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Expenses */}
              <TabsContent value="expenses">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Expenses</CardTitle>
                    <Button><Plus className="h-4 w-4 mr-2" /> New Expense</Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Expense #</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((exp) => (
                          <TableRow key={exp.id}>
                            <TableCell className="font-medium">{exp.expense_number}</TableCell>
                            <TableCell><Badge variant="outline">{exp.category}</Badge></TableCell>
                            <TableCell>{exp.description}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(exp.amount)}</TableCell>
                            <TableCell><Badge className={getStatusBadge(exp.status)}>{exp.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
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
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Journal Entries</CardTitle>
                    <Button><Plus className="h-4 w-4 mr-2" /> New Entry</Button>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Entry #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Debit</TableHead>
                          <TableHead>Credit</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {journalEntries.map((je) => (
                          <TableRow key={je.id}>
                            <TableCell className="font-medium">{je.entry_number}</TableCell>
                            <TableCell>{new Date(je.entry_date).toLocaleDateString()}</TableCell>
                            <TableCell>{je.description}</TableCell>
                            <TableCell>{formatCurrency(je.total_debit)}</TableCell>
                            <TableCell>{formatCurrency(je.total_credit)}</TableCell>
                            <TableCell>
                              <Badge className={je.is_posted ? getStatusBadge('posted') : getStatusBadge('draft')}>
                                {je.is_posted ? 'Posted' : 'Draft'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
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
                    <Button className="mt-4"><Download className="h-4 w-4 mr-2" /> Import Statement</Button>
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
                  <Button className="mt-4"><Plus className="h-4 w-4 mr-2" /> Add Account</Button>
                </Card>
              </TabsContent>

              <TabsContent value="bank_accounts">
                <Card className="p-8 text-center">
                  <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Cash & Bank Accounts</h3>
                  <p className="text-muted-foreground">Manage bank accounts, mobile money, petty cash</p>
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
      </main>
    </div>
  );
}
