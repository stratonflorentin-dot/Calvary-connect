// Calvary Bank Statement Import - CSV Import & Reconciliation
// For Calvary Investment Company Ltd

"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Upload, Download, FileText, CheckCircle, AlertCircle, ArrowLeft,
  FileSpreadsheet, Table2, DollarSign, Calendar, Hash, ArrowRight,
  RefreshCw, Trash2, Edit, Eye, Check, X, AlertTriangle, Plus,
  CreditCard, Building2, Wallet, ChevronDown, ChevronRight, Search,
  Filter, MoreHorizontal, Printer, Send, Clock, TrendingUp, TrendingDown
} from 'lucide-react';

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

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  reference?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  matched: boolean;
  accountCode?: string;
  transactionType?: 'deposit' | 'withdrawal';
}

interface ImportedTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  description: string;
  reference_number?: string;
  debit_amount?: number;
  credit_amount?: number;
  balance?: number;
  transaction_type: 'deposit' | 'withdrawal';
  reconciled: boolean;
  created_at: string;
}

// Pre-configured mapping rules
const ACCOUNT_MAPPINGS = [
  { keyword: 'fuel', accountCode: '5001', accountName: 'Fuel Expenses' },
  { keyword: 'diesel', accountCode: '5001', accountName: 'Fuel Expenses' },
  { keyword: 'maintenance', accountCode: '6001', accountName: 'Vehicle Maintenance' },
  { keyword: 'repair', accountCode: '6001', accountName: 'Vehicle Maintenance' },
  { keyword: 'driver', accountCode: '5002', accountName: 'Driver Allowances' },
  { keyword: 'allowance', accountCode: '5002', accountName: 'Driver Allowances' },
  { keyword: 'toll', accountCode: '5003', accountName: 'Border & Toll Charges' },
  { keyword: 'border', accountCode: '5003', accountName: 'Border & Toll Charges' },
  { keyword: 'insurance', accountCode: '6002', accountName: 'Vehicle Insurance' },
  { keyword: 'client', accountCode: '1101', accountName: 'Accounts Receivable' },
  { keyword: 'payment', accountCode: '1101', accountName: 'Accounts Receivable' },
  { keyword: 'transfer', accountCode: '1001', accountName: 'Cash - NMB Bank' },
];

export function BankStatementImport() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [importedTransactions, setImportedTransactions] = useState<ImportedTransaction[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showReconcileDialog, setShowReconcileDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('import');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBankAccounts();
    loadImportedTransactions();
  }, []);

  const loadBankAccounts = async () => {
    try {
      const { data } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
      setBankAccounts(data || []);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
      setBankAccounts([]);
    }
  };

  const loadImportedTransactions = async () => {
    try {
      const { data } = await supabase
        .from('bank_statements')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(100);
      setImportedTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setImportedTransactions([]);
    }
  };

  const parseCSV = (content: string): ParsedTransaction[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length < 3 || !values[0]) continue;

      const debit = parseFloat(values[3]) || 0;
      const credit = parseFloat(values[4]) || 0;

      // Auto-match based on description keywords
      const description = values[1] || '';
      const matchedAccount = findMatchingAccount(description);

      transactions.push({
        id: `temp-${i}`,
        date: values[0] || '',
        description: description,
        reference: values[2] || '',
        debit: debit || undefined,
        credit: credit || undefined,
        balance: parseFloat(values[5]) || undefined,
        matched: matchedAccount !== null,
        accountCode: matchedAccount,
        transactionType: credit > 0 ? 'deposit' : 'withdrawal',
      });
    }

    return transactions;
  };

  const findMatchingAccount = (description: string): string | null => {
    const lowerDesc = description.toLowerCase();
    for (const mapping of ACCOUNT_MAPPINGS) {
      if (lowerDesc.includes(mapping.keyword)) {
        return mapping.accountCode;
      }
    }
    return null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const transactions = parseCSV(content);
      setParsedTransactions(transactions);
      toast({ title: 'File Parsed', description: `${transactions.length} transactions found` });
      setIsUploading(false);
      setShowReconcileDialog(true);
    };
    reader.onerror = () => {
      toast({ title: 'Error', description: 'Failed to read file', variant: 'destructive' });
      setIsUploading(false);
    };
    reader.readAsText(uploadedFile);
  };

  const handleImport = async () => {
    if (!selectedAccount || parsedTransactions.length === 0) {
      toast({ title: 'Error', description: 'Please select a bank account and upload a file', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const bankAccount = bankAccounts.find(a => a.id === selectedAccount);
      if (!bankAccount) throw new Error('Bank account not found');

      let currentBalance = bankAccount.current_balance;

      for (const tx of parsedTransactions) {
        const amount = tx.debit || -(tx.credit || 0);
        currentBalance += amount;

        const insertData = {
          bank_account_id: selectedAccount,
          transaction_date: tx.date,
          description: tx.description,
          reference_number: tx.reference,
          debit_amount: tx.debit || null,
          credit_amount: tx.credit || null,
          balance: tx.balance || currentBalance,
          transaction_type: tx.transactionType || (tx.credit > 0 ? 'deposit' : 'withdrawal'),
          reconciled: false,
          created_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('bank_statements').insert([insertData]);
        if (error) console.error('Insert error:', error);
      }

      // Update bank account balance
      await supabase.from('bank_accounts').update({
        current_balance: currentBalance,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedAccount);

      toast({ title: 'Success', description: `${parsedTransactions.length} transactions imported` });

      // Reset
      setFile(null);
      setParsedTransactions([]);
      setShowReconcileDialog(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadBankAccounts();
      loadImportedTransactions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReconcile = async (txId: string, reconciled: boolean) => {
    try {
      await supabase.from('bank_statements').update({ reconciled }).eq('id', txId);
      toast({ title: 'Success', description: `Transaction ${reconciled ? 'reconciled' : 'unreconciled'}` });
      loadImportedTransactions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const downloadTemplate = () => {
    const template = `Date,Description,Reference,Debit,Credit,Balance
2024-02-01,Opening Balance,OPEN,0,0,1000000
2024-02-15,Client Payment - Tata Tanzania,INV001,0,2500000,3500000
2024-02-16,Fuel Purchase - Shell Dar es Salaam,FUEL001,850000,0,2650000
2024-02-17,Driver Allowance Transfer,DA001,350000,0,2300000
2024-02-18,Vehicle Maintenance,MAINT001,250000,0,2050000
2024-02-20,Client Payment - Safari Cement,INV002,0,1800000,3850000`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calvary_bank_statement_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Template Downloaded', description: 'Save the CSV file and fill in your data' });
  };

  const formatCurrency = (amount: number) => `Tsh ${amount.toLocaleString()}`;

  // Filter imported transactions
  const filteredTransactions = importedTransactions.filter(tx => {
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      return (
        tx.description?.toLowerCase().includes(term) ||
        tx.reference_number?.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Stats
  const totalDeposits = importedTransactions.filter(t => t.transaction_type === 'deposit').reduce((sum, t) => sum + (t.credit_amount || 0), 0);
  const totalWithdrawals = importedTransactions.filter(t => t.transaction_type === 'withdrawal').reduce((sum, t) => sum + (t.debit_amount || 0), 0);
  const reconciledCount = importedTransactions.filter(t => t.reconciled).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Bank Statement Import</h1>
                <p className="text-sm text-slate-500">Import and reconcile bank transactions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={loadImportedTransactions} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Refresh
              </Button>
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <Download className="w-4 h-4" /> Download Template
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Deposits</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalDeposits)}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-xl p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-500">Total Withdrawals</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalWithdrawals)}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-500">Reconciled</p>
                <p className="text-xl font-bold text-blue-600">{reconciledCount}/{importedTransactions.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg"><CheckCircle className="w-5 h-5 text-blue-600" /></div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-xl p-4 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Net Cash Flow</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(totalDeposits - totalWithdrawals)}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-lg"><Wallet className="w-5 h-5 text-slate-600" /></div>
            </div>
          </motion.div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import CSV</TabsTrigger>
            <TabsTrigger value="history">Transaction History</TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Upload Bank Statement
                </CardTitle>
                <CardDescription>Select a CSV file exported from your bank</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Bank Account Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Select Bank Account</Label>
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose bank account" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-500" />
                              <span>{acc.bank_name} - ****{acc.account_number}</span>
                              <Badge variant="outline" className="ml-2">{acc.currency}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedAccount && (
                      <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-500">Current Balance</span>
                          <span className="font-bold text-emerald-600">
                            {formatCurrency(bankAccounts.find(a => a.id === selectedAccount)?.current_balance || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Upload CSV File</Label>
                    <div
                      className={cn(
                        'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer hover:bg-slate-50',
                        file ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'
                      )}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      {file ? (
                        <div className="flex items-center justify-center gap-3">
                          <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                          <div className="text-left">
                            <p className="font-semibold text-slate-900">{file.name}</p>
                            <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                          <p className="font-medium text-slate-700">Click to upload CSV file</p>
                          <p className="text-sm text-slate-500 mt-1">or drag and drop</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> How to Import
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                      <li>Download the CSV template using the button above</li>
                      <li>Export your bank statement as CSV (or copy from Excel)</li>
                      <li>Ensure columns are: Date, Description, Reference, Debit, Credit, Balance</li>
                      <li>Select your bank account and upload the file</li>
                      <li>Review and map transactions to accounts</li>
                      <li>Click "Import" to add transactions</li>
                    </ol>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* Format Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table2 className="w-5 h-5 text-violet-600" />
                  CSV Format Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono text-sm">2024-02-15</TableCell>
                        <TableCell>Client Payment - Tata Tanzania</TableCell>
                        <TableCell className="font-mono text-sm">INV001</TableCell>
                        <TableCell className="text-right text-slate-400">-</TableCell>
                        <TableCell className="text-right text-emerald-600">2,500,000</TableCell>
                        <TableCell className="text-right">3,500,000</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-sm">2024-02-16</TableCell>
                        <TableCell>Fuel Purchase - Shell Dar</TableCell>
                        <TableCell className="font-mono text-sm">FUEL001</TableCell>
                        <TableCell className="text-right text-red-600">850,000</TableCell>
                        <TableCell className="text-right text-slate-400">-</TableCell>
                        <TableCell className="text-right">2,650,000</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-slate-500 mt-3">
                  <strong>Note:</strong> Leave Debit empty for deposits, Credit empty for withdrawals. Dates should be in YYYY-MM-DD format.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            {/* Search and Filter */}
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="deposits">Deposits</SelectItem>
                      <SelectItem value="withdrawals">Withdrawals</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="reconciled">Reconciled</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-100 to-slate-50">
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold">Reference</TableHead>
                    <TableHead className="text-right font-semibold">Amount</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((tx) => (
                    <TableRow key={tx.id} className={cn(tx.reconciled ? 'bg-emerald-50/50' : '')}>
                      <TableCell className="font-mono text-sm">
                        {new Date(tx.transaction_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">{tx.description}</TableCell>
                      <TableCell className="font-mono text-sm text-blue-600">{tx.reference_number || '-'}</TableCell>
                      <TableCell className={cn(
                        'text-right font-bold',
                        tx.transaction_type === 'deposit' ? 'text-emerald-600' : 'text-red-600'
                      )}>
                        {tx.transaction_type === 'deposit' ? '+' : '-'}{formatCurrency(tx.credit_amount || tx.debit_amount || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          tx.transaction_type === 'deposit' ? 'text-emerald-600 border-emerald-200' : 'text-red-600 border-red-200'
                        )}>
                          {tx.transaction_type === 'deposit' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {tx.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {tx.reconciled ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3 h-3 mr-1" /> Reconciled
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!tx.reconciled ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => handleReconcile(tx.id, true)}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => handleReconcile(tx.id, false)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p className="text-lg font-medium">No transactions found</p>
                        <p className="text-sm">Import a bank statement to get started</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Reconcile Dialog */}
      <Dialog open={showReconcileDialog} onOpenChange={setShowReconcileDialog}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Review & Import Transactions
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-semibold">{parsedTransactions.length} transactions found</p>
                <p className="text-sm text-slate-500">
                  From: {bankAccounts.find(a => a.id === selectedAccount)?.bank_name}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-emerald-600 font-semibold">
                    +{formatCurrency(parsedTransactions.filter(t => t.credit).reduce((sum, t) => sum + (t.credit || 0), 0))}
                  </span>
                  <span className="text-slate-500 ml-1">deposits</span>
                </div>
                <div>
                  <span className="text-red-600 font-semibold">
                    -{formatCurrency(parsedTransactions.filter(t => t.debit).reduce((sum, t) => sum + (t.debit || 0), 0))}
                  </span>
                  <span className="text-slate-500 ml-1">withdrawals</span>
                </div>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Mapped Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedTransactions.map((tx, index) => {
                  const mapping = ACCOUNT_MAPPINGS.find(m => tx.description.toLowerCase().includes(m.keyword));

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-sm">{tx.date}</TableCell>
                      <TableCell className="font-medium">{tx.description}</TableCell>
                      <TableCell className="font-mono text-sm text-blue-600">{tx.reference || '-'}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {tx.debit ? formatCurrency(tx.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {tx.credit ? formatCurrency(tx.credit) : '-'}
                      </TableCell>
                      <TableCell>
                        {tx.matched ? (
                          <Badge className="bg-blue-100 text-blue-700">
                            {mapping?.accountCode} - {mapping?.accountName}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Unmapped</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Button
              onClick={handleImport}
              disabled={isUploading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Import {parsedTransactions.length} Transactions
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}